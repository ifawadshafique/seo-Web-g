import { observeCsp } from "./csp-audit";
import { deliverOutboxMail } from "./mail-outbox";
import prisma from "./prisma";
import { siteSettings } from "./settings";
import { plainText } from "./content-validation";
export async function runWorker() {
  await observeCsp();
  const startedAt = new Date();
  await prisma.workerRun.upsert({
    where: { key: "publishing" },
    create: { key: "publishing", startedAt },
    update: { startedAt, completedAt: null, error: null },
  });
  let published = 0;
  let failed = 0;
  try {
    for (let i = 0; i < 50; i++) {
      let taskId: number | undefined;
      try {
        const result = await prisma.$transaction(async (tx) => {
          const tasks = await tx.$queryRaw<
            { id: number }[]
          >`SELECT id FROM "PublishTask" WHERE state IN ('PENDING','RETRY') AND "nextAttemptAt" <= (now() AT TIME ZONE 'UTC') ORDER BY "runAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
          if (!tasks.length) return "empty";
          taskId = tasks[0].id;
          const task = await tx.publishTask.findUniqueOrThrow({
            where: { id: taskId },
            include: { post: { include: { jobDetails: true } } },
          });
          const post = task.post;
          if (
            post.status !== "SCHEDULED" ||
            post.deletedAt ||
            !post.scheduledAt ||
            +post.scheduledAt !== +task.runAt
          ) {
            await tx.publishTask.update({
              where: { id: task.id },
              data: { state: "CANCELLED", finishedAt: new Date() },
            });
            return "cancelled";
          }
          if (
            !plainText(post.body) ||
            /\bguaranteed\b|100\s*%\s*visa/i.test(
              plainText(post.body) + " " + post.title,
            )
          )
            throw new Error("Publication validation failed");
          if (
            await tx.jobReport.count({
              where: { postId: post.id, status: "UNDER_REVIEW" },
            })
          )
            throw new Error("Listing is under moderation");
          if (post.contentType === "JOB") {
            const job = post.jobDetails;
            if (
              !job?.employerName ||
              !job.applicationUrl.startsWith("https://") ||
              !job.sourceUrl.startsWith("https://") ||
              !job.linkAttestedAt ||
              !job.linkAttestedBy ||
              !job.location ||
              !job.country ||
              !job.employmentType
            )
              throw new Error("Publication validation failed");
          }
          const changed = await tx.post.updateMany({
            where: {
              id: post.id,
              status: "SCHEDULED",
              deletedAt: null,
              scheduledAt: { lte: new Date() },
            },
            data: {
              status: "PUBLISHED",
              publishedAt: post.publishedAt ?? new Date(),
              updatedAt: new Date(),
            },
          });
          if (changed.count !== 1) throw new Error("Publication state changed");
          await tx.publishTask.update({
            where: { id: task.id },
            data: {
              state: "DONE",
              attempts: { increment: 1 },
              finishedAt: new Date(),
              lastError: null,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: post.authorId,
              action: "POST_SCHEDULED_PUBLISHED",
              entityType: "Post",
              entityId: post.id,
            },
          });
          return "published";
        });
        if (result === "empty") break;
        if (result === "published") published++;
      } catch {
        failed++;
        if (taskId) {
          await prisma.$transaction(async (tx) => {
            const task = await tx.publishTask.findUniqueOrThrow({
              where: { id: taskId },
            });
            if (!["PENDING", "RETRY"].includes(task.state)) return;
            const attempts = task.attempts + 1;
            await tx.publishTask.update({
              where: { id: taskId },
              data: {
                state: attempts >= 5 ? "FAILED" : "RETRY",
                attempts,
                lastError:
                  "Scheduled publication failed; review post validation and database health",
                nextAttemptAt: new Date(
                  Date.now() + Math.min(3600000, 30000 * 2 ** attempts),
                ),
              },
            });
            // A durable alert is queued on the first failure and final failure.
            if (attempts === 1 || attempts === 5)
              await tx.mailOutbox.create({
                data: {
                  subject: "Scheduled publication needs attention",
                  text: `Post ${task.postId}, task ${task.id}, attempt ${attempts}. Review the administration inbox.`,
                },
              });
          });
        }
      }
    }
    const settings = await siteSettings();
    const expired = await prisma.jobDetails.findMany({
      where: { jobStatus: "OPEN", closingDate: { lte: new Date() } },
      select: { postId: true },
    });
    for (const job of expired)
      await prisma.$transaction(async (tx) => {
        const changed = await tx.jobDetails.updateMany({
          where: {
            postId: job.postId,
            jobStatus: "OPEN",
            closingDate: { lte: new Date() },
          },
          data: { jobStatus: "EXPIRED", jobStatusChangedAt: new Date() },
        });
        if (changed.count) {
          const post = await tx.post.findUniqueOrThrow({
            where: { id: job.postId },
          });
          await tx.post.update({
            where: { id: job.postId },
            data: {
              updatedAt: new Date(),
              ...(settings.expired_job_policy === "archive"
                ? { status: "ARCHIVED" as const }
                : {}),
              ...(settings.expired_job_policy === "remove"
                ? { deletedAt: new Date(), status: "UNPUBLISHED" as const }
                : {}),
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: post.authorId,
              action: "JOB_EXPIRED",
              entityType: "Post",
              entityId: post.id,
            },
          });
        }
      });
    const overdue = await prisma.jobReport.count({
      where: {
        status: { in: ["PENDING", "UNDER_REVIEW"] },
        createdAt: { lte: new Date(Date.now() - 48 * 3600000) },
      },
    });
    if (overdue) {
      const key = "moderation-overdue-" + new Date().toISOString().slice(0, 10);
      const bucket = await prisma.loginBucket.upsert({
        where: { key },
        create: { key, expiresAt: new Date(Date.now() + 86400000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count === 1)
        await prisma.mailOutbox.create({
          data: {
            subject: "Listing reports are overdue for review",
            text: `${overdue} listing report(s) have waited at least 48 hours. Review the private moderation panel.`,
          },
        });
    }
    await prisma.trafficEvent.deleteMany({
      where: { lastSeenAt: { lt: new Date(Date.now() - 90 * 86400000) } },
    });
    await prisma.cspViolation.deleteMany({
      where: { lastSeenAt: { lt: new Date(Date.now() - 90 * 86400000) } },
    });
    // Contact data is kept no longer than twelve months.
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    await prisma.contactMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    await prisma.mailOutbox.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    await prisma.loginBucket.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    for (let i = 0; i < 30; i++) {
      const sent = await deliverOutboxMail();
      if (!sent) break;
    }
    await prisma.workerRun.update({
      where: { key: "publishing" },
      data: {
        completedAt: new Date(),
        error: failed ? `${failed} publication task(s) failed` : null,
      },
    });
    return { published, failed, expired: expired.length };
  } catch (error) {
    await prisma.workerRun
      .update({
        where: { key: "publishing" },
        data: {
          error: "Worker interrupted; inspect database and restart",
          completedAt: new Date(),
        },
      })
      .catch(() => {});
    throw error;
  }
}

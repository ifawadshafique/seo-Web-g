import { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import prisma from "./prisma";

export function deliverOutboxMail(id?: number) {
  return prisma.$transaction(
    async (tx) => {
      const target =
        id === undefined ? Prisma.empty : Prisma.sql` AND id = ${id}`;
      const rows = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM "MailOutbox" WHERE state IN ('PENDING','RETRY') AND "nextAttemptAt" <= (now() AT TIME ZONE 'UTC') ${target} ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return false;
      const mail = await tx.mailOutbox.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      if (process.env.APP_ENV === "local" && !process.env.SMTP_URL) {
        await tx.mailOutbox.update({
          where: { id: mail.id },
          data: { state: "LOCAL" },
        });
        return true;
      }
      try {
        if (
          !process.env.SMTP_URL ||
          !process.env.CONTACT_TO ||
          !process.env.MAIL_FROM
        )
          throw new Error("Mail is not configured");
        const smtp = new URL(process.env.SMTP_URL);
        if (!["smtp:", "smtps:"].includes(smtp.protocol))
          throw new Error("Invalid SMTP protocol");
        const transport = nodemailer.createTransport({
          host: smtp.hostname,
          port: Number(smtp.port || (smtp.protocol === "smtps:" ? 465 : 587)),
          secure: smtp.protocol === "smtps:",
          auth: smtp.username
            ? {
                user: decodeURIComponent(smtp.username),
                pass: decodeURIComponent(smtp.password),
              }
            : undefined,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });
        await transport.sendMail({
          from: process.env.MAIL_FROM,
          to: process.env.CONTACT_TO,
          replyTo: mail.replyTo ?? undefined,
          subject: mail.subject,
          text: mail.text,
        });
        await tx.mailOutbox.update({
          where: { id: mail.id },
          data: { state: "SENT", sentAt: new Date(), lastError: null },
        });
      } catch {
        const attempts = mail.attempts + 1;
        await tx.mailOutbox.update({
          where: { id: mail.id },
          data: {
            attempts,
            state: attempts >= 5 ? "FAILED" : "RETRY",
            lastError: "Mail delivery failed; check SMTP configuration",
            nextAttemptAt: new Date(Date.now() + 60000 * 2 ** attempts),
          },
        });
      }
      return true;
    },
    { timeout: 15000 },
  );
}

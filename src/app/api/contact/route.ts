import { boundedJson } from "@/lib/request-body";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sameOrigin, AuthError } from "@/lib/auth";
import { digest } from "@/lib/security";
import { contentResult, ContentError } from "@/lib/api-error";
import { deliverOutboxMail } from "@/lib/mail-outbox";
import { after } from "next/server";

export const maxDuration = 20;

const input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).default(""),
  startedAt: z.number(),
});
export async function POST(request: Request) {
  return contentResult(async () => {
    try {
      sameOrigin(request);
    } catch (error) {
      if (error instanceof AuthError)
        return Response.json({ error: "Invalid request" }, { status: 403 });
      throw error;
    }
    if (Number(request.headers.get("content-length")) > 20000)
      throw new ContentError("Message is too large");
    const data = input.parse(await boundedJson(request));
    if (
      data.website ||
      Date.now() - data.startedAt < 2000 ||
      Date.now() - data.startedAt > 86400000
    )
      throw new ContentError("Please wait a moment and submit the form again");
    const ip =
      process.env.TRUST_PROXY === "true"
        ? (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown")
        : "local";
    const key = digest(`contact:${ip}:${Math.floor(Date.now() / 3600000)}`);
    const bucket = await prisma.loginBucket.upsert({
      where: { key },
      create: { key, expiresAt: new Date(Date.now() + 3600000) },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > 5)
      throw new ContentError("Too many messages. Please try again later", 429);
    const mail = await prisma.$transaction(async (tx) => {
      await tx.contactMessage.create({
        data: { name: data.name, email: data.email, message: data.message },
      });
      return tx.mailOutbox.create({
        data: {
          subject: "Website contact message",
          replyTo: data.email,
          text: `From: ${data.name}\nEmail: ${data.email}\n\n${data.message}`,
        },
        select: { id: true },
      });
    });
    if (process.env.SMTP_URL && process.env.CONTACT_TO && process.env.MAIL_FROM)
      after(async () => {
        await deliverOutboxMail(mail.id);
      });
    return Response.json({ ok: true }, { status: 202 });
  });
}

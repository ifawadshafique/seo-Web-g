import { cache } from "react";
import prisma from "./prisma";
import { cspPolicy, policyHash, stagingEvidenceValid } from "./csp";
export const currentPolicyHash = () => policyHash(cspPolicy("NONCE"));
export async function observeCsp() {
  if (process.env.CSP_MODE === "off" && process.env.APP_ENV === "local") return;
  const environment = process.env.APP_ENV ?? "local",
    hash = currentPolicyHash(),
    id = environment + "-" + hash;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.cspAudit.upsert({
      where: { id },
      create: { id, environment, policyHash: hash },
      update: {},
    });
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "CspAudit" WHERE id=${id} FOR UPDATE`;
    if (!rows.length) return;
    const old = await tx.cspAudit.findUniqueOrThrow({ where: { id } });
    const interrupted = now.getTime() - old.lastSeenAt.getTime() > 10 * 60000;
    await tx.cspAudit.update({
      where: { id },
      data: {
        lastSeenAt: now,
        ...(interrupted
          ? {
              startedAt: now,
              reviewedAt: null,
              reviewedBy: null,
              reviewNote: null,
            }
          : {}),
      },
    });
  });
}
export const cspStatus = cache(async () => {
  const hash = currentPolicyHash(),
    environment = process.env.APP_ENV ?? "local";
  const record = await prisma.cspAudit.findUnique({
    where: { id: environment + "-" + hash },
  });
  const unreviewedViolations = await prisma.cspViolation.count({
    where: {
      policyHash: hash,
      reviewedAt: null,
      ...(record ? { lastSeenAt: { gte: record.startedAt } } : {}),
    },
  });
  return {
    hash,
    environment,
    record,
    unreviewedViolations,
    daysObserved: record
      ? Math.max(0, (Date.now() - record.startedAt.getTime()) / 86400000)
      : 0,
  };
});
export async function effectiveCspMode() {
  if (process.env.CSP_MODE === "off" && process.env.APP_ENV === "local")
    return "off";
  if (process.env.CSP_MODE !== "enforce") return "report-only";
  const hash = currentPolicyHash();
  if (process.env.APP_ENV === "production")
    return stagingEvidenceValid(process.env.CSP_STAGING_EVIDENCE, hash)
      ? "enforce"
      : "report-only";
  const state = await cspStatus();
  return state.environment === "staging" &&
    state.record?.reviewedAt &&
    state.daysObserved >= 7 &&
    state.unreviewedViolations === 0 &&
    Date.now() - state.record.lastSeenAt.getTime() < 10 * 60000
    ? "enforce"
    : "report-only";
}

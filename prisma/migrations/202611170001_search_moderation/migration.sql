ALTER TABLE "JobReport" ADD COLUMN "post_url" TEXT, ADD COLUMN "resolution" TEXT;
CREATE TABLE "TrafficEvent" (
 "key" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "path" TEXT NOT NULL, "target" TEXT, "status" INTEGER NOT NULL,
 "hits" INTEGER NOT NULL DEFAULT 1, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TrafficEvent_kind_lastSeenAt_idx" ON "TrafficEvent" ("kind", "lastSeenAt");
CREATE TABLE "CspViolation" (
 "key" TEXT PRIMARY KEY, "policyHash" TEXT NOT NULL, "reviewedAt" TIMESTAMP(3), "reviewNote" TEXT, "directive" TEXT NOT NULL, "blockedOrigin" TEXT NOT NULL, "disposition" TEXT NOT NULL, "path" TEXT NOT NULL,
 "hits" INTEGER NOT NULL DEFAULT 1, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CspAudit" (
 "id" TEXT PRIMARY KEY, "environment" TEXT NOT NULL, "policyHash" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedAt" TIMESTAMP(3), "reviewedBy" INTEGER, "reviewNote" TEXT
);
CREATE INDEX "CspAudit_environment_policyHash_startedAt_idx" ON "CspAudit" ("environment", "policyHash", "startedAt");
CREATE INDEX "JobReport_status_createdAt_idx" ON "JobReport" ("status", "created_at");

ALTER TABLE "Category" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Tag" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';

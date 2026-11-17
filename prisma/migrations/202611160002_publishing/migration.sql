-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "ogMediaId" INTEGER;

-- CreateTable
CREATE TABLE "PublishTask" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PublishTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailOutbox" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "replyTo" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRun" (
    "key" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "WorkerRun_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublishTask_postId_key" ON "PublishTask"("postId");

-- CreateIndex
CREATE INDEX "PublishTask_state_nextAttemptAt_idx" ON "PublishTask"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MailOutbox_state_nextAttemptAt_idx" ON "MailOutbox"("state", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_ogMediaId_fkey" FOREIGN KEY ("ogMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishTask" ADD CONSTRAINT "PublishTask_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublishTask" ADD CONSTRAINT publish_task_state CHECK (state IN ('PENDING','RETRY','FAILED','DONE','CANCELLED'));
ALTER TABLE "MailOutbox" ADD CONSTRAINT mail_outbox_state CHECK (state IN ('PENDING','RETRY','FAILED','SENT','LOCAL'));
ALTER TABLE "PublishTask" ADD CONSTRAINT publish_task_attempts CHECK (attempts >= 0);

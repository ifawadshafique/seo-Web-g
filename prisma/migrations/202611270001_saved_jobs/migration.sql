CREATE TABLE "SavedJob" (
    "memberUid" VARCHAR(128) NOT NULL,
    "postId" INTEGER NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("memberUid", "postId"),
    CONSTRAINT "SavedJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SavedJob_memberUid_savedAt_idx" ON "SavedJob"("memberUid", "savedAt");
CREATE INDEX "SavedJob_postId_idx" ON "SavedJob"("postId");

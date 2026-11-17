-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('JOB', 'ARTICLE');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'EXPIRED', 'FILLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'VERIFIED');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Device" AS ENUM ('ALL', 'MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "mfaSecret" TEXT,
    "mfaLastStep" BIGINT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "author_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "featured_media_id" INTEGER,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "canonical_url" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "ads_enabled" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDetails" (
    "post_id" INTEGER NOT NULL,
    "employer_name" TEXT NOT NULL,
    "location" TEXT,
    "country" TEXT,
    "workplace_type" TEXT,
    "employment_type" TEXT,
    "salary_min" DOUBLE PRECISION,
    "salary_max" DOUBLE PRECISION,
    "salary_currency" TEXT,
    "salary_period" TEXT,
    "closing_date" TIMESTAMP(3),
    "job_status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "job_status_changed_at" TIMESTAMP(3),
    "application_url" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "link_attested_by" TEXT,
    "link_attested_at" TIMESTAMP(3),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'NONE',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_note" TEXT,

    CONSTRAINT "JobDetails_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "post_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" INTEGER NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSlot" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "slot_id" TEXT,
    "placement" TEXT,
    "sizes" TEXT,
    "min_height" INTEGER,
    "device" "Device" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "AdSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" SERIAL NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "JobReport" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "reporter_note" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "JobReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "enrollmentSecret" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "hash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "LoginBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_status_published_at_idx" ON "Post"("status", "published_at");

-- CreateIndex
CREATE INDEX "Post_scheduled_at_idx" ON "Post"("scheduled_at");

-- CreateIndex
CREATE INDEX "Post_author_id_idx" ON "Post"("author_id");

-- CreateIndex
CREATE INDEX "Post_category_id_idx" ON "Post"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_from_path_key" ON "Redirect"("from_path");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_featured_media_id_fkey" FOREIGN KEY ("featured_media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDetails" ADD CONSTRAINT "JobDetails_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SRS DM-9: reject invalid amounts even outside the application.
ALTER TABLE "JobDetails" ADD CONSTRAINT "salary_range" CHECK (
  (salary_min IS NULL OR salary_min >= 0) AND
  (salary_max IS NULL OR salary_max >= 0) AND
  (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min)
);
CREATE INDEX "Post_search_idx" ON "Post" USING GIN
  (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || body));
CREATE INDEX "JobDetails_status_closing_idx" ON "JobDetails" (job_status, closing_date);
CREATE INDEX "JobReport_postId_idx" ON "JobReport" (post_id);
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(email));
CREATE UNIQUE INDEX "Post_slug_lower_key" ON "Post" (lower(slug));
CREATE UNIQUE INDEX "Page_slug_lower_key" ON "Page" (lower(slug));
-- One registry serializes cross-table slug ownership, including concurrent writes.
CREATE TABLE "SlugRegistry" (slug text PRIMARY KEY, owner_type text NOT NULL);
CREATE FUNCTION reserve_content_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(NEW.slug) > 75 OR
     NEW.slug IN ('admin','api','category','tag','search','sitemap','robots','feed','ads','login','_next') THEN
    RAISE EXCEPTION 'Invalid or reserved slug';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.slug = NEW.slug THEN RETURN NEW; END IF;
  INSERT INTO "SlugRegistry" (slug, owner_type) VALUES (NEW.slug, TG_TABLE_NAME);
  IF TG_OP = 'UPDATE' THEN DELETE FROM "SlugRegistry" WHERE slug = OLD.slug; END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION release_content_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM "SlugRegistry" WHERE slug = OLD.slug; RETURN OLD; END $$;
CREATE TRIGGER post_slug BEFORE INSERT OR UPDATE OF slug ON "Post" FOR EACH ROW EXECUTE FUNCTION reserve_content_slug();
CREATE TRIGGER page_slug BEFORE INSERT OR UPDATE OF slug ON "Page" FOR EACH ROW EXECUTE FUNCTION reserve_content_slug();
CREATE TRIGGER post_slug_delete AFTER DELETE ON "Post" FOR EACH ROW EXECUTE FUNCTION release_content_slug();
CREATE TRIGGER page_slug_delete AFTER DELETE ON "Page" FOR EACH ROW EXECUTE FUNCTION release_content_slug();

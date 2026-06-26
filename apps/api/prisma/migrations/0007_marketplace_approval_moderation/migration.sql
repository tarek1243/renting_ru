CREATE TYPE "Gender" AS ENUM ('male', 'female');
CREATE TYPE "OwnerApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE "ListingModerationStatus" AS ENUM ('not_checked', 'passed', 'flagged', 'failed');

ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'ai_flagged';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "users"
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "owner_approval_status" "OwnerApprovalStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "owner_reviewed_by_id" UUID,
  ADD COLUMN "owner_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "owner_reject_reason" TEXT;

UPDATE "users" SET "owner_approval_status" = 'approved';

ALTER TABLE "listings"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "with_driver_available" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "self_drive_available" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "moderation_status" "ListingModerationStatus" NOT NULL DEFAULT 'not_checked',
  ADD COLUMN "moderation_warnings" JSONB,
  ADD COLUMN "reviewed_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reject_reason" TEXT;

CREATE INDEX "users_gender_idx" ON "users"("gender");
CREATE INDEX "users_owner_approval_status_idx" ON "users"("owner_approval_status");
CREATE INDEX "listings_status_moderation_status_idx" ON "listings"("status", "moderation_status");
CREATE INDEX "listings_city_neighborhood_idx" ON "listings"("city", "neighborhood");

-- DB-level guarantees that Prisma's schema language cannot express.

-- 1. Range-exclusion: overlapping availability blocks for the same listing are
--    rejected by Postgres itself (error 23P01), even under concurrent inserts.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Columns are timestamp(3) (Prisma DateTime, stored as UTC), so tsrange is the
-- matching — and immutable — range type.
ALTER TABLE "availability_blocks"
  ADD COLUMN "period" tsrange
  GENERATED ALWAYS AS (tsrange("start_at", "end_at", '[)')) STORED;

ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_no_overlap"
  EXCLUDE USING gist ("listing_id" WITH =, "period" WITH &&);

ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_valid_period" CHECK ("end_at" > "start_at");

-- 2. JSONB attribute filtering: GIN index so category searches like
--    attributes @> '{"transmission":"automatic"}' stay fast at scale.
CREATE INDEX "listings_attributes_gin" ON "listings" USING gin ("attributes" jsonb_path_ops);

-- 3. Full-text search over listing titles (all locales concatenated).
CREATE INDEX "listings_title_trgm" ON "listings" USING gin ((lower("title"::text)) gin_trgm_ops);

-- 4. Sanity checks.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_period" CHECK ("end_at" > "start_at");
ALTER TABLE "reviews"  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews"  ADD CONSTRAINT "reviews_driver_rating_range"
  CHECK ("driver_rating" IS NULL OR "driver_rating" BETWEEN 1 AND 5);

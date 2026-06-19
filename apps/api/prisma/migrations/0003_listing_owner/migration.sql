ALTER TABLE "listings" ADD COLUMN "owner_id" UUID;

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "listings_owner_id_idx" ON "listings"("owner_id");

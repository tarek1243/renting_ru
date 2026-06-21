ALTER TABLE "bookings"
  ADD COLUMN "pickup_address" TEXT,
  ADD COLUMN "dropoff_address" TEXT,
  ADD COLUMN "recurring_series_id" UUID;

CREATE INDEX "bookings_recurring_series_id_start_at_idx"
  ON "bookings"("recurring_series_id", "start_at");

CREATE TYPE "TransportationNeedStatus" AS ENUM ('open', 'reviewing', 'matched', 'closed', 'cancelled');

CREATE TABLE "transportation_needs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "customer_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "status" "TransportationNeedStatus" NOT NULL DEFAULT 'open',
  "internal_note" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "transportation_needs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transportation_needs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "transportation_needs_code_key" ON "transportation_needs"("code");
CREATE INDEX "transportation_needs_customer_id_created_at_idx" ON "transportation_needs"("customer_id", "created_at");
CREATE INDEX "transportation_needs_status_created_at_idx" ON "transportation_needs"("status", "created_at");

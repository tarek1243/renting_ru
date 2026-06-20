CREATE TABLE "media_blobs" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "mime_type"  TEXT        NOT NULL,
  "data"       BYTEA       NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "media_blobs_pkey" PRIMARY KEY ("id")
);

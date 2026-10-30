-- Website CMS: key/value settings edited from Platform Admin -> Website.
-- Non-destructive. Rollback: DROP TABLE "site_settings";
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" varchar(100) PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updated_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "claims" ADD COLUMN "diagnosis_code" varchar(100);--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "location" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb;
CREATE TABLE "era_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"file_data" text NOT NULL,
	"payer_name" varchar(255),
	"payment_date" date,
	"check_number" varchar(100),
	"total_payment" numeric(12, 2),
	"total_claims" integer DEFAULT 0,
	"matched_claims" integer DEFAULT 0,
	"unmatched_claims" integer DEFAULT 0,
	"posted_claims" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'uploaded' NOT NULL,
	"processed_at" timestamp,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "era_files_file_hash_unique" UNIQUE("file_hash")
);
--> statement-breakpoint
CREATE TABLE "era_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"era_file_id" uuid NOT NULL,
	"claim_id" uuid,
	"claim_number" varchar(100),
	"patient_name" varchar(255),
	"date_of_service" date,
	"cpt_code" varchar(20),
	"billed_amount" numeric(12, 2),
	"allowed_amount" numeric(12, 2),
	"paid_amount" numeric(12, 2),
	"contractual_adjustment" numeric(12, 2),
	"patient_responsibility" numeric(12, 2),
	"other_adjustment" numeric(12, 2),
	"carc_code" varchar(20),
	"rarc_code" varchar(20),
	"remark_text" text,
	"match_status" varchar(20) DEFAULT 'unmatched' NOT NULL,
	"post_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" date,
	"gender" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"phone" varchar(50),
	"email" varchar(255),
	"member_id" varchar(100),
	"group_number" varchar(100),
	"subscriber_name" varchar(255),
	"relationship_to_subscriber" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"insurance_payment" numeric(12, 2) DEFAULT '0',
	"contractual_adjustment" numeric(12, 2) DEFAULT '0',
	"other_adjustment" numeric(12, 2) DEFAULT '0',
	"patient_responsibility" numeric(12, 2) DEFAULT '0',
	"denial_amount" numeric(12, 2) DEFAULT '0',
	"carc_code" varchar(20),
	"rarc_code" varchar(20),
	"remarks" text,
	"posted_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"payer_name" varchar(255),
	"payment_date" date NOT NULL,
	"check_number" varchar(100),
	"total_amount" numeric(12, 2) NOT NULL,
	"allocated_amount" numeric(12, 2) DEFAULT '0',
	"unallocated_amount" numeric(12, 2),
	"era_file_id" uuid,
	"notes" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"posted_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrubbing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'error' NOT NULL,
	"field_to_check" varchar(100) NOT NULL,
	"validation_type" varchar(50) NOT NULL,
	"validation_value" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "patient_id" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "practice_id" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "workflow_status" varchar(50) DEFAULT 'unworked' NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "claim_insurance_status" varchar(50);--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "worked_by" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "submitted_for_approval_at" timestamp;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "rework_reason" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "rework_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "era_files" ADD CONSTRAINT "era_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "era_transactions" ADD CONSTRAINT "era_transactions_era_file_id_era_files_id_fk" FOREIGN KEY ("era_file_id") REFERENCES "public"."era_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "era_transactions" ADD CONSTRAINT "era_transactions_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_worked_by_users_id_fk" FOREIGN KEY ("worked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
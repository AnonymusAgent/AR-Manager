CREATE TYPE "public"."auth_status" AS ENUM('pending', 'in_progress', 'completed', 'denied', 'expired');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('new', 'assigned', 'in_progress', 'pending', 'submitted_for_review', 'approved', 'rework_required', 'paid', 'denied', 'closed', 'sent_to_coding', 'coding_review', 'coding_corrected', 'returned_to_billing', 'resubmitted');--> statement-breakpoint
CREATE TYPE "public"."coding_status" AS ENUM('sent_to_coding', 'under_review', 'corrected', 'returned_to_billing', 'resubmitted');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_assignment', 'claim_submitted', 'review_completed', 'claim_approved', 'claim_rejected', 'rework_requested', 'task_assigned', 'practice_assigned', 'document_approved', 'document_rejected', 'signoff_pending', 'signoff_approved', 'signoff_rejected', 'supervisor_comment', 'system');--> statement-breakpoint
CREATE TYPE "public"."responsibility" AS ENUM('accounts_receivable', 'charge_entry', 'payment_posting', 'prior_authorization', 'referral_management', 'verification_of_benefits', 'full_practice_management');--> statement-breakpoint
CREATE TYPE "public"."signoff_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('prior_authorization', 'referral_management', 'verification_of_benefits', 'charge_entry', 'payment_posting', 'custom');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('new', 'assigned', 'in_progress', 'pending', 'completed', 'submitted_for_signoff', 'signed_off', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('administrator', 'supervisor', 'manager', 'senior_lead', 'team_lead', 'ar_executive', 'billing_user');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"permissions" jsonb,
	"organization_id" uuid,
	"created_by" uuid NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"previous_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" uuid NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_name" varchar(255) NOT NULL,
	"insurance_name" varchar(255) NOT NULL,
	"auth_number" varchar(100),
	"status" "auth_status" DEFAULT 'pending' NOT NULL,
	"date_obtained" date,
	"expiration_date" date,
	"service_requested" text,
	"cpt_codes" text,
	"diagnosis_codes" text,
	"notes" text,
	"claim_id" uuid,
	"practice_id" uuid,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp,
	"completed_at" timestamp,
	"completed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" "task_category" NOT NULL,
	"status" "task_status" DEFAULT 'new' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"practice_id" uuid,
	"claim_id" uuid,
	"patient_name" varchar(255),
	"patient_dob" date,
	"insurance_name" varchar(255),
	"member_id" varchar(100),
	"auth_number" varchar(100),
	"referral_number" varchar(100),
	"service_date" date,
	"expiration_date" date,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp,
	"completed_at" timestamp,
	"completed_by" uuid,
	"due_date" date,
	"notes" text,
	"result" text,
	"additional_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"channel_type" varchar(20) DEFAULT 'direct' NOT NULL,
	"department" varchar(100),
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar(20) DEFAULT 'text' NOT NULL,
	"file_name" varchar(500),
	"file_data" text,
	"file_mime_type" varchar(100),
	"related_claim_id" uuid,
	"is_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"action_performed" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"previous_status" "claim_status",
	"new_status" "claim_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" varchar(100) NOT NULL,
	"account_number" varchar(100),
	"patient_name" varchar(255),
	"date_of_service" date,
	"cpt_codes" text,
	"provider" varchar(255),
	"insurance" varchar(255),
	"payer" varchar(255),
	"billed_amount" numeric(12, 2),
	"paid_amount" numeric(12, 2),
	"balance" numeric(12, 2),
	"status" "claim_status" DEFAULT 'new' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"uploaded_file_id" uuid,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_comments" text,
	"denial_code_id" integer,
	"denial_reason" text,
	"sub_status" varchar(100),
	"worked_date" timestamp,
	"follow_up_date" date,
	"approved_by" uuid,
	"approved_at" timestamp,
	"additional_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coding_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coding_request_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coding_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"status" "coding_status" DEFAULT 'sent_to_coding' NOT NULL,
	"denial_reason" text,
	"comments" text,
	"correction_notes" text,
	"sent_by" uuid NOT NULL,
	"assigned_to" uuid,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "denial_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"denial_code_id" integer,
	"denial_code" varchar(20),
	"analysis_result" jsonb,
	"likely_reason" text,
	"recommended_actions" jsonb,
	"recovery_potential" varchar(20),
	"priority_score" integer,
	"confidence_score" numeric(5, 2),
	"historical_match_count" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"action_taken" text,
	"outcome" varchar(50),
	"analyzed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "denial_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"code_type" varchar(10) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "denial_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "e_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"document_title" varchar(500) NOT NULL,
	"document_content" text,
	"signature_data" text NOT NULL,
	"signer_name" varchar(255) NOT NULL,
	"signer_role" varchar(100),
	"signer_email" varchar(255),
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"related_claim_id" uuid,
	"related_entity_type" varchar(50),
	"related_entity_id" uuid,
	"signed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"related_claim_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"document_type" varchar(100),
	"extracted_data" jsonb,
	"raw_text" text,
	"confidence" numeric(5, 2),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"applied_to_claim_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" varchar(500),
	"primary_color" varchar(7),
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"tax_id" varchar(20),
	"npi" varchar(20),
	"subscription_tier" varchar(20) DEFAULT 'standard',
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payer_portals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payer_name" varchar(255) NOT NULL,
	"payer_code" varchar(50) NOT NULL,
	"payer_id" varchar(100),
	"portal_url" varchar(500),
	"api_endpoint" varchar(500),
	"auth_method" varchar(50) DEFAULT 'none',
	"credentials" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_configured" boolean DEFAULT false NOT NULL,
	"supports_eligibility" boolean DEFAULT false,
	"supports_claim_status" boolean DEFAULT false,
	"supports_era" boolean DEFAULT false,
	"supports_auth" boolean DEFAULT false,
	"last_tested_at" timestamp,
	"last_test_status" varchar(20),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payer_portals_payer_code_unique" UNIQUE("payer_code")
);
--> statement-breakpoint
CREATE TABLE "portal_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payer_portal_id" uuid NOT NULL,
	"interaction_type" varchar(50) NOT NULL,
	"claim_id" uuid,
	"request_data" jsonb,
	"response_data" jsonb,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"npi" varchar(20),
	"tax_id" varchar(20),
	"specialty" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "practices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"task_id" uuid,
	"claim_id" uuid,
	"status" "signoff_status" DEFAULT 'pending' NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"submission_notes" text,
	"is_automatic" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer,
	"uploaded_by" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_comments" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"is_supervisor_comment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"previous_status" "task_status",
	"new_status" "task_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"total_records" integer DEFAULT 0,
	"processed_records" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_practice_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"responsibilities" text[],
	"is_primary" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_responsibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"responsibility" "responsibility" NOT NULL,
	"assigned_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'ar_executive' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"team_lead_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_documents" ADD CONSTRAINT "auth_documents_auth_id_authorizations_id_fk" FOREIGN KEY ("auth_id") REFERENCES "public"."authorizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_documents" ADD CONSTRAINT "auth_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tasks" ADD CONSTRAINT "billing_tasks_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tasks" ADD CONSTRAINT "billing_tasks_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tasks" ADD CONSTRAINT "billing_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tasks" ADD CONSTRAINT "billing_tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tasks" ADD CONSTRAINT "billing_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_related_claim_id_claims_id_fk" FOREIGN KEY ("related_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_notes" ADD CONSTRAINT "claim_notes_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_notes" ADD CONSTRAINT "claim_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_status_history" ADD CONSTRAINT "claim_status_history_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_status_history" ADD CONSTRAINT "claim_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_uploaded_file_id_uploaded_files_id_fk" FOREIGN KEY ("uploaded_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_denial_code_id_denial_codes_id_fk" FOREIGN KEY ("denial_code_id") REFERENCES "public"."denial_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_documents" ADD CONSTRAINT "coding_documents_coding_request_id_coding_requests_id_fk" FOREIGN KEY ("coding_request_id") REFERENCES "public"."coding_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_documents" ADD CONSTRAINT "coding_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denial_analyses" ADD CONSTRAINT "denial_analyses_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denial_analyses" ADD CONSTRAINT "denial_analyses_denial_code_id_denial_codes_id_fk" FOREIGN KEY ("denial_code_id") REFERENCES "public"."denial_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denial_analyses" ADD CONSTRAINT "denial_analyses_analyzed_by_users_id_fk" FOREIGN KEY ("analyzed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_signatures" ADD CONSTRAINT "e_signatures_related_claim_id_claims_id_fk" FOREIGN KEY ("related_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_signatures" ADD CONSTRAINT "e_signatures_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_claim_id_claims_id_fk" FOREIGN KEY ("related_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_scans" ADD CONSTRAINT "ocr_scans_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_scans" ADD CONSTRAINT "ocr_scans_applied_to_claim_id_claims_id_fk" FOREIGN KEY ("applied_to_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_scans" ADD CONSTRAINT "ocr_scans_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_interactions" ADD CONSTRAINT "portal_interactions_payer_portal_id_payer_portals_id_fk" FOREIGN KEY ("payer_portal_id") REFERENCES "public"."payer_portals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_interactions" ADD CONSTRAINT "portal_interactions_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_interactions" ADD CONSTRAINT "portal_interactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_task_id_billing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."billing_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_task_id_billing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."billing_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_task_id_billing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."billing_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_task_id_billing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."billing_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_practice_assignments" ADD CONSTRAINT "user_practice_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_practice_assignments" ADD CONSTRAINT "user_practice_assignments_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_practice_assignments" ADD CONSTRAINT "user_practice_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_responsibilities" ADD CONSTRAINT "user_responsibilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_responsibilities" ADD CONSTRAINT "user_responsibilities_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
-- SaaS platform (non-destructive: new tables + nullable/defaulted columns only)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_status" varchar(20) DEFAULT 'active' NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "org_type" varchar(50);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" varchar(100);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" varchar(100);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'active' NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_step" integer DEFAULT 0 NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_complete" boolean DEFAULT false NOT NULL;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id");
ALTER TABLE "practices" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id");
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id");
CREATE TABLE IF NOT EXISTS "plans" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "slug" varchar(50) NOT NULL UNIQUE, "name" varchar(100) NOT NULL, "description" text, "monthly_price_cents" integer DEFAULT 0 NOT NULL, "annual_price_cents" integer DEFAULT 0 NOT NULL, "currency" varchar(3) DEFAULT 'USD' NOT NULL, "trial_days" integer DEFAULT 14 NOT NULL, "features" jsonb, "limits" jsonb, "stripe_monthly_price_id" varchar(255), "stripe_annual_price_id" varchar(255), "is_active" boolean DEFAULT true NOT NULL, "sort_order" integer DEFAULT 0 NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "subscriptions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade, "plan_id" uuid REFERENCES "plans"("id"), "billing_provider" varchar(50), "external_customer_id" varchar(255), "external_subscription_id" varchar(255), "status" varchar(30) DEFAULT 'trialing' NOT NULL, "billing_interval" varchar(10) DEFAULT 'monthly' NOT NULL, "trial_end" timestamp, "current_period_end" timestamp, "cancel_at_period_end" boolean DEFAULT false NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "organization_domains" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade, "hostname" varchar(255) NOT NULL UNIQUE, "is_subdomain" boolean DEFAULT false NOT NULL, "verification_status" varchar(20) DEFAULT 'pending' NOT NULL, "verification_token_hash" text, "verification_token_plain" varchar(100), "hosting_status" varchar(30) DEFAULT 'not_configured' NOT NULL, "tls_status" varchar(30) DEFAULT 'unknown' NOT NULL, "verified_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "organization_invitations" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade, "email" varchar(255) NOT NULL, "org_role" varchar(50) DEFAULT 'member' NOT NULL, "token_hash" text NOT NULL, "expires_at" timestamp NOT NULL, "accepted_at" timestamp, "revoked_at" timestamp, "invited_by" uuid REFERENCES "users"("id"), "created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "auth_tokens" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade, "type" varchar(30) NOT NULL, "token_hash" text NOT NULL, "expires_at" timestamp NOT NULL, "used_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "leads" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "type" varchar(20) DEFAULT 'contact' NOT NULL, "name" varchar(255) NOT NULL, "email" varchar(255) NOT NULL, "organization" varchar(255), "phone" varchar(50), "message" text, "status" varchar(20) DEFAULT 'new' NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "processed_webhooks" ("id" varchar(255) PRIMARY KEY, "provider" varchar(50) NOT NULL, "type" varchar(100), "created_at" timestamp DEFAULT now() NOT NULL);
CREATE INDEX IF NOT EXISTS "claims_org_idx" ON "claims"("organization_id");
CREATE INDEX IF NOT EXISTS "subscriptions_org_idx" ON "subscriptions"("organization_id");
CREATE INDEX IF NOT EXISTS "auth_tokens_hash_idx" ON "auth_tokens"("token_hash");
-- NOTE: existing claims/practices/patients keep organization_id NULL = legacy/unassigned.
-- Do NOT auto-assign them to any new registrant; reconcile manually (docs/SAAS_SETUP.md).
-- Rollback: DROP TABLE plans, subscriptions, organization_domains, organization_invitations, auth_tokens, leads, processed_webhooks; ALTER TABLE ... DROP COLUMN for added columns.

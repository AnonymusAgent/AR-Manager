# AR Manager SaaS — Architecture, Setup & Launch Checklist

## 1. Original architecture (audit summary)
Next.js 16 App Router + React 19 + TypeScript, Tailwind 4, PostgreSQL (Neon-compatible) via Drizzle ORM, custom JWT sessions (jose, HTTP-only cookie, DB-backed `sessions`), bcrypt password hashing, DB rate limiting, RBAC (7 roles), SSE chat, Nodemailer SMTP, 40+ tables / 57+ API routes. Existing `organizations` + `organization_members` existed but there was no public registration, email verification, plans/subscriptions, custom domains, marketing site, or platform admin. Root `/` redirected to `/login`. Full prior audit: `audit.md`.

## 2. Changes made (this implementation)
- **Schema (migration `drizzle/0003_saas_platform.sql`, non-destructive):** new `plans`, `subscriptions`, `organization_domains`, `organization_invitations`, `auth_tokens`, `leads`, `processed_webhooks`; `users.email_verified_at/is_platform_admin/account_status`; `organizations.org_type/country/timezone/owner_user_id/status/onboarding_*`; nullable `organization_id` on `claims/practices/patients` (legacy rows stay NULL = unassigned, **never** auto-given to a new registrant — reconcile manually).
- **Auth:** `POST /api/auth/register` (creates user + org + owner membership + trial subscription + hashed, expiring, single-use verification token), verify/resend, forgot/reset (reset revokes all sessions), login blocks `pending_verification`/`suspended`. Legacy seeded users keep `account_status='active'` so existing logins don't break.
- **Tenancy:** `src/lib/tenant.ts` deny-by-default membership checks; `resolveTenantByHostname` (verified custom domain, or `<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>`); public branding-only `GET /api/tenant?host=`. **Slug/hostname alone is never authorization** — session + membership still required.
- **Domains:** add hostname → unique TXT challenge (`_armanager-verify.<host>`), `verify` does a real `dns.resolveTxt` lookup. A domain is never marked active on entry alone.
- **Team:** invitations (hashed token, 7-day expiry, role-escalation guard, seat-limit entitlement check, accept creates account or links existing).
- **Billing:** plans in DB (`ensureDefaultPlans` seeds Starter/Professional/Enterprise; platform-admin editable via `PUT /api/platform/plans`). Stripe Checkout created server-side; webhook verifies HMAC signature and is idempotent (`processed_webhooks`); **subscriptions activate only from webhooks, never from a success redirect**. Without `STRIPE_SECRET_KEY` checkout honestly returns 503 — no fake payments.
- **Platform admin:** `/admin/platform` + `/api/platform/*` gated on `users.is_platform_admin` (separate from org admin; does not grant PHI access). Suspend/reactivate requires a recorded reason and writes an audit log.
- **Website:** `/` marketing home, `/features`, `/pricing` (live plans from DB), `/about`, `/contact` (leads stored, honeypot), `/faq`, `/legal/{terms,privacy,subscription,cookies,dpa,baa}` templates, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/onboarding`, `/settings/organization`, `/settings/billing`. Existing app URLs and features are untouched.

## 3. Environment variables
See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`. For real email: `SMTP_*`. For checkout: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` + Stripe price IDs per plan. For domains: `NEXT_PUBLIC_ROOT_DOMAIN`, DNS wildcard, hosting domain add.

## 4. Migration & rollback
Run `npm run db:migrate` (or apply `drizzle/0003_saas_platform.sql`) against staging first, back up production, then deploy. Rollback SQL is commented at the bottom of the migration file — dropping the new tables/columns does not touch existing data.

## 5. Custom domain go-live (manual steps that cannot be done from code)
1. Org owner adds domain in Organization Settings and publishes the TXT record.
2. Clicks **Verify DNS** (real lookup must pass).
3. Operator/org adds the same hostname in the hosting provider (e.g. Vercel → Project → Settings → Domains) and, for subdomains of the app domain, configures wildcard DNS `*.your-domain` → deployment. Until this is done the domain shows `manual_configuration_required` / TLS `pending_hosting_configuration` — by design we don't claim HTTPS is live.

## 6. Payments go-live
Create products/prices in Stripe, put price IDs on plans (platform admin API), set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, point Stripe webhook to `/api/subscriptions/webhook`, test with Stripe test cards + duplicate-webhook replay.

## 7. Make a platform admin
`UPDATE users SET is_platform_admin = true WHERE email = 'you@example.com';` (deliberately not self-service.)

## 8. Known limitations / external configuration still required
- No live SMTP, Stripe, or DNS/hosting configured in this environment — registration, verification, invites and checkout are implemented but report `not_configured` honestly until keys are set.
- Existing AR tables beyond claims/practices/patients are not yet org-scoped; org scoping is enforced for new SaaS surfaces (orgs, domains, invitations, billing). Extend `organization_id` scoping module-by-module before marketing strict isolation for those modules, and backfill only via manual reconciliation.
- MFA, SSO, and automated Vercel domain provisioning are not implemented (APIs/templates are ready for them).
- Legal pages are templates requiring counsel review. No HIPAA-compliance claim is made.

## 9. Security & launch checklist
- [ ] Rotate any dev credentials; disable `/api/seed` in production; set strong `JWT_SECRET`
- [ ] Backups + restore test; staging migration rehearsal
- [ ] Configure SMTP, Stripe (test then live), wildcard DNS + custom-domain hosting
- [ ] `npm run typecheck && npm run build`, `node tests/saas-unit.test.mjs`
- [ ] Two-org cross-tenant test with real DB: register Org A and Org B, confirm B cannot read A's domains/invitations/billing via direct API calls
- [ ] Legal review of Terms/Privacy/DPA/BAA; incident-response & retention policy documented

## 10. Platform Admin — Website Manager (`/admin/platform`)
Requires `users.is_platform_admin = true`. Tabs:
- **Overview** — org/user/trial/subscription/domain metrics and shortcuts.
- **Website** — edits everything public visitors see, stored in `site_settings` (migration `0004_site_settings.sql`): brand/tagline/support contacts, announcement banner, homepage hero CTAs, feature cards, About/Roadmap, FAQs, all legal pages, SEO title/description. Saving publishes immediately (marketing pages are `force-dynamic` and read through `GET /api/site`). Changes are audit-logged as `site_content_updated`.
- **Plans & Pricing** — create/edit/disable plans, $ prices, trial days, feature lists, seat/usage limits (JSON) and Stripe price IDs. Edits drive `/pricing` and checkout. Disable is a soft-disable so existing subscriptions keep working.
- **Organizations** — suspend/reactivate with a mandatory audit-logged reason.
- **Users** — search all users; activate/deactivate (deactivation revokes sessions), grant/remove platform admin, revoke sessions, mark email verified. You cannot modify your own platform account from here.
- **Leads Inbox** — contact/sales/demo submissions from `/contact` with status workflow and delete.
- **Domains & System** — custom-domain verification/hosting/TLS status and integration configuration status (booleans only; secrets are never displayed).

## 11. Account Settings (`/settings/account`)
For every signed-in user (linked from the sidebar, next to Profile / Organization Settings / Billing):
- **Profile** — first/last name, phone, avatar URL (email is the sign-in identity).
- **Security & Sessions** — change password, list active sessions (tokens never exposed), sign out individual devices or all other devices (`/api/account/sessions`).
- **Preferences** — date format, timezone, page size (same sanitized preferences store as `/profile`).
- **My Organizations** — memberships with links to Organization Settings, Billing and Onboarding.

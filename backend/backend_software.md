# Chapter2 Backend Software Plan

## 1) Delivery Approach

Scope decision:
- **Use providers** for authentication, payments, and messaging.
- **Build in-house** everything else (CRM, quoting, booking, operations, partner/guide management, analytics, compliance workflows, catalog sync).

Primary goal:
- Move Chapter2 from static lead capture to a production backend that runs the full lead -> quote -> booking -> trip operations lifecycle.

## 1.1 Implementation Status (Updated February 25, 2026)

Current implemented code lives in:
- `backend/app/src/server.js`
- `backend/app/data/store.json`
- `backend/app/config/staff.json`
- `backend/app/scripts/seed.js`

Implemented now:
- Milestone 1 core backend (lead ingestion, customer dedup, stage pipeline, owner assignment, SLA timestamps, activity timeline)
- Frontend lead form integration in `assets/js/main.js` using `POST /public/v1/leads` with idempotency key and `mailto` fallback
- Admin API token protection for `/api/v1/*` via `Authorization: Bearer <ADMIN_API_TOKEN>` (or `?api_token=...` for local admin page flows)
- Lead/customer list pagination and filtering

Note on stack:
- Planned stack remains NestJS + Postgres + Redis for production rollout.
- Current Milestone 1 implementation is a lightweight Node.js HTTP service with JSON-file persistence for rapid local delivery.

## 2) Technology Stack

## 2.1 Core Platform (Built In-House)

- Backend framework: **NestJS (TypeScript)**
- API style: **REST + OpenAPI**
- Database: **PostgreSQL 16**
- ORM: **Prisma**
- Queue/jobs: **BullMQ + Redis**
- File storage: **S3-compatible object storage**
- Search: **Meilisearch (self-hosted or managed)**
- Admin UI: **Next.js + TypeScript + Tailwind CSS**
- Background workers: **NestJS worker process**
- PDF generation (quotes/vouchers): **Playwright (HTML -> PDF)**
- Reporting: **Metabase (connected to Postgres read replica or warehouse schema)**

## 2.2 External Providers (Buy)

- Auth provider: **Auth0** (or Cognito if cost-first)
- Payments provider: **Stripe**
- Messaging provider:
  - **Postmark** for email
  - **Twilio** for WhatsApp/SMS

## 2.3 Infrastructure

- Runtime: **AWS ECS Fargate**
- DB: **AWS RDS PostgreSQL**
- Cache/queue broker: **AWS ElastiCache Redis**
- Object storage: **AWS S3**
- CDN/WAF: **CloudFront + AWS WAF**
- Secrets: **AWS Secrets Manager**
- Monitoring/logging: **Sentry + CloudWatch** (Datadog optional in growth phase)
- IaC: **Terraform**
- CI/CD: **GitHub Actions**

## 3) Target Architecture

- Single repository with modular monolith architecture.
- Modules:
  - `crm`
  - `quote`
  - `booking`
  - `operations`
  - `guides`
  - `partners`
  - `finance`
  - `support`
  - `catalog`
  - `compliance`
  - `integration`
- Internal domain events for async workflows (`LeadCreated`, `QuoteAccepted`, `BookingConfirmed`, `ServiceAtRisk`, etc.).
- Clear boundary: external providers only at integration layer adapters.

## 4) Milestones and Timeline

## Milestone 0: Foundation (Weeks 1-2)

Status: **Partially implemented (local dev baseline only)**

Deliverables:
- Monorepo setup (`apps/api`, `apps/admin`, `apps/worker`, `packages/shared`)
- Terraform baseline for dev/staging/prod
- Auth0 integration for staff login (RBAC claims)
- Postgres, Redis, object storage setup
- Core frameworks:
  - audit logging
  - permissions middleware
  - job queue abstraction
  - error model and API standards
- Initial admin shell and health dashboards

Exit criteria:
- Deployable staging environment with secure login and basic module scaffolding.

## Milestone 1: Lead and CRM Core (Weeks 3-5)

Status: **Implemented in local backend app**

Deliverables:
- Lead ingestion API
- Customer profile and deduplication
- Pipeline stages + ownership + SLA clocks
- Activity timeline (notes, tasks, contact logs)
- Admin views for lead triage and follow-up

Exit criteria:
- 100% web leads captured in CRM with no manual copy/paste.

Delivered endpoints and features:
- `POST /public/v1/leads`
- `GET /api/v1/leads` with `page`, `page_size`, `stage`, `owner_id`, `search`, `sort`
- `GET /api/v1/leads/:leadId`
- `PATCH /api/v1/leads/:leadId/stage`
- `GET /api/v1/leads/:leadId/activities`
- `POST /api/v1/leads/:leadId/activities`
- `GET /api/v1/customers` with pagination/search
- Admin UI pages:
  - `/admin/leads` (filters + pagination)
  - `/admin/leads/:leadId` (stage update + activity note)
  - `/admin/customers` (search + pagination)
  - `/admin/customers/:customerId` (profile + related leads)

## Milestone 2: Quote and Itinerary Engine (Weeks 6-8)

Deliverables:
- Product component model (hotels/transfers/activities/guides)
- Versioned quote builder
- Pricing rules (markup, occupancy, seasonality)
- Quote PDF generation + shareable quote links
- Accept/decline endpoint and state transition

Exit criteria:
- Sales team can produce, revise, and send quotes fully in system.

## Milestone 3: Booking and Operations (Weeks 9-12)

Deliverables:
- Quote-to-booking conversion
- Service orders and supplier confirmation workflow
- Guide assignment + availability management
- Run sheets and pre-departure checklists
- Incident and escalation workflows

Exit criteria:
- Confirmed bookings are operationally executable from backend only.

## Milestone 4: Finance and Settlement (Weeks 13-15)

Deliverables:
- Stripe payment intents/links integration
- Invoices, receipts, refunds
- Partner payables and reconciliation views
- Margin reporting by booking/service

Exit criteria:
- Finance can reconcile cash-in and supplier obligations per booking.

## Milestone 5: Catalog Publishing + Analytics (Weeks 16-18)

Deliverables:
- Backend catalog manager for tours
- Publishing pipeline to website tour feed
- KPI dashboards (lead conversion, quote SLA, margin, incident rate)
- Data retention and compliance workflows

Exit criteria:
- Website tour content is backend-driven and operational KPIs are visible.

## Milestone 6: Hardening and Scale (Weeks 19-22)

Deliverables:
- Load/performance tuning
- Backup/restore drill and incident runbooks
- Security test pass (OWASP-focused)
- Advanced automation policies (alerts, escalations, reminder jobs)

Exit criteria:
- Production readiness and predictable operations under peak traffic.

## 5) Data Model (Core Entities)

- `Customer`, `Lead`, `LeadActivity`, `ConsentRecord`
- `TripTemplate`, `TripVariant`, `CatalogMedia`
- `Quote`, `QuoteVersion`, `QuoteLineItem`
- `Booking`, `Traveler`, `ServiceOrder`, `ItineraryDay`
- `Guide`, `GuideAvailability`, `GuideAssignment`
- `Partner`, `PartnerContract`, `RateCard`, `InventoryAllocation`
- `Invoice`, `Payment`, `Refund`, `Payable`
- `SupportCase`, `Incident`
- `StaffUser`, `Role`, `Permission`, `AuditEvent`

## 6) Detailed Website Integration Plan

Current site context:
- Static frontend with modal lead form and `data/trips.json` source.
- No server-side runtime today.

Integration objective:
- Keep current frontend UX mostly intact while replacing static/manual flows with backend APIs.

## 6.1 Lead Form Integration (`#leadModal`)

Frontend changes:
- Replace current submit behavior with `POST /public/v1/leads`.
- Keep current 3-step UX and field validation.
- Add idempotency token per submission to prevent duplicates on retry.

Backend endpoint:
- `POST /public/v1/leads`
- Accepts:
  - destination, style, month, travelers, duration, budget
  - name, email, phone/whatsapp, language
  - notes, utm_source/utm_medium/utm_campaign, page_url
- Response:
  - `lead_id`, `status`, `next_step_message`

Operational behavior:
- Lead is stored in CRM and auto-assigned by rules (destination/language/workload).
- System creates follow-up task with SLA timer.
- Notification sent via Postmark/Twilio to assigned staff.

## 6.2 Tour Catalog Integration (`#tourGrid`)

Current:
- `data/trips.json` fetched by frontend.

Target:
- Frontend reads catalog from backend-managed feed.

Two-step rollout:
1. Compatibility mode:
- Backend publishes static JSON to `data/trips.json` via CI job.
- Frontend remains unchanged.
2. API mode:
- Frontend calls `GET /public/v1/tours?dest=&style=&limit=&offset=`.
- Backend applies filtering/sorting and returns normalized card payload.

Result:
- Content managers update tours in admin backend; website reflects changes without manual file edits.

## 6.3 Quote Link and Customer Acceptance

Frontend/public pages:
- Add quote page route (can be separate lightweight app): `/quote/:token`
- Customer can review itinerary and click accept.

Backend APIs:
- `GET /public/v1/quotes/{token}`
- `POST /public/v1/quotes/{token}/accept`
- `POST /public/v1/quotes/{token}/decline`

Behavior:
- Accept action converts quote state and triggers booking preparation workflow.

## 6.4 Payment Integration on Web

Frontend/public pages:
- Payment button on quote/booking page.

Backend + Stripe flow:
- Backend creates Stripe payment session/intents.
- Frontend redirects to Stripe Checkout or renders hosted payment element.
- Stripe webhook (`/webhooks/stripe`) updates payment and booking status.

Critical controls:
- Webhook signature verification
- Idempotent processing by event ID
- Reconciliation job for missed webhook events

## 6.5 Messaging and Notifications

Events that trigger messaging:
- Lead received
- Quote sent/viewed/reminder
- Booking confirmed
- Payment reminder
- Pre-departure reminder
- Incident escalation notifications

Flow:
- Domain event -> queue job -> provider adapter (Postmark/Twilio) -> delivery status persisted.

## 6.6 Tracking and Attribution Integration

Frontend:
- Capture UTM parameters and referrer into lead payload.
- Persist short-lived attribution in local storage/session.

Backend:
- Store attribution fields on lead/customer records.
- Expose conversion reporting by channel/campaign.

## 6.7 Security for Public Endpoints

- Rate limiting on public endpoints (`/public/v1/*`)
- CAPTCHA (Cloudflare Turnstile or hCaptcha) on lead submission
- Input schema validation and sanitization
- Abuse monitoring and automatic IP throttling rules

## 6.8 Migration Plan (No Frontend Downtime)

1. Add backend APIs in staging and wire frontend feature flags.
2. Run dual-write period for leads (existing fallback + backend) for 1 week.
3. Switch production lead submit to backend API.
4. Move catalog to backend publish mode.
5. Introduce quote/payment public pages.
6. Remove legacy mailto-only fallback after stable period.

## 7) Quality, Security, and Delivery Standards

- Testing:
  - Unit tests for domain logic
  - Integration tests for DB and provider adapters
  - E2E tests for lead -> quote -> booking happy path
- Security:
  - OWASP ASVS-aligned checks
  - Dependency scanning and container scanning in CI
  - Quarterly access review and audit log review
- Delivery:
  - Trunk-based development with short-lived branches
  - Automated migrations with rollback scripts
  - Blue/green deploy for API service

## 8) First Production KPIs

- Lead capture success rate >= 99%
- Median lead assignment time <= 2 minutes
- Median quote turnaround <= 48 hours
- Booking confirmation traceability = 100%
- Payment webhook processing success >= 99.9%
- Incident acknowledgement time <= 15 minutes (during staffed hours)

## 9) Immediate Next Steps

1. Confirm provider choices (Auth0 vs Cognito).
2. Approve milestone timeline and staffing.
3. Start Milestone 0 with infra and module scaffolding.
4. Implement website lead API integration first (highest immediate ROI).

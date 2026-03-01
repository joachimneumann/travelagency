# AsiaTravelPlan Backend Software Plan

## 1) Delivery Approach

Scope decision:
- **Use providers** for authentication, payments, and messaging.
- **Build in-house** everything else (CRM, quoting, booking, operations, partner/guide management, analytics, compliance workflows, catalog sync).

Primary goal:
- Move AsiaTravelPlan from static booking capture to a production backend that runs the full booking -> quote -> confirmed trip operations lifecycle.

## 1.1 Implementation Status (Updated February 26, 2026)

Current implemented code lives in:
- `backend/app/src/server.js`
- `backend/app/src/auth.js`
- `backend/app/data/store.json`
- `backend/app/data/tours/`
- `backend/app/config/staff.json`
- `backend/app/scripts/seed.js`

Runtime persistence note:
- `backend/app/data/store.json` remains the hardwired JSON persistence path in the current backend.
- It is no longer tracked in Git and must be treated as runtime data.

Implemented now:
- Milestone 1 core backend (booking ingestion, customer dedup, stage pipeline, staff assignment, SLA timestamps, activity timeline)
- Frontend booking form integration in `assets/js/main.js` using `POST /public/v1/bookings` with idempotency key and inline error handling
- Keycloak-protected `/api/v1/*` access via backend session cookie (browser) or Keycloak bearer token
- Booking/customer list pagination and filtering
- Keycloak OIDC auth flow implemented for backend (`/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me`) with role gating
- Auth internals refactored into dedicated module `src/auth.js` (route handlers, session state, OIDC discovery/token verification, API auth checks)
- Branded website backoffice pages implemented:
  - `backend.html`: paginated searchable customers + bookings + tours tables (default newest 10 each)
  - `backend-tour.html` is the dedicated tour edit page linked from tour IDs in `backend.html`
  - `backend-booking.html`: detail page for bookings/customers with booking actions (staff/stage updates + notes)
  - Website header includes `backend` login button and `Logged in as` status from `/auth/me`
  - Backend page header includes `Website` and `Logout` actions
- Tours are fully backend-driven:
  - website reads tours from `GET /public/v1/tours`
  - tour images are backend-hosted under `/public/v1/tour-images/...`
  - `GET /public/v1/tours` provides HTTP caching (`ETag`, `Cache-Control`)
  - frontend applies local cache + image prewarm for faster load
- Tour editor supports:
  - destination countries selection via checkbox group (multi selection)
  - styles selection via checkbox group (multi selection)
  - image upload with backend ImageMagick conversion to WebP (max 1000px)
- Admin API includes staff directory and creation endpoints used by booking assignment controls:
  - `GET /api/v1/staff`
  - `POST /api/v1/staff`

Current role model in the implemented backend:
- `atp_staff`
  - read and write only bookings assigned to that staff member
  - booking access is resolved by matching Keycloak `preferred_username` to `backend/app/config/staff.json -> usernames[]`
- `atp_manager`
  - read and write all bookings
  - change staff assignments
  - create staff records
- `atp_admin`
  - read and write all bookings
  - change staff assignments
  - create staff records
  - read and edit tours
- `atp_accountant`
  - read all bookings
  - change booking stage only
  - read-only access to tours

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
- Internal domain events for async workflows (`BookingCreated`, `QuoteAccepted`, `BookingConfirmed`, `ServiceAtRisk`, etc.).
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

## Milestone 1: Booking and CRM Core (Weeks 3-5)

Status: **Implemented in local backend app**

Deliverables:
- Booking ingestion API
- Customer profile and deduplication
- Pipeline stages + staff assignment + SLA clocks
- Activity timeline (notes, tasks, contact logs)
- Admin views for booking triage and follow-up

Exit criteria:
- 100% web bookings captured in CRM with no manual copy/paste.

Delivered endpoints and features:
- `POST /public/v1/bookings`
- `GET /api/v1/bookings` with `page`, `page_size`, `stage`, `owner_id`, `search`, `sort`
- `GET /api/v1/bookings/:bookingId`
- `PATCH /api/v1/bookings/:bookingId/stage`
- `PATCH /api/v1/bookings/:bookingId/owner` (current path retained for staff assignment compatibility)
- `GET /api/v1/bookings/:bookingId/activities`
- `POST /api/v1/bookings/:bookingId/activities`
- `GET /api/v1/staff`
- `POST /api/v1/staff`
- `GET /api/v1/customers` with pagination/search
- Admin UI pages:
  - `/admin/bookings` (filters + pagination)
  - `/admin/bookings/:bookingId` (role-aware staff/stage/note actions)
  - `/admin/customers` (search + pagination)
  - `/admin/customers/:customerId` (profile + related bookings)

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
- KPI dashboards (booking conversion, quote SLA, margin, incident rate)
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

- `Customer`, `Booking`, `BookingActivity`, `ConsentRecord`
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
- Frontend with modal booking form and backend-powered tours source (`/public/v1/tours`).
- No server-side runtime today.

Integration objective:
- Keep current frontend UX mostly intact while replacing static/manual flows with backend APIs.

## 6.1 Booking Form Integration (`#bookingModal`)

Frontend changes:
- Replace current submit behavior with `POST /public/v1/bookings`.
- Keep current 3-step UX and field validation.
- Add idempotency token per submission to prevent duplicates on retry.

Backend endpoint:
- `POST /public/v1/bookings`
- Accepts:
  - destination, style, month, travelers, duration, budget
  - name, email, phone/whatsapp, language
  - notes, utm_source/utm_medium/utm_campaign, page_url
  - backend additionally captures request `ip_address` and `ip_country_guess`
- Response:
  - `booking_id`, `status`, `next_step_message`

Operational behavior:
- Booking is stored in CRM with `staff` initially unassigned.
- System creates follow-up task with SLA timer.
- Manager/admin can later assign the booking to staff.

## 6.2 Tour Catalog Integration (`#tourGrid`)

Current:
- Frontend fetches tours from `GET /public/v1/tours`.

Target:
- Frontend reads catalog from backend-managed feed.

Current rollout mode:
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
- Booking received
- Quote sent/viewed/reminder
- Booking confirmed
- Payment reminder
- Pre-departure reminder
- Incident escalation notifications

Flow:
- Domain event -> queue job -> provider adapter (Postmark/Twilio) -> delivery status persisted.

## 6.6 Tracking and Attribution Integration

Frontend:
- Capture UTM parameters and referrer into booking payload.
- Persist short-lived attribution in local storage/session.

Backend:
- Store attribution fields on booking/customer records.
- Expose conversion reporting by channel/campaign.

## 6.7 Security for Public Endpoints

- Rate limiting on public endpoints (`/public/v1/*`)
- CAPTCHA (Cloudflare Turnstile or hCaptcha) on booking submission
- Input schema validation and sanitization
- Abuse monitoring and automatic IP throttling rules

## 6.8 Migration Plan (No Frontend Downtime)

1. Add backend APIs in staging and wire frontend feature flags.
2. Bookings are already switched to backend API (no mailto fallback in current implementation).
3. Move catalog to backend publish mode.
4. Introduce quote/payment public pages.

## 7) Quality, Security, and Delivery Standards

- Testing:
  - Unit tests for domain logic
  - Integration tests for DB and provider adapters
  - E2E tests for booking -> quote -> booking happy path
- Security:
  - OWASP ASVS-aligned checks
  - Dependency scanning and container scanning in CI
  - Quarterly access review and audit log review
- Delivery:
  - Trunk-based development with short-lived branches
  - Automated migrations with rollback scripts
  - Blue/green deploy for API service

## 8) First Production KPIs

- Booking capture success rate >= 99%
- Median booking assignment time <= 2 minutes
- Median quote turnaround <= 48 hours
- Booking confirmation traceability = 100%
- Payment webhook processing success >= 99.9%
- Incident acknowledgement time <= 15 minutes (during staffed hours)

## 9) Immediate Next Steps

1. Confirm provider choices (Auth0 vs Cognito).
2. Approve milestone timeline and staffing.
3. Start Milestone 0 with infra and module scaffolding.
4. Implement website booking API integration first (highest immediate ROI).

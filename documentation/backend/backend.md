# Backend Requirements for AsiaTravelPlan

## 1) Why AsiaTravelPlan Needs a Backend

AsiaTravelPlan currently has a strong marketing site and booking capture UX, but no operational core to manage bookings, trip execution, partners, and field staff at scale.

Without a backend, the business will hit limits quickly:
- Booking loss from manual handoff (modal -> email/manual tracking)
- Slow quote turnaround and inconsistent pricing
- No single source of truth for customers, bookings, guides, and suppliers
- Weak operational control for multi-country trips (Vietnam, Thailand, Cambodia, Laos)
- High risk of service quality variance and partner coordination failures
- Limited ability to track margin, partner performance, and staff productivity

A backend is required to move AsiaTravelPlan from brochure + form collection into a true travel operations platform.

## 2) Scope and User Groups

The backend must support these actor groups:
- Customers (bookings, booked travelers, repeat customers)
- Internal staff (sales, ops coordinators, finance, management)
- Local guides (freelance or contracted)
- Business partners (hotels, transport, cruise operators, activity providers, DMC/ground operators)
- External support staff (drivers, airport reps, on-call emergency contacts)

## 3) Core Business Capabilities (Complete Requirement List)

## 3.1 Booking and Customer CRM

Functional requirements:
- Capture bookings from website form, email, WhatsApp, and manual entry
- De-duplicate customers by email/phone/passport + fuzzy name matching
- Maintain full customer profile:
  - Identity, contact info, preferred language, travel preferences
  - Household/group relationships (family members, companions)
  - Past trips, quote history, spend and margin contribution
- Support booking lifecycle stages:
  - New -> Qualified -> Proposal Sent -> Negotiation -> Won/Lost -> Post-Trip
- Assign staff and SLA deadlines for each booking
- Track interaction timeline:
  - Calls, emails, WhatsApp chats, notes, tasks, documents
- Store booking source attribution (campaign, referral, direct, partner)
- Support segmentation (country, budget band, style, destination interest)
- Trigger reminders and automations for follow-ups
- Record consent status for marketing/contact by channel

Data requirements:
- Immutable timeline/audit events for customer-facing actions
- Consent log with timestamp, source, policy version
- PII field classification and retention rules

## 3.2 Quote and Itinerary Builder

Functional requirements:
- Build modular itineraries from reusable components:
  - Accommodation, transfers, activities, guides, meals, flights/trains (optional)
- Support multiple proposal versions per booking
- Price per traveler and per group with occupancy rules
- Handle multi-currency quotes (USD, VND, THB, etc.)
- Allow markup rules by product type, partner, route, season
- Handle seasonal and blackout pricing windows
- Define inclusions/exclusions automatically in output
- Produce branded quote documents and shareable links
- Track quote open/view/accept status
- Lock accepted quote snapshot to prevent accidental repricing

Data requirements:
- Versioned itinerary objects
- Rate source traceability (which partner contract/rate card was used)
- Valid-from/valid-to for quoted prices

## 3.3 Booking and Reservation Management

Functional requirements:
- Convert accepted quote to booking/order with one click
- Split booking into service orders (hotel, transport, guide, activity)
- Booking statuses:
  - Pending, Confirmed, Partially Confirmed, In Progress, Completed, Cancelled
- Track supplier confirmations and deadlines
- Store booking travelers with passport/visa requirements where needed
- Support amendments (date changes, room changes, add-ons)
- Compute repricing deltas for amendments
- Manage cancellation and refund policies per service and package
- Generate vouchers and service confirmations
- Manage pre-trip checklist completion

Data requirements:
- Parent booking + child service booking hierarchy
- Service-level cancellation windows and penalties
- Document attachments (vouchers, invoices, passport copies where lawful)

## 3.4 Operations and Trip Execution

Functional requirements:
- Build day-by-day operation run-sheet per trip
- Assign operational owner for each departure
- Generate daily dispatch plans for pickups/transfers/activities
- Maintain emergency contact workflow and escalation tree
- Push real-time updates to operations dashboard:
  - Delays, weather disruptions, no-show, overbooking, route changes
- Enable rapid re-accommodation/re-routing flows
- Track service delivery completion per item
- Capture incident reports with severity levels and RCA fields

Data requirements:
- Time-zone aware scheduling
- SLA timestamps (planned vs actual)
- Incident repository linked to trip, partner, and responsible unit

## 3.5 Local Guide Management

Functional requirements:
- Guide profile management:
  - Languages, certifications/licenses, destinations, specialties
  - Availability calendar, blackout dates, max daily capacity
  - Rates (half-day/full-day/overtime), currency, tax status
- Vetting and compliance records (documents + expiry reminders)
- Assignment engine:
  - Match by language, location, trip style, traveler profile, rating
- Confirm/decline workflow with response SLA
- Guide briefing pack generation (guest profile, itinerary, notes, constraints)
- Attendance/check-in and completion confirmation
- Guide payout calculations and payment status tracking
- Post-trip performance scoring from customer + ops feedback

Data requirements:
- Availability ledger (reserved/held/free)
- Credential expiry dates and alerts
- Historical assignment/performance dataset

## 3.6 Business Partner Management (Hotels, Cruises, Transport, Activities)

Functional requirements:
- Partner master records:
  - Legal entity, contacts, tax data, banking details, licenses
- Contract lifecycle management:
  - Contract versions, validity periods, negotiated terms, allotments
- Rate card management:
  - Seasonal rates, child policy, occupancy rules, stop-sell periods
- Inventory/allotment tracking where applicable
- Supplier request and confirmation workflows
- SLA tracking (response time, reconfirmation, service failure rate)
- Quality management:
  - Complaints, incident linkage, corrective action logs
- Partner settlement:
  - Payables, commissions, credit terms, reconciliation status
- Blocklist and risk flags for underperforming suppliers

Data requirements:
- Contract/rate version history
- Partner scorecard dataset (quality, reliability, profitability)
- Settlement records linked to bookings and invoices

## 3.7 Internal Staff Management (Own Team)

Functional requirements:
- Internal user directory with role-based access control
- Team structures (sales, operations, finance, admin, management)
- Work queues and task assignment:
  - New bookings, quote deadlines, pending confirmations, pre-departure checks
- SLA dashboards per team and individual
- Shift/on-call schedule for emergency support
- Internal notes, handover logs, and approval flows
- Performance metrics:
  - Response time, conversion, booking error rate, customer satisfaction
- Leave/availability flags affecting assignment

Data requirements:
- Staff activity audit trails
- Role and permission history
- Team productivity snapshots over time

## 3.8 Payments, Finance, and Settlement

Functional requirements:
- Payment links and manual payment recording
- Deposit schedules and balance due reminders
- Multi-currency invoicing and receipt generation
- Refund handling with approval and reason codes
- Partner payable tracking and settlement runs
- Commission and margin calculations at:
  - Booking level
  - Service component level
  - Destination and partner level
- Financial reconciliation support (expected vs collected vs paid)
- Export for accounting system integration

Data requirements:
- Ledger-style transaction records
- FX rate timestamp used per transaction
- Invoice/credit note links to booking and services

## 3.9 Customer Support and Service Recovery

Functional requirements:
- Ticketing/case management linked to customer and trip
- Case categories (pre-trip, in-trip, post-trip, complaints, refund)
- Priority and severity levels with SLA timers
- Escalation workflow (ops booking -> manager -> emergency)
- Resolution notes and compensation tracking
- Post-resolution customer feedback capture

Data requirements:
- Case timeline with staff assignment changes

## 3.12 Current backend role model

The implemented backend authorization model is:

- `atp_staff`
  - read and write only bookings assigned to that staff member
  - assignment is resolved from Keycloak `preferred_username` matching `backend/app/config/staff.json -> usernames[]`
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
  - may change booking stage only
  - read-only access to tours
- Root cause taxonomy
- Compensation and goodwill history

## 3.10 Content, Product, and Catalog Management

Functional requirements:
- Maintain destination/style tour templates used by website
- Product status control (active, paused, retired)
- Image/media references and localized text fields
- Priority and merchandising rules for front-end cards
- Sync pipeline between backend catalog and website `data/tours_fallback_data.jspn`
- Change approval workflow for published offers

Data requirements:
- Versioned catalog with publish history
- Mapping between front-end trip IDs and backend product IDs

## 3.11 Reporting and Analytics

Functional requirements:
- KPI dashboards by day/week/month:
  - Booking volume, conversion, quote turnaround, booking value, margin
- Operational KPIs:
  - Confirmation booking time, incident rate, on-time service delivery
- Supplier KPIs:
  - Acceptance rate, SLA compliance, complaint rates
- Guide KPIs:
  - Utilization, ratings, reliability
- Staff KPIs:
  - Throughput, SLA adherence, quality metrics
- Cohort and repeat-customer analysis
- Pipeline forecasting

Data requirements:
- Snapshot tables for trend reporting
- Source-of-truth definitions for each KPI
- Exportable reports for management/finance

## 4) Cross-Cutting Technical Requirements

## 4.1 Identity, Access, and Security

- Role-based access control (RBAC) with least privilege
- Optional attribute-based policies for sensitive records (VIP, legal cases)
- MFA for staff accounts
- SSO readiness (Google/Microsoft)
- API authentication for integrations (OAuth2/JWT/API keys)
- Full audit logging for create/update/delete and permission changes
- Encryption in transit (TLS 1.2+) and at rest
- Secrets management (no credentials in code/config files)
- Session controls (timeouts, revocation, suspicious login alerts)

## 4.2 Privacy and Compliance

- Data minimization per workflow (collect only what is necessary)
- Explicit consent capture and withdrawal handling
- Data subject rights workflows:
  - Access, correction, deletion, export, processing restriction
- Retention policies by data class (booking, booking, finance, support)
- Sensitive-data handling policy (passport, health/dietary notes, minors)
- Cross-border data transfer controls and logging
- Privacy-by-design defaults in new features
- Processor/subprocessor register for external integrations

## 4.3 Reliability and Operations

- Availability target (minimum 99.9% monthly)
- Backup policy (daily full + point-in-time where feasible)
- Disaster recovery objectives:
  - RPO <= 15 minutes for core booking data (target)
  - RTO <= 4 hours for critical operations (target)
- Idempotent APIs for booking/payment operations
- Queue-based background jobs for notifications and sync tasks
- Monitoring/alerting (errors, latency, failed jobs, integration failures)
- Structured logs with correlation IDs

## 4.4 Performance and Scalability

- Sub-300ms median response for common CRM actions
- Sub-2s page loads for operations dashboard queries
- Horizontal scalability for peak inquiry seasons (Tet, summer)
- Caching strategy for catalog and reference data
- Bulk import/export support for partner and rate updates

## 4.5 Integration Requirements

Required integrations (phased):
- Website booking ingestion (implemented in current milestone)
- Email and WhatsApp messaging gateway
- Payment processor(s)
- Accounting software
- Optional channel/OTA feeds and flight content providers
- Partner portal/API for confirmations and rate updates

Integration design requirements:
- Retry logic and dead-letter queue for failed syncs
- Integration health dashboard and reconciliation tools
- Webhook signature verification

## 5) Suggested Data Model (Minimum Entities)

Core entities:
- `Customer`
- `Booking`
- `TripPreference`
- `Quote`
- `QuoteVersion`
- `Booking`
- `BookingTraveler`
- `ServiceOrder`
- `ItineraryDay`
- `Guide`
- `GuideAssignment`
- `Partner`
- `PartnerContract`
- `RateCard`
- `InventoryAllocation`
- `Invoice`
- `Payment`
- `Refund`
- `Payable`
- `SupportCase`
- `Incident`
- `StaffUser`
- `Role`
- `Permission`
- `AuditEvent`
- `ConsentRecord`
- `Document`

## 6) Required Workflow Automations

- New booking auto-routing by destination/style/language
- Follow-up reminders when SLA thresholds are near breach
- Auto-create pre-departure checklist at booking confirmation
- Auto-alert operations on unconfirmed critical services
- Auto-notify finance for due deposits and overdue balances
- Auto-trigger guide payout after trip completion + QA pass
- Auto-escalate support cases by severity/time open
- Auto-request post-trip reviews and CSAT score

## 7) API Requirements

- REST or GraphQL API with versioning policy
- Consistent pagination/filter/sort standards
- Idempotency keys for create-booking/create-payment endpoints
- Fine-grained permission checks on every resource
- Webhook framework for external event subscriptions
- Public API documentation and sandbox environment
- Contract tests for all external-facing endpoints

## 8) Admin and Backoffice UX Requirements

- Unified operations dashboard (today's departures, issues, pending confirmations)
- Kanban and list views for booking pipeline
- Calendar views for guide and service assignments
- Rate/contract management screens for partners
- Booking timeline view with all service components and messages
- Mobile-friendly operations views for on-the-go staff

## 9) MVP vs Phase 2 Prioritization

## MVP (must-have to operate reliably)

- CRM booking capture + pipeline
- Quote builder (versioned)
- Booking conversion and core service orders
- Partner directory + basic contracting + confirmations
- Guide directory + assignment + availability
- RBAC + audit logs
- Basic payments/invoices
- Core dashboards (pipeline + operations)

## Phase 2 (scale and margin optimization)

- Advanced dynamic pricing/markup rules engine
- Automated partner API integrations
- Full payout automation for guides/partners
- Advanced forecasting and cohort analytics
- Partner self-service portal
- Customer self-service trip portal/app
- ML-assisted guide/partner recommendations

## 10) Acceptance Criteria (Definition of Done for the Backend Program)

The backend is considered production-ready when:
- 100% of website bookings are captured and trackable in CRM
- Quote turnaround meets internal SLA target (for example <= 48-72h)
- Each confirmed booking has complete service-order traceability
- Guide and partner assignments are visible and auditable per trip day
- Finance can reconcile customer payments and supplier payables per booking
- Support incidents are tracked end-to-end with measurable closure SLAs
- Role permissions and audit logs pass internal security review
- Backup/restore and incident-response drills pass defined RTO/RPO targets

## 11) Recommended Implementation Architecture (Pragmatic)

- Modular monolith first (CRM, Booking, Ops, Finance modules)
- PostgreSQL as primary transactional database
- Redis for cache/queues/session acceleration
- Object storage for documents and vouchers
- Event bus (or queue) for async workflows and integrations
- API-first design to support future customer/partner portals

This approach minimizes initial complexity while preserving a clean migration path to microservices if scale requires it.

## 12) Research Basis and External Standards (Reviewed February 25, 2026)

This requirements document is aligned with:
- AsiaTravelPlan operational context (project context) and market analysis (`research.md`) in this repository
- GDPR legal baseline for personal data processing and territorial scope (EUR-Lex, Regulation (EU) 2016/679)
- Vietnam personal data protection regime:
  - Decree 13/2023/ND-CP (effective July 1, 2023)
  - Decree 356/2025/ND-CP implementation updates (effective January 1, 2026, per English legal summary source)
- PCI DSS v4.x baseline for cardholder data security controls (PCI SSC)
- OWASP ASVS for application security verification requirements
- NIST SP 800-63-4 digital identity guidance for authentication, lifecycle, and federation
- Travel interoperability direction from IATA NDC and OpenTravel standards (for optional future distribution/connectivity integrations)

## 13) Concrete Build-vs-Buy Implementation Proposal for AsiaTravelPlan

## 13.1 Decision Principles

- Build what creates durable competitive advantage (itinerary/quote logic, operations orchestration, supplier and guide performance intelligence).
- Buy commodity infrastructure (auth, payments, messaging, monitoring, file storage, BI baseline).
- Keep the core in one codebase first (modular monolith), then split only when scale or team size demands it.

## 13.2 What to Buy (Managed/SaaS Components)

- **Cloud platform:** AWS
  - ECS Fargate for app runtime
  - RDS PostgreSQL for primary DB
  - ElastiCache Redis for queues/cache
  - S3 for documents/vouchers
  - CloudFront + WAF for edge protection
- **Identity and access:** Auth0 (or AWS Cognito if cost-first)
  - MFA, SSO, passwordless options, role claims
- **Payments:** Stripe
  - Payment links, multi-currency capture, webhook events
- **Transactional email:** Postmark
  - Booking confirmations, quote emails, reminders
- **WhatsApp/SMS:** Twilio
  - Operations and customer notifications
- **Observability:** Sentry + Datadog (or Grafana Cloud as lower-cost alternative)
  - Error tracking, APM, infra metrics
- **Search:** Meilisearch (managed if available) or Typesense Cloud
  - Fast internal search for customers/bookings/partners
- **BI/analytics:** Metabase Cloud (initially)
  - KPI dashboards for management and operations
- **Document e-sign:** DocuSign (only if partner contracting flow needs signatures in-app)

## 13.3 What to Build In-House (Core Product)

- Booking-to-booking CRM workflow tailored to AsiaTravelPlan (pipeline + SLA routing).
- Modular itinerary and quote engine:
  - Versioned proposals
  - Inclusion/exclusion generation
  - Margin/markup controls
- Booking orchestration and service-order management.
- Guide assignment engine and availability ledger.
- Partner contract/rate/allotment model and confirmation workflow.
- Operations control tower:
  - Daily run sheets
  - Incident handling
  - Escalation workflow
- Finance reconciliation layer:
  - Booking-level margin
  - Partner payables mapping
- Website catalog sync:
  - Backend products -> `data/tours_fallback_data.jspn` publish pipeline
- Audit trail and compliance workflows specific to tourism operations in target markets.

## 13.4 Recommended Technology Stack (Concrete)

- **Backend:** TypeScript + NestJS
- **API:** REST first (OpenAPI), with webhook framework
- **DB:** PostgreSQL 16
- **ORM:** Prisma
- **Queue/jobs:** BullMQ + Redis
- **Workflow orchestration:** Temporal (Phase 2) or BullMQ step workflows (MVP)
- **Admin frontend/backoffice:** Next.js (App Router) + Tailwind + component library
- **Permissions:** Casbin or Permit.io (start with in-app RBAC if simpler)
- **Infra as code:** Terraform
- **CI/CD:** GitHub Actions + preview environments per PR
- **Testing:** Vitest/Jest + Playwright for critical backoffice flows

## 13.5 LLM-Enabled Components (High ROI, Controlled Risk)

Build these with strict human approval gates:
- **Itinerary drafting assistant:** Suggest day plans from templates, partner inventory, and traveler profile.
- **Quote copilot:** Generate polished customer-facing quote text from structured itinerary.
- **Ops copilot:** Summarize incidents and propose reroute/recovery options.
- **Support copilot:** Draft responses using booking timeline and policy context.

Guardrails:
- No autonomous booking or payment actions.
- All LLM outputs marked as draft and require staff confirmation.
- PII redaction policy before sending data to external model APIs.
- Prompt/version logging for auditability.

## 13.6 Target System Modules (Single Repo, Modular Monolith)

- `crm-module`
- `quote-module`
- `booking-module`
- `ops-module`
- `guide-module`
- `partner-module`
- `finance-module`
- `support-module`
- `catalog-module`
- `auth-access-module`
- `audit-compliance-module`
- `integration-module`

Each module owns:
- Domain entities
- Service layer
- API controllers
- Background jobs
- Module-scoped tests

## 13.7 Phased Delivery Plan (Concrete)

## Phase 0 (Weeks 1-2): Foundations

- Finalize domain model and event taxonomy.
- Provision cloud, auth, DB, observability, CI/CD.
- Implement RBAC skeleton, audit event framework, and base admin shell.

Deliverable:
- Secure runnable backend baseline with developer workflow and monitoring.

## Phase 1 (Weeks 3-8): MVP Revenue Core

- CRM booking ingestion (website + manual).
- Quote builder v1 with versioning and PDF generation.
- Booking conversion + service orders.
- Partner and guide directories with assignment basics.
- Core dashboards (pipeline + today operations).

Deliverable:
- AsiaTravelPlan can run end-to-end booking -> quote -> booking in one system.

## Phase 2 (Weeks 9-14): Operational Hardening

- Dispatch board, run sheets, incident management, escalation timers.
- Payment and invoicing integration, deposits, and reconciliation v1.
- SLA alerts, reminder automation, pre-departure checklists.
- Data retention/consent workflows and compliance admin tooling.

Deliverable:
- Operations and finance run reliably with measurable SLA control.

## Phase 3 (Weeks 15-20): Optimization and Scale

- Advanced pricing rules and partner scorecards.
- LLM copilots (itinerary + quote + support drafts).
- BI layer expansion and cohort/margin analytics.
- Optional partner portal beta.

Deliverable:
- Margin optimization and productivity uplift capabilities online.

## 13.8 Team Plan

Minimum delivery team:
- 1 Tech booking / architect
- 2 Backend engineers
- 1 Full-stack engineer (admin UI + API integration)
- 1 QA automation engineer (shared or part-time)
- 1 Product manager (or founder acting as PM)

## 13.9 Build-vs-Buy Summary Table

- **Auth:** Buy
- **Payments:** Buy
- **Email/WhatsApp delivery:** Buy
- **Observability:** Buy
- **Cloud infra primitives:** Buy (managed)
- **CRM domain logic:** Build
- **Quote/itinerary engine:** Build
- **Booking orchestration:** Build
- **Guide/partner management intelligence:** Build
- **Ops control tower:** Build
- **Compliance and audit workflow glue:** Build on top of managed services

## 13.10 First 90-Day Success Metrics

- >= 95% bookings captured automatically from web channels
- <= 48h median quote turnaround
- >= 90% confirmed bookings with complete service-order traceability
- >= 80% guide assignments completed without manual escalation
- < 2% critical operations incidents without logged RCA
- 100% sensitive record access covered by audit events

## 14) Typical Costs for Purchased Components (as of February 25, 2026)

Cost notes:
- Prices below are typical reference prices for planning, not binding quotes.
- Final spend depends on region, traffic, MAU, message volume, and retention settings.
- Where we listed alternatives in Section 13, both options are shown.

## 14.1 Assumptions Used for "Typical" Estimates

- Early production stage for AsiaTravelPlan (small team, first operational backend rollout).
- Region baseline: US East where applicable.
- 3-8 internal users, moderate booking volume, moderate messaging volume.
- Costs shown mostly as monthly recurring; variable transaction fees are called out separately.

## 14.2 Cost by Purchased Component

| Component | Pricing basis | Typical monthly cost |
|---|---|---|
| AWS ECS Fargate | Pay per vCPU-second and GB-second | $70-$250 |
| AWS RDS PostgreSQL | Instance + storage + backups | $80-$300 |
| AWS ElastiCache Redis | Node hours + memory tier | $25-$120 |
| AWS S3 (docs/vouchers) | Storage + requests | $5-$40 |
| CloudFront + WAF (new flat-rate plans) | Pro plan starts at $15/month; Business $200/month; Premium $1,000/month | $15-$200 (most likely start) |
| Auth0 (B2C) | Essentials starts at $35/month (500 MAU tier on pricing page) | $35-$240+ |
| Amazon Cognito (alternative to Auth0) | Essentials/Lite include free tier; then MAU-based pricing (examples show $0.015/MAU above free tier) | $0-$150+ (early stage often near $0) |
| Stripe | No fixed monthly core fee on standard plan; per successful transaction fee | Fixed: $0, Variable: 2.9% + $0.30 domestic card (plus extras) |
| Postmark | Basic 10K emails plan at $15/month; overage $1.80 per 1,000 | $15-$80 |
| Twilio WhatsApp | Twilio fee $0.005/message + Meta template fees by country/type | $20-$300+ |
| Sentry | Team starts at $26/month; Business starts at $80/month | $26-$80+ |
| Datadog (if added) | Infrastructure Pro starts $15/host/month (annual) or $18 on-demand; APM standalone starts $36/host/month | $30-$250+ |
| Search (Meilisearch Cloud) | Build starts $30/month; Pro starts $300/month | $30-$300+ |
| Search (Typesense Cloud alternative) | Cluster-hour + bandwidth pricing (pay-as-you-go) | $20-$200+ |
| Metabase Cloud | Starter $100/month + $6/user (first 5 included); Pro $575/month + $12/user | $100-$250 (Starter usage) |
| DocuSign (optional) | Business Pro listed at $40/user/month billed annually | $40/user/month (if used) |

## 14.3 Practical Budget Bands for AsiaTravelPlan

## Lean MVP monthly run-rate (recommended start)

- AWS core (Fargate + RDS + Redis + S3 + CloudFront/WAF): $195-$710
- Auth + messaging + email + observability + BI + search: $206-$945
- Estimated platform subtotal (excluding Stripe variable transaction fees): **$401-$1,655/month**

## Growth monthly run-rate (higher traffic + more monitoring)

- AWS core: $700-$2,000+
- SaaS stack (Auth0 Pro, higher messaging volume, Datadog + Sentry, larger BI/search): $800-$3,000+
- Estimated platform subtotal (excluding Stripe variable transaction fees): **$1,500-$5,000+/month**

## 14.4 Cost Control Recommendations

- Start with Cognito instead of Auth0 if minimizing fixed cost is critical.
- Start with Sentry only; add Datadog when infra complexity/scale justifies dual tooling.
- Keep Metabase on Starter until governance/embedding requirements force Pro.
- Use CloudFront Pro flat-rate first; upgrade only when usage clearly exceeds allowances.
- Enforce message templates and notification policies to control Twilio/Meta spend.
- Review per-booking gross margin weekly and cap third-party SaaS cost as a percent of gross margin.

## 14.5 Primary Pricing References

- AWS Fargate pricing: https://aws.amazon.com/fargate/pricing/
- AWS RDS PostgreSQL pricing: https://aws.amazon.com/rds/postgresql/pricing/
- AWS Cognito pricing: https://aws.amazon.com/cognito/pricing/
- AWS WAF pricing: https://aws.amazon.com/waf/pricing/
- AWS CloudFront flat-rate announcement (Nov 18, 2025): https://aws.amazon.com/about-aws/whats-new/2025/11/aws-flat-rate-pricing-plans
- AWS S3 pricing: https://aws.amazon.com/s3/pricing/
- Auth0 pricing: https://auth0.com/pricing
- Stripe pricing: https://stripe.com/pricing
- Postmark pricing: https://postmarkapp.com/pricing
- Twilio WhatsApp pricing: https://www.twilio.com/en-us/whatsapp/pricing
- Sentry pricing: https://sentry.io/pricing/
- Datadog pricing: https://www.datadoghq.com/pricing/list/
- Meilisearch pricing: https://www.meilisearch.com/pricing
- Metabase pricing: https://www.metabase.com/pricing/
- DocuSign pricing: https://ecom.docusign.com/

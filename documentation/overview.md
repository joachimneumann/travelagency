# AsiaTravelPlan Software Overview

### Comparison with Manual Word, Canva, Invoice, And Receipt Workflows

Before this system, a travel agency could create travel plans manually in Microsoft Word, Canva, Google Docs, or similar tools, then create invoices and payment receipts in separate accounting templates. That can work for a small number of trips, but it creates operational problems as volume grows.

Manual document creation usually means:

- each travel plan is copied from an old file or rebuilt from scratch
- formatting quality depends on the individual staff member
- prices, dates, names, destinations, and payment terms are retyped in several places
- itinerary text, offer PDFs, invoices, receipts, and internal booking notes can drift apart
- reusing one good itinerary requires searching through old files and manually copying sections
- multilingual output requires separate manual translation and layout work
- invoice and receipt history is not naturally connected to the booking, offer, or payment step
- management cannot easily see which version was sent, paid, or accepted

The backend system replaces that with structured booking data and generated artifacts.

For travel plans, the practical advantage is reuse:

- a complete travel plan can be saved as a standard tour and applied to another booking
- individual days from existing travel plans can be searched and reused
- individual services from existing travel plans can be searched and reused
- copied travel-plan content gets fresh booking-specific IDs, so it can be edited safely for the new customer
- high-quality routes, day structures, descriptions, hotel/service notes, and images can become reusable building blocks
- staff can start from proven content and customize it instead of beginning with an empty Word or Canva page
- travel-plan PDFs are generated from the structured booking content, which keeps output consistent

For finance, the practical advantage is consistency and traceability:

- the offer, generated offer PDF, payment requests, received-payment records, and receipt PDFs stay attached to the booking
- payment documents are generated from the payment flow instead of being typed manually in a separate invoice file
- receipt documents are tied to the specific payment row they confirm
- accepted commercial snapshots prevent later edits from silently changing the historical payment context
- staff and managers can inspect the booking history instead of reconstructing it from emails and file names

This does not remove expert judgment. Staff still design the trip, adjust the route, write customer-specific details, and decide what should be sent. The system removes repetitive document assembly, reduces copy-paste errors, and turns the best previous work into reusable operational knowledge.


This document provides an overview for new employees who need to understand the AsiaTravelPlan system. It does not replace the detailed technical documents. It explains the main architecture, operational workflows, and where to look next.

Start with this file, then read:

- [README.md](../README.md)
- [documentation/current_system_map.md](current_system_map.md)
- [documentation/concept/software_architecture.md](concept/software_architecture.md)
- [documentation/concept/i18n_runtime.md](concept/i18n_runtime.md)
- [documentation/backend/README.md](backend/README.md)
- [documentation/backend/hetzner.md](backend/hetzner.md)
- [documentation/concept/backup.md](concept/backup.md)

## 1. System In One Page

AsiaTravelPlan is a static public website plus an authenticated backend workspace for travel agency operations.

The system contains:

- a public marketing website with tour cards and a booking form
- a backend workspace for bookings, offers, travel plans, payments, tours, staff profiles, and settings
- a CUE model that defines domain entities, API payloads, enums, and generated contracts
- a Node backend with file-based application persistence
- Keycloak authentication and roles
- Caddy reverse proxy and static file serving
- Docker Compose based local, staging, and production deployments
- Hetzner infrastructure and a Hetzner Storage Box backup path

The most important mental model:

1. `model/` defines the shared meaning of the system.
2. The generator produces OpenAPI and JS contract files.
3. The backend and frontend consume those generated files.
4. Runtime data is mostly JSON/files, not Git.
5. Public homepage tour/team data is generated from editable content.

## 2. Infrastructure: Hetzner Server And Storage Box

### Server

The documented server target is a Hetzner Cloud `CX32` running Ubuntu 24.04.

The server stack uses:

- Docker and Docker Compose
- Caddy for HTTPS, static file serving, and reverse proxying
- Node backend container
- Keycloak container
- PostgreSQL container for Keycloak data
- file volumes/directories for application runtime data and content

Current server layout used by the deploy scripts:

- production checkout: `/srv/asiatravelplan`
- staging checkout: `/srv/asiatravelplan-staging`
- public Caddy runtime root: `/srv/asiatravelplan-public`
- production compose project: `asiatravelplan`
- staging compose project: `asiatravelplan-staging`
- shared Caddy compose project: `asiatravelplan-public`

Important hosts:

- production website: `https://asiatravelplan.com`
- staging website: `https://staging.asiatravelplan.com`
- staging API: `https://api-staging.asiatravelplan.com`
- staging Keycloak: `https://auth-staging.asiatravelplan.com`

Production Caddy serves the public website and backend pages from the production checkout, proxies `/api/*`, `/auth/*`, `/public/v1/*`, and `/integrations/*` to the production backend, and proxies `/keycloak/*` to production Keycloak.

Staging Caddy protects most staging pages with staging access, serves static files from the staging checkout, and proxies backend/API/auth routes to the staging backend and Keycloak.

### Storage Box

The backup strategy uses off-server storage. Hetzner Storage Box is the current concrete target for staging backup scripts.

Implemented scripts:

- `scripts/content/backup_staging_to_storage_box.sh`
- `scripts/content/restore_staging_from_storage_box.sh`

The staging backup script creates:

- `content.tar.gz`
- `backend-app-data.tar.gz`
- `manifest.json`
- `sha256sums.txt`

It uploads them to the Storage Box over SFTP on port `23`.

Required environment variables:

- `STORAGE_BOX_USER`
- `STORAGE_BOX_HOST`

Optional environment variables:

- `STAGING_ROOT`, default `/srv/asiatravelplan-staging`
- `STORAGE_BOX_KEY`, default `~/.ssh/storage_box_backup`
- `BACKUP_PREFIX`, default `staging/snapshots`
- `LOCAL_TMP_ROOT`, default `/tmp`
- `KEEP_LOCAL_ARCHIVES`

Production backup requirements are documented in [documentation/concept/backup.md](concept/backup.md). The concrete production backup script is not currently present in the repository, so a new employee should not assume production backups work the same way until that is verified with the project owner.

Backup principles:

- production is the source of truth
- backups are created on the server, not laptops
- backups must be stored off-server
- staging is not a production backup
- Git is audit/history, not the primary backup
- a backup must be restored in a test to be trusted

## 3. Git Repository Usage

### Repository Map

Important top-level areas:

- `model/` - CUE source of truth for entities, API shapes, enums, and normalized IR
- `tools/generator/` - generation scripts
- `api/generated/` - generated OpenAPI and metadata
- `shared/generated-contract/` - generated JS contract used by runtime code
- `backend/app/Generated/` - backend generated contract re-exports
- `frontend/Generated/` - frontend generated contract re-exports
- `backend/app/` - backend runtime code and runtime data directory
- `frontend/pages/` - static HTML pages
- `frontend/scripts/` - browser ES modules
- `shared/css/` - shared CSS and page/component styles
- `shared/js/` - shared browser helpers
- `content/` - editable content source for tours, standard tours, staff, and country reference
- `backup/` - backup copy only, not active runtime source
- `assets/` - website assets and generated homepage media
- `scripts/` - local, staging, production, content, asset, i18n, and utility scripts
- `documentation/` - architecture, backend, frontend, infrastructure, and concept docs
- `mobile/iOS/` - reduced SwiftUI iOS shell

### What Belongs In Git

Commit:

- source code
- CUE model changes
- generated contract files after model changes
- static frontend files
- editable content intended to be versioned
- documentation
- deployment scripts and examples

Do not commit:

- `.env` files with real secrets
- `backend/app/data/store.json`
- generated runtime PDFs
- uploaded booking images
- traveler photos/documents
- Keycloak runtime database data
- local temporary files

### Generated Code Rule

Do not hand-edit generated files as a normal workflow.

When the model changes, update CUE files first, then regenerate:

```bash
ruby tools/generator/generate_mobile_contract_artifacts.rb
```

Generated outputs include:

- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`
- `mobile/iOS/Generated/` only when explicitly generated for iOS

### Deployment And Git

Server update scripts expect a clean Git deployment flow.

Staging update:

```bash
cd /srv/asiatravelplan-staging
./scripts/deploy/update_staging.sh all
```

Production update:

```bash
cd /srv/asiatravelplan
./scripts/deploy/update_production.sh all
```

The staging update script runs `git fetch origin` and `git pull --ff-only`. This means changes must be merged into the branch used by the server before deployment.

Repository-root wrappers also exist:

```bash
./deploy_frontend
./deploy_backend
./deploy_keycloak
./deploy_all
```

They dispatch differently depending on whether they are run from the local checkout, staging checkout, or production checkout.

## 4. Local Development

Common local commands:

```bash
./scripts/local/deploy_local_all.sh
./scripts/local/deploy_local_backend.sh
./scripts/local/deploy_local_frontend.sh
./scripts/local/deploy_local_backend_frontend.sh
```

Backend only:

```bash
cd backend/app
npm start
```

Backend default URL:

```text
http://localhost:8787
```

Local Caddy can serve the frontend with the local Caddy compose file. Local Keycloak uses:

- `docker-compose.local-keycloak.yml`
- port `8081`

Useful maintenance commands:

```bash
./scripts/content/wipe_local_bookings.sh --yes
node scripts/assets/generate_public_homepage_assets.mjs
./scripts/i18n/translate check
```

Run backend tests from `backend/app`:

```bash
npm test
```

The deploy scripts also run selected backend tests before staging/production backend deploys.

## 5. Authentication, Roles, And Access

Authentication is Keycloak-based when `KEYCLOAK_ENABLED=true`.

The backend supports:

- session cookie login through `/auth/login` and `/auth/callback`
- bearer-token API authorization
- an insecure test-auth mode only when enabled for tests

Role names currently include:

- `atp_admin`
- `atp_manager`
- `atp_accountant`
- `atp_staff`
- `atp_tour_editor`

Important access rules in the current runtime:

- settings are admin-only
- booking list access is available to admin, manager, accountant, and staff roles
- admin, manager, and accountant can read all bookings
- admin and manager can edit all bookings and change assignment
- staff can read and edit only bookings assigned to their Keycloak user id
- accountant is primarily read-only for booking operations
- tour read access is currently admin, accountant, and tour editor
- tour edit access is currently admin and tour editor
- standard tours are available to admin, manager, and staff
- Keycloak user directory visibility is available to admin, manager, and accountant

The access rules live in:

- `backend/app/src/domain/access.js`
- `frontend/scripts/shared/nav.js`
- page-specific permission logic such as `frontend/scripts/pages/settings_list.js`

If the docs and UI disagree, check those files because they describe current runtime behavior.

## 6. Public Website Architecture

The public website is static HTML plus browser ES modules.

Main entry points:

- `frontend/pages/index.html`
- `frontend/scripts/main.js`
- `frontend/scripts/main_tours.js`
- `shared/css/styles.css`

Caddy rewrites `/` and page URLs to files under `frontend/pages/` and serves assets directly.

The homepage contains:

- hero video and destination/style controls
- dynamic tours grid
- trust and review sections
- FAQ
- contact/booking call to action
- multi-step booking modal

The booking form submits to:

```text
POST /public/v1/bookings
```

The backend stores the original public form submission in:

```text
booking.web_form_submission
```

It also creates normalized booking-owned person data in:

```text
booking.persons[]
```

### Static Homepage Data

Public tour/team data is not read live from the backend by the production homepage. It is generated to static frontend files.

Source of truth:

- `content/tours/<tour_id>/tour.json`
- `content/atp_staff/staff.json`
- `content/atp_staff/photos/*`
- `content/country_reference_info.json`

Generated outputs:

- `frontend/data/generated/homepage/public-tours.<lang>.json`
- `frontend/data/generated/homepage/public-team.json`
- `assets/generated/homepage/tours/<tour_id>/<file>`
- `assets/generated/homepage/team/<file>`

Regenerate after changing public homepage content:

```bash
node scripts/assets/generate_public_homepage_assets.mjs
```

## 7. Tours And Backend Content Editing

Tours are editable in the backend through:

- `frontend/pages/marketing_tours.html`
- `frontend/pages/marketing_tour.html`
- `frontend/scripts/pages/tours_list.js`
- `frontend/scripts/pages/tour.js`

Backend handlers:

- `backend/app/src/http/handlers/tours.js`
- `backend/app/src/domain/tours_support.js`
- `backend/app/src/domain/tour_catalog_i18n.js`

Tour source files live under:

```text
content/tours/<tour_id>/tour.json
```

Tour images are stored with tour content and are also copied into generated homepage assets.

Public destination visibility is controlled through:

```text
content/country_reference_info.json
```

The `published_on_webpage` value controls whether a destination appears on the public website and in public tours output. The settings page exposes this as "Website destinations".

Tour publishing rules:

- destination options on the homepage are based only on currently published destinations
- if one destination is published, the destination selector is hidden
- tour card ordering uses human priority plus a random component
- new tours default to priority `50`
- existing priority values are preserved by the sync script

## 8. Translation And Language Architecture

The runtime has three different language concerns:

1. public website language
2. backend UI language
3. customer-facing content language

Do not merge these concepts when making changes.

Important files:

- `shared/generated/language_catalog.js`
- `frontend/scripts/shared/frontend_i18n.js`
- `frontend/scripts/shared/backend_i18n.js`
- `frontend/scripts/booking/i18n.js`
- `frontend/scripts/booking/localized_editor.js`
- `backend/app/src/domain/booking_content_i18n.js`
- `backend/app/src/domain/booking_translation.js`
- `backend/app/src/domain/tour_catalog_i18n.js`
- `backend/app/src/lib/pdf_i18n.js`

Current behavior:

- backend UI language is the ATP staff source/editing language for refactored workflows
- customer content language is the target language for customer-facing content
- localized fields are stored as language-keyed maps
- flat strings in API responses are resolved projections for the requested language
- translation endpoints use explicit `source_lang` and `target_lang`
- translation status metadata can detect stale translations
- manual target-language edits can be preserved from later auto-translation runs
- generated offers, travel-plan PDFs, and payment PDFs use customer/document language, not backend UI language

Examples of localized persisted fields:

- tour title, short description, and highlights
- offer labels and details
- travel plan titles, locations, notes, and segment details
- payment document titles, notes, and component descriptions
- ATP staff profile position and descriptions

## 9. Model, API, Backend, And Frontend Architecture

### Model

The CUE model is the source of truth.

Important folders:

- `model/json/` - file-backed content entities such as tours, standard tours, ATP staff, and country reference
- `model/database/` - operational entities such as bookings, booking persons, offers, travel plans, payment documents
- `model/api/` - transport request/response shapes and read models
- `model/enums/` - currencies, languages, countries, roles, statuses, travel styles, payment kinds
- `model/common/` - reusable base, money, and constraint definitions
- `model/ir/` - normalized intermediate representation used by the generator

Important rule:

- persisted business state belongs in `model/json/` or `model/database/`
- response-only fields belong in `model/api/`
- generated read models should not become accidental persisted fields

### API Contract

The API contract is generated from CUE.

Important outputs:

- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/API/generated_APIRequestFactory.js`
- `shared/generated-contract/API/generated_APIModels.js`
- frontend/backend generated re-exports

Runtime route wiring lives in:

- `backend/app/src/http/routes.js`

The backend is a raw Node HTTP server. It is not an Express app.

### Backend

Backend root:

```text
backend/app/
```

Main entry point:

```text
backend/app/src/server.js
```

Important backend areas:

- `backend/app/src/bootstrap/` - service and handler composition
- `backend/app/src/config/runtime.js` - environment, paths, integrations, constants
- `backend/app/src/http/` - routes, handlers, pagination, HTTP helpers
- `backend/app/src/domain/` - business logic and normalization
- `backend/app/src/lib/` - stores, PDFs, Gmail drafts, Keycloak directory, translation client
- `backend/app/src/integrations/` - Meta webhook integration

Current persistence:

- `backend/app/data/store.json`
- `backend/app/data/pdfs/generated_offers/`
- `backend/app/data/pdfs/payment_documents/`
- `backend/app/data/pdfs/travel_plans/`
- `backend/app/data/pdfs/attachments/`
- `backend/app/data/booking_images/`
- `backend/app/data/booking_person_photos/`
- `content/tours/`
- `content/atp_staff/`
- `content/country_reference_info.json`
- `content/standard_tours/`

PostgreSQL exists in the compose stack for Keycloak. The application booking/tour/content data is currently still file-backed.

### Frontend

Frontend roots:

- `frontend/pages/`
- `frontend/scripts/`
- `shared/css/`
- `shared/js/`
- `shared/generated/`
- `frontend/Generated/`

Backend workspace pages:

- `bookings.html` - booking list
- `booking.html` - booking detail workspace
- `marketing_tours.html` - tour list
- `marketing_tour.html` - tour editor
- `standard-tours.html` - standard tour list
- `standard-tour.html` - standard tour editor
- `settings.html` - reports and settings
- `traveler-details.html` - traveler-facing details flow

The frontend is browser-native HTML and ES modules. There is no SPA framework.

## 10. Backend Features

### Booking Management

The booking is the central operational record.

Core booking features:

- public booking intake from website form
- immutable original web form snapshot
- booking-owned persons and travelers
- booking list search, filtering, pagination, sorting
- booking assignment to Keycloak users
- booking title, destination, style, customer language, and currency
- notes
- activities timeline
- booking image and person photos
- read-only WhatsApp/Meta chat timeline linked to the booking
- section-level optimistic concurrency revisions
- traveler details portal support

Important files:

- `frontend/pages/bookings.html`
- `frontend/scripts/pages/booking_list.js`
- `frontend/pages/booking.html`
- `frontend/scripts/pages/booking.js`
- `frontend/scripts/booking/persons.js`
- `frontend/scripts/booking/core.js`
- `frontend/scripts/booking/whatsapp.js`
- `backend/app/src/http/handlers/booking_query.js`
- `backend/app/src/http/handlers/booking_core.js`
- `backend/app/src/http/handlers/booking_people.js`
- `backend/app/src/http/handlers/booking_chat.js`
- `backend/app/src/domain/booking_views.js`

The current domain direction intentionally avoids a shared CRM master-data layer for customers or traveler groups. Persons belong to the booking.

### Travel Plans

Travel plans are structured, booking-owned itineraries.

They include:

- title and summary
- ordered days
- day dates, titles, overnight locations, notes
- ordered segments such as transport, accommodation, activity, meal, guide, free time, border crossing, and other
- images
- attachments
- generated travel-plan PDFs

Important files:

- `frontend/scripts/booking/travel_plan.js`
- `frontend/scripts/booking/travel_plan_images.js`
- `frontend/scripts/booking/travel_plan_attachments.js`
- `frontend/scripts/booking/travel_plan_pdfs.js`
- `backend/app/src/http/handlers/booking_travel_plan.js`
- `backend/app/src/http/handlers/booking_travel_plan_images.js`
- `backend/app/src/http/handlers/booking_travel_plan_attachments.js`
- `backend/app/src/domain/travel_plan.js`
- `backend/app/src/lib/travel_plan_pdf.js`

Standard tours are reusable tour definitions:

- maintained directly as reusable travel-plan content
- stored independently from bookings
- draft, published, archived lifecycle
- published standard tours can be applied to a booking by copy
- standard tours are not live-linked after apply

### Financial Flow

The financial flow separates proposal creation from payment execution.

Proposal/offer area:

- offer currency
- internal and visible detail levels
- trip/day pricing
- additional items
- discounts
- category rules
- tax and totals
- payment terms
- generated offer PDFs
- Gmail draft creation for generated offer PDFs
- management approval flow

Payments area:

- payment request documents
- payment received data
- receipt references
- customer receipt documents
- accepted commercial snapshot
- payment-linked generated offer snapshot

Payment kinds:

- `DEPOSIT`
- `INSTALLMENT`
- `FINAL_BALANCE`

Financial state is derived from receipt fields:

- `PENDING` when receipt data is incomplete
- `PAID` when receipt data is complete

Important rules:

- offer currency is editable only while the offer is draft
- payment documents are generated from the payment flow
- once a commercial snapshot is accepted, later payment documents use the accepted snapshot
- generated offer deletion must not break payment snapshots that reference it

Important files:

- `frontend/scripts/booking/offers.js`
- `frontend/scripts/booking/offer_pricing.js`
- `frontend/scripts/booking/offer_payment_terms.js`
- `frontend/scripts/booking/payment_flow.js`
- `frontend/scripts/booking/pdf_workspace.js`
- `backend/app/src/http/handlers/booking_finance.js`
- `backend/app/src/http/handlers/booking_payment_documents.js`
- `backend/app/src/domain/pricing.js`
- `backend/app/src/domain/accepted_record.js`
- `backend/app/src/domain/generated_offer_artifacts.js`
- `backend/app/src/lib/offer_pdf.js`
- `backend/app/src/lib/payment_document_pdf.js`
- `backend/app/src/lib/gmail_drafts.js`


### Settings Tab

The backend settings page is:

```text
frontend/pages/settings.html
frontend/scripts/pages/settings_list.js
```

It is currently admin-only.

Settings features:

- backend activity observability
- active backend-process sessions
- most recently changed booking
- Keycloak-backed staff directory table
- ATP staff profile editing
- staff photo upload
- friendly short name
- public team order
- staff languages and destinations
- public website team visibility
- localized staff position, description, and short description
- staff profile translation helpers
- website destination publication controls
- emergency country-reference notes and contacts

Backend/API support:

- `GET /api/v1/settings/observability`
- `GET /api/v1/keycloak_users`
- `GET /api/v1/staff-profiles`
- `PATCH /api/v1/keycloak_users/{username}/staff-profile`
- `POST /api/v1/keycloak_users/{username}/staff-profile/translate-fields`
- `POST /api/v1/keycloak_users/{username}/staff-profile/picture`
- `DELETE /api/v1/keycloak_users/{username}/staff-profile/picture`
- `GET /api/v1/country-reference-info`
- `PATCH /api/v1/country-reference-info`
- ATP staff profile handlers in `backend/app/src/http/handlers/atp_staff.js`
- country reference handlers in `backend/app/src/http/handlers/country_reference.js`

Important data files:

- `content/atp_staff/staff.json`
- `content/atp_staff/photos/*`
- `content/country_reference_info.json`

Saving staff profiles or destination publication may trigger static homepage asset regeneration. If the automatic sync fails, run:

```bash
node scripts/assets/generate_public_homepage_assets.mjs
```

## 11. Integrations

### Keycloak

Keycloak provides authentication, roles, and the assignment directory.

The backend reads assignable users from Keycloak and falls back to a last successful in-memory snapshot when possible.

Key files:

- `backend/app/src/auth.js`
- `backend/app/src/lib/keycloak_directory.js`
- `backend/keycloak-theme/asiatravelplan/`
- `scripts/keycloak/`

### Meta / WhatsApp

The backend has webhook support for Meta and WhatsApp.

Important environment variables:

- `META_WEBHOOK_ENABLED`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_WEBHOOK_ENABLED`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`

Important files:

- `backend/app/src/integrations/meta_webhook.js`
- `backend/app/src/http/handlers/booking_chat.js`
- `frontend/scripts/booking/whatsapp.js`

### Gmail Drafts

Generated offer PDFs can be attached to Gmail drafts.

Required environment variables:

- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_IMPERSONATED_EMAIL`

Important file:

- `backend/app/src/lib/gmail_drafts.js`

### Translation

Translation can use OpenAI and a Google fallback path depending on environment configuration.

Important environment variables:

- `OPENAI_API_KEY`
- `OPENAI_PROJECT_ID`
- `OPENAI_ORGANIZATION_ID`
- `OPENAI_TRANSLATION_MODEL`
- `GOOGLE_TRANSLATE_FALLBACK_ENABLED`

## 12. Secrets, Privacy, And Customer Data

This system handles customer PII and commercial documents.

Sensitive data includes:

- customer names, emails, phone numbers
- traveler details
- traveler photos and document images
- booking notes
- payment documents
- generated offer PDFs
- Gmail draft credentials
- Keycloak secrets
- Meta/WhatsApp webhook secrets
- Google service account credentials

Rules:

- never commit real `.env` files
- never commit runtime booking data or generated PDFs
- keep server secrets only on the server or approved secret storage
- limit access by Keycloak role
- treat backup archives as sensitive
- verify Caddy does not expose hidden server files
- use HTTPS for public/staging/production traffic

## 13. Operational Checks

After local setup or deploy, check:

```bash
curl -i http://localhost:8787/health
curl -i https://api-staging.asiatravelplan.com/health
```

Common smoke flows:

- open public website
- submit booking form
- log into backend through Keycloak
- open booking list
- open booking detail
- edit booking owner/title/person/notes
- create or edit proposal
- generate offer PDF
- create Gmail draft if configured
- create payment request document
- record payment received
- generate customer receipt document
- edit travel plan
- generate travel-plan PDF
- edit a tour and upload image
- change website destination publication
- verify generated homepage tour/team files after content changes
- logout/login

Common server commands:

```bash
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs -f backend
docker compose -f docker-compose.staging.yml logs -f keycloak
docker compose -f docker-compose.staging.yml logs -f caddy
```

For production, use the production compose file from `/srv/asiatravelplan`.

## 14. Known Limitations And Current Exceptions

New employees should know these limitations before changing the system:

- application data is currently file-backed, not database-backed
- PostgreSQL currently stores Keycloak data, not the main booking store
- some backend routes and runtime behavior are still handwritten
- Meta webhook endpoints are handwritten exceptions
- tour upload behavior has handwritten parts
- translation workflows still have runtime-specific behavior
- mobile iOS is currently a reduced shell, not a full booking/tour app
- generated Swift contract files are not currently checked in
- production Storage Box backup automation is conceptually documented but not implemented as a concrete script in this repo

These limitations are acceptable only while they remain explicit and aligned with the model, API contract, and current runtime docs.

## 15. Glossary

- Booking: the central operational record for one customer inquiry or trip.
- Booking person: a contact or traveler stored inside a booking.
- Web form submission: immutable snapshot of the original website booking request.
- Offer/proposal: editable commercial proposal for a booking.
- Generated offer: frozen offer PDF artifact and snapshot created from the proposal.
- Payment document: request or receipt PDF generated from the payment flow.
- Accepted commercial snapshot: frozen offer/payment terms used for later payment documents.
- Travel plan: booking-owned structured itinerary.
- Standard tour: reusable tour definition copied into bookings.
- Tour: marketing catalog item shown on the public website when published.
- Country reference: country-level operational information and public destination visibility.
- Backend UI language: language used by ATP staff in backend chrome and authoring.
- Customer content language: language used for customer-facing content and PDFs.
- Source language: language branch that staff are authoring from.
- Target language: language branch produced by translation.
- ATP staff profile: public/internal guide profile linked to a Keycloak user.

## 16. First-Week Checklist

1. Read this overview and [documentation/current_system_map.md](current_system_map.md).
2. Start the local stack with `./scripts/local/deploy_local_all.sh`.
3. Open the public site and submit a test booking.
4. Log into the backend through Keycloak.
5. Trace the booking from website form to `booking.persons[]`.
6. Read `model/root.cue` and `model/api/endpoints.cue`.
7. Find the generated request factory used by a frontend page.
8. Edit a staging-safe tour and regenerate homepage assets.
9. Create a proposal, generated offer PDF, and payment document in a non-production environment.
10. Review backup and restore scripts before touching server data.
11. Ask the project owner which production secrets and server permissions you should have.

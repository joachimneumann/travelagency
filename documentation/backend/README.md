# AsiaTravelPlan Backend App

This backend now uses a booking-owned person model.

Core principles:
- `booking` is the operational record
- `booking.persons[]` stores the contact and traveler data for that booking
- there is no separate shared master-data model for booking contacts or traveler groups
- incoming website form data is stored as an immutable `booking.web_form_submission` snapshot

## Run

```bash
cd backend/app
npm start
```

Default URL: `http://localhost:8787`

Important environment variables:
- `PORT`
- `CORS_ORIGIN`
- `BACKEND_DATA_DIR`
- `STORE_FILE`
- `KEYCLOAK_ENABLED`
- `KEYCLOAK_BASE_URL`
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_ALLOWED_TOKEN_CLIENT_IDS`
- `KEYCLOAK_REDIRECT_URI`
- `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`
- `KEYCLOAK_ALLOWED_ROLES`
- `RETURN_TO_ALLOWED_ORIGINS`
- `META_WEBHOOK_ENABLED`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_WEBHOOK_ENABLED`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_IMPERSONATED_EMAIL`
- `ZOHO_ACCOUNTS_BASE_URL`
- `ZOHO_MAIL_API_BASE_URL`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ACCOUNT_ID`
- `WEB_INQUIRY_NOTIFICATION_ENABLED`
- `WEB_INQUIRY_NOTIFICATION_FROM`
- `WEB_INQUIRY_NOTIFICATION_TO`
- `WEB_INQUIRY_NOTIFICATION_BACKEND_BASE_URL`
- `WEB_INQUIRY_NOTIFICATION_LOGO_URL`
- `BASE_CURRENCY`
- `EXCHANGE_RATE_<FROM>_<TO>`
- `EXCHANGE_RATE_OVERRIDES`

Gmail draft creation for generated offers requires:
- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_IMPERSONATED_EMAIL`

Booking notification email sends through the Zoho Mail API when a public website booking is created:
- `ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.com`
- `ZOHO_MAIL_API_BASE_URL=https://mail.zoho.com`
- `ZOHO_CLIENT_ID=1000.YWWEP9YOU6NCNE4JBBRXEIK61NBCJC`
- `ZOHO_CLIENT_SECRET=<Zoho client secret>`
- `ZOHO_REFRESH_TOKEN=<Zoho refresh token>`
- `ZOHO_ACCOUNT_ID=3042681000000008002`
- `WEB_INQUIRY_NOTIFICATION_ENABLED=true`
- `WEB_INQUIRY_NOTIFICATION_FROM=noreply@asiatravelplan.com`
- `WEB_INQUIRY_NOTIFICATION_TO=booking@asiatravelplan.com`
- `WEB_INQUIRY_NOTIFICATION_BACKEND_BASE_URL=https://asiatravelplan.com`
- `WEB_INQUIRY_NOTIFICATION_LOGO_URL=https://asiatravelplan.com/assets/generated/runtime/brand-logo.png`

## Storage

Runtime JSON persistence:
- `backend/app/data/app-data.json`
- `backend/app/data/pdfs/payment_documents/`
- `backend/app/data/booking_images/`
- `backend/app/data/booking_person_photos/`
- `content/tours/<tour_id>/tour.json`
- `content/country_reference_info.json`

Notes:
- `backend/app/data/app-data.json` is runtime data and is not tracked in Git
- startup creates an empty store automatically if the file is missing
- bookings, activities, payment documents, and chats are the active operational store domains
- tours and country reference info remain file-backed content domains

## Current Architecture

Implemented now:
- public booking ingestion
- public tour catalog
- country-reference publication controls for the public website
- booking assignment and operational follow-up
- booking notes, offers, activities, and payment-flow documents
- booking-owned persons
- Keycloak-backed ATP user assignment
- Keycloak-protected backend access
- Meta webhook ingestion linked to bookings

Administrative pages:
- `/bookings.html`
- `/booking.html`
- `/marketing_tour.html`
- `/emergency.html`

## API Endpoints

Operational and integration:
- `GET /health`
- `GET /integrations/meta/webhook/status`
- `GET /integrations/meta/webhook`
- `POST /integrations/meta/webhook`
- staging access endpoints under `/staging-access/*`

Public:
- `GET /public/v1/mobile/bootstrap`
- `GET /public/v1/tours`
- `GET /public/v1/team`
- `GET /public/v1/tour-images/:path`
- `GET /public/v1/booking-images/:path`
- `GET /public/v1/booking-person-photos/:path`
- `POST /public/v1/bookings`
- public traveler-details routes under `/public/v1/bookings/:bookingId/persons/:personId/traveler-details*`

`GET /public/v1/tours` currently:
- filters tours and destination options against `content/country_reference_info.json`
- uses `published_on_webpage` as the source of truth for public destination visibility
- responds with `Cache-Control: no-store` so publication changes appear immediately after reload

`GET /public/v1/booking-person-photos/:path` serves traveler photos and document images only to an authenticated backend session or a valid traveler-details signed token. It uses private/no-store caching because these files can contain PII.

Admin API:
- `GET /api/v1/bookings`
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`
- `DELETE /api/v1/bookings/:bookingId`
- `POST /api/v1/bookings/:bookingId/clone`
- `GET /api/v1/bookings/:bookingId/chat`
- `PATCH /api/v1/bookings/:bookingId/name`
- `PATCH /api/v1/bookings/:bookingId/customer-language`
- `PATCH /api/v1/bookings/:bookingId/source`
- `POST /api/v1/bookings/:bookingId/image`
- `PATCH /api/v1/bookings/:bookingId/owner`
- `POST /api/v1/bookings/:bookingId/translate-fields`
- `POST /api/v1/bookings/:bookingId/persons`
- `PATCH /api/v1/bookings/:bookingId/persons/:personId`
- `DELETE /api/v1/bookings/:bookingId/persons/:personId`
- `POST /api/v1/bookings/:bookingId/persons/:personId/photo`
- `POST /api/v1/bookings/:bookingId/persons/:personId/documents/:documentType/picture`
- `POST /api/v1/bookings/:bookingId/persons/:personId/traveler-details-link`
- `PATCH /api/v1/bookings/:bookingId/notes`
- travel-plan routes under `/api/v1/bookings/:bookingId/travel-plan*`
- `PATCH /api/v1/bookings/:bookingId/offer`
- `POST /api/v1/bookings/:bookingId/generated-offers`
- `PATCH /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId`
- `DELETE /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId`
- `GET /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId/pdf`
- `POST /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId/gmail-draft`
- `GET /api/v1/bookings/:bookingId/activities`
- `POST /api/v1/bookings/:bookingId/activities`
- `GET /api/v1/bookings/:bookingId/payment-documents`
- `POST /api/v1/bookings/:bookingId/payment-documents`
- `GET /api/v1/payment-documents/:documentId/pdf`
- `POST /api/v1/offers/exchange-rates`
- `GET /api/v1/keycloak_users`
- staff-profile routes under `/api/v1/keycloak_users/:username/staff-profile*`
- `GET /api/v1/settings/observability`
- `GET /api/v1/tours`
- `GET /api/v1/tours/:tourId`
- `POST /api/v1/tours`
- `PATCH /api/v1/tours/:tourId`
- `DELETE /api/v1/tours/:tourId`
- `POST /api/v1/tours/translate-fields`
- `GET /api/v1/tours/:tourId/video`
- `POST /api/v1/tours/:tourId/video`
- `DELETE /api/v1/tours/:tourId/video`
- `GET /api/v1/country-reference-info`
- `PATCH /api/v1/country-reference-info`

The generated OpenAPI file at `api/generated/openapi.yaml` is the modeled transport source of truth. The tour video routes are runtime editor routes and must remain documented alongside the generated route list until they are moved into the model.

## Website Booking Form

When a public booking is created:
- the submitted form is stored in `booking.web_form_submission`
- the backend also normalizes a first booking person from the submitted contact fields
- later edits happen on `booking.persons[]`, not on a separate customer record

Relevant website fields:
- destinations
- travel style
- travel month
- number of travelers
- preferred currency
- preferred language
- travel duration min/max
- contact name, email, phone
- budget lower/upper USD
- notes

## Booking List and Detail

`GET /api/v1/bookings` supports:
- `page`
- `page_size`
- `assigned_keycloak_user_id`
- `search`
- `sort`

Common `sort` values:
- `created_at_desc`
- `created_at_asc`
- `updated_at_desc`
- `updated_at_asc`

Commercial document currency rules:
- booking offer currency is editable only while `offer.status == "DRAFT"`
- payment documents are generated from the booking/payment flow and do not have a standalone edit route
- once an offer is approved/sent, later payment documents use the accepted commercial snapshot instead of a separately editable document currency

The booking list and detail views use booking-owned people:
- primary contact comes from `booking.persons`
- traveler counts come from `booking.number_of_travelers` and person roles
- chat matching is based on booking contact phone/email data

Mutating booking endpoints use section-specific optimistic concurrency checks.

Current request fields are:
- `expected_core_revision` for booking core mutations such as `name`, `customer_language`, `source`, and `owner`
- `expected_persons_revision` for booking person and person-photo mutations
- `expected_notes_revision` for booking notes
- `expected_offer_revision` for offer updates
- `expected_payment_documents_revision` for payment-document creation

Generated-offer email drafts:
- `POST /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId/gmail-draft` creates a Gmail draft for the frozen generated-offer PDF
- the response returns `draft_id`, `gmail_draft_url`, `recipient_email`, `generated_offer_id`, and `activity_logged`
- `gmail_draft_url` currently points to Gmail Drafts, not to a deep link into the compose editor
- if the draft is created but the booking activity cannot be persisted, the route still returns success with `activity_logged: false` and a `warning`

## Roles

Current role behavior:
- `atp_staff`: read and edit only assigned bookings; no tour access unless combined with another role
- `atp_manager`: read and edit all bookings, change assignment, and view assignable Keycloak users; no tour access unless combined with another role
- `atp_admin`: read and edit all bookings, tours, country reference data, settings, and staff profiles
- `atp_accountant`: read all bookings, read tours, view assignable Keycloak users, no booking editing, no tour editing
- `atp_tour_editor`: read and edit tours and country reference data; no booking access unless combined with another role

Booking assignment is stored as `booking.assigned_keycloak_user_id`, using the durable Keycloak user id directly.
There is no local ATP user directory anymore.

`GET /api/v1/keycloak_users` is the assignment directory endpoint.

The Keycloak assignment directory is treated as a live integration, not a persisted cache:
- the backend resolves assignable users directly from Keycloak
- the UI shows Keycloak `name`, then `username`, then raw id as fallback
- transient Keycloak directory failures fall back to the last successful in-memory snapshot when available

Booking-person normalization is centralized in `backend/app/src/lib/booking_persons.js`.
Handlers, read models, and store normalization should reuse that module instead of re-implementing person defaults or fallback names.

## Local Keycloak

Helper scripts:
- `scripts/local/start_local_keycloak.sh`
- `scripts/local/stop_local_keycloak.sh`
- `scripts/local/restart_local_keycloak.sh`
- `node backend/app/scripts/prune_stale_content_translations.js`
  - dry-run by default
  - add `--write` to persist
  - keeps the booking's current customer language plus inferred backend source-language branches in booking offer and travel-plan localized fields
  - prunes section translation metadata to kept target languages only

Recommended local setup:
- Keycloak on `http://localhost:8081`
- backend on `http://localhost:8787`
- frontend on `http://localhost:8080`

Required local Keycloak client:
- realm: your chosen local realm, commonly `master`
- client id: `asiatravelplan-backend`
- type: OpenID Connect confidential client
- redirect URI: `http://localhost:8787/auth/callback`
- bearer token clients: `KEYCLOAK_ALLOWED_TOKEN_CLIENT_IDS`, defaulting to `asiatravelplan-backend,asiatravelplan-ios`

## Notes

- The generated OpenAPI contract in `api/generated/openapi.yaml` is the transport contract.
- The active model source is under `model/`.
- Mobile documentation may describe future usage, but the backend contract and model already follow the booking-owned person architecture.

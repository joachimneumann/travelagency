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
- `BASE_CURRENCY`
- `EXCHANGE_RATE_<FROM>_<TO>`
- `EXCHANGE_RATE_OVERRIDES`

Gmail draft creation for generated offers requires:
- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_IMPERSONATED_EMAIL`

## Storage

Runtime JSON persistence:
- `backend/app/data/store.json`
- `backend/app/data/tours/<tour_id>/tour.json`
- `backend/app/data/invoices/`
- `backend/app/data/booking_images/`
- `backend/app/data/booking_person_photos/`

Notes:
- `backend/app/data/store.json` is runtime data and is not tracked in Git
- startup creates an empty store automatically if the file is missing
- bookings, activities, invoices, chats, and tours are the active persisted domains

## Current Architecture

Implemented now:
- public booking ingestion
- public tour catalog
- booking pipeline stages and assignment
- booking notes, pricing, offer, activities, invoices
- booking-owned persons
- Keycloak-backed ATP user assignment
- Keycloak-protected backend access
- Meta webhook ingestion linked to bookings

Administrative pages:
- `/backend.html`
- `/booking.html`
- `/persons.html`
- `/tour.html`

`/persons.html` is a booking-derived person search page. It is not a standalone person CRUD domain.

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
- `GET /public/v1/tour-images/:path`
- `GET /public/v1/booking-images/:path`
- `GET /public/v1/booking-person-photos/:path`
- `POST /public/v1/bookings`

Admin API:
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`
- `DELETE /api/v1/bookings/:bookingId`
- `GET /api/v1/bookings/:bookingId/chat`
- `PATCH /api/v1/bookings/:bookingId/name`
- `POST /api/v1/bookings/:bookingId/image`
- `PATCH /api/v1/bookings/:bookingId/stage`
- `PATCH /api/v1/bookings/:bookingId/owner`
- `POST /api/v1/bookings/:bookingId/persons`
- `PATCH /api/v1/bookings/:bookingId/persons/:personId`
- `DELETE /api/v1/bookings/:bookingId/persons/:personId`
- `POST /api/v1/bookings/:bookingId/persons/:personId/photo`
- `PATCH /api/v1/bookings/:bookingId/notes`
- `PATCH /api/v1/bookings/:bookingId/pricing`
- `PATCH /api/v1/bookings/:bookingId/offer`
- `POST /api/v1/bookings/:bookingId/generated-offers`
- `PATCH /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId`
- `DELETE /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId`
- `GET /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId/pdf`
- `POST /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId/gmail-draft`
- `GET /api/v1/bookings/:bookingId/activities`
- `POST /api/v1/bookings/:bookingId/activities`
- `GET /api/v1/bookings/:bookingId/invoices`
- `POST /api/v1/bookings/:bookingId/invoices`
- `PATCH /api/v1/bookings/:bookingId/invoices/:invoiceId`
- `GET /api/v1/invoices/:invoiceId/pdf`
- `POST /api/v1/offers/exchange-rates`
- `GET /api/v1/keycloak_users`
- `GET /api/v1/tours`
- `GET /api/v1/tours/:tourId`
- `POST /api/v1/tours`
- `PATCH /api/v1/tours/:tourId`
- `POST /api/v1/tours/:tourId/image`

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
- `stage`
- `assigned_keycloak_user_id`
- `search`
- `sort`

Common `sort` values:
- `created_at_desc`
- `created_at_asc`
- `updated_at_desc`
- `updated_at_asc`
- `stage_asc`
- `stage_desc`

Commercial document currency rules:
- booking offer currency is editable only while `offer.status == "DRAFT"`
- invoice currency is editable only while `invoice.status == "DRAFT"`
- once an offer is approved/sent or an invoice is sent/paid/void, the backend rejects currency changes even if an old client tries to submit them

The booking list and detail views use booking-owned people:
- primary contact comes from `booking.persons`
- traveler counts come from `booking.number_of_travelers` and person roles
- chat matching is based on booking contact phone/email data

Mutating booking endpoints use section-specific optimistic concurrency checks.

Current request fields are:
- `expected_core_revision` for booking core mutations such as `name`, `stage`, and `owner`
- `expected_persons_revision` for booking person and person-photo mutations
- `expected_notes_revision` for booking notes
- `expected_pricing_revision` for pricing updates
- `expected_offer_revision` for offer updates
- `expected_invoices_revision` for invoice mutations

Generated-offer email drafts:
- `POST /api/v1/bookings/:bookingId/generated-offers/:generatedOfferId/gmail-draft` creates a Gmail draft for the frozen generated-offer PDF
- the response returns `draft_id`, `gmail_draft_url`, `recipient_email`, `generated_offer_id`, and `activity_logged`
- `gmail_draft_url` currently points to Gmail Drafts, not to a deep link into the compose editor
- if the draft is created but the booking activity cannot be persisted, the route still returns success with `activity_logged: false` and a `warning`

## Roles

Current role behavior:
- `atp_staff`: read and edit only assigned bookings, read tours, edit tours
- `atp_manager`: read and edit all bookings, change assignment, view assignable Keycloak users, read tours, edit tours
- `atp_admin`: same booking and tour capabilities as manager
- `atp_accountant`: read all bookings, read tours, view assignable Keycloak users, no booking editing, no tour editing

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
- `scripts/start_local_keycloak.sh`
- `scripts/stop_local_keycloak.sh`
- `scripts/restart_local_keycloak.sh`

Recommended local setup:
- Keycloak on `http://localhost:8081`
- backend on `http://localhost:8787`
- frontend on `http://localhost:8080`

Required local Keycloak client:
- realm: your chosen local realm, commonly `master`
- client id: `asiatravelplan-backend`
- type: OpenID Connect confidential client
- redirect URI: `http://localhost:8787/auth/callback`

## Notes

- The generated OpenAPI contract in `api/generated/openapi.yaml` is the transport contract.
- The active model source is under `model/`.
- Mobile documentation may describe future usage, but the backend contract and model already follow the booking-owned person architecture.

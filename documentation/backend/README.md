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
- `KEYCLOAK_ENABLED`
- `KEYCLOAK_BASE_URL`
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_REDIRECT_URI`
- `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`
- `KEYCLOAK_ALLOWED_ROLES`
- `META_WEBHOOK_ENABLED`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `BASE_CURRENCY`
- `EXCHANGE_RATE_<FROM>_<TO>`

## Storage

Runtime JSON persistence:
- `backend/app/data/store.json`
- `backend/app/data/tours/<tour_id>/tour.json`
- `backend/app/data/invoices/`

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

Public:
- `GET /integrations/meta/webhook/status`
- `GET /integrations/meta/webhook`
- `POST /integrations/meta/webhook`
- `GET /public/v1/mobile/bootstrap`
- `GET /public/v1/tours`
- `GET /public/v1/tour-images/:path`
- `POST /public/v1/bookings`
- staging access endpoints under `/staging-access/*`

Admin API:
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`
- `DELETE /api/v1/bookings/:bookingId`
- `GET /api/v1/bookings/:bookingId/chat`
- `PATCH /api/v1/bookings/:bookingId/stage`
- `PATCH /api/v1/bookings/:bookingId/owner`
- `PATCH /api/v1/bookings/:bookingId/notes`
- `PATCH /api/v1/bookings/:bookingId/pricing`
- `PATCH /api/v1/bookings/:bookingId/offer`
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

The booking list and detail views use booking-owned people:
- primary contact comes from `booking.persons`
- traveler counts come from `booking.number_of_travelers` and person roles
- chat matching is based on booking contact phone/email data

## Roles

Current role behavior:
- `atp_staff`: read and edit only assigned bookings
- `atp_manager`: read and edit all bookings, change assignment
- `atp_admin`: same as manager plus tour editing
- `atp_accountant`: read all bookings, read tours, no booking editing

Booking assignment is stored as `booking.assigned_keycloak_user_id`, using the durable Keycloak user id directly.
There is no local ATP user directory anymore.

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

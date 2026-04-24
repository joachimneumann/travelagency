# AsiaTravelPlan Local Backend Integration

This guide describes the current local setup with the booking-owned person model.

## What Exists

Local backend features:
- public booking ingestion
- public tours catalog
- country-reference publication controls for the public website
- booking pipeline and assignment
- booking detail editing
- booking-owned persons
- payment documents and pricing
- Keycloak user assignment lookup
- Keycloak login

Local admin pages:
- `http://localhost:8080/bookings.html`
- `http://localhost:8080/booking.html?id=<booking_id>`
- `http://localhost:8080/marketing_tour.html?id=<tour_id>`
- `http://localhost:8080/emergency.html`

## Start Locally

Backend:

```bash
cd backend/app
npm start
```

Frontend:

```bash
cd ~/projects/travelagency
./scripts/local/deploy_local_frontend.sh
```

Optional local Keycloak:

```bash
cd ~/projects/travelagency
./scripts/local/start_local_keycloak.sh
```

Recommended split-origin setup:
- frontend: `http://localhost:8080`
- backend: `http://localhost:8787`
- keycloak: `http://localhost:8081`

Set:

```bash
export CORS_ORIGIN='http://localhost:8080'
```

If you want the generated-offer `email` action to create Gmail drafts locally, also set:

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON_PATH="$HOME/.config/asiatravelplan/gmail-service-account.json"
export GOOGLE_IMPERSONATED_EMAIL='info@asiatravelplan.com'
```

Notes:
- keep the service-account JSON file outside the repository
- if these Gmail variables are missing, the Gmail draft endpoint returns `503`
- the booking UI still loads normally without Gmail draft support

## Seed Data

```bash
cd backend/app
npm run seed -- --count 40
```

This creates sample:
- bookings
- booking persons
- activities
- payment documents
- tours

## Public Booking Flow

The website posts to:
- `POST /public/v1/bookings`

Stored on each booking:
- immutable `web_form_submission`
- normalized `persons[]`

The submitted contact becomes the initial booking person and can later be refined on the booking itself.

## Public tour visibility

- `GET /public/v1/tours` is filtered by `content/country_reference_info.json`
- each supported country can be hidden from the public website via `published_on_webpage`
- when only one destination remains published, the homepage hides the destination selector and builds the hero title from that remaining country
- public tours are served with `Cache-Control: no-store`, so destination publication changes appear on reload

## Backend UI

`bookings.html`
- bookings table
- tours table
- Keycloak-backed assignment controls inside booking detail

`booking.html`
- booking header
- ATP staff assignment
- operational follow-up fields
- notes
- persons summary
- offer
- pricing
- payment documents
- activities
- read-only Meta chat timeline

There is no customer page and no travel-group page.

`emergency.html`
- edit country practical tips and emergency contacts
- control `published_on_webpage` for each supported destination
- this page is currently the operational source of truth for homepage destination visibility

## Role Behavior

- `atp_staff`: only assigned bookings; no tour access unless combined with another role
- `atp_manager`: all bookings + assignment + Keycloak user directory access; no tour access unless combined with another role
- `atp_admin`: all booking, tour, country-reference, settings, and staff-profile capabilities
- `atp_accountant`: all bookings read, tours read-only, Keycloak user directory access
- `atp_tour_editor`: tour and country-reference editing; no booking access unless combined with another role

## Verification Checklist

1. Open `bookings.html`.
2. Confirm bookings load.
3. Open a booking.
4. Confirm persons summary renders from `booking.persons`.
5. Confirm ATP staff assignment works according to role.
6. Open `marketing_tour.html` and confirm tours still load.
7. Open `emergency.html`, change `published_on_webpage` for a country, and confirm a normal homepage reload reflects the destination visibility change.
8. If Gmail draft config is set, use the generated-offer `email` action and confirm Gmail opens the Drafts view with the new draft available.

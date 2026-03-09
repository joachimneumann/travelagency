# AsiaTravelPlan Local Backend Integration

This guide describes the current local setup with the booking-owned person model.

## What Exists

Local backend features:
- public booking ingestion
- public tours catalog
- booking pipeline and assignment
- booking detail editing
- booking-owned persons
- invoices and pricing
- ATP staff management
- Keycloak login

Local admin pages:
- `http://localhost:8080/backend.html`
- `http://localhost:8080/booking.html?id=<booking_id>`
- `http://localhost:8080/persons.html`
- `http://localhost:8080/tour.html?id=<tour_id>`

## Start Locally

Backend:

```bash
cd backend/app
npm start
```

Frontend:

```bash
cd ~/projects/travelagency
./scripts/start_local_frontend.sh
```

Optional local Keycloak:

```bash
cd ~/projects/travelagency
./scripts/start_local_keycloak.sh
```

Recommended split-origin setup:
- frontend: `http://localhost:8080`
- backend: `http://localhost:8787`
- keycloak: `http://localhost:8081`

Set:

```bash
export CORS_ORIGIN='http://localhost:8080'
```

## Seed Data

```bash
cd backend/app
npm run seed -- --count 40
```

This creates sample:
- bookings
- booking persons
- activities
- invoices
- tours

## Public Booking Flow

The website posts to:
- `POST /public/v1/bookings`

Stored on each booking:
- immutable `web_form_submission`
- normalized `persons[]`

The submitted contact becomes the initial booking person and can later be refined on the booking itself.

## Backend UI

`backend.html`
- bookings table
- tours table
- ATP staff panel
- link to person search

`booking.html`
- booking header
- ATP staff assignment
- stage change
- notes
- persons summary
- offer
- pricing
- invoices
- activities
- read-only Meta chat timeline

`persons.html`
- booking-derived person search
- links back to related bookings

There is no customer page and no travel-group page.

## Role Behavior

- `atp_staff`: only assigned bookings
- `atp_manager`: all bookings + assignment + ATP staff creation
- `atp_admin`: manager rights + tour editing
- `atp_accountant`: all bookings read, stage changes, tours read-only

## Verification Checklist

1. Open `backend.html`.
2. Confirm bookings load.
3. Open a booking.
4. Confirm persons summary renders from `booking.persons`.
5. Confirm stages and ATP staff assignment work according to role.
6. Open `persons.html` and verify person search links back to bookings.
7. Open `tour.html` and confirm tours still load.

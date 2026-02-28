# AsiaTravelPlan Backend Usage and Local Web Integration Guide

This guide explains:
- how to run and use the local backend
- how to connect it to a locally executed AsiaTravelPlan website
- how to verify the integration end-to-end

## 1) What is implemented now

Local backend implementation (Milestone 1) is in:
- `backend/app/src/server.js`
- `backend/app/data/store.json`
- `backend/app/data/tours/`
- `backend/app/config/staff.json`
- `backend/app/scripts/seed.js`

Features available now:
- Public booking ingestion (`POST /public/v1/bookings`)
- Public tours catalog (`GET /public/v1/tours`)
- Public backend-hosted tour images (`GET /public/v1/tour-images/:path`)
- Booking pipeline and stage transitions
- Customer deduplication
- Booking ownership assignment + SLA due timestamps
- Booking activity timeline
- Staff lookup API for assignment controls (`GET /api/v1/staff`)
- Admin API (Keycloak protected)
- Keycloak login/session support (`/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me`)
- Lightweight admin pages (`/admin`, `/admin/bookings`, `/admin/bookings/:id`, `/admin/customers`, `/admin/customers/:id`)
- Branded frontend backoffice pages (`backend.html`, `backend-booking.html`)
- `backend.html` lists tours
- clicking a tour ID opens `backend-tour.html` for editing
  - destination and styles are edited with checkbox groups
  - image upload converts to WebP (max 1000px) automatically

## 2) Start the backend locally

From repo root:

```bash
cd backend/app
npm start
```

Default backend URL:
- `http://localhost:8787`

Important environment variables:
- `PORT` (default `8787`)
- `CORS_ORIGIN` (default `*`)
- `KEYCLOAK_ENABLED` (default `false`)
- `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_REDIRECT_URI` (default `http://localhost:8787/auth/callback`)
- `KEYCLOAK_ALLOWED_ROLES`

## 3) Seed test data

```bash
cd backend/app
npm run seed -- --count 40
```

This appends realistic customers/bookings/activities into `backend/app/data/store.json`.

## 4) Use the backend APIs

## 4.1 Public booking endpoint

```bash
curl -X POST http://localhost:8787/public/v1/bookings \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: local-demo-1' \
  -d '{
    "destination": "Vietnam",
    "style": "Adventure",
    "travelMonth": "2026-11",
    "duration": "9-12 days",
    "travelers": "2",
    "budget": "$900-$1,400 / week",
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "phone": "+1 415 555 0100",
    "language": "English",
    "notes": "Interested in family-friendly options",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "asiatravelplan_local_test",
    "pageUrl": "http://localhost:8080/",
    "referrer": "https://google.com"
  }'
```

## 4.2 Admin API auth

All `/api/v1/*` endpoints require Keycloak auth.

Browser session example:

```bash
curl -b cookie.txt \
  'http://localhost:8787/api/v1/bookings?page=1&page_size=10&sort=created_at_desc'
```

Supported filters on `GET /api/v1/bookings`:
- `page`, `page_size`
- `stage`
- `owner_id`
- `search`
- `sort` (`created_at_desc`, `created_at_asc`, `updated_at_desc`, `sla_due_at_asc`, `sla_due_at_desc`)

Bearer token example (service-to-service):

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/bookings?page=1&page_size=10&sort=created_at_desc'
```

## 4.3 Admin web pages

Open in browser:
- `http://localhost:8787/admin`
- `http://localhost:8787/admin/bookings`
- `http://localhost:8787/admin/customers`

## 5) Integrate with locally executed AsiaTravelPlan webpage

The frontend submit logic in `assets/js/main.js` already supports backend integration.

It uses:
- `window.ASIATRAVELPLAN_API_BASE` if defined
- otherwise relative `/public/v1/bookings`

Tours source:
- Website tour cards are loaded from backend `GET /public/v1/tours` when `window.ASIATRAVELPLAN_API_BASE` is set.
- Backend persists tours in per-tour folders under `backend/app/data/tours/<tour_id>/tour.json`.
- Tour images are stored and served by backend from `backend/app/data/tours/<tour_id>/`.

Branded backend web UI:
- `backend.html` provides a AsiaTravelPlan-styled backend workspace page.
- It shows:
  - paginated searchable Customers table (newest first, page size 10)
  - paginated searchable Bookings table (newest first, page size 10)
  - paginated searchable Tours table
- tour IDs open `backend-tour.html` for editing
- Booking/customer IDs link to `backend-booking.html`.
- Backend pages include `Website` and `Logout` actions in the header.
- The main site header now includes a single `backend` button (no dropdown).
- Clicking `backend` triggers Keycloak login (`/auth/login`) in the main window and returns to `backend.html`.
- The main site also displays `Logged in as: ...` below the `backend` button using `/auth/me`.

## 5.1 Recommended local setup (split origin)

Run backend on `8787`, static site on another port (for example `8080`).

Terminal A (backend):

```bash
cd backend/app
KEYCLOAK_ENABLED=true \
KEYCLOAK_BASE_URL='http://localhost:8081' \
KEYCLOAK_REALM='master' \
KEYCLOAK_CLIENT_ID='asiatravelplan-backend' \
KEYCLOAK_CLIENT_SECRET='YOUR_CLIENT_SECRET' \
KEYCLOAK_REDIRECT_URI='http://localhost:8787/auth/callback' \
KEYCLOAK_ALLOWED_ROLES='admin,staff_joachim,staff_van' \
CORS_ORIGIN='http://localhost:8080' \
npm start
```

Terminal B (website):

```bash
cd /Users/internal_admin/projects/travelagency
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080`

Set API base before loading `assets/js/main.js`:
- This is now auto-set in `index.html` for localhost (`localhost`/`127.0.0.1`) to `http://localhost:8787`.

### Persistent local Keycloak theme setup

For local Keycloak on Docker, use the repo-managed compose file so the custom theme is mounted persistently instead of copied into the container manually.

Files:
- `docker-compose.local-keycloak.yml`
- `backend/keycloak-theme/asiatravelplan/`

Scripts:
- `./scripts/start_local_keycloak.sh`
- `./scripts/stop_local_keycloak.sh`
- `./scripts/restart_local_keycloak.sh`

Start Keycloak:

```bash
cd /Users/internal_admin/projects/travelagency
./scripts/start_local_keycloak.sh
```

This starts Keycloak on:
- `http://localhost:8081`

The compose file mounts:
- host: `/Users/internal_admin/projects/travelagency/backend/keycloak-theme/asiatravelplan`
- container: `/opt/keycloak/themes/asiatravelplan`

Important behavior:
- the custom login theme survives container restarts/recreates
- theme cache is disabled in local dev for faster CSS/theme iteration

After Keycloak is running:
1. Open Keycloak admin.
2. Go to `Realm settings`.
3. Open `Themes`.
4. Set `Login theme` to `asiatravelplan`.
5. Save.

If the theme does not appear in the dropdown:

```bash
docker compose -f docker-compose.local-keycloak.yml restart
```

Then hard refresh the browser and re-check the theme dropdown.

## 5.2 Same-origin setup (optional)

If you place a reverse proxy in front (for example `http://localhost:8080`) and route:
- `/public/v1/*` and `/api/v1/*` -> backend (`8787`)
- `/` and static assets -> website static server

then you do not need `window.ASIATRAVELPLAN_API_BASE`, because relative path `/public/v1/bookings` works directly.

## 5.3 File-open mode (`file://`) note

The website can be opened directly from filesystem, but this is not recommended for integration tests.

Use an HTTP static server (`python -m http.server`) so browser behavior matches production more closely.

## 6) Verify end-to-end integration

1. Open website locally.
2. Click `backend`.
3. Login via Keycloak form.
4. Verify redirect lands on `http://localhost:8080/backend.html`.
5. Verify customers and bookings tables load.
6. Fill and submit the booking modal form.
7. Confirm success message appears in modal.
8. Check backend data:

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/bookings?sort=created_at_desc&page_size=5'
```

9. Open booking/customer detail links from `backend.html`.
10. Re-query activities:

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/bookings/<BOOKING_ID>/activities'
```

11. Verify tour image upload/transform:

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/tours?page=1&page_size=3'
```

Confirm `image` values point to `/public/v1/tour-images/...` and open one URL in browser.

## 7) Troubleshooting

- `401 Unauthorized` on `/api/v1/*`
  - If Keycloak enabled, ensure login completed and backend cookie is present for `localhost:8787`.
  - Ensure backend CORS allows frontend origin and credentials (`CORS_ORIGIN='http://localhost:8080'`).
  - Use a valid Keycloak access token for non-browser calls.

- Booking form opens mail app instead of backend submission
  - Backend unreachable or wrong API base URL.
  - Check `window.ASIATRAVELPLAN_API_BASE` and backend process status.

- CORS errors in browser console
  - For Keycloak session-based UI across ports, use:
    - `CORS_ORIGIN='http://localhost:8080'`
  - Keep backend and frontend on `localhost` to avoid cookie domain mismatch.
  - Or use the local frontend proxy setup and the persistent local Keycloak compose file to avoid brittle split-origin local flows.

- Duplicate booking submissions
  - Ensure `Idempotency-Key` header is present (frontend already sends it).

## 8) Current limitations and next step

Current persistence is JSON-file based (`store.json`) for local development speed.

Next step for production-readiness:
- migrate Milestone 1 domain to PostgreSQL
- keep API contracts unchanged so frontend integration remains stable

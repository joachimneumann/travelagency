# Chapter2 Backend Usage and Local Web Integration Guide

This guide explains:
- how to run and use the local backend
- how to connect it to a locally executed Chapter2 website
- how to verify the integration end-to-end

## 1) What is implemented now

Local backend implementation (Milestone 1) is in:
- `backend/app/src/server.js`
- `backend/app/data/store.json`
- `backend/app/data/tours.json`
- `backend/app/config/staff.json`
- `backend/app/scripts/seed.js`

Features available now:
- Public lead ingestion (`POST /public/v1/leads`)
- Public tours catalog (`GET /public/v1/tours`)
- Lead pipeline and stage transitions
- Customer deduplication
- Lead ownership assignment + SLA due timestamps
- Lead activity timeline
- Admin API (Keycloak protected)
- Keycloak login/session support (`/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me`)
- Lightweight admin pages (`/admin`, `/admin/leads`, `/admin/leads/:id`, `/admin/customers`, `/admin/customers/:id`)
- Branded frontend backoffice pages (`backend.html`, `backend-detail.html`)
  - `backend.html` lists tours
  - clicking a tour ID opens `backend-tour.html` for editing

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

This appends realistic customers/leads/activities into `backend/app/data/store.json`.

## 4) Use the backend APIs

## 4.1 Public lead endpoint

```bash
curl -X POST http://localhost:8787/public/v1/leads \
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
    "utm_campaign": "chapter2_local_test",
    "pageUrl": "http://localhost:8080/",
    "referrer": "https://google.com"
  }'
```

## 4.2 Admin API auth

All `/api/v1/*` endpoints require Keycloak auth.

Browser session example:

```bash
curl -b cookie.txt \
  'http://localhost:8787/api/v1/leads?page=1&page_size=10&sort=created_at_desc'
```

Supported filters on `GET /api/v1/leads`:
- `page`, `page_size`
- `stage`
- `owner_id`
- `search`
- `sort` (`created_at_desc`, `created_at_asc`, `updated_at_desc`, `sla_due_at_asc`, `sla_due_at_desc`)

Bearer token example (service-to-service):

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/leads?page=1&page_size=10&sort=created_at_desc'
```

## 4.3 Admin web pages

Open in browser:
- `http://localhost:8787/admin`
- `http://localhost:8787/admin/leads`
- `http://localhost:8787/admin/customers`

## 5) Integrate with locally executed Chapter2 webpage

The frontend submit logic in `assets/js/main.js` already supports backend integration.

It uses:
- `window.CHAPTER2_API_BASE` if defined
- otherwise relative `/public/v1/leads`

Tours source:
- Website tour cards are loaded from backend `GET /public/v1/tours` when `window.CHAPTER2_API_BASE` is set.
- Backend persists tours in `backend/app/data/tours.json`.

Branded backend web UI:
- `backend.html` provides a Chapter2-styled backend workspace page.
- It shows:
  - paginated searchable Customers table (newest first, page size 10)
  - paginated searchable Leads table (newest first, page size 10)
  - paginated searchable Tours table
  - Tour form for create/update
- Lead/customer IDs link to `backend-detail.html`.
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
KEYCLOAK_CLIENT_ID='chapter2-backend' \
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

## 5.2 Same-origin setup (optional)

If you place a reverse proxy in front (for example `http://localhost:8080`) and route:
- `/public/v1/*` and `/api/v1/*` -> backend (`8787`)
- `/` and static assets -> website static server

then you do not need `window.CHAPTER2_API_BASE`, because relative path `/public/v1/leads` works directly.

## 5.3 File-open mode (`file://`) note

The website can be opened directly from filesystem, but this is not recommended for integration tests.

Use an HTTP static server (`python -m http.server`) so browser behavior matches production more closely.

## 6) Verify end-to-end integration

1. Open website locally.
2. Click `backend`.
3. Login via Keycloak form.
4. Verify redirect lands on `http://localhost:8080/backend.html`.
5. Verify customers and leads tables load.
6. Fill and submit the lead modal form.
7. Confirm success message appears in modal.
8. Check backend data:

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/leads?sort=created_at_desc&page_size=5'
```

9. Open lead/customer detail links from `backend.html`.
10. Re-query activities:

```bash
curl -H 'Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>' \
  'http://localhost:8787/api/v1/leads/<LEAD_ID>/activities'
```

## 7) Troubleshooting

- `401 Unauthorized` on `/api/v1/*`
  - If Keycloak enabled, ensure login completed and backend cookie is present for `localhost:8787`.
  - Ensure backend CORS allows frontend origin and credentials (`CORS_ORIGIN='http://localhost:8080'`).
  - Use a valid Keycloak access token for non-browser calls.

- Lead form opens mail app instead of backend submission
  - Backend unreachable or wrong API base URL.
  - Check `window.CHAPTER2_API_BASE` and backend process status.

- CORS errors in browser console
  - For Keycloak session-based UI across ports, use:
    - `CORS_ORIGIN='http://localhost:8080'`
  - Keep backend and frontend on `localhost` to avoid cookie domain mismatch.

- Duplicate lead submissions
  - Ensure `Idempotency-Key` header is present (frontend already sends it).

## 8) Current limitations and next step

Current persistence is JSON-file based (`store.json`) for local development speed.

Next step for production-readiness:
- migrate Milestone 1 domain to PostgreSQL
- keep API contracts unchanged so frontend integration remains stable

# Chapter2 Backend App (Milestone 1)

This service implements Milestone 1 from `backend/backend_software.md`:
- Lead ingestion API
- Customer deduplication and profile creation
- Lead pipeline stages and transitions
- Owner assignment with workload balancing
- SLA due timestamps
- Lead activity timeline
- Simple admin pages for pipeline and lead detail

## Run

```bash
cd backend/app
npm start
```

Default URL: `http://localhost:8787`

Environment variables:
- `PORT` (default `8787`)
- `CORS_ORIGIN` (default `*`)
- `KEYCLOAK_ENABLED` (`true`/`false`, default `false`)
- `KEYCLOAK_BASE_URL` (example: `http://localhost:8081`)
- `KEYCLOAK_REALM` (example: `chapter2`)
- `KEYCLOAK_CLIENT_ID` (example: `chapter2-backend`)
- `KEYCLOAK_CLIENT_SECRET` (Keycloak confidential client secret)
- `KEYCLOAK_REDIRECT_URI` (default `http://localhost:8787/auth/callback`)
- `KEYCLOAK_POST_LOGOUT_REDIRECT_URI` (optional; must be allowed by Keycloak client if set)
- `KEYCLOAK_ALLOWED_ROLES` (comma-separated, default `admin,staff_joachim,staff_van`)
- `KEYCLOAK_FORCE_LOGIN_PROMPT` (`true`/`false`, default `false`)
- `KEYCLOAK_GLOBAL_LOGOUT` (`true`/`false`, default `false`)
- `RETURN_TO_ALLOWED_ORIGINS` (comma-separated absolute origins allowed for `return_to`; default `http://localhost:8080,http://localhost:8787`)

Cross-origin browser usage note:
- When frontend is served from `http://localhost:8080` and backend from `http://localhost:8787`, use:
  - `CORS_ORIGIN='http://localhost:8080'`
- Backend sends `Access-Control-Allow-Credentials: true`, and frontend backend pages send `credentials: "include"` so Keycloak session cookies are used for `/api/v1/*`.

## Data Storage

JSON files are used for local persistence:
- `data/store.json`
- `data/tours/<tour_id>/tour.json`
- `data/tours/<tour_id>/tour_<uuid>.webp`
- `config/staff.json`

## Auth Module Split

Authentication internals are now isolated in:
- `src/auth.js`

`src/server.js` now only wires auth at the route and request-gate level:
- `const auth = createAuth({ port })`
- `...auth.routes` for `/auth/*` handlers
- `auth.pruneState()` on each request
- `auth.isKeycloakEnabled()` + `auth.hasSession(req)` for `/admin*` gate
- `auth.authorizeApiRequest(req, requestUrl)` for `/api/v1/*` gate

This keeps backend business logic (leads/customers/pipeline) separate from OIDC/session internals.

## API Endpoints

Public:
- `POST /public/v1/leads`
- `GET /public/v1/tours`
- `GET /public/v1/tour-images/:path`

Admin API:
- `GET /api/v1/leads`
- `GET /api/v1/leads/:leadId`
- `PATCH /api/v1/leads/:leadId/stage`
- `PATCH /api/v1/leads/:leadId/owner`
- `GET /api/v1/leads/:leadId/activities`
- `POST /api/v1/leads/:leadId/activities`
- `GET /api/v1/customers`
- `GET /api/v1/customers/:customerId`
- `GET /api/v1/tours`
- `GET /api/v1/tours/:tourId`
- `POST /api/v1/tours`
- `PATCH /api/v1/tours/:tourId`
- `POST /api/v1/tours/:tourId/image`

Tour ID format:
- Tours now use generated IDs like `tour_<uuid>` (same pattern style as leads/customers).
- `POST /api/v1/tours` always generates the tour ID server-side.

Tour image handling:
- Tour images are stored per tour under `backend/app/data/tours/<tour_id>/`.
- `POST /api/v1/tours/:tourId/image` accepts JSON:
  - `filename`
  - `data_base64`
- Backend uses ImageMagick to:
  - auto-orient image
  - resize to max `1000x1000`
  - strip metadata
  - convert to optimized `.webp`
- Public image URLs are served from `/public/v1/tour-images/...` with long-lived immutable cache headers.
Tour API caching:
- `GET /public/v1/tours` returns `ETag` and `Cache-Control` (`max-age=120`, `stale-while-revalidate=600`).
- Website frontend also keeps a short local cache and prewarms visible image URLs.

`/api/v1/*` authentication:
- Keycloak backend session cookie (browser flows)
- Or `Authorization: Bearer <KEYCLOAK_ACCESS_TOKEN>`

When Keycloak is enabled:
- `/admin*` requires browser session login via Keycloak.
- `/api/v1/*` accepts either authenticated backend session cookie or Keycloak bearer token.
- If `KEYCLOAK_ENABLED=false`, `/api/v1/*` requests are rejected with `401`.

Lead list query params (`GET /api/v1/leads`):
- `page` (default `1`)
- `page_size` (default `25`, max `100`)
- `stage` (`NEW|QUALIFIED|PROPOSAL_SENT|NEGOTIATION|WON|LOST|POST_TRIP`)
- `owner_id` (exact match)
- `search` (matches lead id, destination, style, owner, notes, customer name/email)
- `sort` (`created_at_desc`, `created_at_asc`, `updated_at_desc`, `sla_due_at_asc`, `sla_due_at_desc`)

Default ordering:
- Leads: newest first (`created_at desc`)
- Customers: newest first (`created_at desc`, fallback `updated_at`)

Admin UI:
- `GET /admin`
- `GET /admin/leads`
- `GET /admin/leads/:leadId`
- `GET /admin/customers`
- `GET /admin/customers/:customerId`

Branded frontend backoffice pages (served by website):
- `/backend.html`: chapter-branded dashboard with:
  - paginated searchable Customers table
  - paginated searchable Leads table
  - paginated searchable Tours table
- `/backend-tour.html`: dedicated tour edit page (opened by clicking a tour ID in `backend.html`)
- `backend.html` header includes `Website` and `Logout` actions.
- `/backend-detail.html`: detail pages for lead/customer records

Website header integration:
- Main site has a `backend` button (no dropdown) that redirects to `/auth/login`.
- Main site shows `Logged in as: ...` below the backend button using `/auth/me` and session cookies.

Health:
- `GET /health`

Auth:
- `GET /auth/login`
- `GET /auth/callback`
- `GET /auth/logout`
- `GET /auth/me`

## Example Lead Request

```bash
curl -X POST http://localhost:8787/public/v1/leads \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-001' \
  -d '{
    "destination": "Vietnam",
    "style": "Adventure",
    "travelMonth": "November",
    "duration": "10-14 days",
    "travelers": "2",
    "budget": "$2500-$3500",
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "phone": "+1 415 555 0100",
    "language": "English",
    "notes": "Interested in private guides and food tours",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "sea_winter",
    "pageUrl": "https://chapter2.live/",
    "referrer": "https://google.com"
  }'
```

## Seed Test Data

```bash
cd backend/app
npm run seed -- --count 40
```

## Enable Keycloak Auth (Example)

```bash
cd backend/app
npm install
KEYCLOAK_ENABLED=true \
KEYCLOAK_BASE_URL='http://localhost:8081' \
KEYCLOAK_REALM='chapter2' \
KEYCLOAK_CLIENT_ID='chapter2-backend' \
KEYCLOAK_CLIENT_SECRET='YOUR_CLIENT_SECRET' \
KEYCLOAK_REDIRECT_URI='http://localhost:8787/auth/callback' \
KEYCLOAK_ALLOWED_ROLES='admin,staff_joachim,staff_van' \
npm start
```

Open:
- `http://localhost:8787/auth/login?return_to=/admin`

# AsiaTravelPlan Backend App (Milestone 1)

This service implements Milestone 1 from `backend/backend_software.md`:
- Booking ingestion API
- Customer deduplication and profile creation
- Booking pipeline stages and transitions
- Staff assignment on bookings
- SLA due timestamps
- Booking activity timeline
- Simple admin pages for pipeline and booking detail

Related documentation:
- `mobileApp.md`: how to build a native iPhone app against this backend and Keycloak setup
- Mobile source scaffold: `/Users/internal_admin/projects/travelagency/mobile/iOS`

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
- `KEYCLOAK_REALM` (example: `asiatravelplan`)
- `KEYCLOAK_CLIENT_ID` (example: `asiatravelplan-backend`)
- `KEYCLOAK_CLIENT_SECRET` (Keycloak confidential client secret)
- `KEYCLOAK_REDIRECT_URI` (default `http://localhost:8787/auth/callback`)
- `KEYCLOAK_POST_LOGOUT_REDIRECT_URI` (optional; must be allowed by Keycloak client if set)
- `KEYCLOAK_ALLOWED_ROLES` (comma-separated, default `atp_admin,atp_manager,atp_accountant,atp_staff`)
- `KEYCLOAK_FORCE_LOGIN_PROMPT` (`true`/`false`, default `false`)
- `KEYCLOAK_GLOBAL_LOGOUT` (`true`/`false`, default `false`)
- `RETURN_TO_ALLOWED_ORIGINS` (comma-separated absolute origins allowed for `return_to`; default `http://localhost:8080,http://localhost:8787`)
- `MOBILE_MIN_SUPPORTED_APP_VERSION` (minimum iOS app version allowed to continue after bootstrap)
- `MOBILE_LATEST_APP_VERSION` (latest published iOS app version shown to users)
- `MOBILE_FORCE_UPDATE` (`true`/`false`, forces all app builds to stop at the update screen)

Cross-origin browser usage note:
- When frontend is served from `http://localhost:8080` and backend from `http://localhost:8787`, use:
  - `CORS_ORIGIN='http://localhost:8080'`
- Backend sends `Access-Control-Allow-Credentials: true`, and frontend backend pages send `credentials: "include"` so Keycloak session cookies are used for `/api/v1/*`.

## Local Keycloak With Persistent Theme

For local Docker-based Keycloak with the custom login theme mounted persistently, use:
- `/Users/internal_admin/projects/travelagency/docker-compose.local-keycloak.yml`
- `/Users/internal_admin/projects/travelagency/backend/keycloak-theme/asiatravelplan`

Helper scripts:
- `/Users/internal_admin/projects/travelagency/scripts/start_local_keycloak.sh`
- `/Users/internal_admin/projects/travelagency/scripts/stop_local_keycloak.sh`
- `/Users/internal_admin/projects/travelagency/scripts/restart_local_keycloak.sh`

Start Keycloak:

```bash
cd /Users/internal_admin/projects/travelagency
./scripts/start_local_keycloak.sh
```

This setup:
- exposes Keycloak on `http://localhost:8081`
- mounts the custom theme into `/opt/keycloak/themes/asiatravelplan`
- disables theme cache for local development

After startup, set the Keycloak realm login theme to `asiatravelplan` in:
- `Realm settings` -> `Themes` -> `Login theme`

## Data Storage

JSON files are used for local persistence:
- `data/store.json`
- `data/tours/<tour_id>/tour.json`
- `data/tours/<tour_id>/tour_<uuid>.webp`
- `config/staff.json`

Runtime data note:
- `backend/app/data/store.json` is no longer tracked in Git.
- The backend still reads and writes that exact path.
- Local startup creates an empty `store.json` automatically if it is missing.
- Staging deploys must preserve the server's existing `backend/app/data/store.json`.
- Preferred staging update command on the server:
  - `./scripts/update_staging.sh backend`
  - `./scripts/update_staging.sh keycloak`
  - `./scripts/update_staging.sh caddy`
  - `./scripts/update_staging.sh all`

## Auth Module Split

Authentication internals are now isolated in:
- `src/auth.js`

`src/server.js` now only wires auth at the route and request-gate level:
- `const auth = createAuth({ port })`
- `...auth.routes` for `/auth/*` handlers
- `auth.pruneState()` on each request
- `auth.isKeycloakEnabled()` + `auth.hasSession(req)` for `/admin*` gate
- `auth.authorizeApiRequest(req, requestUrl)` for `/api/v1/*` gate

This keeps backend business logic (bookings/customers/pipeline) separate from OIDC/session internals.

## API Endpoints

Public:
- `GET /public/v1/mobile/bootstrap`
- `POST /public/v1/bookings`
- `GET /public/v1/tours`
- `GET /public/v1/tour-images/:path`

Admin API:
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`
- `PATCH /api/v1/bookings/:bookingId/stage`
- `PATCH /api/v1/bookings/:bookingId/owner` (current path retained for staff assignment compatibility)
- `PATCH /api/v1/bookings/:bookingId/notes` (single editable booking note with conflict detection)
- `PATCH /api/v1/bookings/:bookingId/pricing` (replace the booking commercials model)
- `GET /api/v1/bookings/:bookingId/activities`
- `POST /api/v1/bookings/:bookingId/activities`
- `GET /api/v1/customers`
- `GET /api/v1/customers/:customerId`
- `GET /api/v1/staff`
- `POST /api/v1/staff`
- `GET /api/v1/tours`
- `GET /api/v1/tours/:tourId`
- `POST /api/v1/tours`
- `PATCH /api/v1/tours/:tourId`
- `POST /api/v1/tours/:tourId/image`

Tour ID format:
- Tours now use generated IDs like `tour_<uuid>` (same pattern style as bookings/customers).
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

Booking list query params (`GET /api/v1/bookings`):
- `page` (default `1`)
- `page_size` (default `25`, max `100`)
- `stage` (`NEW|QUALIFIED|PROPOSAL_SENT|NEGOTIATION|WON|LOST|POST_TRIP`)
- `owner_id` (exact match; compatible filter for assigned staff id)
- `search` (matches booking id, destination, style, assigned staff, notes, customer name/email)
- `sort` (`created_at_desc`, `created_at_asc`, `updated_at_desc`, `sla_due_at_asc`, `sla_due_at_desc`)

Default ordering:
- Bookings: newest first (`created_at desc`)
- Customers: newest first (`created_at desc`, fallback `updated_at`)

Admin UI:
- `GET /admin`
- `GET /admin/bookings`
- `GET /admin/bookings/:bookingId`
- `GET /admin/customers`
- `GET /admin/customers/:customerId`

Branded frontend backoffice pages (served by website):
- `/backend.html`: AsiaTravelPlan-branded dashboard with:
  - paginated searchable Customers table
  - paginated searchable Bookings table
  - paginated searchable Tours table
- `/backend-tour.html`: dedicated tour edit page (opened by clicking a tour ID in `backend.html`)
- `backend.html` header includes `Website` and `Logout` actions.
- `/backend-booking.html`: role-aware booking/customer detail page with booking actions
  - booking activities list
  - change staff assignment
  - change stage
  - edit the single booking note

Booking concurrency model:
- every booking read model includes `booking_hash`
- clients must send the current `booking_hash` back with any booking mutation
  - stage change
  - staff assignment change
  - note save
- if the hash does not match, backend rejects the write and returns the refreshed booking
- clients must show:
  - `The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.`

Booking note model:
- each booking has exactly one editable `notes` field
- note edits use the same `booking_hash` concurrency check as other booking writes

Booking pricing model:
- the agreed commercial base is stored as `pricing.agreed_net_amount_cents`
- all amounts are stored in integer cents
- taxes are stored as basis points per payment (`tax_rate_basis_points`)
- the booking may contain typed adjustments:
  - `DISCOUNT`
  - `CREDIT`
  - `SURCHARGE`
- the booking may contain zero or more scheduled payments
- each payment stores:
  - label
  - due date
  - net amount
  - tax rate
  - derived tax amount
  - derived gross amount
  - payment status (`PENDING` or `PAID`)
  - optional paid timestamp
- backend derives and returns:
  - adjusted net amount
  - unscheduled net amount
  - scheduled tax total
  - scheduled gross total
  - paid gross total
  - outstanding gross total
  - schedule balance flag
- partial schedules are allowed
- the sum of scheduled payment net amounts must not exceed the adjusted booking net amount
- the remaining not-yet-scheduled amount is returned as `unscheduled_net_amount_cents`
- pricing mutations also use `booking_hash`
- if the booking changed in the meantime, the frontend/mobile client must refresh and ask the user to enter the change again

## Role Model

Allowed backend roles:
- `atp_admin`
- `atp_manager`
- `atp_accountant`
- `atp_staff`

Role behavior:
- `atp_staff`
  - read and write only bookings assigned to that staff member
  - staff identity is mapped from Keycloak `preferred_username` to `config/staff.json -> usernames[]`
- `atp_manager`
  - see and edit all bookings
  - change staff assignments
  - create staff records
  - see customers
- `atp_admin`
  - see and edit all bookings
  - change staff assignments
  - create staff records
  - see customers
  - see and edit tours
- `atp_accountant`
  - see all bookings
  - may change booking stage only
  - read-only access to tours

Booking assignment model:
- each new booking is created with `staff = null`
- staff assignment is added later by `atp_manager` or `atp_admin`
- `atp_staff` booking access depends on Keycloak `preferred_username` matching `config/staff.json -> usernames[]`

Website header integration:
- Main site has a `backend` button (no dropdown) that redirects to `/auth/login`.
- Main site shows `Logged in as: ...` below the backend button using `/auth/me` and session cookies.

Health:
- `GET /health`

Auth:
- `GET /auth/login`
- `GET /auth/callback`
- `GET /auth/logout`

## Mobile Contract

The mobile app should not follow backend internals or `store.json` structure directly.
The single contract source is:
- [/Users/internal_admin/projects/travelagency/contracts/mobile-api.openapi.yaml](/Users/internal_admin/projects/travelagency/contracts/mobile-api.openapi.yaml)

Generated artifacts:
- [/Users/internal_admin/projects/travelagency/contracts/generated/mobile-api.meta.json](/Users/internal_admin/projects/travelagency/contracts/generated/mobile-api.meta.json)
- [/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIModels.swift](/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIModels.swift)
- [/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIRequestFactory.swift](/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIRequestFactory.swift)

Regenerate after editing the OpenAPI file:

```bash
ruby /Users/internal_admin/projects/travelagency/contracts/generate_mobile_contract_artifacts.rb
```

Contract validation tests:

```bash
cd /Users/internal_admin/projects/travelagency/backend/app
npm test
```

The iPhone app startup gate reads `GET /public/v1/mobile/bootstrap` and stops with a `Please update` screen when the installed app version is below `MOBILE_MIN_SUPPORTED_APP_VERSION` or when `MOBILE_FORCE_UPDATE=true`.
- `GET /auth/me`

## Example Booking Request

```bash
curl -X POST http://localhost:8787/public/v1/bookings \
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
    "pageUrl": "https://asiatravelplan.com/",
    "referrer": "https://google.com"
  }'
```

## Seed Test Data

```bash
cd backend/app
npm run seed -- --count 40
```

Booking source attribution captured on ingest:
- client-reported `page_url`
- backend-captured `ip_address`
- backend `ip_country_guess` as a display label from trusted proxy country headers when present, otherwise `Local/Private` or `Unknown` (for example `Vietnam (VN)`)

## Enable Keycloak Auth (Example)

```bash
cd backend/app
npm install
KEYCLOAK_ENABLED=true \
KEYCLOAK_BASE_URL='http://localhost:8081' \
KEYCLOAK_REALM='asiatravelplan' \
KEYCLOAK_CLIENT_ID='asiatravelplan-backend' \
KEYCLOAK_CLIENT_SECRET='YOUR_CLIENT_SECRET' \
KEYCLOAK_REDIRECT_URI='http://localhost:8787/auth/callback' \
KEYCLOAK_ALLOWED_ROLES='atp_admin,atp_manager,atp_accountant,atp_staff' \
npm start
```

Open:
- `http://localhost:8787/auth/login?return_to=/admin`

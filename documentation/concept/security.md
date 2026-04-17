# API Security Review

## Scope

This is a source-code review of the current backend implementation in this repository.

It is not a live penetration test.
It does not prove the API is safe.
It evaluates whether the current code looks reasonably hardened against common API attacks and where the obvious gaps are.

I assume `SQP injection` means `SQL injection`.

## Short Answer

The API is not obviously vulnerable to classic SQL injection, because the current backend does not use SQL at all. It persists bookings and related data into JSON files and per-folder assets.

There are also some good security choices already in place:
- JWT verification uses `jose`
- role-based authorization is enforced on `/api/v1/*`
- payment-document PDFs are served through authenticated endpoints
- public generated-offer access and public generated-offer PDFs are gated by a dedicated booking confirmation token
- booking image path resolution uses path-bound checks
- image conversion uses `execFile(...)` instead of spawning a shell command string

However, I would not call the API fully safe for internet-facing sensitive traveler data in its current state.

There are still several meaningful gaps:
- session cookie hardening is incomplete
- CORS is too permissive by default
- there is no CSRF protection for cookie-authenticated writes
- request body size is unbounded
- broader route-level rate limiting is still largely absent
- webhook signature verification is effectively optional if the app secret is missing
- booking and traveler images are publicly accessible with long cache lifetimes
- internal error details are returned to clients

My conclusion:

- safe enough for limited internal use behind trusted access controls: maybe
- safe enough for public self-service traveler workflows with sensitive document data: not yet

## What Looks Good

### 1. Low SQL injection risk in the current implementation

There is no SQL or ORM layer in the current backend.
The active persistence model is JSON files and filesystem assets.

That means classic SQL injection is not currently the main risk class.

If the backend later moves to PostgreSQL, MySQL, or another database, parameterized queries will become mandatory.

### 2. Command injection risk is relatively low in the current image pipeline

The code uses `execFile("magick", [...])` rather than shell interpolation.
That is materially safer than `exec(...)` or building a shell string.

Relevant code:
- `backend/app/src/http/handlers/bookings.js`
- `backend/app/src/http/handlers/tours.js`

This does not eliminate image-processing risk entirely, because ImageMagick itself still increases parser and resource-exhaustion attack surface.

### 3. Path traversal is partially mitigated

Booking image path resolution checks that the resolved file stays inside the configured storage directory.

Relevant code:
- `backend/app/src/http/handlers/bookings.js`

This is the right pattern for filesystem-backed asset serving.

### 4. Booking-scoped access checks exist on most sensitive staff endpoints

The booking, payment-document, offer, and chat handlers generally check `canAccessBooking(...)` or `canEditBooking(...)` before serving or mutating data.

That is an important baseline control and is better than trusting IDs in the URL alone.

### 5. Public booking confirmation is no longer authorized by identifiers alone

Relevant code:
- `backend/app/src/http/handlers/booking_booking_confirmation.js`
- `backend/app/src/domain/booking_confirmation.js`

Current behavior:
- public generated-offer access and public generated-offer PDFs require a dedicated booking confirmation token

This is materially better than a public flow that trusts only `booking_id` and `generated_offer_id`.

## Main Findings

## High Risk

### 1. Session cookie is not marked `Secure`

Current session cookie code:
- `backend/app/src/auth.js`

The cookie is set with:
- `HttpOnly`
- `SameSite=Lax`

but not:
- `Secure`

Impact:
- if the app is ever reachable over plain HTTP, or if TLS termination is misconfigured, session cookies can leak over the network
- this is not acceptable for authenticated internal admin access

Recommendation:
- always set `Secure` on the auth session cookie
- in production, reject non-HTTPS requests for authenticated routes
- add HSTS at the reverse proxy

### 2. CORS is too permissive by default, and it allows credentials

Current CORS code:
- `backend/app/src/http/http_helpers.js`

Behavior today:
- if `CORS_ORIGIN` contains `*`, the server reflects the request origin
- `Access-Control-Allow-Credentials` is always `true`

Impact:
- this is too permissive for an authenticated API
- it increases the risk of cross-origin data exposure if the frontend/auth model changes
- together with cookie auth, this is poor default posture

Recommendation:
- remove `*` support for authenticated API traffic
- use a strict explicit allow-list of exact frontend origins
- only set `Access-Control-Allow-Credentials: true` for trusted origins
- keep public unauthenticated endpoints separate from authenticated CORS policy

### 3. There is no visible CSRF protection for cookie-authenticated writes

The backend relies on a session cookie for `/api/v1/*`.
I did not find CSRF token checks on mutating routes.

Relevant code:
- `/api/v1/*` auth gate in `backend/app/src/server.js`
- session cookie auth in `backend/app/src/auth.js`

Why this matters:
- `SameSite=Lax` helps, but it is not a complete CSRF strategy
- same-site subdomain relationships and future frontend changes can still create risk
- once traveler-facing or partner-facing cookie auth exists, this becomes more important

Recommendation:
- add CSRF protection for all state-changing cookie-authenticated routes
- use one of:
  - synchronizer CSRF token
  - double-submit cookie
  - stricter session architecture that avoids browser cookie auth for API mutations

### 4. Request bodies are unbounded

Body reading code:
- `backend/app/src/http/http_helpers.js`

The server reads the full request body into memory with no visible limit.
This affects:
- JSON API requests
- base64 image uploads
- webhook ingest

Impact:
- denial of service through memory exhaustion
- oversized base64 uploads can amplify memory pressure
- ImageMagick processing increases the cost further after the upload is accepted

Recommendation:
- enforce global body size limits
- use smaller limits by route type

Suggested starting limits:
- normal JSON endpoints: 256 KB to 1 MB
- public booking form: 64 KB to 256 KB
- webhook ingest: 1 MB
- image upload endpoints: 5 MB to 10 MB after base64 decoding, preferably move away from base64 JSON entirely

### 5. Webhook signature verification is optional if the secret is not configured

Relevant code:
- `backend/app/src/integrations/meta_webhook.js`

Current behavior:
- if no app secret is configured, `verifyMetaWebhookSignature(...)` returns `true`
- webhook configuration only requires a verify token, not an app secret

Impact:
- if the webhook is enabled without an app secret, anyone who can reach the endpoint can POST unsigned data
- that can create fake chat events and poison operational records

Recommendation:
- if webhook ingest is enabled, require an app secret at startup
- fail fast on boot if webhook verify token is set but signature secret is missing
- do not accept unsigned webhook POSTs in any non-local environment

### 6. Booking and traveler images are publicly accessible and long-cacheable

Relevant code:
- `backend/app/src/http/handlers/booking_media.js`

Current behavior:
- booking images and traveler photos are served from public endpoints
- cache control is `public, max-age=31536000, immutable`

Impact:
- if these URLs leak, the content is openly retrievable
- traveler photos are personal data
- public immutable caching makes revocation and privacy cleanup harder

Recommendation:
- do not serve traveler photos from public world-readable endpoints
- switch to authenticated file endpoints or short-lived signed URLs
- for any sensitive resource, use `private, no-store` or short-lived signed fetches instead of immutable public caching

## Medium Risk

### 7. Internal error details are exposed to clients

Relevant code:
- `backend/app/src/server.js`
- `backend/app/src/http/handlers/booking_media.js`
- `backend/app/src/http/handlers/tours.js`
- `backend/app/src/auth.js`

Current behavior:
- the backend returns raw error detail strings to clients in several places

Impact:
- leaks implementation details
- may expose filesystem paths, dependency failures, proxy misconfiguration, or upstream auth errors
- makes targeted attacks easier

Recommendation:
- return generic error messages to clients
- log detailed diagnostics server-side only
- gate verbose error detail behind a local-development-only flag

### 8. No broad rate limiting or brute-force controls

I did not find route-level or global rate limiting for:
- auth endpoints
- staging access password form
- public booking creation
- webhook ingest
- upload endpoints
- authenticated API mutations

Impact:
- easier brute force and abuse
- easier denial of service
- no protection against automated scraping or repeated failed login attempts

Recommendation:
- add IP-based and route-based throttling
- add stricter limits for login and upload routes
- log and alert on repeated failures

### 9. `INSECURE_TEST_AUTH` is a dangerous production footgun

Relevant code:
- `backend/app/src/auth.js`

If `INSECURE_TEST_AUTH=true`, the backend accepts identity and roles from request headers like:
- `x-test-roles`
- `x-test-sub`

Impact:
- catastrophic if enabled outside local/dev
- effectively turns header spoofing into authentication

Recommendation:
- hard-fail startup if `INSECURE_TEST_AUTH=true` outside explicit local development
- guard it behind both environment and host checks
- ideally remove it entirely from production builds

### 10. `quick_login` support increases auth attack surface

Relevant code:
- `backend/app/src/auth.js`

The login flow has a special `quick_login` path for `staging.asiatravelplan.com`, `localhost`, and `127.0.0.1`.

Even if it currently depends on Keycloak-side behavior, it is still a sensitive shortcut.

Recommendation:
- disable `quick_login` outside local development
- do not rely only on the incoming `Host` header for deciding whether a shortcut is allowed
- move it behind an explicit environment flag that defaults to off

### 11. Public webhook status endpoint leaks operational details

Relevant code:
- `backend/app/src/integrations/meta_webhook.js`

Current behavior:
- `/integrations/meta/webhook/status` exposes whether secrets are configured and shows counters such as signature failures and ingest activity

Impact:
- useful reconnaissance for an attacker
- reveals operational state that should usually remain internal

Recommendation:
- protect this endpoint or remove it in production
- if kept, expose only a minimal health signal to authenticated admins

## Lower Risk / Good Enough For Now

### 12. Classic path traversal is reasonably handled on booking image paths

Relevant code:
- `backend/app/src/http/handlers/bookings.js`

This area looks acceptable.

### 13. Classic shell injection is not the primary issue here

Relevant code:
- `backend/app/src/http/handlers/bookings.js`

Because `execFile(...)` is used instead of shell command concatenation, classic command injection risk is lower.

The remaining concern is ImageMagick parser/resource exposure, not shell injection.

## Attack Class Assessment

### SQL injection

Current risk: low

Reason:
- no SQL persistence layer exists in the current code path

Future recommendation:
- if a database is introduced later, use parameterized queries everywhere

### NoSQL injection

Current risk: low

Reason:
- there is no Mongo-like query layer driven by user JSON

### Command injection

Current risk: low to medium

Reason:
- shell injection is mitigated by `execFile(...)`
- third-party image parsing still adds risk

Recommendation:
- sandbox ImageMagick
- enforce file size and pixel limits
- consider a stricter image policy or isolated worker

### Path traversal

Current risk: low to medium

Reason:
- booking asset handlers use directory-bound path resolution
- tour image path handling is simpler and should be kept under review

### Authentication bypass

Current risk: medium

Reason:
- production auth path is reasonable
- but there are dangerous configuration shortcuts: `INSECURE_TEST_AUTH`, permissive CORS defaults, and `quick_login`

### Broken access control

Current risk: medium

Reason:
- staff-side booking access checks are generally present
- public booking/traveler image endpoints weaken privacy boundaries

### CSRF

Current risk: medium to high

Reason:
- cookie-authenticated API
- no visible CSRF token enforcement

### Denial of service

Current risk: high

Reason:
- no body-size limits
- no visible rate limiting
- image conversion and JSON buffering are expensive operations

## Recommended Priority Order

### Immediate

1. Set `Secure` on session cookies and require HTTPS for authenticated traffic.
2. Replace wildcard/reflective CORS with a strict allow-list.
3. Add CSRF protection for all cookie-authenticated mutating routes.
4. Add request-size limits globally and stricter limits for uploads/webhooks.
5. Require webhook signature secrets whenever webhook ingest is enabled.
6. Remove public long-lived traveler-photo access.
7. Stop returning raw internal error details to clients.

### Near Term

8. Add rate limiting for auth, webhook, public booking, and upload routes.
9. Disable `quick_login` outside local development.
10. Fail startup if `INSECURE_TEST_AUTH` is enabled outside local.
11. Restrict or remove the public webhook status endpoint.
12. Add security headers at the reverse proxy:
    - `Strict-Transport-Security`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy`
    - `Content-Security-Policy` for HTML responses

### Before Any Traveler Self-Service Rollout

13. Split traveler-facing APIs from staff APIs completely.
14. Use traveler-scoped tokens/sessions and protected file delivery.
15. Add audit logging for access and data changes.
16. Add automated security checks:
    - dependency scanning
    - static analysis
    - basic API abuse tests
    - upload fuzzing / image bomb tests

## Bottom Line

If the question is:

"Is the API safe against basic SQL injection?"

Then the answer is:
- mostly yes, because there is no SQL layer here

If the question is:

"Is the API safely hardened for internet-facing sensitive traveler data?"

Then the answer is:
- no, not yet

The biggest improvements needed are:
- cookie/session hardening
- tighter CORS and CSRF controls
- mandatory webhook signatures
- request-size and rate limiting
- removal of public access to sensitive traveler assets

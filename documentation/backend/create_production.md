# Create Production

This document describes the planned production rollout for `https://asiatravelplan.com`.

Status:
- planning only
- do not execute yet
- keep the placeholder page public for now
- allow authenticated staff to reach the full homepage through a temporary authenticated entrypoint

## Current Server Layout

Current `atp` deployment layout:

- production checkout: `/srv/asiatravelplan`
- staging checkout: `/srv/asiatravelplan-staging`
- production app compose project: `asiatravelplan`
- staging app compose project: `asiatravelplan-staging`
- shared public Caddy compose project: `asiatravelplan-public`

Operational rule:
- production deploys are run from `/srv/asiatravelplan`
- staging deploys are run from `/srv/asiatravelplan-staging`
- do not use a shell-wide `export COMPOSE_PROJECT_NAME=...`
- the deploy scripts now pin the correct compose project names internally

Shared public Caddy now lives outside the staging app stack:
- it is started from `/srv/asiatravelplan/docker-compose.caddy.yml`
- it serves both `asiatravelplan.com` and the staging hostnames
- it owns public ports `80` and `443`

Current staging proxy wiring for the shared public Caddy:
- staging backend host port: `8789`
- staging Keycloak host port: `8083`

Those staging host ports are used only so the dedicated public Caddy can proxy into the staging app stack from its own compose project.

## Goal

Production should be served from:
- `https://asiatravelplan.com`

Temporary behavior for this week:
- public visitors see the placeholder page
- the placeholder page includes a clear link to log into the backend
- after login, staff should see the full homepage

Planned behavior next week:
- remove the temporary placeholder requirement
- serve the full homepage at `/`

## Recommended Temporary Approach

Use a temporary authenticated route instead of making `/` dynamic immediately.

Recommended flow:
1. Keep `/` mapped to the placeholder bundle in `production/`.
2. Add a prominent "Log into backend" link or button on the placeholder page.
3. Point that login entry to `/auth/login?return_to=/app-home.html`.
4. Add a temporary authenticated route `/app-home.html`.
5. Serve `/app-home.html` from the real website homepage at `frontend/pages/index.html`.
6. Protect `/app-home.html` with a small backend auth-check endpoint that allows access only when a valid Keycloak session cookie exists.
7. If the user is not authenticated, redirect back to `/`.

Why this is the recommended approach:
- lower risk than changing `/` behavior immediately
- keeps the public site stable during the interim week
- reuses the existing Keycloak session flow
- makes next week's switch small and reversible

## Planned File Changes

Temporary implementation is expected to touch:
- `production/index.html`
- `deploy/Caddyfile`
- `backend/app/src/auth.js` or a small new operational handler plus `backend/app/src/http/routes.js`
- `scripts/production/deploy_production_all.sh`
- `scripts/production/deploy_production_backend_frontend.sh`
- a new wrapper script `scripts/production/deploy_production_caddy.sh`

## Planned Routing Changes

Current intended temporary routing:
- `/` -> placeholder page from `production/index.html`
- `/placeholder-assets/*` -> placeholder static assets
- `/app-home.html` -> rewrite to `frontend/pages/index.html`
- `/auth/*` -> backend auth endpoints
- `/keycloak/*` -> Keycloak

Planned Caddy behavior:
- keep the current public root on the placeholder
- add a dedicated handler for `/app-home.html`
- add auth gating for `/app-home.html`
- preserve the existing backend and Keycloak reverse proxies

## Planned Backend Auth Check

Production currently already exposes:
- `GET /auth/me`

For the temporary homepage gate, add one small operational endpoint, for example:
- `GET /production-access/check`

Planned behavior:
- return `204` when a valid session exists
- otherwise redirect to `/`

This mirrors the existing staging access pattern conceptually, but uses authenticated Keycloak session state instead of a password cookie.

## Placeholder Page Changes

Update `production/index.html` to:
- keep the current coming-soon presentation
- add a visible backend login action
- route that action through `/auth/login`
- use `return_to=/app-home.html`

Example target:

```text
/auth/login?return_to=/app-home.html
```

## Next Week's Switch

When the placeholder is no longer needed:
1. Remove the temporary `/app-home.html` path or leave it as a compatibility alias.
2. Change Caddy so `/` rewrites to `frontend/pages/index.html`.
3. Remove placeholder-specific routing from the main production entry.
4. Simplify the placeholder deployment step if it is no longer needed.

This should be a small follow-up change if the temporary route is introduced first.

## Production Scripts

Existing production entrypoints already fit the intended rollout structure:
- `./scripts/production/deploy_production_backend.sh`
- `./scripts/production/deploy_production_frontend.sh`
- `./scripts/production/deploy_production_backend_frontend.sh`
- `./scripts/production/deploy_production_all.sh`

Existing lower-level helpers:
- `./scripts/deploy/update_production.sh`
- `./scripts/deploy/deploy_static_website.sh`
- `./scripts/deploy/install_production_caddy.sh`

### Planned Script Roles

`./scripts/deploy/update_production.sh`
- deploy backend and Keycloak services from `docker-compose.production.yml`
- generate public homepage assets before container startup
- ideally gain the same kind of predeploy test step that staging already runs

`./scripts/deploy/deploy_static_website.sh`
- publish the placeholder bundle from `production/` to `/srv/placeholder`
- stay responsible only for the temporary public placeholder bundle

`./scripts/deploy/install_production_caddy.sh`
- validate and reload the shared production Caddy configuration

### Planned New Wrapper

Add:

```bash
./scripts/production/deploy_production_caddy.sh
```

Expected role:
- thin wrapper around `./scripts/deploy/install_production_caddy.sh`
- production-facing entrypoint consistent with the existing `scripts/production/` conventions

### Planned `deploy_production_all.sh` Order

Planned execution order:
1. deploy backend and Keycloak
2. reload Caddy
3. publish placeholder static bundle

This order ensures:
- auth/backend is available before routing changes rely on it
- Caddy is updated before or alongside the public entrypoint behavior
- placeholder assets are published last as the static public bundle

## Planned Production Commands

Initial bootstrap on the production host:

```bash
cp .env.production.example .env.production
# fill all production secrets in .env.production

./scripts/deploy/update_production.sh all

set -a
source .env.production
set +a
./scripts/keycloak/bootstrap_keycloak_backend_realm.sh

./scripts/production/deploy_production_caddy.sh
./scripts/production/deploy_production_frontend.sh
```

Normal production deploy after bootstrap:

```bash
./scripts/production/deploy_production_all.sh
```

Current recommended production deploy on `atp`:

```bash
cd /srv/asiatravelplan
./scripts/deploy/update_production.sh all
./scripts/production/deploy_production_caddy.sh
./scripts/production/deploy_production_frontend.sh
```

Current recommended staging deploy on `atp`:

```bash
cd /srv/asiatravelplan-staging
./scripts/deploy/update_staging.sh all
```

## Predeploy Validation To Add

Before enabling the production route change, the plan is to run:
- backend tests inside the production compose context
- Caddy config validation
- static placeholder publish validation

Recommended checks:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build backend
docker compose --env-file .env.production -f docker-compose.production.yml run --rm --no-deps backend \
  node --test test/mobile-contract.test.js test/source-integrity.test.js
```

Caddy validation is already supported through the existing Caddy install helper.

## Assumptions

- production hostname is still `atp` for the guarded server-side scripts
- production Caddy is managed through the shared Caddy setup used by `scripts/deploy/install_production_caddy.sh`
- Keycloak remains served under `https://asiatravelplan.com/keycloak`
- backend auth remains served under `https://asiatravelplan.com/auth/*`
- the placeholder should remain public only for this interim week

## Tradeoff

Recommended tradeoff:
- authenticated staff use `/app-home.html` temporarily instead of `/`

Reason:
- simpler and safer this week
- avoids mixing public placeholder behavior and authenticated homepage behavior on the same root path immediately
- keeps next week's cleanup straightforward

Alternative not recommended for this interim step:
- make `/` itself dynamically switch between placeholder and full homepage based on login state

That can work, but it introduces more routing and auth-coupling risk than needed for a one-week transition.

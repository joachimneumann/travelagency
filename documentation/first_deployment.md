# First Deployment Migration Plan

Status: rollout implementation applied in this branch; pending production host
tag, deploy, and smoke tests.

This plan covers the first production deployment after removing the temporary
placeholder page. The target behavior is that `https://asiatravelplan.com/`
serves the real public homepage from `frontend/pages/index.html`, matching
staging, and no deploy script copies files into `/srv/placeholder`.

## Current Placeholder State

Before this migration, production still uses the placeholder setup:

- `https://asiatravelplan.com/` serves the placeholder bundle from
  `/srv/placeholder`.
- `/placeholder-assets/*` is public.
- `/app-home.html` used to serve the real homepage only after the temporary
  `/production-access/check` forward-auth check.
- production deploy wrappers used to call
  `scripts/deploy/deploy_static_website.sh`.
- `docker-compose.caddy.yml` used to mount `/srv/placeholder:/placeholder:ro`.

Do not use this document as a normal production deploy checklist until the
migration has been implemented and validated.

## Target State After Migration

- Production checkout: `/srv/asiatravelplan`
- Staging checkout: `/srv/asiatravelplan-staging`
- Public Caddy runtime root: `/srv/asiatravelplan-public`
- Production app root mounted in Caddy as `/production-app`
- Public homepage source: `frontend/pages/index.html`
- Public metadata is served from the real site root:
  - `site.webmanifest`
  - `robots.txt`
  - `sitemap.xml`
- Placeholder bundle: removed from the repository
- Placeholder runtime directory: no longer mounted or updated
- `/placeholder-assets/*`: returns `404`
- `/app-home.html`: redirects to `/`
- Backend HTML pages are protected by Caddy `forward_auth` through
  `/backend-access/check`
- `/production-access/check`: removed

## Branch And Release Model

Use `main` as the staging and next-release branch. Do not maintain a separate
long-lived production branch unless there is a later need for multiple release
trains.

Recommended model:

- feature branches contain work in progress.
- `main` contains accepted work and is what staging deploys.
- production releases are immutable Git tags on `main`.
- production deploys only from a validated tagged commit.

Normal flow:

1. Merge feature work into `main`.
2. Deploy staging from `main`.
3. Validate staging.
4. Create a production tag on the exact validated `main` commit.
5. Deploy production from that tagged commit.

This keeps `main` moving forward while still giving production a precise,
auditable release marker.

## Compatibility Decision

Chosen compatibility behavior:

- `/app-home.html` redirects to `/`.
- Backend HTML pages are no longer public static responses; Caddy checks
  `/backend-access/check` before serving them.

## Implementation Plan

1. Update production Caddy routing.
   - Serve `/` and `/index.html` from
     `/production-app/frontend/pages/index.html`.
   - Serve `/404.html` from `/production-app/frontend/pages/404.html`.
   - Keep backend HTML pages served from `/production-app/frontend/pages`.
   - Protect backend HTML pages with Caddy `forward_auth` through
     `/backend-access/check`.
   - Keep only the expected public static paths served from `/production-app`.
   - Keep `/auth/*`, `/api/*`, `/public/v1/*`, and `/integrations/*` proxied to
     the production backend.
   - Keep `/keycloak/*` proxied to production Keycloak.
   - Remove `/placeholder` as the production root.
   - Remove `/placeholder-assets/*`.
   - Keep `/app-home.html` only as a redirect to `/`.

2. Make Caddy file serving allowlisted.
   - Do not set `root * /production-app` with a broad final `file_server`.
   - Use explicit matchers for public static paths such as `/assets/*`,
     `/shared/*`, `/frontend/scripts/*`, `/frontend/data/*`,
     `/frontend/Generated/*`, `/site.webmanifest`, `/robots.txt`, and
     `/sitemap.xml`.
   - Use explicit matchers for public HTML pages.
   - End the production site block with a `404` response for unmatched paths.
   - Keep `hide` rules for sensitive repo paths wherever `file_server` is used.
   - Confirm these paths return `404`: `/.env`, `/.git/config`,
     `/backend/app/src/server.js`, `/deploy/Caddyfile`, and
     `/documentation/first_deployment.md`.

3. Remove placeholder mounts.
   - Remove `/srv/placeholder:/placeholder:ro` from `docker-compose.caddy.yml`.
   - Remove the same stale mount from `docker-compose.staging.yml` if it is no
     longer needed.

4. Stop publishing the placeholder bundle.
   - Remove calls to `scripts/deploy/deploy_static_website.sh` from all
     production deploy wrappers.
   - Retire or delete `scripts/deploy/deploy_static_website.sh`.
   - Ensure `./deploy_frontend` on `/srv/asiatravelplan` only regenerates
     homepage assets and does not copy anything into `/srv/placeholder`.

5. Define the new wrapper behavior.
   - `scripts/production/deploy_production_frontend.sh` should run
     `node scripts/assets/generate_public_homepage_assets.mjs`, verify
     `frontend/data/generated/homepage/public-homepage-main.bundle.js`, and exit.
   - `scripts/production/deploy_production_backend_frontend.sh` should run the
     backend update path and reload Caddy if routing changed. It must not publish
     the placeholder bundle.
   - `scripts/production/deploy_production_all.sh` should run
     `scripts/deploy/update_production.sh all` and
     `scripts/production/deploy_production_caddy.sh`. It must not call
     `scripts/deploy/deploy_static_website.sh`.
   - Do not add a separate manual homepage asset generation step to the
     production deploy sequence. `scripts/deploy/update_production.sh all`
     already regenerates homepage assets.

6. Move or recreate public metadata.
   - Keep the real root `site.webmanifest`.
   - Move or recreate `robots.txt` and `sitemap.xml` outside the `production/`
     placeholder bundle before deleting `production/`.
   - Verify manifest icon paths point to real production app assets, not
     `placeholder-assets/*`.

7. Delete placeholder artifacts.
   - Remove the `production/` placeholder bundle after metadata has been moved.
   - Remove stale references to `Coming Soon`, `placeholder-assets`, and
     `/srv/placeholder` from active code, config, and scripts.

8. Remove the temporary app-home auth flow.
   - Remove `/production-access/check` from backend routes.
   - Add `/backend-access/check` for protected backend HTML page checks.
   - Remove `handleProductionAccessCheck` and its handler wiring.
   - Remove tests that assert the temporary route exists.
   - Remove `app-home.html` checks from homepage JavaScript.
   - Regenerate homepage assets so generated bundles do not contain stale
     `app-home.html` logic.

9. Update related documentation.
   - Rewrite `documentation/backend/create_production.md` so it describes the
     real production setup, not the temporary placeholder rollout.
   - Update `scripts/README.md` so production frontend deploy no longer says it
     publishes placeholder static files.

## Validation Before Deploy

Run these checks before deploying:

```bash
node --test backend/app/test/mobile-contract.test.js
node --test backend/app/test/source-integrity.test.js
node --test backend/app/test/http_routes.test.js
node --test backend/app/test/i18n_integrity.test.js
node --check frontend/scripts/main.js
node scripts/assets/generate_public_homepage_assets.mjs
node --check frontend/data/generated/homepage/public-homepage-main.bundle.js
git diff --check
```

Validate Caddy before reloading production:

```bash
docker run --rm \
  -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2 \
  caddy validate --config /etc/caddy/Caddyfile
```

Run a leftover scan:

```bash
rg -n "placeholder-assets|/srv/placeholder|/placeholder|production-access|deploy_static_website|Coming Soon" .
```

Only expected matches should remain. After the cleanup release, there should be
no matches outside this migration note, current production routing docs, and
historical documentation. Separately check `app-home` references; active code
should keep only the production Caddy redirect.

Run an exposure scan on the Caddyfile and review every production `file_server`
block:

```bash
rg -n "root \* /production-app|file_server|respond 404|hide |backend-access" deploy/Caddyfile
```

The production site must not have a catch-all `file_server` rooted at
`/production-app`.

## Production Tags

Mark production releases with Git tags on the exact `main` commit that is
deployed.

Recommended tag format:

```text
production-YYYY-MM-DD-N
```

Example:

```bash
git checkout main
git pull --ff-only
git tag -a production-2026-04-22-1 -m "Production deploy 2026-04-22"
git push origin production-2026-04-22-1
```

Deploy the tagged commit on the production host:

```bash
cd /srv/asiatravelplan
git fetch origin --tags
git checkout main
git pull --ff-only
git rev-parse HEAD
git rev-parse production-2026-04-22-1
```

The two `rev-parse` values should match before deploying. If they do not match,
the production host is not on the tagged release commit.

Operational rule:

- `main` contains the latest accepted code and feeds staging.
- production tags identify the commits that were deployed to production.
- do not create production tags before staging has been validated.
- do not move or reuse production tags after pushing them.
- rollback means deploying an older production tag, not editing the tag.

## Production Deploy Sequence

Before changing public routing, preserve the current runtime Caddy files:

```bash
cd /srv/asiatravelplan-public
cp deploy/Caddyfile deploy/Caddyfile.before-public-homepage
cp docker-compose.caddy.yml docker-compose.caddy.yml.before-public-homepage
```

After the implementation is merged, tagged, and staging has been validated:

```bash
cd /srv/asiatravelplan
git fetch origin --tags
git checkout main
git pull --ff-only
test "$(git rev-parse HEAD)" = "$(git rev-parse production-2026-04-22-1)"

./scripts/deploy/update_production.sh all
./scripts/production/deploy_production_caddy.sh
```

This order makes `/backend-access/check` available before Caddy starts using it
for backend HTML pages. During the short gap before Caddy reloads,
`/app-home.html` may no longer pass its old temporary auth check; after Caddy is
reloaded it redirects to `/`.

If the frontend-only wrapper remains, it should be safe to run:

```bash
./deploy_frontend
```

It must not copy files into `/srv/placeholder`.

## Smoke Tests

After deploy, verify:

```bash
curl -I https://asiatravelplan.com/
curl -I https://asiatravelplan.com/index.html
curl -I https://asiatravelplan.com/site.webmanifest
curl -I https://asiatravelplan.com/robots.txt
curl -I https://asiatravelplan.com/sitemap.xml
curl -I https://asiatravelplan.com/assets/img/logo-asiatravelplan.svg
curl -I https://asiatravelplan.com/shared/css/tokens.css
curl -I https://asiatravelplan.com/frontend/data/generated/homepage/public-homepage-main.bundle.js
curl -I 'https://asiatravelplan.com/assets/generated/homepage/tours/tour_17d0e941-b5f4-4685-8fd6-c71d3655aeeb/tour_17d0e941-b5f4-4685-8fd6-c71d3655aeeb.webp?v=2026-04-22T15%3A58%3A19.568Z'
curl -I https://asiatravelplan.com/bookings.html
curl -I https://asiatravelplan.com/placeholder-assets/styles.css
curl -I https://asiatravelplan.com/app-home.html
curl -I https://asiatravelplan.com/.env
curl -I https://asiatravelplan.com/backend/app/src/server.js
curl -I https://asiatravelplan.com/deploy/Caddyfile
```

Expected results:

- `/` returns the real homepage, not the placeholder.
- `/index.html` returns the real homepage.
- `/site.webmanifest` returns the real manifest.
- `/robots.txt` and `/sitemap.xml` resolve.
- normal assets resolve from the production app.
- generated homepage data resolves from the production app.
- public tour images resolve through the backend.
- unauthenticated `/bookings.html` redirects to `/auth/login` instead of serving
  the backend HTML shell.
- `/placeholder-assets/*` returns `404`.
- `/app-home.html` redirects to `/`.
- sensitive repo paths return `404`.

Check the homepage body:

```bash
curl -fsSL https://asiatravelplan.com/ | rg -q "Custom Southeast Asia Holidays"
if curl -fsSL https://asiatravelplan.com/ | rg -q "Coming Soon|placeholder-assets"; then
  echo "Placeholder content is still present" >&2
  exit 1
fi
```

Check the user flow in a browser:

- public homepage loads without authentication.
- backend login button still sends staff to the Keycloak login flow.
- after login, staff can reach the backend landing page.
- unauthenticated visitors cannot access backend HTML pages or APIs that require
  authentication.

## Rollback

Preferred rollback is to deploy the previous production tag:

```bash
cd /srv/asiatravelplan
git fetch origin --tags
git switch --detach production-YYYY-MM-DD-N
./scripts/production/deploy_production_caddy.sh
./scripts/deploy/update_production.sh all
```

If only Caddy routing needs to be restored and the old placeholder runtime files
still exist:

```bash
cd /srv/asiatravelplan-public
cp deploy/Caddyfile.before-public-homepage deploy/Caddyfile
cp docker-compose.caddy.yml.before-public-homepage docker-compose.caddy.yml
docker compose -p asiatravelplan-public \
  --env-file /srv/asiatravelplan/.env \
  -f docker-compose.caddy.yml \
  up -d caddy
```

Do not delete `/srv/placeholder` on the production host until the public homepage
cutover has passed smoke tests and the previous production tag rollback path is
confirmed.

This rollback only restores code and routing. It does not change booking or
customer data.

# First Deployment

This plan covers the first production deployment after removing the temporary
placeholder page. The target behavior is that `https://asiatravelplan.com/`
serves the real public homepage from `frontend/pages/index.html`, matching
staging, and no deploy script copies files into `/srv/placeholder`.

## Current Target State

- Production checkout: `/srv/asiatravelplan`
- Staging checkout: `/srv/asiatravelplan-staging`
- Public Caddy runtime root: `/srv/asiatravelplan-public`
- Production app root mounted in Caddy as `/production-app`
- Public homepage source: `frontend/pages/index.html`
- Placeholder bundle: removed

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

## Implementation Plan

1. Update production Caddy routing.
   - Serve `/` and `/index.html` from `/production-app/frontend/pages/index.html`.
   - Keep backend HTML pages served from `/production-app/frontend/pages`.
   - Keep static assets served from `/production-app`.
   - Remove `/placeholder` as the production root.
   - Remove `/placeholder-assets/*`.
   - Remove the temporary authenticated `/app-home.html` route.
   - Optionally keep `/app-home.html` as a redirect to `/` for old links.

2. Remove placeholder mounts.
   - Remove `/srv/placeholder:/placeholder:ro` from `docker-compose.caddy.yml`.
   - Remove the same stale mount from `docker-compose.staging.yml` if it is no
     longer needed.

3. Stop publishing the placeholder bundle.
   - Remove calls to `scripts/deploy/deploy_static_website.sh` from production
     deploy wrappers.
   - Retire or delete `scripts/deploy/deploy_static_website.sh`.
   - Ensure `./deploy_frontend` on `/srv/asiatravelplan` only regenerates
     homepage assets and does not copy anything into `/srv/placeholder`.

4. Delete placeholder artifacts.
   - Remove the `production/` placeholder bundle.
   - Keep required public metadata in the real site root:
     - `site.webmanifest`
     - `robots.txt`
     - `sitemap.xml`

5. Remove the temporary app-home auth flow.
   - Remove `/production-access/check` from backend routes.
   - Remove `handleProductionAccessCheck` and its handler wiring.
   - Remove tests that assert the temporary route exists.
   - Remove `app-home.html` checks from homepage JavaScript.
   - Regenerate homepage assets so generated bundles do not contain
     `app-home.html`.

6. Update documentation.
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
rg -n "app-home|placeholder-assets|/srv/placeholder|/placeholder|production-access|deploy_static_website" .
```

Only expected matches should remain. Ideally there should be none outside this
deployment note and historical documentation.

## Production Deploy Sequence

After the implementation is merged into the production checkout:

```bash
cd /srv/asiatravelplan
git fetch origin
git pull --ff-only
./scripts/deploy/update_production.sh all
./scripts/production/deploy_production_caddy.sh
```

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
curl -I https://asiatravelplan.com/assets/img/logo-asiatravelplan.svg
curl -I https://asiatravelplan.com/placeholder-assets/styles.css
curl -I https://asiatravelplan.com/app-home.html
```

Expected results:

- `/` returns the real homepage.
- `/index.html` returns the real homepage.
- `/site.webmanifest` returns the real manifest.
- normal assets resolve from the production app.
- `/placeholder-assets/*` returns `404`.
- `/app-home.html` either redirects to `/` or returns `404`, depending on the
  chosen compatibility behavior.

## Rollback

If the production homepage fails after Caddy reload:

1. Revert the Caddyfile change in `/srv/asiatravelplan`.
2. Run `./scripts/production/deploy_production_caddy.sh`.
3. If needed, restore the previous placeholder deployment script and rerun the
   old static publish step.

This rollback only restores routing. It does not change booking or customer
data.

# Production Deployment

This document describes the production setup after the first public homepage
rollout.

## Runtime Layout

- production checkout: `/srv/asiatravelplan`
- staging checkout: `/srv/asiatravelplan-staging`
- shared public Caddy runtime root: `/srv/asiatravelplan-public`
- production backend compose project: `asiatravelplan`
- shared public Caddy compose project: `asiatravelplan-public`

The public production site serves the real homepage from
`frontend/pages/index.html`. The old placeholder bundle is not deployed,
mounted, or published.

## Public Routing

- `/` and `/index.html` serve `frontend/pages/index.html`.
- `/404.html`, `/privacy.html`, and `/traveler-details.html` are public HTML
  pages served from `frontend/pages/`.
- `/app-home.html` redirects to `/` for compatibility with old staff links.
- `/placeholder-assets/*` returns `404`.
- `/site.webmanifest`, `/robots.txt`, and `/sitemap.xml` are served from the
  repository root.
- `/assets/*`, `/shared/*`, `/frontend/scripts/*`, `/frontend/data/*`, and
  `/frontend/Generated/*` are the allowlisted static frontend paths.
- `/auth/*`, `/api/*`, `/public/v1/*`, and `/integrations/*` proxy to the
  production backend on host port `8788`.
- `/keycloak/*` proxies to production Keycloak on host port `8082`.

Production Caddy must not use a broad catch-all `file_server` rooted at
`/production-app`. Unmatched paths end with a `404` response.

## Backend HTML Protection

Backend workspace HTML pages are served statically only after Caddy verifies an
authenticated backend session:

- protected pages: `/bookings.html`, `/booking.html`, `/persons.html`,
  `/marketing_tours.html`, `/marketing_tour.html`, `/standard-tours.html`,
  `/standard-tour.html`, `/settings.html`, and `/emergency.html`
- Caddy `forward_auth` endpoint: `/backend-access/check`
- unauthenticated users are redirected to `/auth/login` with the requested page
  as `return_to`

API authorization remains enforced by the backend.

## Deploy Commands

Production app stack:

```bash
cd /srv/asiatravelplan
./scripts/deploy/update_production.sh all
```

Shared public Caddy stack:

```bash
cd /srv/asiatravelplan
./scripts/production/deploy_production_caddy.sh
```

Frontend-only refresh:

```bash
cd /srv/asiatravelplan
./deploy_frontend
```

`./deploy_frontend` only regenerates public homepage assets. It does not copy a
static bundle to `/srv/placeholder`.

## Release Model

Production deploys should use immutable tags on `main`, for example:

```bash
git tag -a production-YYYY-MM-DD-N -m "Production deploy YYYY-MM-DD"
git push origin production-YYYY-MM-DD-N
```

On the production host, verify that `main` points at the intended tag before
running deploy commands:

```bash
git fetch origin --tags
git checkout main
git pull --ff-only
test "$(git rev-parse HEAD)" = "$(git rev-parse production-YYYY-MM-DD-N)"
```

Rollback means deploying a previous production tag, not moving or editing a tag.

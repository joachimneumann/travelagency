# Scripts Overview

The `scripts/` folder is organized by concern:

- `scripts/local/`
  - local deploy plus lower-level start, stop, and restart helpers
- `scripts/staging/`
  - canonical staging deploy entrypoints
- `scripts/production/`
  - canonical production deploy entrypoints
- `scripts/deploy/`
  - lower-level staging and production deploy helpers
- `scripts/content/`
  - content sync, backups, and booking-data maintenance
- `scripts/assets/`
  - asset and generated-catalog builders
- `scripts/i18n/`
  - translation sync and helper commands
- `scripts/keycloak/`
  - Keycloak bootstrap helpers
- `scripts/tests/`
  - script-level smoke tests
- `scripts/tools/`
  - small one-off utilities
- `scripts/lib/`
  - shared shell helpers

Common entry points:

```bash
./deploy_frontend
./deploy_backend
./deploy_backend_frontend
./deploy_keycloak
./deploy_all

./scripts/local/deploy_local_all.sh
./scripts/local/deploy_local_backend.sh
./scripts/local/deploy_local_frontend.sh
./scripts/local/deploy_local_backend_frontend.sh

./scripts/staging/deploy_staging_backend.sh
./scripts/staging/deploy_staging_frontend.sh
./scripts/staging/deploy_staging_backend_frontend.sh
./scripts/staging/deploy_staging_all.sh

./scripts/production/deploy_production_backend.sh
./scripts/production/deploy_production_frontend.sh
./scripts/production/deploy_production_backend_frontend.sh
./scripts/production/deploy_production_all.sh

./scripts/content/wipe_local_bookings.sh --yes
./scripts/content/wipe_staging_bookings.sh --yes
./scripts/content/clipVideo assets/video/mountains.mp4

./scripts/i18n/translate check
node scripts/assets/generate_public_homepage_assets.mjs
```

## Server Deploy Layout

Current `atp` layout:

- production checkout: `/srv/asiatravelplan`
- staging checkout: `/srv/asiatravelplan-staging`
- public Caddy runtime root: `/srv/asiatravelplan-public`
- production app compose project: `asiatravelplan`
- staging app compose project: `asiatravelplan-staging`
- shared public Caddy compose project: `asiatravelplan-public`

The deploy scripts now pin the correct compose project names internally.
Do not rely on a shell-wide `export COMPOSE_PROJECT_NAME=...` anymore.

Canonical server commands:

```bash
# production app stack
cd /srv/asiatravelplan
./scripts/deploy/update_production.sh all
./scripts/production/deploy_production_caddy.sh

# production frontend asset refresh only
./scripts/production/deploy_production_frontend.sh

# staging app stack
cd /srv/asiatravelplan-staging
./scripts/deploy/update_staging.sh all
```

Current public routing notes:

- `asiatravelplan-public` owns ports `80` and `443`
- production `/` serves the real homepage from `/srv/asiatravelplan`
- production backend HTML pages are protected by `/backend-access/check`
- staging backend is published on host port `8789`
- staging Keycloak is published on host port `8083`
- the public Caddy proxies staging traffic through those host ports

## Directory-Aware Wrappers

The repo root now includes five wrapper commands:

```bash
./deploy_frontend
./deploy_backend
./deploy_backend_frontend
./deploy_keycloak
./deploy_all
```

They must be run from the checkout root itself, and they dispatch by current
directory:

- `/Users/joachim/projects/travelagency` -> local scripts
- `/srv/asiatravelplan` -> production scripts
- `/srv/asiatravelplan-staging` -> staging scripts

Git worktrees attached to those repositories are treated as the same
environment as their parent checkout. A worktree attached to
`$HOME/projects/travelagency`, for example, dispatches to the local scripts.

Use `./deploy_backend_frontend` instead of running `./deploy_backend` followed
by `./deploy_frontend`. The combined wrapper dispatches to the environment's
backend+frontend deploy entrypoint so shared work such as i18n checks, predeploy
tests, `git pull`, and public homepage asset generation runs only once.

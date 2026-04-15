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

./scripts/i18n/translate check
node scripts/assets/generate_public_homepage_assets.mjs
```

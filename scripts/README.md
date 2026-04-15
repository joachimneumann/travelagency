# Scripts Overview

The `scripts/` folder is organized by concern:

- `scripts/local/`
  - local start, stop, and restart helpers
- `scripts/deploy/`
  - staging and production deployment helpers
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
./scripts/local/start_local_all.sh
./scripts/local/start_local_backend.sh
./scripts/local/start_local_frontend.sh
./scripts/local/start_local_keycloak.sh

./scripts/deploy/update_staging.sh backend
./scripts/deploy/update_production.sh backend

./scripts/content/wipe_local_bookings.sh --yes
./scripts/content/wipe_staging_bookings.sh --yes

./scripts/i18n/translate check
node scripts/assets/generate_public_homepage_assets.mjs
```

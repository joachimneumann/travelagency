# Current System Map

This document describes the repository as it exists now.

Use it for orientation before editing code or reading older concept notes.

## 1. Source of Truth and Generation

The active source of truth is the CUE model under:
- `model/entities/`
- `model/api/`
- `model/enums/`
- `model/common/`
- `model/ir/`

Generation entry point:
- `tools/generator/generate_mobile_contract_artifacts.rb`

Generated outputs currently committed in the repository:
- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`

Important current mobile status:
- the generator can emit iOS artifacts only when run with `GENERATE_IOS=1`
- `mobile/iOS/Generated/` is not currently present in the repository

## 2. Backend Runtime

Backend root:
- `backend/app/`

Main entry point:
- `backend/app/src/server.js`

Route table:
- `backend/app/src/http/routes.js`

Important backend areas:
- `backend/app/src/http/`
  - route wiring, handlers, pagination, HTTP helpers
- `backend/app/src/domain/`
  - pricing, booking views, travel plan, access, tour support, content-i18n and translation status helpers
- `backend/app/src/lib/`
  - PDF writers, translation client, Keycloak directory, store utilities, PDF i18n
- `backend/app/src/integrations/`
  - Meta webhook integration

Runtime persistence is currently file-based:
- `backend/app/data/store.json`
- `backend/app/data/generated_offers/`
- `backend/app/data/invoices/`
- `backend/app/data/booking_images/`
- `backend/app/data/booking_person_photos/`
- `content/tours/`
- `content/country_reference_info.json`

The backend is a raw Node HTTP server, not an Express app.

## 3. Frontend Runtime

Frontend roots:
- `frontend/pages/`
- `frontend/scripts/`
- `shared/css/`
- `shared/js/`
- `shared/generated/`

Public site entry:
- `frontend/pages/index.html`
- `frontend/scripts/main.js`
- `frontend/scripts/main_tours.js`

Backend workspace entry:
- `frontend/pages/bookings.html`
- `frontend/scripts/pages/booking_list.js`
- `frontend/pages/emergency.html`
- `frontend/scripts/pages/emergency.js`

Booking detail workspace:
- `frontend/pages/booking.html`
- `frontend/scripts/pages/booking.js`

Tour editor:
- `frontend/pages/marketing_tour.html`
- `frontend/scripts/pages/tour.js`

Public destination publication flow:
- `content/country_reference_info.json`
- `backend/app/src/http/handlers/tours.js`
- `frontend/scripts/main_tours.js`

This flow controls which destinations appear on the homepage and in the public tours payload.

Booking page feature modules:
- `frontend/scripts/booking/persons.js`
- `frontend/scripts/booking/offers.js`
- `frontend/scripts/booking/pricing.js`
- `frontend/scripts/booking/invoices.js`
- `frontend/scripts/booking/travel_plan.js`
- `frontend/scripts/booking/whatsapp.js`

Language/runtime i18n entrypoints:
- `shared/generated/language_catalog.js`
  - generated language source of truth
- `frontend/scripts/shared/backend_i18n.js`
  - backend workspace UI language
- `frontend/scripts/shared/frontend_i18n.js`
  - public-site UI language
- `frontend/scripts/booking/i18n.js`
  - booking source/customer language helpers
- `backend/app/src/domain/booking_content_i18n.js`
  - booking localized-map normalization and branch resolution
- `backend/app/src/lib/pdf_i18n.js`
  - customer-facing PDF copy dictionary

Styling:
- shared entrypoint: `shared/css/styles.css`
- page-specific overrides: `shared/css/pages/*.css`
- component styles: `shared/css/components/*.css`

## 4. Mobile Runtime

Mobile root:
- `mobile/iOS/`

Current app entry:
- `mobile/iOS/AsiaTravelPlanApp.swift`

Current runtime scope:
- app bootstrap/version gate
- Keycloak login and logout
- local session restoration
- minimal authenticated shell

Current key files:
- `mobile/iOS/AppConfig.swift`
- `mobile/iOS/Services/APIClient.swift`
- `mobile/iOS/Services/AppBootstrapStore.swift`
- `mobile/iOS/Services/AuthService.swift`
- `mobile/iOS/Services/SessionStore.swift`
- `mobile/iOS/Views/RootView.swift`
- `mobile/iOS/Views/LoginView.swift`
- `mobile/iOS/Views/AppShellView.swift`

Not currently present in active mobile runtime:
- generated Swift contract files
- booking/tour/offer/invoice/person UI flows

Authoritative mobile status doc:
- `documentation/backend/mobileApp.md`

## 5. Deployment and Operations

Staging compose:
- `docker-compose.staging.yml`

Local helper compose files:
- `docker-compose.local-caddy.yml`
- `docker-compose.local-keycloak.yml`

Reverse proxy configs:
- `deploy/Caddyfile`
- `deploy/Caddyfile.local`

Main local scripts:
- `scripts/start_local_all.sh`
- `scripts/start_local_backend.sh`
- `scripts/start_local_frontend.sh`
- `scripts/start_local_keycloak.sh`
- matching `restart_*` and `stop_*` scripts

Main staging update script:
- `scripts/update_staging.sh`

## 6. Current Exceptions to the Clean Model-Driven Story

These areas are active and intentionally still partly handwritten:
- some backend routes in `backend/app/src/http/routes.js`
- Meta webhook endpoints
- tour upload behavior
- some translation workflows
- some runtime pricing and PDF logic

This is acceptable only while the handwritten behavior stays aligned with:
- `model/`
- `api/generated/openapi.yaml`
- generated runtime contract modules

Current known exception:
- none in the booking source-language contract path after the `editing_language` cleanup; page URLs use `lang` for backend UI, and booking API requests use `content_lang` plus `source_lang`

## 7. Practical Reading Order

For a new contributor:

1. `README.md`
2. `documentation/current_system_map.md`
3. `documentation/concept/software_architecture.md`
4. `documentation/concept/i18n_runtime.md` for language-sensitive changes
5. `model/root.cue`
6. `model/api/endpoints.cue`
7. `tools/generator/generate_mobile_contract_artifacts.rb`
8. `backend/app/src/http/routes.js`
9. `backend/app/src/server.js`
10. the relevant runtime page or service entrypoint you intend to change

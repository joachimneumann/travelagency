# AsiaTravelPlan Mobile App Guide

This is the authoritative mobile status document.

Use this file instead of `mobile/iOS/README.md` when you want to understand what the iOS app currently is and is not.

## Current Status

The iOS app is intentionally reduced.

Implemented now:
- app bootstrap and version gate
- Keycloak login and logout
- local session restoration
- role-aware authenticated shell

Not implemented now:
- booking list
- booking detail
- offer, payment-document, activity, person, and chat UI
- tour editing
- generated Swift contract files in the active tree

The current app should be treated as a minimal authenticated shell, not as a full mobile client.

## Current Entry Points

App entry:
- `mobile/iOS/AsiaTravelPlanApp.swift`

Configuration:
- `mobile/iOS/AppConfig.swift`

Core services:
- `mobile/iOS/Services/APIClient.swift`
- `mobile/iOS/Services/AppBootstrapStore.swift`
- `mobile/iOS/Services/AuthService.swift`
- `mobile/iOS/Services/SessionStore.swift`
- `mobile/iOS/Services/TokenStore.swift`

Current views:
- `mobile/iOS/Views/RootView.swift`
- `mobile/iOS/Views/LoginView.swift`
- `mobile/iOS/Views/AppShellView.swift`
- `mobile/iOS/Views/StartupFailureView.swift`
- `mobile/iOS/Views/UnauthorizedView.swift`
- `mobile/iOS/Views/UpdateRequiredView.swift`

## Current Runtime Behavior

Bootstrap flow:
- app calls `GET /public/v1/mobile/bootstrap`
- app checks minimum supported version and force-update flag

Authentication flow:
- separate mobile Keycloak client
- OpenID Connect with PKCE
- redirect URI: `asiatravelplan://auth/callback`

Session behavior:
- restore stored session on app activation
- refresh tokens where possible
- logout through Keycloak end-session flow

## Current Configuration Reality

The current iOS app is wired directly to staging values in code:
- `apiBaseURL = https://api-staging.asiatravelplan.com`
- `keycloakBaseURL = https://auth-staging.asiatravelplan.com`
- realm `master`
- client id `asiatravelplan-ios`

These values currently live in:
- `mobile/iOS/AppConfig.swift`

This means the mobile target is not yet a flexible environment-driven app.

## Contract and Model Alignment

The source of truth remains:
- `model/json/`
- `model/database/`
- `model/api/`
- `model/enums/`
- `model/common/`
- `model/ir/`

The generator emits:
- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`

Important current exception:
- `mobile/iOS/Generated/` is not currently present in the repository
- the iOS app is using handwritten Swift types and services for the reduced shell

If Swift contract artifacts are explicitly needed again, generate them with:

```bash
GENERATE_IOS=1 ruby /Users/internal_admin/projects/travelagency/tools/generator/generate_mobile_contract_artifacts.rb
```

## Domain Rules Mobile Must Follow

When mobile work resumes, it must follow the active web/backend vocabulary:
- booking
- booking persons
- ATP staff
- tours
- payment documents
- activities

Important rules:
- `booking.persons[]` is the editable booking-owned person data
- `booking.web_form_submission` is the immutable inbound snapshot
- there is no standalone shared person directory in the current architecture

## Recommended Next Mobile Expansion

If mobile work resumes, the next useful scope is:
- booking list
- booking detail
- booking stage changes where allowed
- booking notes
- booking activity visibility
- booking payment-document visibility
- booking person summary visibility

Still out of scope unless there is a strong reason:
- standalone person CRUD
- separate shared master-data workflows
- tour editing
- staff administration UI

## Roles

Current expected role behavior:
- `atp_staff`: assigned bookings only, plus tour read/edit access in the main system
- `atp_manager`: all bookings, assignment changes, Keycloak user directory access, tour read/edit access
- `atp_admin`: same booking and tour capabilities as manager
- `atp_accountant`: booking read access, tours read-only, Keycloak user directory access

## Maintenance Notes

To regenerate the Xcode project:

```bash
ruby /Users/internal_admin/projects/travelagency/mobile/iOS/generate_xcodeproj.rb
```

For overall repository orientation, start with:
- `/Users/internal_admin/projects/travelagency/README.md`
- `/Users/internal_admin/projects/travelagency/documentation/current_system_map.md`

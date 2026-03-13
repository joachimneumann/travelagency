# AsiaTravelPlan iOS App

This iOS target is intentionally reduced to:
- app bootstrap / version gate
- Keycloak login and logout
- local session restoration
- a minimal authenticated app shell

Removed on purpose:
- generated Swift API and model files
- all booking, offer, invoice, person, chat, and tour UI beyond the minimal authenticated shell
- domain-specific mobile view models and formatting helpers

Kept on purpose:
- [`/Users/internal_admin/projects/travelagency/mobile/iOS/AsiaTravelPlanApp.swift`](/Users/internal_admin/projects/travelagency/mobile/iOS/AsiaTravelPlanApp.swift)
- [`/Users/internal_admin/projects/travelagency/mobile/iOS/AppConfig.swift`](/Users/internal_admin/projects/travelagency/mobile/iOS/AppConfig.swift)
- auth/session services under [`/Users/internal_admin/projects/travelagency/mobile/iOS/Services`](/Users/internal_admin/projects/travelagency/mobile/iOS/Services)
- login/setup views under [`/Users/internal_admin/projects/travelagency/mobile/iOS/Views`](/Users/internal_admin/projects/travelagency/mobile/iOS/Views)

To regenerate the Xcode project:

```bash
ruby /Users/internal_admin/projects/travelagency/mobile/iOS/generate_xcodeproj.rb
```

The main contract generator no longer emits iOS Swift artifacts by default. If you
explicitly need them again, run it with:

```bash
GENERATE_IOS=1 ruby /Users/internal_admin/projects/travelagency/tools/generator/generate_mobile_contract_artifacts.rb
```

Open the project in Xcode and configure signing plus the Keycloak mobile client:
- client id: `asiatravelplan-ios`
- redirect URI: `asiatravelplan://auth/callback`

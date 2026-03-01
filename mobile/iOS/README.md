# AsiaTravelPlan iOS App

This folder contains the first implementation pass of the native iPhone app described in:
- `/Users/internal_admin/projects/travelagency/documentation/backend/mobileApp.md`

Current scope:
- SwiftUI app shell
- session handling
- JWT role decoding
- allow only `atp_admin`, `atp_manager`, `atp_accountant`, `atp_staff`
- booking list
- booking detail
- role-aware booking actions
- PKCE-based Keycloak login flow
- startup bootstrap gate with minimum supported app version enforcement
- generated contract models/request factory from OpenAPI

Included now:
- Xcode project: `/Users/internal_admin/projects/travelagency/mobile/iOS/AsiaTravelPlan.xcodeproj`
- project generator: `/Users/internal_admin/projects/travelagency/mobile/iOS/generate_xcodeproj.rb`
- contract source: `/Users/internal_admin/projects/travelagency/contracts/mobile-api.openapi.yaml`
- generated models: `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated`
- URL scheme registration in `Resources/Info.plist`
- PKCE authorization code exchange against Keycloak
- refresh-token based session restoration
- Keycloak end-session logout via `ASWebAuthenticationSession`
- startup call to `/public/v1/mobile/bootstrap`
- `Please update` screen when backend requires a newer app build

Regenerate the contract artifacts after changing the OpenAPI file:

```bash
ruby /Users/internal_admin/projects/travelagency/contracts/generate_mobile_contract_artifacts.rb
ruby /Users/internal_admin/projects/travelagency/mobile/iOS/generate_xcodeproj.rb
```

Current limitation:
- command-line build verification in this environment stops at asset compilation because the local Xcode installation here does not expose usable simulator runtimes to the sandbox
- the project should be opened and run from Xcode on the local machine for real device/simulator testing

Suggested next step in Xcode:
1. open `AsiaTravelPlan.xcodeproj`
2. set the signing team / bundle settings you want
3. confirm Keycloak mobile client `asiatravelplan-ios`
4. add `asiatravelplan://auth/callback` to the mobile client post-logout redirect URIs
5. run on simulator or device

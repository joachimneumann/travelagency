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

Included now:
- Xcode project: `/Users/internal_admin/projects/travelagency/mobile/iOS/AsiaTravelPlan.xcodeproj`
- project generator: `/Users/internal_admin/projects/travelagency/mobile/iOS/generate_xcodeproj.rb`
- URL scheme registration in `Resources/Info.plist`
- PKCE authorization code exchange against Keycloak
- refresh-token based session restoration

Current limitation:
- command-line build verification in this environment stops at asset compilation because the local Xcode installation here does not expose usable simulator runtimes to the sandbox
- the project should be opened and run from Xcode on the local machine for real device/simulator testing

Suggested next step in Xcode:
1. open `AsiaTravelPlan.xcodeproj`
2. set the signing team / bundle settings you want
3. confirm Keycloak mobile client `asiatravelplan-ios`
4. run on simulator or device

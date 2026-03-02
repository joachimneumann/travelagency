# Generated Code Cutover

## Purpose

Track legacy generated outputs that should be retired after the new generator is executed and the runtimes are rewired to the split generated layout.

## Legacy generated outputs to retire

- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIModels.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIRequestFactory.swift`
- `/Users/internal_admin/projects/travelagency/assets/js/generated/mobile-api-contract.js`
- `/Users/internal_admin/projects/travelagency/assets/js/generated/models/mobile-api-models.js`
- `/Users/internal_admin/projects/travelagency/assets/js/generated/api/mobile-api-request-factory.js`
- `/Users/internal_admin/projects/travelagency/assets/js/generated/api/mobile-api-client.js`

## Target generated output roots

- `/Users/internal_admin/projects/travelagency/backend/app/Generated/`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/`

## Target generated files

### Backend
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/Models/generated_Currency.js`
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/Models/generated_User.js`
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/Models/generated_Booking.js`
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/Models/generated_Aux.js`
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/API/generated_APIModels.js`
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/API/generated_APIRequestFactory.js`
- `/Users/internal_admin/projects/travelagency/backend/app/Generated/API/generated_APIClient.js`

### Frontend
- `/Users/internal_admin/projects/travelagency/frontend/Generated/Models/generated_Currency.js`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/Models/generated_User.js`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/Models/generated_Booking.js`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/Models/generated_Aux.js`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/API/generated_APIModels.js`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/API/generated_APIRequestFactory.js`
- `/Users/internal_admin/projects/travelagency/frontend/Generated/API/generated_APIClient.js`

### iOS
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/Models/generated_Currency.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/Models/generated_User.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/Models/generated_Booking.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/Models/generated_Aux.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/API/generated_APIModels.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/API/generated_APIRequestFactory.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/API/generated_APIClient.swift`

## Cutover steps

1. Execute the generator.
2. Inspect generated diffs.
3. Rewire backend, frontend, and iOS imports to the new generated locations.
4. Remove runtime references to legacy generated files.
5. Move or delete retired generated files.
6. Remove this temporary migration buffer when the cutover is complete.

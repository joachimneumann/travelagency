# Generated Code Cutover

Moved to `DEPRECATED_CODE`:

- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIModels.swift`
- `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/MobileAPIRequestFactory.swift`
- `/Users/internal_admin/projects/travelagency/assets/js/generated/mobile-api-contract.js`

Cutover status:

1. iOS runtime and Xcode project now use the split generated files under:
   - `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/Models/`
   - `/Users/internal_admin/projects/travelagency/mobile/iOS/Generated/API/`
2. Web runtime no longer imports `/Users/internal_admin/projects/travelagency/assets/js/generated/mobile-api-contract.js`.
3. Legacy generated artifacts remain only as archive material in `DEPRECATED_CODE`.

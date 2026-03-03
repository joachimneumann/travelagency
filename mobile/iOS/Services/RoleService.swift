import Foundation

struct RoleService {
    func isAllowed(_ profile: ClientProfile) -> Bool {
        !profile.roles.isDisjoint(with: AppConfig.allowedRoles)
    }

    func canReadAllBookings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager) || profile.roles.contains(.atpAccountant)
    }

    func canEditAssignedBookings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.staff)
    }

    func canEditAllBookings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canChangeBookingStage(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager) || profile.roles.contains(.atpAccountant) || profile.roles.contains(.staff)
    }

    func canChangeAssignment(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canCreateAtpStaff(_ profile: ClientProfile) -> Bool {
        canChangeAssignment(profile)
    }

    func canReadTours(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpAccountant)
    }

    func canEditTours(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin)
    }
}

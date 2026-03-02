import Foundation

struct RoleService {
    func isAllowed(_ profile: UserProfile) -> Bool {
        !profile.roles.isDisjoint(with: AppConfig.allowedRoles)
    }

    func canReadAllBookings(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager) || profile.roles.contains(.atpAccountant)
    }

    func canEditAssignedBookings(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpStaff)
    }

    func canEditAllBookings(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canChangeBookingStage(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager) || profile.roles.contains(.atpAccountant) || profile.roles.contains(.atpStaff)
    }

    func canChangeAssignment(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canCreateStaff(_ profile: UserProfile) -> Bool {
        canChangeAssignment(profile)
    }

    func canReadTours(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpAccountant)
    }

    func canEditTours(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.atpAdmin)
    }
}

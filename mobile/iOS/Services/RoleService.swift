import Foundation

struct RoleService {
    func isAllowed(_ profile: UserProfile) -> Bool {
        !profile.roles.isDisjoint(with: AppConfig.allowedRoles)
    }

    func canReadAllBookings(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.admin) || profile.roles.contains(.manager) || profile.roles.contains(.accountant)
    }

    func canEditAssignedBookings(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.staff)
    }

    func canEditAllBookings(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.admin) || profile.roles.contains(.manager)
    }

    func canChangeBookingStage(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.admin) || profile.roles.contains(.manager) || profile.roles.contains(.accountant) || profile.roles.contains(.staff)
    }

    func canChangeAssignment(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.admin) || profile.roles.contains(.manager)
    }

    func canCreateStaff(_ profile: UserProfile) -> Bool {
        canChangeAssignment(profile)
    }

    func canReadTours(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.admin) || profile.roles.contains(.accountant)
    }

    func canEditTours(_ profile: UserProfile) -> Bool {
        profile.roles.contains(.admin)
    }
}

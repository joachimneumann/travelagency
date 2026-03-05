import Foundation

struct RoleService {
    func isAllowed(_ profile: ClientProfile) -> Bool {
        !profile.roles.isDisjoint(with: AppConfig.allowedRoles)
    }

    func canReadAllBookings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager) || profile.roles.contains(.atpAccountant)
    }

    func canReadCustomers(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canEditAssignedBookings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpStaff)
    }

    func canEditAllBookings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canChangeBookingStage(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager) || profile.roles.contains(.atpAccountant) || profile.roles.contains(.atpStaff)
    }

    func canChangeAssignment(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

    func canCreateAtpStaff(_ profile: ClientProfile) -> Bool {
        canChangeAssignment(profile)
    }


    func canReadSettings(_ profile: ClientProfile) -> Bool {
        profile.roles.contains(.atpAdmin) || profile.roles.contains(.atpManager)
    }

}

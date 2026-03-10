import Foundation

struct RoleService {
    func isAllowed(_ profile: ClientProfile) -> Bool {
        !profile.roles.isDisjoint(with: AppConfig.allowedRoles)
    }
}

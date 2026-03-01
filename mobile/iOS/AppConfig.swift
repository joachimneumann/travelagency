import Foundation

enum AppConfig {
    static let apiBaseURL = URL(string: "https://api-staging.asiatravelplan.com")!
    static let keycloakBaseURL = URL(string: "https://auth-staging.asiatravelplan.com")!
    static let realm = "master"
    static let clientID = "asiatravelplan-ios"
    static let redirectURI = "asiatravelplan://auth/callback"
    static let allowedRoles: Set<ATPUserRole> = [.admin, .manager, .accountant, .staff]
    static let currentAppVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
}

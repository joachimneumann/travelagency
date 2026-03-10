import Foundation

enum ATPStaffRole: String, Codable, Hashable {
    case atpAdmin = "atp_admin"
    case atpManager = "atp_manager"
    case atpAccountant = "atp_accountant"
    case atpStaff = "atp_staff"
}

struct MobileBootstrapResponse: Codable, Equatable {
    let app: MobileAppVersionGate
    let api: APIContractVersion
}

struct MobileAppVersionGate: Codable, Equatable {
    let minSupportedVersion: String
    let latestVersion: String
    let forceUpdate: Bool

    private enum CodingKeys: String, CodingKey {
        case minSupportedVersion = "min_supported_version"
        case latestVersion = "latest_version"
        case forceUpdate = "force_update"
    }
}

struct APIContractVersion: Codable, Equatable {
    let contractVersion: String

    private enum CodingKeys: String, CodingKey {
        case contractVersion = "contract_version"
    }
}

enum AppConfig {
    static let apiBaseURL = URL(string: "https://api-staging.asiatravelplan.com")!
    static let keycloakBaseURL = URL(string: "https://auth-staging.asiatravelplan.com")!
    static let realm = "master"
    static let clientID = "asiatravelplan-ios"
    static let redirectURI = "asiatravelplan://auth/callback"
    static let allowedRoles: Set<ATPStaffRole> = [.atpAdmin, .atpManager, .atpAccountant, .atpStaff]
    static let currentAppVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"

    static func mobileBootstrapURL() -> URL {
        apiBaseURL
            .appendingPathComponent("public")
            .appendingPathComponent("v1")
            .appendingPathComponent("mobile")
            .appendingPathComponent("bootstrap")
    }
}

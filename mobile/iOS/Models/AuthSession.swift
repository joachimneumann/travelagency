import Foundation

struct AuthSession: Codable, Equatable {
    let accessToken: String
    let idToken: String?
    let refreshToken: String?
    let expiresAt: Date?
    let client: ClientProfile

    var isExpired: Bool {
        guard let expiresAt else { return false }
        return expiresAt <= Date()
    }

    var requiresRefresh: Bool {
        guard let expiresAt else { return false }
        return expiresAt <= Date().addingTimeInterval(300)
    }

    init(accessToken: String, idToken: String?, refreshToken: String?, expiresAt: Date?, client: ClientProfile) {
        self.accessToken = accessToken
        self.idToken = idToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.client = client
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try container.decode(String.self, forKey: .accessToken)
        idToken = try container.decodeIfPresent(String.self, forKey: .idToken)
        refreshToken = try container.decodeIfPresent(String.self, forKey: .refreshToken)
        expiresAt = try container.decodeIfPresent(Date.self, forKey: .expiresAt)
        if let currentClient = try container.decodeIfPresent(ClientProfile.self, forKey: .client) {
            client = currentClient
        } else if let legacyUser = try container.decodeIfPresent(ClientProfile.self, forKey: .user) {
            client = legacyUser
        } else {
            throw DecodingError.keyNotFound(
                CodingKeys.client,
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Missing required field `client` in AuthSession"
                )
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(accessToken, forKey: .accessToken)
        try container.encodeIfPresent(idToken, forKey: .idToken)
        try container.encodeIfPresent(refreshToken, forKey: .refreshToken)
        try container.encodeIfPresent(expiresAt, forKey: .expiresAt)
        try container.encode(client, forKey: .client)
    }

    private enum CodingKeys: String, CodingKey {
        case accessToken
        case idToken
        case refreshToken
        case expiresAt
        case client
        case user
    }
}

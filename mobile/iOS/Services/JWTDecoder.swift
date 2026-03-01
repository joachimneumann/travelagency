import Foundation

struct JWTDecoder {
    struct Claims: Decodable {
        let sub: String
        let email: String?
        let preferredUsername: String?
        let realmAccess: RealmAccess?
        let resourceAccess: [String: ResourceAccess]?
        let exp: TimeInterval?

        private enum CodingKeys: String, CodingKey {
            case sub
            case email
            case preferredUsername = "preferred_username"
            case realmAccess = "realm_access"
            case resourceAccess = "resource_access"
            case exp
        }
    }

    struct RealmAccess: Decodable {
        let roles: [String]
    }

    struct ResourceAccess: Decodable {
        let roles: [String]
    }

    func decode(_ token: String) throws -> Claims {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { throw JWTDecoderError.invalidFormat }
        let payload = String(parts[1])
        guard let data = Data(base64URLEncoded: payload) else { throw JWTDecoderError.invalidPayload }
        return try JSONDecoder().decode(Claims.self, from: data)
    }
}

enum JWTDecoderError: Error {
    case invalidFormat
    case invalidPayload
}

private extension Data {
    init?(base64URLEncoded string: String) {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder != 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }
        self.init(base64Encoded: base64)
    }
}

import AuthenticationServices
import CryptoKit
import Foundation
#if canImport(UIKit)
import UIKit
#endif

final class AuthService: NSObject {
    private var webAuthenticationSession: ASWebAuthenticationSession?
    private let decoder = JWTDecoder()
    private lazy var presentationContextProvider = WebAuthenticationPresentationContextProvider()

    func startLogin() async throws -> AuthSession {
        let pkce = PKCE.create()
        let state = randomURLSafeString(length: 32)
        let url = try authorizationURL(pkce: pkce, state: state)
        let callbackURL = try await authenticate(at: url)

        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw AuthServiceError.invalidCallback
        }
        let queryItems = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        if let error = queryItems["error"] {
            throw AuthServiceError.authorizationFailed(error)
        }
        guard queryItems["state"] == state else {
            throw AuthServiceError.stateMismatch
        }
        guard let code = queryItems["code"], !code.isEmpty else {
            throw AuthServiceError.missingAuthorizationCode
        }

        let tokenResponse = try await exchangeCodeForTokens(code: code, pkce: pkce)
        return try buildSession(
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
            expiresIn: tokenResponse.expiresIn
        )
    }

    func buildSession(accessToken: String, refreshToken: String?, expiresIn: TimeInterval? = nil) throws -> AuthSession {
        let claims = try decoder.decode(accessToken)
        let roles = extractRoles(from: claims)
        let profile = UserProfile(
            subject: claims.sub,
            preferredUsername: claims.preferredUsername,
            email: claims.email,
            roles: roles
        )
        let expiresAt = expiresIn.map { Date().addingTimeInterval($0) } ?? claims.exp.map { Date(timeIntervalSince1970: $0) }
        return AuthSession(accessToken: accessToken, refreshToken: refreshToken, expiresAt: expiresAt, user: profile)
    }

    func refresh(session: AuthSession) async throws -> AuthSession {
        guard let refreshToken = session.refreshToken, !refreshToken.isEmpty else {
            throw AuthServiceError.missingRefreshToken
        }
        var request = URLRequest(url: tokenEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = formURLEncodedBody([
            "grant_type": "refresh_token",
            "client_id": AppConfig.clientID,
            "refresh_token": refreshToken
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AuthServiceError.invalidTokenResponse
        }
        guard (200...299).contains(http.statusCode) else {
            throw AuthServiceError.tokenExchangeFailed(String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)")
        }

        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        return try buildSession(
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken ?? refreshToken,
            expiresIn: tokenResponse.expiresIn
        )
    }

    private func extractRoles(from claims: JWTDecoder.Claims) -> Set<ATPUserRole> {
        var values = Set<String>()
        values.formUnion(claims.realmAccess?.roles ?? [])
        values.formUnion(claims.resourceAccess?[AppConfig.clientID]?.roles ?? [])
        values.formUnion(claims.resourceAccess?["asiatravelplan-backend"]?.roles ?? [])
        return Set(values.compactMap(ATPUserRole.init(rawValue:)))
    }

    private var authorizationEndpoint: URL {
        AppConfig.keycloakBaseURL
            .appendingPathComponent("realms")
            .appendingPathComponent(AppConfig.realm)
            .appendingPathComponent("protocol/openid-connect/auth")
    }

    private var tokenEndpoint: URL {
        AppConfig.keycloakBaseURL
            .appendingPathComponent("realms")
            .appendingPathComponent(AppConfig.realm)
            .appendingPathComponent("protocol/openid-connect/token")
    }

    private func authorizationURL(pkce: PKCE, state: String) throws -> URL {
        guard var components = URLComponents(url: authorizationEndpoint, resolvingAgainstBaseURL: false) else {
            throw AuthServiceError.invalidAuthorizationURL
        }
        components.queryItems = [
            URLQueryItem(name: "client_id", value: AppConfig.clientID),
            URLQueryItem(name: "redirect_uri", value: AppConfig.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid profile email"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: pkce.codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        guard let url = components.url else {
            throw AuthServiceError.invalidAuthorizationURL
        }
        return url
    }

    private func authenticate(at url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                self?.webAuthenticationSession = nil
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: AuthServiceError.invalidCallback)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.prefersEphemeralWebBrowserSession = false
            session.presentationContextProvider = presentationContextProvider
            webAuthenticationSession = session
            guard session.start() else {
                continuation.resume(throwing: AuthServiceError.unableToStartAuthenticationSession)
                return
            }
        }
    }

    private func exchangeCodeForTokens(code: String, pkce: PKCE) async throws -> TokenResponse {
        var request = URLRequest(url: tokenEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = formURLEncodedBody([
            "grant_type": "authorization_code",
            "client_id": AppConfig.clientID,
            "redirect_uri": AppConfig.redirectURI,
            "code": code,
            "code_verifier": pkce.codeVerifier
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AuthServiceError.invalidTokenResponse
        }
        guard (200...299).contains(http.statusCode) else {
            throw AuthServiceError.tokenExchangeFailed(String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)")
        }
        do {
            return try JSONDecoder().decode(TokenResponse.self, from: data)
        } catch {
            throw AuthServiceError.tokenDecodingFailed(error.localizedDescription)
        }
    }

    private var callbackScheme: String? {
        URL(string: AppConfig.redirectURI)?.scheme
    }

    private func formURLEncodedBody(_ parameters: [String: String]) -> Data? {
        let body = parameters
            .map { key, value in
                let escapedKey = key.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? key
                let escapedValue = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
                return "\(escapedKey)=\(escapedValue)"
            }
            .joined(separator: "&")
        return body.data(using: .utf8)
    }

    private func randomURLSafeString(length: Int) -> String {
        let raw = Data((0..<length).map { _ in UInt8.random(in: 0...255) })
        return raw.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

enum AuthServiceError: LocalizedError {
    case invalidAuthorizationURL
    case unableToStartAuthenticationSession
    case invalidCallback
    case authorizationFailed(String)
    case stateMismatch
    case missingAuthorizationCode
    case invalidTokenResponse
    case tokenExchangeFailed(String)
    case tokenDecodingFailed(String)
    case missingRefreshToken

    var errorDescription: String? {
        switch self {
        case .invalidAuthorizationURL:
            return "Invalid authorization URL."
        case .unableToStartAuthenticationSession:
            return "Unable to start authentication session."
        case .invalidCallback:
            return "Invalid authentication callback."
        case .authorizationFailed(let message):
            return "Authorization failed: \(message)"
        case .stateMismatch:
            return "State mismatch in authentication callback."
        case .missingAuthorizationCode:
            return "Missing authorization code."
        case .invalidTokenResponse:
            return "Invalid token response."
        case .tokenExchangeFailed(let message):
            return "Token exchange failed: \(message)"
        case .tokenDecodingFailed(let message):
            return "Failed to decode token response: \(message)"
        case .missingRefreshToken:
            return "Missing refresh token."
        }
    }
}

private struct TokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: TimeInterval?

    private enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

private struct PKCE {
    let codeVerifier: String
    let codeChallenge: String

    static func create() -> PKCE {
        let verifier = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let digest = SHA256.hash(data: Data(verifier.utf8))
        let challenge = Data(digest)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return PKCE(codeVerifier: verifier, codeChallenge: challenge)
    }
}

private final class WebAuthenticationPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
#if canImport(UIKit)
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
           let window = scene.windows.first(where: { $0.isKeyWindow }) {
            return window
        }
#endif
        return ASPresentationAnchor()
    }
}

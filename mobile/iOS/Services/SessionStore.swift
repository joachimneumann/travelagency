import Foundation

@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var session: AuthSession?
    @Published private(set) var isRestoring = false
    @Published var authError: String?

    private let tokenStore = TokenStore()
    private let authService = AuthService()
    private let roleService = RoleService()

    var isAuthenticated: Bool {
        session != nil
    }

    var isAuthorized: Bool {
        guard let session else { return false }
        return roleService.isAllowed(session.user)
    }

    func validSession() async -> AuthSession? {
        guard let current = session else { return nil }

        if !current.requiresRefresh {
            return current
        }

        authError = nil
        do {
            let refreshed = try await authService.refresh(session: current)
            guard roleService.isAllowed(refreshed.user) else {
                tokenStore.clear()
                session = nil
                authError = "Authenticated, but not authorized for the mobile app."
                return nil
            }
            try tokenStore.save(session: refreshed)
            session = refreshed
            return refreshed
        } catch {
            if !current.isExpired {
                return current
            }
            tokenStore.clear()
            session = nil
            authError = error.localizedDescription
            return nil
        }
    }

    func restoreSessionIfPossible() async {
        isRestoring = true
        defer { isRestoring = false }
        do {
            let restored = try tokenStore.load()
            guard let restored else {
                session = nil
                return
            }
            if restored.requiresRefresh {
                do {
                    let refreshed = try await authService.refresh(session: restored)
                    if roleService.isAllowed(refreshed.user) {
                        try tokenStore.save(session: refreshed)
                        session = refreshed
                    } else {
                        tokenStore.clear()
                        session = nil
                        authError = "Authenticated, but not authorized for the mobile app."
                    }
                } catch {
                    if !restored.isExpired, roleService.isAllowed(restored.user) {
                        session = restored
                    } else {
                        tokenStore.clear()
                        session = nil
                        authError = error.localizedDescription
                    }
                }
                return
            }
            if roleService.isAllowed(restored.user) {
                session = restored
            } else {
                tokenStore.clear()
                session = nil
                authError = "Authenticated, but not authorized for the mobile app."
            }
        } catch {
            authError = error.localizedDescription
        }
    }

    func login() async {
        authError = nil
        do {
            let session = try await authService.startLogin()
            guard roleService.isAllowed(session.user) else {
                tokenStore.clear()
                self.session = nil
                authError = "Authenticated, but not authorized for the mobile app."
                return
            }
            try tokenStore.save(session: session)
            self.session = session
        } catch {
            if !isDismissedAuthenticationError(error) {
                authError = error.localizedDescription
            }
        }
    }

    func store(session: AuthSession) {
        do {
            guard roleService.isAllowed(session.user) else {
                authError = "Authenticated, but not authorized for the mobile app."
                return
            }
            try tokenStore.save(session: session)
            self.session = session
        } catch {
            authError = error.localizedDescription
        }
    }

    func logout() {
        tokenStore.clear()
        session = nil
        authError = nil
    }

    func logoutEverywhere() async {
        let currentSession = session
        logout()
        guard let currentSession else { return }
        do {
            try await authService.logout(session: currentSession)
        } catch {
            if !isDismissedAuthenticationError(error) {
                authError = "Signed out locally, but Keycloak logout may not have completed. Check the mobile client post-logout redirect URI."
            }
        }
    }

    private func isDismissedAuthenticationError(_ error: Error) -> Bool {
        let nsError = error as NSError
        return nsError.domain == "com.apple.AuthenticationServices.WebAuthenticationSession" && nsError.code == 1
    }
}

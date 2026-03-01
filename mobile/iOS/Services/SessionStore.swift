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

    func restoreSessionIfPossible() async {
        isRestoring = true
        defer { isRestoring = false }
        do {
            let restored = try tokenStore.load()
            guard let restored else {
                session = nil
                return
            }
            if restored.isExpired {
                let refreshed = try await authService.refresh(session: restored)
                if roleService.isAllowed(refreshed.user) {
                    try tokenStore.save(session: refreshed)
                    session = refreshed
                } else {
                    tokenStore.clear()
                    session = nil
                    authError = "Authenticated, but not authorized for the mobile app."
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
            authError = error.localizedDescription
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
}

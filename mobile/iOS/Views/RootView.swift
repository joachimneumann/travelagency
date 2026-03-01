import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @EnvironmentObject private var bootstrapStore: AppBootstrapStore

    var body: some View {
        Group {
            switch bootstrapStore.state {
            case .idle, .loading:
                ProgressView("Checking app version...")
            case .failed(let message):
                StartupFailureView(message: message) {
                    Task {
                        await bootstrapStore.initialize()
                        if bootstrapStore.isReady {
                            await sessionStore.restoreSessionIfPossible()
                        }
                    }
                }
            case .updateRequired(let bootstrap):
                UpdateRequiredView(bootstrap: bootstrap)
            case .ready:
                if sessionStore.isRestoring {
                    ProgressView("Restoring session...")
                } else if !sessionStore.isAuthenticated {
                    LoginView()
                } else if !sessionStore.isAuthorized {
                    UnauthorizedView()
                } else {
                    AppShellView()
                }
            }
        }
        .alert("Authentication", isPresented: Binding(
            get: { sessionStore.authError != nil },
            set: { if !$0 { sessionStore.authError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(sessionStore.authError ?? "Unknown error")
        }
    }
}

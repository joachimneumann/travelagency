import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        Group {
            if sessionStore.isRestoring {
                ProgressView("Restoring session...")
            } else if !sessionStore.isAuthenticated {
                LoginView()
            } else if !sessionStore.isAuthorized {
                UnauthorizedView()
            } else {
                BookingsListView()
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

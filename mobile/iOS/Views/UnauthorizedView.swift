import SwiftUI

struct UnauthorizedView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "lock.slash")
                .font(.system(size: 40))
                .foregroundStyle(.red)
            Text("Access denied")
                .font(.title2.bold())
            Text("This mobile app is limited to approved AsiaTravelPlan backend roles.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Log out") {
                Task { await sessionStore.logout() }
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding(24)
    }
}

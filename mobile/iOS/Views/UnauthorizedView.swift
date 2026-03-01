import SwiftUI

struct UnauthorizedView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "lock.slash")
                .font(.system(size: 48))
                .foregroundStyle(.red)
            Text("Access denied")
                .font(.title.bold())
            Text("This mobile app is limited to approved AsiaTravelPlan backend roles.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Log out") {
                sessionStore.logout()
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding(24)
    }
}

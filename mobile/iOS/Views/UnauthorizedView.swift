import SwiftUI

struct UnauthorizedView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "lock.slash")
                .font(.system(size: 32))
                .foregroundStyle(.red)
            Text("Access denied")
                .font(.headline.bold())
            Text("This mobile app is limited to approved AsiaTravelPlan backend roles.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Log out") {
                Task { await sessionStore.logoutEverywhere() }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .frame(maxWidth: 340)
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 12)
    }
}

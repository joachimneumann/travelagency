import SwiftUI

struct AppShellView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image("BrandLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 180)
                    .padding(.top, 24)

                Text(sessionStore.session?.client.preferredUsername ?? sessionStore.session?.client.email ?? "Logged in")
                    .font(.title2.weight(.semibold))

                if let session = sessionStore.session, !session.client.roles.isEmpty {
                    Text(rolesDisplay(session.client.roles))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Text("The iOS app currently keeps only the shell and login flow.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)

                Button("Log out") {
                    Task { await sessionStore.logoutEverywhere() }
                }
                .buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 24)
            .navigationTitle("AsiaTravelPlan")
        }
    }

    private func rolesDisplay(_ roles: Set<ATPStaffRole>) -> String {
        roles
            .map(\.rawValue)
            .sorted()
            .joined(separator: " | ")
    }
}

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @EnvironmentObject private var bootstrapStore: AppBootstrapStore
    @AppStorage("debugInfoEnabled") private var debugInfoEnabled = false

    var body: some View {
        NavigationStack {
            List {
                Section("Application") {
                    settingRow("App version", value: AppConfig.currentAppVersion)
                    settingRow("API version", value: apiVersion)
                }
                .textCase(nil)

                Section("Debug") {
                    Toggle("Debug information", isOn: $debugInfoEnabled)
                        .font(.subheadline)

                    if debugInfoEnabled {
                        settingRow("API base", value: AppConfig.apiBaseURL.absoluteString)
                        settingRow("Auth base", value: AppConfig.keycloakBaseURL.absoluteString)
                        settingRow("Client", value: AppConfig.clientID)
                        settingRow("User", value: sessionStore.session?.user.preferredUsername ?? "-")
                        settingRow("Roles", value: formattedRoles)
                    }
                }
                .textCase(nil)

                Section {
                    Button(role: .destructive) {
                        Task { await sessionStore.logout() }
                    } label: {
                        Text("Logout")
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }
            .listStyle(.inset)
            .navigationTitle("Settings")
        }
    }

    private var apiVersion: String {
        switch bootstrapStore.state {
        case .ready(let bootstrap):
            return bootstrap.api.contractVersion
        case .updateRequired(let bootstrap):
            return bootstrap.api.contractVersion
        default:
            return MobileAPIRequestFactory.contractVersion
        }
    }

    private var formattedRoles: String {
        let roles = sessionStore.session?.user.roles.map(\.rawValue).sorted() ?? []
        return roles.isEmpty ? "-" : roles.joined(separator: ", ")
    }

    private func settingRow(_ label: String, value: String) -> some View {
        LabeledContent(label) {
            Text(value)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

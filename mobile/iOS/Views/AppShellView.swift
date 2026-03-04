import SwiftUI

struct AppShellView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    private let roleService = RoleService()

    var body: some View {
        TabView {
            NavigationStack {
                BookingsListView()
            }
            .tabItem {
                Label("Bookings", systemImage: "list.bullet.rectangle")
            }

            if canReadCustomers {
                NavigationStack {
                    CustomersListView()
                }
                .tabItem {
                    Label("Customers", systemImage: "person.3")
                }
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
        }
    }

    private var canReadCustomers: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canReadCustomers(session.client)
    }
}

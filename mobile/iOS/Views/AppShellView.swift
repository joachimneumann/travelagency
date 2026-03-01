import SwiftUI

struct AppShellView: View {
    var body: some View {
        TabView {
            NavigationStack {
                BookingsListView()
            }
            .tabItem {
                Label("Bookings", systemImage: "list.bullet.rectangle")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
        }
    }
}

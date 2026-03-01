import SwiftUI

struct AppShellView: View {
    var body: some View {
        TabView {
            BookingsListView()
                .tabItem {
                    Label("Bookings", systemImage: "list.bullet.rectangle")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
    }
}

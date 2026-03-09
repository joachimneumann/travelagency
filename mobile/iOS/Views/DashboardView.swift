import SwiftUI

struct DashboardView: View {
    let canReadCustomers: Bool
    let canReadBookings: Bool
    let canReadSettings: Bool

    var body: some View {
        List {
            if canReadBookings {
                NavigationLink {
                    BookingsListView()
                } label: {
                    Label("Bookings", systemImage: "list.bullet.rectangle")
                }
            }

            if canReadCustomers {
                NavigationLink {
                    CustomersListView()
                } label: {
                    Label("Customer Search", systemImage: "person.fill")
                }
            }

            if canReadSettings {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Reports / Settings", systemImage: "chart.bar.doc.horizontal")
                }
            }

            if !canReadCustomers && !canReadBookings && !canReadSettings {
                Section {
                    Text("No sections are available for your role.")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.large)
    }
}

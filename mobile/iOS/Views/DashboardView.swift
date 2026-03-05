import SwiftUI

struct DashboardView: View {
    let canReadCustomers: Bool
    let canReadTravelGroups: Bool
    let canReadBookings: Bool
    let canReadSettings: Bool

    var body: some View {
        List {
            if canReadCustomers {
                NavigationLink {
                    CustomersListView()
                } label: {
                    Label("Customers", systemImage: "person.fill")
                }
            }

            if canReadTravelGroups {
                NavigationLink {
                    TravelGroupsListView()
                } label: {
                    Label("Travel Groups", systemImage: "person.3")
                }
            }

            if canReadBookings {
                NavigationLink {
                    BookingsListView()
                } label: {
                    Label("Bookings", systemImage: "list.bullet.rectangle")
                }
            }

            if canReadSettings {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Reports / Settings", systemImage: "chart.bar.doc.horizontal")
                }
            }

            if !canReadCustomers && !canReadTravelGroups && !canReadBookings && !canReadSettings {
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

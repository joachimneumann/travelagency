import SwiftUI

struct AppShellView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    private let roleService = RoleService()

    var body: some View {
        NavigationStack {
            DashboardView(
                canReadCustomers: canReadCustomers,
                canReadTravelGroups: canReadTravelGroups,
                canReadBookings: canReadBookings,
                canReadSettings: canReadSettings
            )
        }
    }

    private var canReadCustomers: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canReadCustomers(session.client)
    }

    private var canReadBookings: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canReadAllBookings(session.client)
            || roleService.canEditAssignedBookings(session.client)
    }

    private var canReadTravelGroups: Bool {
        canReadBookings
    }

    private var canReadSettings: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canReadSettings(session.client)
    }
}

import Foundation

@MainActor
final class BookingsViewModel: ObservableObject {
    @Published private(set) var bookings: [Booking] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let apiClient = APIClient()

    func load(session: AuthSession) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await apiClient.fetchBookings(session: session)
            bookings = response.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
final class CustomersViewModel: ObservableObject {
    @Published private(set) var customers: [Customer] = []
    @Published private(set) var isLoading = false
    @Published var searchDraft = ""
    @Published private(set) var appliedSearch = ""
    @Published var errorMessage: String?

    private let apiClient = APIClient()

    func load(session: AuthSession) async {
        await load(session: session, search: appliedSearch)
    }

    func applySearch(session: AuthSession) async {
        let normalized = normalizedQuery(searchDraft)
        searchDraft = normalized
        appliedSearch = normalized
        await load(session: session, search: normalized)
    }

    func clearSearch(session: AuthSession) async {
        searchDraft = ""
        appliedSearch = ""
        await load(session: session, search: "")
    }

    private func load(session: AuthSession, search: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await apiClient.fetchCustomers(
                session: session,
                page: 1,
                pageSize: 20,
                search: search
            )
            customers = response.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func normalizedQuery(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

@MainActor
final class TravelGroupsViewModel: ObservableObject {
    @Published private(set) var groups: [TravelGroup] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let apiClient = APIClient()

    func load(session: AuthSession) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await apiClient.fetchTravelGroups(
                session: session,
                page: 1,
                pageSize: 20,
                search: nil
            )
            groups = response.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

import Foundation

@MainActor
final class BookingsViewModel: ObservableObject {
    @Published private(set) var bookings: [Booking] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var searchDraft = ""
    @Published private(set) var appliedSearch = ""

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
            let response = try await apiClient.fetchBookings(session: session, page: 1, pageSize: 20, search: search)
            bookings = response.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func normalizedQuery(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

@MainActor
final class CustomersViewModel: ObservableObject {
    @Published private(set) var bookings: [Booking] = []
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
            let response = try await apiClient.fetchBookings(session: session, page: 1, pageSize: 20, search: search)
            bookings = response.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func normalizedQuery(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

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
            bookings = response.bookings
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

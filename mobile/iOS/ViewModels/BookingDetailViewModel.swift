import Foundation

@MainActor
final class BookingDetailViewModel: ObservableObject {
    @Published private(set) var booking: Booking?
    @Published private(set) var customer: Customer?
    @Published private(set) var activities: [BookingActivity] = []
    @Published private(set) var invoices: [BookingInvoice] = []
    @Published private(set) var staff: [StaffMember] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var noteDraft = ""

    private let apiClient = APIClient()
    private let roleService = RoleService()

    func load(bookingID: String, session: AuthSession) async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let detail = apiClient.fetchBookingDetail(id: bookingID, session: session)
            async let activityPayload = apiClient.fetchActivities(bookingID: bookingID, session: session)
            async let invoicePayload = apiClient.fetchInvoices(bookingID: bookingID, session: session)
            async let staffPayload: StaffListResponse? = roleService.canChangeAssignment(session.user)
                ? apiClient.fetchStaff(session: session)
                : nil

            let detailResponse = try await detail
            booking = detailResponse.booking
            customer = detailResponse.customer
            activities = try await activityPayload.activities
            invoices = try await invoicePayload.items
            staff = try await staffPayload?.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateStage(_ stage: String, session: AuthSession) async {
        guard let booking else { return }
        do {
            let response = try await apiClient.updateStage(bookingID: booking.id, stage: stage, session: session)
            self.booking = response.booking
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateAssignment(_ staffID: String?, session: AuthSession) async {
        guard let booking else { return }
        do {
            let response = try await apiClient.updateStaffAssignment(bookingID: booking.id, staffID: staffID, session: session)
            self.booking = response.booking
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addNote(session: AuthSession) async {
        guard let booking else { return }
        let trimmed = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            let response = try await apiClient.addActivity(bookingID: booking.id, detail: trimmed, session: session)
            activities.append(response.activity)
            noteDraft = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

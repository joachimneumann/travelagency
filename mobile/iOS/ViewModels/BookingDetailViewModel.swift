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
    @Published private(set) var originalNote = ""

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
            noteDraft = detailResponse.booking.notes ?? ""
            originalNote = detailResponse.booking.notes ?? ""
            activities = try await activityPayload.activities
            invoices = try await invoicePayload.items
            staff = try await staffPayload?.items ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateStage(_ stage: String, session: AuthSession) async {
        guard let booking, let bookingHash = booking.bookingHash else { return }
        do {
            let response = try await apiClient.updateStage(bookingID: booking.id, stage: stage, bookingHash: bookingHash, session: session)
            self.booking = response.booking
            self.noteDraft = response.booking.notes ?? ""
            self.originalNote = response.booking.notes ?? ""
        } catch APIClient.APIError.bookingConflict {
            await refreshAfterConflict(session: session, bookingID: booking.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateAssignment(_ staffID: String?, session: AuthSession) async {
        guard let booking, let bookingHash = booking.bookingHash else { return }
        do {
            let response = try await apiClient.updateStaffAssignment(bookingID: booking.id, staffID: staffID, bookingHash: bookingHash, session: session)
            self.booking = response.booking
            self.noteDraft = response.booking.notes ?? ""
            self.originalNote = response.booking.notes ?? ""
        } catch APIClient.APIError.bookingConflict {
            await refreshAfterConflict(session: session, bookingID: booking.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveNote(session: AuthSession) async {
        guard let booking, let bookingHash = booking.bookingHash else { return }
        do {
            let trimmed = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
            let response = try await apiClient.updateBookingNote(
                bookingID: booking.id,
                note: trimmed,
                bookingHash: bookingHash,
                session: session
            )
            self.booking = response.booking
            self.noteDraft = response.booking.notes ?? ""
            self.originalNote = response.booking.notes ?? ""
            let activityPayload = try await apiClient.fetchActivities(bookingID: booking.id, session: session)
            self.activities = activityPayload.activities
        } catch APIClient.APIError.bookingConflict {
            await refreshAfterConflict(session: session, bookingID: booking.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshAfterConflict(session: AuthSession, bookingID: String) async {
        do {
            let detailResponse = try await apiClient.fetchBookingDetail(id: bookingID, session: session)
            self.booking = detailResponse.booking
            self.customer = detailResponse.customer
            self.noteDraft = detailResponse.booking.notes ?? ""
            self.originalNote = detailResponse.booking.notes ?? ""
            let activityPayload = try await apiClient.fetchActivities(bookingID: bookingID, session: session)
            self.activities = activityPayload.activities
            self.errorMessage = "The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again."
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }
}

import SwiftUI

struct BookingDetailView: View {
    let bookingID: String

    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingDetailViewModel()
    private let roleService = RoleService()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let booking = viewModel.booking, let session = sessionStore.session {
                    section("Booking") {
                        LabeledContent("ID", value: booking.id)
                        LabeledContent("Stage", value: booking.stage)
                        LabeledContent("Destination", value: booking.destination ?? "-")
                        LabeledContent("Style", value: booking.style ?? "-")
                        LabeledContent("Staff", value: booking.staffName ?? "Unassigned")
                    }

                    if roleService.canChangeBookingStage(session.user) {
                        section("Stage") {
                            ForEach(["NEW", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "INVOICE_SENT", "PAYMENT_RECEIVED", "WON", "LOST", "POST_TRIP"], id: \.self) { stage in
                                Button(stage) {
                                    Task { await viewModel.updateStage(stage, session: session) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }

                    if roleService.canChangeAssignment(session.user) {
                        section("Assignment") {
                            ForEach(viewModel.staff) { member in
                                Button(member.name) {
                                    Task { await viewModel.updateAssignment(member.id, session: session) }
                                }
                                .buttonStyle(.bordered)
                            }
                            Button("Unassign") {
                                Task { await viewModel.updateAssignment(nil, session: session) }
                            }
                            .buttonStyle(.bordered)
                        }
                    }

                    if roleService.canEditAllBookings(session.user) || roleService.canEditAssignedBookings(session.user) {
                        section("Add note") {
                            TextEditor(text: $viewModel.noteDraft)
                                .frame(minHeight: 120)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.secondary.opacity(0.3))
                                }
                            Button("Save note") {
                                Task { await viewModel.addNote(session: session) }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }

                    if !viewModel.activities.isEmpty {
                        section("Activities") {
                            ForEach(viewModel.activities) { activity in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(activity.type)
                                        .font(.caption.weight(.semibold))
                                    Text(activity.detail)
                                        .font(.footnote)
                                    Text("\(activity.actor) • \(activity.createdAt)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }

                    if let customer = viewModel.customer {
                        section("Customer") {
                            LabeledContent("Name", value: customer.name ?? "-")
                            LabeledContent("Email", value: customer.email ?? "-")
                            LabeledContent("Phone", value: customer.phone ?? "-")
                            LabeledContent("Language", value: customer.language ?? "-")
                        }
                    }
                } else if viewModel.isLoading {
                    ProgressView("Loading booking...")
                }
            }
            .padding(16)
        }
        .navigationTitle("Booking")
        .task {
            guard let session = sessionStore.session else { return }
            await viewModel.load(bookingID: bookingID, session: session)
        }
        .modifier(BookingDetailNavigationChromeModifier())
        .alert("Booking", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.footnote.bold())
            content()
                .font(.footnote)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct BookingDetailNavigationChromeModifier: ViewModifier {
    func body(content: Content) -> some View {
#if os(iOS)
        content
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
#else
        content
#endif
    }
}

import SwiftUI

struct BookingDetailView: View {
    let bookingID: String

    @EnvironmentObject private var sessionStore: SessionStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = BookingDetailViewModel()
    private let roleService = RoleService()

    var body: some View {
        VStack(spacing: 0) {
            detailTopBar

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
                            section("Booking note") {
                                TextEditor(text: $viewModel.noteDraft)
                                    .frame(minHeight: 120)
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.secondary.opacity(0.3))
                                    }
                                Button("Save note") {
                                    Task { await viewModel.saveNote(session: session) }
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
        }
        .task {
            guard let session = sessionStore.session else { return }
            await viewModel.load(bookingID: bookingID, session: session)
        }
        .ignoresSafeArea(.container, edges: [.top, .bottom])
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

    private var detailTopBar: some View {
        HStack(spacing: 8) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(.plain)

            Spacer()

            Text("Booking")
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)

            Spacer()

            Color.clear
                .frame(width: 20, height: 20)
        }
        .padding(.horizontal, 12)
        .frame(height: 25)
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
            .toolbar(.hidden, for: .navigationBar)
#else
        content
#endif
    }
}

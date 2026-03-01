import SwiftUI

struct BookingDetailView: View {
    let bookingID: String

    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingDetailViewModel()
    private let roleService = RoleService()

    @State private var selectedStage = ""
    @State private var selectedStaffID = ""

    var body: some View {
        Form {
            if let booking = viewModel.booking {
                Section("Booking") {
                    LabeledContent("ID", value: booking.id)
                    LabeledContent("Stage", value: booking.stage)
                    LabeledContent("Destination", value: booking.destination ?? "-")
                    LabeledContent("Style", value: booking.style ?? "-")
                    LabeledContent("Staff", value: booking.staffName ?? "Unassigned")
                }

                if let customer = viewModel.customer {
                    Section("Customer") {
                        LabeledContent("Name", value: customer.name ?? "-")
                        LabeledContent("Email", value: customer.email ?? "-")
                        LabeledContent("Phone", value: customer.phone ?? "-")
                        LabeledContent("Language", value: customer.language ?? "-")
                    }
                }

                if canChangeStage, let session = sessionStore.session {
                    Section("Stage") {
                        Picker("Stage", selection: $selectedStage) {
                            ForEach(stageOptions, id: \.self) { stage in
                                Text(stage).tag(stage)
                            }
                        }

                        Button("Update Stage") {
                            Task { await viewModel.updateStage(selectedStage, session: session) }
                        }
                        .disabled(selectedStage.isEmpty || selectedStage == booking.stage)
                    }
                }

                if canChangeAssignment, let session = sessionStore.session {
                    Section("Assignment") {
                        Picker("Staff", selection: $selectedStaffID) {
                            Text("Unassigned").tag("")
                            ForEach(viewModel.staff) { member in
                                Text(member.name).tag(member.id)
                            }
                        }

                        Button("Save Assignment") {
                            let staffID = selectedStaffID.isEmpty ? nil : selectedStaffID
                            Task { await viewModel.updateAssignment(staffID, session: session) }
                        }
                        .disabled(selectedStaffID == (booking.staff ?? ""))
                    }
                }

                if canEditBooking, let session = sessionStore.session {
                    Section("Booking Note") {
                        TextEditor(text: $viewModel.noteDraft)
                            .frame(minHeight: 140)

                        Button("Save Note") {
                            Task { await viewModel.saveNote(session: session) }
                        }
                        .disabled(viewModel.noteDraft == viewModel.originalNote)
                    }
                }

                if !viewModel.activities.isEmpty {
                    Section("Activities") {
                        ForEach(viewModel.activities) { activity in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(activity.type)
                                    .font(.headline)
                                Text(activity.detail)
                                    .font(.body)
                                Text("\(activity.actor) • \(activity.createdAt)")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            } else if viewModel.isLoading {
                Section {
                    ProgressView("Loading booking...")
                }
            }
        }
        .navigationTitle("Details")
        .modifier(InlineNavigationTitleDisplayModeModifier())
        .task {
            guard let session = sessionStore.session else { return }
            await viewModel.load(bookingID: bookingID, session: session)
            syncSelectionsFromBooking()
        }
        .onChange(of: viewModel.booking?.id) { _, _ in
            syncSelectionsFromBooking()
        }
        .onChange(of: viewModel.booking?.stage) { _, _ in
            syncSelectionsFromBooking()
        }
        .onChange(of: viewModel.booking?.staff) { _, _ in
            syncSelectionsFromBooking()
        }
        .alert("Booking", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
    }

    private var canChangeStage: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canChangeBookingStage(session.user)
    }

    private var canChangeAssignment: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canChangeAssignment(session.user)
    }

    private var canEditBooking: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canEditAllBookings(session.user) || roleService.canEditAssignedBookings(session.user)
    }

    private var stageOptions: [String] {
        ["NEW", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "INVOICE_SENT", "PAYMENT_RECEIVED", "WON", "LOST", "POST_TRIP"]
    }

    private func syncSelectionsFromBooking() {
        selectedStage = viewModel.booking?.stage ?? ""
        selectedStaffID = viewModel.booking?.staff ?? ""
    }
}

private struct InlineNavigationTitleDisplayModeModifier: ViewModifier {
    func body(content: Content) -> some View {
#if os(iOS)
        content.navigationBarTitleDisplayMode(.inline)
#else
        content
#endif
    }
}

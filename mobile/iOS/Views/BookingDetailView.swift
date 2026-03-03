import SwiftUI

struct BookingDetailView: View {
    let bookingID: String

    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingDetailViewModel()
    private let roleService = RoleService()

    @State private var selectedStage = ""
    @State private var selectedAtpStaffID = ""
    @State private var isApplyingSelection = false

    var body: some View {
        Form {
            formContent
        }
        .navigationTitle("Details")
        .modifier(InlineNavigationTitleDisplayModeModifier())
        .task {
            guard let session = await sessionStore.validSession() else { return }
            await viewModel.load(bookingID: bookingID, session: session)
            syncSelectionsFromBooking()
        }
        .onChange(of: viewModel.booking?.id) { _, _ in
            syncSelectionsFromBooking()
        }
        .onChange(of: viewModel.booking?.stage) { _, _ in
            syncSelectionsFromBooking()
        }
        .onChange(of: viewModel.booking?.assignedAtpStaffId) { _, _ in
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

    @ViewBuilder
    private var formContent: some View {
        if let booking = viewModel.booking {
            if canChangeStage {
                stageSection(for: booking)
            } else {
                readOnlyStageSection(booking)
            }
            bookingSummarySection(for: booking)
            if let customer = viewModel.customer {
                customerSection(customer)
            }
            bookingNoteSection()
            if let offer = booking.offer {
                offerSection(for: offer)
            }
            if let pricing = booking.pricing {
                paymentsSection(for: pricing)
            }
            if canChangeAssignment {
                assignmentSection(for: booking)
            }
            activitiesSection()
        } else if viewModel.isLoading {
            Section {
                ProgressView("Loading booking...")
            }
        }
    }

    @ViewBuilder
    private func bookingSummarySection(for booking: Booking) -> some View {
        Section {
            NavigationLink {
                BookingSummaryDetailView(booking: booking)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Booking")
                        .font(.headline)
                    Text("\(booking.destination.isEmpty ? "—" : booking.destination) | \(booking.style.isEmpty ? "—" : booking.style)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    @ViewBuilder
    private func customerSection(_ customer: Customer) -> some View {
        Section {
            NavigationLink {
                BookingCustomerDetailView(customer: customer)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Customer")
                        .font(.headline)
                    Text(customer.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Unknown")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    @ViewBuilder
    private func bookingNoteSection() -> some View {
        Section {
            NavigationLink {
                BookingNoteDetailView(
                    noteDraft: $viewModel.noteDraft,
                    originalNote: viewModel.originalNote,
                    isEditable: canEditBooking,
                    onSave: {
                        Task {
                            guard let session = await sessionStore.validSession() else { return }
                            await viewModel.saveNote(session: session)
                        }
                    }
                )
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Notes")
                        .font(.headline)
                    Text(formatSummaryText(from: viewModel.originalNote))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    @ViewBuilder
    private func offerSection(for offer: BookingOffer) -> some View {
        let summary = offer.items.isEmpty ? "No offer items" : "\(offer.totals.itemsCount) items"
        Section {
            NavigationLink {
                OfferDetailView(offer: offer, offerTitle: summary)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Offer")
                        .font(.headline)
                    Text("Total with tax \(formatMoney(offer.totalPriceCents, currency: offer.currency)) (\(summary))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    @ViewBuilder
    private func paymentsSection(for pricing: BookingPricing) -> some View {
        Section {
            NavigationLink {
                PaymentsDetailView(pricing: pricing)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Payments")
                        .font(.headline)
                    Text(paymentSubtitle(for: pricing))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    @ViewBuilder
    private func stageSection(for booking: Booking) -> some View {
        Section {
            HStack {
                Text("Stage")
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
                Picker("", selection: $selectedStage) {
                    ForEach(stageOptions, id: \.self) { stage in
                        Text(stage).tag(stage)
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()
                .frame(maxWidth: .infinity, alignment: .trailing)
                .fixedSize(horizontal: true, vertical: false)
                .onChange(of: selectedStage) { _, newValue in
                    Task {
                        await stageChanged(newValue, booking: booking)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func readOnlyStageSection(_ booking: Booking) -> some View {
        Section {
            HStack {
                Text("Stage")
                Spacer()
                Text(booking.stage.rawValue)
                    .foregroundStyle(.secondary)
            }
            .font(.callout)
        }
    }

    @ViewBuilder
    private func assignmentSection(for booking: Booking) -> some View {
        Section("Assignment") {
            Picker("AtpStaff", selection: $selectedAtpStaffID) {
                Text("Unassigned").tag("")
                ForEach(viewModel.atp_staff) { member in
                    Text(member.name).tag(member.id)
                }
            }

            Button("Save Assignment") {
                let staffID = selectedAtpStaffID.isEmpty ? nil : selectedAtpStaffID
                Task {
                    guard let session = await sessionStore.validSession() else { return }
                    await viewModel.updateAssignment(staffID, session: session)
                }
            }
            .disabled(selectedAtpStaffID == (booking.assignedAtpStaffId ?? ""))
        }
    }

    @ViewBuilder
    private func activitiesSection() -> some View {
        let activities: [BookingActivity] = viewModel.activities
        Section {
            NavigationLink {
                ActivitiesDetailView(activities: activities)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Activities")
                        .font(.headline)
                    Text("Number of activities: \(activities.count)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    private var canChangeStage: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canChangeBookingStage(session.client)
    }

    private var canChangeAssignment: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canChangeAssignment(session.client)
    }

    private var canEditBooking: Bool {
        guard let session = sessionStore.session else { return false }
        return roleService.canEditAllBookings(session.client) || roleService.canEditAssignedBookings(session.client)
    }

    private var stageOptions: [String] {
        ["NEW", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "INVOICE_SENT", "PAYMENT_RECEIVED", "WON", "LOST", "POST_TRIP"]
    }

    private func syncSelectionsFromBooking() {
        isApplyingSelection = true
        selectedStage = viewModel.booking?.stage.rawValue ?? ""
        selectedAtpStaffID = viewModel.booking?.assignedAtpStaffId ?? ""
        isApplyingSelection = false
    }

    private func stageChanged(_ value: String, booking: Booking) async {
        guard !isApplyingSelection else { return }
        guard let session = await sessionStore.validSession() else { return }
        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedValue != booking.stage.rawValue else { return }
        await viewModel.updateStage(trimmedValue, session: session)
    }

    private func paymentSubtitle(for pricing: BookingPricing) -> String {
        let paid = pricing.payments.filter { $0.status == .paid }.count
        let total = pricing.payments.count
        return "\(paid) or \(total) paid"
    }
}

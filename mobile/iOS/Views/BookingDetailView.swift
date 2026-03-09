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
        .onChange(of: viewModel.booking?.id) { _, _ in syncSelectionsFromBooking() }
        .onChange(of: viewModel.booking?.stage) { _, _ in syncSelectionsFromBooking() }
        .onChange(of: viewModel.booking?.atp_staff) { _, _ in syncSelectionsFromBooking() }
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
            personsSection(for: booking)
            submissionSection(for: booking)
            bookingNoteSection()
            whatsAppChatSection(for: booking)
            offerSection(for: booking.offer)
            paymentsSection(for: booking.pricing)
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

    private func bookingSummarySection(for booking: Booking) -> some View {
        Section("Booking") {
            LabeledContent("Destinations", value: joinedList(booking.destinations))
            LabeledContent("Travel styles", value: joinedList(booking.travel_styles))
            LabeledContent("Preferred currency", value: booking.preferredCurrency?.rawValue ?? "-")
            LabeledContent("Travel start day", value: booking.travel_start_day ?? "-")
            LabeledContent("Travel end day", value: booking.travel_end_day ?? "-")
        }
    }

    private func personsSection(for booking: Booking) -> some View {
        Section("Persons") {
            let rows = (booking.persons?.isEmpty == false) ? (booking.persons ?? []) : [fallbackPerson(for: booking)].compactMap { $0 }
            if rows.isEmpty {
                Text("No persons yet")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(rows.indices, id: \.self) { index in
                    let person = rows[index]
                    VStack(alignment: .leading, spacing: 4) {
                        Text(person.name.isEmpty ? "Unnamed person" : person.name)
                            .font(.headline)
                        Text(verbatim: bookingPersonLine(person))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(verbatim: personFlags(person))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func submissionSection(for booking: Booking) -> some View {
        Section("Web form submission") {
            LabeledContent("Name", value: booking.web_form_submission?.name ?? "-")
            LabeledContent("Email", value: booking.web_form_submission?.email ?? "-")
            LabeledContent("Phone number", value: booking.web_form_submission?.phone_number ?? "-")
            LabeledContent("Preferred language", value: booking.web_form_submission?.preferred_language?.rawValue ?? "-")
            LabeledContent("Travel month", value: booking.web_form_submission?.travel_month ?? "-")
            LabeledContent("Number of travelers", value: stringValue(booking.web_form_submission?.number_of_travelers))
        }
    }

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

    private func whatsAppChatSection(for booking: Booking) -> some View {
        let events = viewModel.chatEvents
        let latest = events.max { left, right in
            let leftKey = left.sentAt ?? left.createdAt ?? left.receivedAt ?? ""
            let rightKey = right.sentAt ?? right.createdAt ?? right.receivedAt ?? ""
            return leftKey < rightKey
        }
        Section {
            NavigationLink {
                WhatsAppChatThreadView(
                    events: events,
                    customerPhone: primaryPhone(for: booking),
                    onRefresh: {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.refreshChat(session: session)
                    }
                )
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("WhatsApp Chat")
                        .font(.headline)
                    Text(events.isEmpty ? "No messages yet" : "\(events.count) messages · \(formatSummaryText(from: latest?.textPreview ?? "", maxLength: 56))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

    private func offerSection(for offer: BookingOffer) -> some View {
        let summary = ((offer.components ?? []).isEmpty) ? "No components" : "\(offer.totals.componentsCount) components"
        return Section {
            NavigationLink {
                OfferDetailView(offer: offer, offerTitle: summary)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Offer")
                        .font(.headline)
                    Text("Total with tax \(formatMoney(offer.totals.grossAmountCents, currency: offer.currency)) (\(summary))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }

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
                    Task { await stageChanged(newValue, booking: booking) }
                }
            }
        }
    }

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
            .disabled(selectedAtpStaffID == (booking.atp_staff ?? ""))
        }
    }

    private func activitiesSection() -> some View {
        let activities: [BookingActivity] = viewModel.activities
        return Section {
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
        selectedAtpStaffID = viewModel.booking?.atp_staff ?? ""
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
        _ = pricing
        return "Detailed schedules not in current mobile contract"
    }
}

private func joinedList(_ values: [String]?) -> String {
    let entries = (values ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    return entries.isEmpty ? "—" : entries.joined(separator: ", ")
}

private func stringValue<T>(_ value: T?) -> String {
    guard let value else { return "-" }
    return String(describing: value)
}

private func personFlags(_ person: BookingPerson) -> String {
    var flags: [String] = []
    if person.is_lead_contact == true { flags.append("Lead contact") }
    if person.is_traveling == false { flags.append("Not traveling") }
    return flags.isEmpty ? "-" : flags.joined(separator: " • ")
}

private func primaryPhone(for booking: Booking) -> String? {
    let person = primaryPerson(for: booking) ?? fallbackPerson(for: booking)
    return person?.phone_numbers?.first
}

private struct WhatsAppChatThreadView: View {
    let events: [BookingChatEvent]
    let customerPhone: String?
    let onRefresh: () async -> Void

    private var orderedEvents: [BookingChatEvent] {
        events.sorted { left, right in
            let leftKey = left.sentAt ?? left.createdAt ?? left.receivedAt ?? ""
            let rightKey = right.sentAt ?? right.createdAt ?? right.receivedAt ?? ""
            return leftKey < rightKey
        }
    }

    private var waURL: URL? {
        let digits = String(customerPhone ?? "").filter { $0.isNumber }
        guard !digits.isEmpty else { return nil }
        return URL(string: "https://wa.me/\(digits)")
    }

    private var phoneLabel: String {
        let trimmed = String(customerPhone ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "-" : trimmed
    }

    var body: some View {
        List {
            Section {
                HStack {
                    Text("WhatsApp")
                    Spacer()
                    Text(phoneLabel)
                        .foregroundStyle(.secondary)
                }
                if let waURL {
                    Link("Open WhatsApp", destination: waURL)
                }
                Button("Refresh") {
                    Task { await onRefresh() }
                }
            }
            ForEach(orderedEvents) { event in
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.textPreview.isEmpty ? (event.externalStatus ?? "-") : event.textPreview)
                    Text(event.sentAt ?? event.receivedAt ?? event.createdAt ?? "-")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("WhatsApp")
    }
}

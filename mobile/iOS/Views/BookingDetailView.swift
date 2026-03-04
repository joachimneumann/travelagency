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
            whatsAppChatSection()
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
    private func whatsAppChatSection() -> some View {
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
                    customerPhone: viewModel.customer?.phone,
                    onRefresh: {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.refreshChat(session: session)
                    }
                )
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text("WhatsApp Chat")
                        .font(.headline)
                    Text(
                        events.isEmpty
                            ? "No messages yet"
                            : "\(events.count) messages · \(formatSummaryText(from: latest?.textPreview ?? "", maxLength: 56))"
                    )
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

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                if orderedEvents.isEmpty {
                    Text("No WhatsApp messages yet.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.top, 24)
                } else {
                    ForEach(orderedEvents) { event in
                        WhatsAppChatBubbleRow(event: event)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 14)
        }
        .background(WhatsAppChatBackground().ignoresSafeArea())
        .navigationTitle("WhatsApp Chat")
        .modifier(InlineNavigationTitleDisplayModeModifier())
        .toolbar {
            if let waURL {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Link("WhatsApp", destination: waURL)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                }
            }
        }
        .refreshable {
            await onRefresh()
        }
    }
}

private struct WhatsAppChatBubbleRow: View {
    let event: BookingChatEvent

    private var isOutbound: Bool { event.direction.lowercased() == "outbound" }
    private var isStatus: Bool { event.eventType.lowercased() == "status" }
    private var bubbleColor: Color {
        if isStatus { return Color(red: 1.0, green: 0.97, blue: 0.83) }
        if isOutbound { return Color(red: 0.85, green: 0.99, blue: 0.83) }
        return .white
    }

    private var metaLine: String {
        let time = chatClockTime(from: event.sentAt ?? event.createdAt ?? event.receivedAt)
        let status = event.externalStatus?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if status.isEmpty { return time }
        return "\(time) · \(status)"
    }

    var body: some View {
        HStack {
            if isStatus {
                Spacer(minLength: 24)
                bubble
                Spacer(minLength: 24)
            } else if isOutbound {
                Spacer(minLength: 44)
                bubble
            } else {
                bubble
                Spacer(minLength: 44)
            }
        }
    }

    private var bubble: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(event.textPreview.isEmpty ? "-" : event.textPreview)
                .font(.system(size: 19, weight: .regular, design: .rounded))
                .foregroundStyle(Color(red: 0.07, green: 0.11, blue: 0.13))
                .multilineTextAlignment(.leading)
            HStack {
                Spacer(minLength: 0)
                Text(metaLine)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color(red: 0.38, green: 0.45, blue: 0.49))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(bubbleColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
        .frame(maxWidth: 340, alignment: .leading)
    }
}

private struct WhatsAppChatBackground: View {
    var body: some View {
        ZStack {
            Color(red: 0.94, green: 0.92, blue: 0.89)
            LinearGradient(
                colors: [Color.black.opacity(0.035), Color.clear, Color.black.opacity(0.02)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

private func chatClockTime(from rawTimestamp: String?) -> String {
    guard let rawTimestamp, !rawTimestamp.isEmpty else { return "--:--" }
    let isoWithFractional = ISO8601DateFormatter()
    isoWithFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let isoWithoutFractional = ISO8601DateFormatter()
    isoWithoutFractional.formatOptions = [.withInternetDateTime]

    let parsedDate = isoWithFractional.date(from: rawTimestamp) ?? isoWithoutFractional.date(from: rawTimestamp)
    guard let parsedDate else { return rawTimestamp }

    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm"
    return formatter.string(from: parsedDate)
}

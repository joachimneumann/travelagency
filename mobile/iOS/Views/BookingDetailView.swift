import SwiftUI

struct BookingDetailView: View {
    let bookingID: String

    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingDetailViewModel()
    private let roleService = RoleService()

    @State private var selectedStage = ""
    @State private var selectedAtpStaffID = ""

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
            bookingSummarySection(for: booking)
            if let customer = viewModel.customer {
                customerSection(customer)
            }
            if let pricing = booking.pricing {
                paymentsSection(for: pricing)
                adjustmentsSection(for: pricing)
                paymentScheduleSection(for: pricing)
            }
            if let offer = booking.offer {
                offerSection(for: offer)
            }
            if canChangeStage {
                stageSection(for: booking)
            }
            if canChangeAssignment {
                assignmentSection(for: booking)
            }
            if canEditBooking {
                bookingNoteSection()
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
        Section("Booking") {
            LabeledContent("ID", value: booking.id)
            LabeledContent("Stage", value: booking.stage.rawValue)
            LabeledContent("Destination", value: booking.destination)
            LabeledContent("Style", value: booking.style)
            LabeledContent("AtpStaff", value: booking.assignedAtpStaffName ?? "Unassigned")
        }
    }

    @ViewBuilder
    private func customerSection(_ customer: Customer) -> some View {
        Section("Customer") {
            LabeledContent("Name", value: customer.name ?? "-")
            LabeledContent("Email", value: customer.email ?? "-")
            LabeledContent("Phone", value: customer.phone ?? "-")
            LabeledContent("Language", value: customer.language ?? "-")
        }
    }

    @ViewBuilder
    private func paymentsSection(for pricing: BookingPricing) -> some View {
        Section("Payments") {
            if paymentSummaryRows(for: pricing).isEmpty {
                Text("No payments yet")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(paymentSummaryRows(for: pricing), id: \.label) { row in
                    LabeledContent(row.label, value: row.value)
                }
                if !pricing.summary.isScheduleBalanced {
                    LabeledContent("Schedule Complete", value: "No")
                }
            }
        }
    }

    @ViewBuilder
    private func adjustmentsSection(for pricing: BookingPricing) -> some View {
        if !pricing.adjustments.isEmpty {
            Section("Adjustments") {
                ForEach(pricing.adjustments) { adjustment in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(adjustment.label)
                            Spacer()
                            Text(adjustment.type.rawValue)
                                .foregroundStyle(.secondary)
                        }
                        Text(formatMoney(signedAdjustmentAmount(adjustment), currency: pricing.currency))
                            .font(.subheadline)
                        if let notes = adjustment.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    @ViewBuilder
    private func paymentScheduleSection(for pricing: BookingPricing) -> some View {
        Section("Payment Schedule") {
            if pricing.payments.isEmpty {
                Text("No payments scheduled")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(pricing.payments) { payment in
                    paymentRow(payment, currency: pricing.currency)
                }
            }
        }
    }

    @ViewBuilder
    private func offerSection(for offer: BookingOffer) -> some View {
        let showOfferTotalValues = offer.items.contains(where: { $0.quantity != 1 })
        Section("Offer") {
            LabeledContent("Currency", value: offer.currency.rawValue)
            LabeledContent("Items", value: String(offer.totals.itemsCount))
            LabeledContent("Net", value: formatMoney(offer.totals.netAmountCents, currency: offer.currency))
            LabeledContent("Tax", value: formatMoney(offer.totals.taxAmountCents, currency: offer.currency))
            LabeledContent("Gross", value: formatMoney(offer.totals.grossAmountCents, currency: offer.currency))
            LabeledContent("Offer total (TOTAL, \(offer.currency.rawValue))", value: formatMoney(offer.totalPriceCents, currency: offer.currency))
        }

        if !offer.categoryRules.isEmpty {
            Section("Offer Tax Rules") {
                ForEach(offer.categoryRules, id: \.category) { rule in
                    LabeledContent(offerCategoryLabel(rule.category), value: formatPercent(rule.taxRateBasisPoints))
                }
            }
        }

        Section("Offer Items") {
            if offer.items.isEmpty {
                Text("No offer items yet")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(offer.items) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(item.label)
                            Spacer()
                            Text(offerCategoryLabel(item.category))
                                .foregroundStyle(.secondary)
                        }
                        if let details = item.details, !details.isEmpty {
                            Text(details)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        HStack {
                            Text("Qty \(item.quantity)")
                                .foregroundStyle(.secondary)
                            Spacer()
                            if showOfferTotalValues {
                                let single = formatMoney(item.unitAmountCents, currency: offer.currency)
                                let total = formatMoney(
                                    item.lineTotalAmountCents ?? (item.unitAmountCents * item.quantity),
                                    currency: offer.currency
                                )
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("Price (SINGLE, \(offer.currency.rawValue)): \(single)")
                                    Text("Price (TOTAL, \(offer.currency.rawValue)): \(total)")
                                }
                                .font(.subheadline)
                            } else {
                                let lineGross = item.lineGrossAmountCents
                                Text(formatMoney(lineGross ?? (item.lineTotalAmountCents ?? (item.unitAmountCents * item.quantity)), currency: offer.currency))
                            }
                        }
                        Text("Tax \(formatPercent(item.taxRateBasisPoints))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if let notes = item.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    @ViewBuilder
    private func paymentRow(_ payment: BookingPayment, currency: ATPCurrencyCode) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(payment.label)
                Spacer()
                Text(payment.status.rawValue)
                    .foregroundStyle(payment.status == .paid ? .green : .secondary)
            }
            HStack {
                Text(formatMoney(payment.grossAmountCents, currency: currency))
                Spacer()
                Text("Tax \(formatPercent(payment.taxRateBasisPoints))")
                    .foregroundStyle(.secondary)
            }
            if let dueDate = payment.dueDate, !dueDate.isEmpty {
                Text("Due \(dueDate)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let paidAt = payment.paidAt, !paidAt.isEmpty {
                Text("Paid \(paidAt)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let notes = payment.notes, !notes.isEmpty {
                Text(notes)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func stageSection(for booking: Booking) -> some View {
        Section("Stage") {
            Picker("Stage", selection: $selectedStage) {
                ForEach(stageOptions, id: \.self) { stage in
                    Text(stage).tag(stage)
                }
            }

            Button("Update Stage") {
                Task {
                    guard let session = await sessionStore.validSession() else { return }
                    await viewModel.updateStage(selectedStage, session: session)
                }
            }
            .disabled(selectedStage.isEmpty || selectedStage == booking.stage.rawValue)
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
    private func bookingNoteSection() -> some View {
        Section("Booking Note") {
            TextEditor(text: $viewModel.noteDraft)
                .frame(minHeight: 140)

            Button("Save Note") {
                Task {
                    guard let session = await sessionStore.validSession() else { return }
                    await viewModel.saveNote(session: session)
                }
            }
            .disabled(viewModel.noteDraft == viewModel.originalNote)
        }
    }

    @ViewBuilder
    private func activitiesSection() -> some View {
        let activities: [BookingActivity] = viewModel.activities
        if !activities.isEmpty {
            Section("Activities") {
                BookingActivityRows(activities: activities)
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
        selectedStage = viewModel.booking?.stage.rawValue ?? ""
        selectedAtpStaffID = viewModel.booking?.assignedAtpStaffId ?? ""
    }

    private func formatMoney(_ minorUnits: Int, currency: ATPCurrencyCode) -> String {
        let definition = ATPCurrencyCatalog.definition(for: currency)
        let divisor = pow(10.0, Double(definition.decimalPlaces))
        let amount = Double(minorUnits) / divisor
        if definition.decimalPlaces == 0 {
            return "\(definition.symbol) \(Int(amount.rounded()))"
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.groupingSeparator = ","
        formatter.decimalSeparator = "."
        formatter.minimumFractionDigits = definition.decimalPlaces
        formatter.maximumFractionDigits = definition.decimalPlaces
        return "\(definition.symbol) \(formatter.string(from: NSNumber(value: amount)) ?? String(format: "%.2f", amount))"
    }

    private func formatPercent(_ basisPoints: Int) -> String {
        let percent = Double(basisPoints) / 100.0
        return String(format: "%.2f%%", percent).replacingOccurrences(of: ".00%", with: "%")
    }

    private func signedAdjustmentAmount(_ adjustment: BookingPricingAdjustment) -> Int {
        switch adjustment.type {
        case .discount, .credit:
            return -adjustment.amountCents
        case .surcharge:
            return adjustment.amountCents
        }
    }

    private func paymentSummaryRows(for pricing: BookingPricing) -> [(label: String, value: String)] {
        let rows: [(String, Int)] = [
            ("Agreed Net", pricing.agreedNetAmountCents),
            ("Adjustments", pricing.summary.adjustmentsDeltaCents),
            ("Adjusted Net", pricing.summary.adjustedNetAmountCents),
            ("Unscheduled Net", pricing.summary.unscheduledNetAmountCents),
            ("Scheduled Gross", pricing.summary.scheduledGrossAmountCents),
            ("Paid", pricing.summary.paidGrossAmountCents),
            ("Outstanding", pricing.summary.outstandingGrossAmountCents)
        ]

        return rows
            .filter { $0.1 != 0 }
            .map { (label: $0.0, value: formatMoney($0.1, currency: pricing.currency)) }
    }

    private func offerCategoryLabel(_ category: OfferCategory) -> String {
        switch category {
        case .accommodation:
            return "Accommodation"
        case .transportation:
            return "Transportation"
        case .toursActivities:
            return "Tours & Activities"
        case .guideSupportServices:
            return "Guide & Support Services"
        case .meals:
            return "Meals"
        case .feesTaxes:
            return "Fees & Taxes"
        case .discountsCredits:
            return "Discounts & Credits"
        case .other:
            return "Other"
        }
    }
}

private struct BookingActivityRows: View {
    let activities: [BookingActivity]

    var body: some View {
        ForEach<[Int], Int, ActivityRowView>(Array(0..<activities.count), id: \.self) { index in
            let activity = activities[index]
            ActivityRowView(activity: activity)
        }
    }
}

private struct ActivityRowView: View {
    let activity: BookingActivity

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(activity.type)
                .font(.headline)
            if let note = activity.note, !note.isEmpty {
                Text(note)
                    .font(.body)
            }
            Text(activity.createdAt)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
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

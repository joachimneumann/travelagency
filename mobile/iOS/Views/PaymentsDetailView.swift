import SwiftUI

struct PaymentsDetailView: View {
    let pricing: BookingPricing

    var body: some View {
        Form {
            summarySection
            adjustmentsSection
            paymentScheduleSection
        }
        .navigationTitle("Payments")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }

    @ViewBuilder
    private var summarySection: some View {
        Section("Summary") {
            let rows = paymentSummaryRows(for: pricing)
            if rows.isEmpty {
                Text("No payment summary available")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(rows, id: \.label) { row in
                    LabeledContent(row.label, value: row.value)
                }
                if !pricing.summary.isScheduleBalanced {
                    LabeledContent("Schedule Complete", value: "No")
                }
            }
        }
    }

    @ViewBuilder
    private var adjustmentsSection: some View {
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
    private var paymentScheduleSection: some View {
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

    private func signedAdjustmentAmount(_ adjustment: BookingPricingAdjustment) -> Int {
        switch adjustment.type {
        case .discount, .credit:
            return -adjustment.amountCents
        case .surcharge:
            return adjustment.amountCents
        }
    }
}

import SwiftUI

struct OfferItemDetailView: View {
    let item: BookingOfferItem
    let currency: ATPCurrencyCode

    var body: some View {
        Form {
            Section("Offer Item") {
                LabeledContent("Label", value: item.label)
                LabeledContent("Category", value: offerCategoryLabel(item.category))
                if let details = item.details, !details.isEmpty {
                    LabeledContent("Details", value: details)
                }
                LabeledContent("Quantity", value: String(item.quantity))
                LabeledContent("Price (Single)", value: formatMoney(item.unitAmountCents, currency: currency))
                if let lineTotal = item.lineTotalAmountCents {
                    LabeledContent("Price (Total)", value: formatMoney(lineTotal, currency: currency))
                }
                LabeledContent("Tax", value: formatPercent(item.taxRateBasisPoints))
                if let notes = item.notes, !notes.isEmpty {
                    Text("Notes")
                        .font(.headline)
                    Text(notes)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Offer Item")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

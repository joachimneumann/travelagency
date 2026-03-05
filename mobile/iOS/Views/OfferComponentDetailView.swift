import SwiftUI

struct OfferComponentDetailView: View {
    let component: BookingOfferComponent
    let currency: ATPCurrencyCode

    var body: some View {
        Form {
            Section("Offer Component") {
                LabeledContent("Label", value: component.label)
                LabeledContent("Category", value: offerCategoryLabel(component.category))
                if let details = component.details, !details.isEmpty {
                    LabeledContent("Details", value: details)
                }
                LabeledContent("Quantity", value: String(component.quantity))
                LabeledContent("Price (Single)", value: formatMoney(component.unitAmountCents, currency: currency))
                if let lineTotal = component.lineTotalAmountCents {
                    LabeledContent("Price (Total)", value: formatMoney(lineTotal, currency: currency))
                }
                LabeledContent("Tax", value: formatPercent(component.taxRateBasisPoints))
                if let notes = component.notes, !notes.isEmpty {
                    Text("Notes")
                        .font(.headline)
                    Text(notes)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Offer Component")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

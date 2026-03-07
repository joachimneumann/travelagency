import SwiftUI

struct OfferDetailView: View {
    let offer: BookingOffer
    let offerTitle: String

    var body: some View {
        let categoryRules = offer.categoryRules ?? []
        let components = offer.components ?? []

        Form {
            Section("Offer") {
                LabeledContent("Currency", value: offer.currency.rawValue)
                LabeledContent("Components", value: String(offer.totals.componentsCount))
                LabeledContent("Net", value: formatMoney(offer.totals.netAmountCents, currency: offer.currency))
                LabeledContent("Tax", value: formatMoney(offer.totals.taxAmountCents, currency: offer.currency))
                LabeledContent("Gross", value: formatMoney(offer.totals.grossAmountCents, currency: offer.currency))
                LabeledContent("Total with Tax", value: formatMoney(offer.totals.grossAmountCents, currency: offer.currency))
            }

            if !categoryRules.isEmpty {
                Section("Offer Tax Rules") {
                    ForEach(categoryRules, id: \.category) { rule in
                        LabeledContent(offerCategoryLabel(rule.category), value: formatPercent(rule.taxRateBasisPoints))
                    }
                }
            }

            Section("Offer Components (\(offerTitle))") {
                if components.isEmpty {
                    Text("no components yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(components) { component in
                        NavigationLink {
                            OfferComponentDetailView(component: component, currency: offer.currency)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(offerCategoryLabel(component.category))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Text(component.label)
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                if let details = component.details, !details.isEmpty {
                                    Text(details)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Offer")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

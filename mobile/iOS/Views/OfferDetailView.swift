import SwiftUI

struct OfferDetailView: View {
    let offer: BookingOffer
    let offerTitle: String

    var body: some View {
        Form {
            Section("Offer") {
                LabeledContent("Currency", value: offer.currency.rawValue)
                LabeledContent("Items", value: String(offer.totals.itemsCount))
                LabeledContent("Net", value: formatMoney(offer.totals.netAmountCents, currency: offer.currency))
                LabeledContent("Tax", value: formatMoney(offer.totals.taxAmountCents, currency: offer.currency))
                LabeledContent("Gross", value: formatMoney(offer.totals.grossAmountCents, currency: offer.currency))
                LabeledContent("Total with Tax", value: formatMoney(offer.totalPriceCents, currency: offer.currency))
            }

            if !offer.categoryRules.isEmpty {
                Section("Offer Tax Rules") {
                    ForEach(offer.categoryRules, id: \.category) { rule in
                        LabeledContent(offerCategoryLabel(rule.category), value: formatPercent(rule.taxRateBasisPoints))
                    }
                }
            }

            Section("Offer Items (\(offerTitle))") {
                if offer.items.isEmpty {
                    Text("No offer items yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(offer.items) { item in
                        NavigationLink {
                            OfferItemDetailView(item: item, currency: offer.currency)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(offerCategoryLabel(item.category))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Text(item.label)
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                if let details = item.details, !details.isEmpty {
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

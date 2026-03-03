import Foundation

func formatMoney(_ minorUnits: Int, currency: ATPCurrencyCode) -> String {
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

func formatPercent(_ basisPoints: Int) -> String {
    let percent = Double(basisPoints) / 100.0
    return String(format: "%.2f%%", percent).replacingOccurrences(of: ".00%", with: "%")
}

func formatSummaryText(from text: String, maxLength: Int = 72) -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return "—" }
    guard trimmed.count > maxLength else { return trimmed }
    return String(trimmed.prefix(maxLength - 1)) + "…"
}

func offerCategoryLabel(_ category: OfferCategory) -> String {
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

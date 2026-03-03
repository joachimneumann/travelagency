    import Foundation

    // Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    enum GeneratedCurrencyCode: String, CaseIterable, Codable, Hashable {
    case usd = "USD"
    case euro = "EURO"
    case vnd = "VND"
    case thb = "THB"

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            let rawValue = try container.decode(String.self).trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            switch rawValue {
            case "USD":
                self = .usd
            case "EURO", "EUR":
                self = .euro
            case "VND":
                self = .vnd
            case "THB":
                self = .thb
            default:
                self = .usd
            }
        }
    }

    struct GeneratedCurrencyDefinition: Codable, Equatable {
        let code: GeneratedCurrencyCode
        let symbol: String
        let decimalPlaces: Int
        let isoCode: String
    }

    enum GeneratedCurrencyCatalog {
        static let definitions: [GeneratedCurrencyCode: GeneratedCurrencyDefinition] = [
        .usd: GeneratedCurrencyDefinition(code: .usd, symbol: "$", decimalPlaces: 2, isoCode: "USD"),
        .euro: GeneratedCurrencyDefinition(code: .euro, symbol: "€", decimalPlaces: 2, isoCode: "EURO"),
        .vnd: GeneratedCurrencyDefinition(code: .vnd, symbol: "₫", decimalPlaces: 0, isoCode: "VND"),
        .thb: GeneratedCurrencyDefinition(code: .thb, symbol: "฿", decimalPlaces: 0, isoCode: "THB")
        ]

        static func definition(for code: GeneratedCurrencyCode) -> GeneratedCurrencyDefinition {
            definitions[code] ?? GeneratedCurrencyDefinition(code: .usd, symbol: "$", decimalPlaces: 2, isoCode: "USD")
        }
    }

import Foundation

// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    struct GeneratedTour: Codable, Equatable, Identifiable {
    let id: String
    let title: String?
    let destinationCountries: [String]?
    let styles: [String]?
    let durationDays: Int?
    let priceFrom: GeneratedTourPriceFrom?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case title = "title"
        case destinationCountries = "destinationCountries"
        case styles = "styles"
        case durationDays = "durationDays"
        case priceFrom = "priceFrom"
        }

    }

    struct GeneratedTourPriceFrom: Codable, Equatable {
    let currency: GeneratedCurrencyCode
    let minor: Int

        private enum CodingKeys: String, CodingKey {
        case currency = "currency"
        case minor = "minor"
        }

    }


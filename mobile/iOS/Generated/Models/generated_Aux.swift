import Foundation

// Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    struct GeneratedCustomer: Codable, Equatable, Identifiable {
    let id: String
    let name: String?
    let email: String?
    let phone: String?
    let language: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case name = "name"
        case email = "email"
        case phone = "phone"
        case language = "language"
        }
    }

    struct GeneratedTour: Codable, Equatable, Identifiable {
    let id: String
    let title: String?
    let destinationCountries: [String]
    let styles: [String]
    let durationDays: Int?
    let priceFrom: GeneratedTourPriceFrom?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case title = "title"
        case destinationCountries = "destination_countries"
        case styles = "styles"
        case durationDays = "duration_days"
        case priceFrom = "price_from"
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


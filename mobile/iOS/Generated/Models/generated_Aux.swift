import Foundation

// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    struct GeneratedTour: Codable, Equatable, Identifiable {
    let id: String
    let title: String?
    let destinations: [String]?
    let styles: [String]?
    let travel_duration_days: Int?
    let budget_lower_USD: Int?
    let priority: Int?
    let rating: Double?
    let seasonality_start_month: GeneratedMonthCode?
    let seasonality_end_month: GeneratedMonthCode?
    let shortDescription: String?
    let highlights: [String]?
    let image: String?
    let createdAt: String?
    let updatedAt: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case title = "title"
        case destinations = "destinations"
        case styles = "styles"
        case travel_duration_days = "travel_duration_days"
        case budget_lower_USD = "budget_lower_USD"
        case priority = "priority"
        case rating = "rating"
        case seasonality_start_month = "seasonality_start_month"
        case seasonality_end_month = "seasonality_end_month"
        case shortDescription = "shortDescription"
        case highlights = "highlights"
        case image = "image"
        case createdAt = "createdAt"
        case updatedAt = "updatedAt"
        }

    }

    struct GeneratedWebsiteBookingForm: Codable, Equatable {
    let destinations: [String]?
    let travel_style: [String]?
    let travel_month: String?
    let number_of_travelers: Int?
    let preferred_currency: GeneratedCurrencyCode
    let travel_duration_days_min: Int?
    let travel_duration_days_max: Int?
    let name: String
    let email: String?
    let phone_number: String?
    let budget_lower_USD: Int?
    let budget_upper_USD: Int?
    let preferred_language: GeneratedLanguageCode
    let notes: String?

        private enum CodingKeys: String, CodingKey {
        case destinations = "destinations"
        case travel_style = "travel_style"
        case travel_month = "travel_month"
        case number_of_travelers = "number_of_travelers"
        case preferred_currency = "preferred_currency"
        case travel_duration_days_min = "travel_duration_days_min"
        case travel_duration_days_max = "travel_duration_days_max"
        case name = "name"
        case email = "email"
        case phone_number = "phone_number"
        case budget_lower_USD = "budget_lower_USD"
        case budget_upper_USD = "budget_upper_USD"
        case preferred_language = "preferred_language"
        case notes = "notes"
        }

    }


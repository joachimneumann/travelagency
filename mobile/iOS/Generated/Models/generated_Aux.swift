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


import Foundation

struct BookingListResponse: Decodable {
    let bookings: [Booking]
    let page: Int?
    let pageSize: Int?
    let total: Int?
    let totalPages: Int?

    private enum CodingKeys: String, CodingKey {
        case bookings
        case page
        case pageSize = "page_size"
        case total
        case totalPages = "total_pages"
    }
}

struct BookingDetailResponse: Decodable {
    let booking: Booking
    let customer: Customer?
}

struct BookingUpdateResponse: Decodable {
    let booking: Booking
}

struct Booking: Codable, Identifiable, Equatable {
    let id: String
    var stage: String
    let destination: String?
    let style: String?
    let travelMonth: String?
    let travelers: Int?
    let durationLabel: String?
    let budgetLabel: String?
    let notes: String?
    let createdAt: String?
    let updatedAt: String?
    let slaDueAt: String?
    let staff: String?
    let staffName: String?
    let customerID: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case stage
        case destination
        case style
        case travelMonth = "travel_month"
        case travelers
        case durationLabel = "duration_label"
        case budgetLabel = "budget_label"
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case slaDueAt = "sla_due_at"
        case staff
        case staffName = "staff_name"
        case customerID = "customer_id"
    }
}

struct Customer: Codable, Equatable {
    let id: String
    let name: String?
    let email: String?
    let phone: String?
    let language: String?
}

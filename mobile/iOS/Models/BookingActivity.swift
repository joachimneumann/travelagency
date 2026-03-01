import Foundation

struct BookingActivitiesResponse: Decodable {
    let activities: [BookingActivity]
}

struct BookingActivityCreateResponse: Decodable {
    let activity: BookingActivity
}

struct BookingActivity: Codable, Identifiable, Equatable {
    let id: String
    let type: String
    let detail: String
    let actor: String
    let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case detail
        case actor
        case createdAt = "created_at"
    }
}

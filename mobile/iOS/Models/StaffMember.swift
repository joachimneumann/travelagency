import Foundation

struct StaffListResponse: Decodable {
    let items: [StaffMember]
    let total: Int?
}

struct StaffMember: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let active: Bool
    let usernames: [String]?
    let destinations: [String]?
    let languages: [String]?
}

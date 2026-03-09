    import Foundation

    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    enum GeneratedAPIRequestFactory {
        static let contractVersion = "2026-03-02.1"

    static let mobileBootstrap = "/public/v1/mobile/bootstrap"
    static let authMe = "/auth/me"
    static let publicBookings = "/public/v1/bookings"
    static let publicTours = "/public/v1/tours"
    static let bookings = "/api/v1/bookings"
    static let bookingDetail = "/api/v1/bookings/{bookingId}"
    static let bookingChat = "/api/v1/bookings/{bookingId}/chat"
    static let bookingStage = "/api/v1/bookings/{bookingId}/stage"
    static let bookingAssignment = "/api/v1/bookings/{bookingId}/owner"
    static let bookingNote = "/api/v1/bookings/{bookingId}/notes"
    static let bookingPricing = "/api/v1/bookings/{bookingId}/pricing"
    static let bookingOffer = "/api/v1/bookings/{bookingId}/offer"
    static let bookingActivities = "/api/v1/bookings/{bookingId}/activities"
    static let bookingInvoices = "/api/v1/bookings/{bookingId}/invoices"
    static let atpStaff = "/api/v1/atp_staff"
    static let tours = "/api/v1/tours"

        static func buildURL(baseURL: URL, path: String, queryItems: [URLQueryItem] = []) -> URL {
            var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems.isEmpty ? nil : queryItems
            return components.url!
        }

static func mobileBootstrapPath() -> String {
    "/public/v1/mobile/bootstrap"
}

static func authMePath() -> String {
    "/auth/me"
}

static func publicBookingsPath() -> String {
    "/public/v1/bookings"
}

static func publicToursPath() -> String {
    "/public/v1/tours"
}

static func bookingsPath() -> String {
    "/api/v1/bookings"
}

static func bookingDetailPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)"
}

static func bookingChatPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/chat"
}

static func bookingStagePath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/stage"
}

static func bookingAssignmentPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/owner"
}

static func bookingNotePath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/notes"
}

static func bookingPricingPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/pricing"
}

static func bookingOfferPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/offer"
}

static func bookingActivitiesPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/activities"
}

static func bookingInvoicesPath(bookingId: String) -> String {
    "/api/v1/bookings/\(bookingId)/invoices"
}

static func atpStaffPath() -> String {
    "/api/v1/atp_staff"
}

static func toursPath() -> String {
    "/api/v1/tours"
}


static func mobileBootstrapURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: mobileBootstrapPath(), queryItems: queryItems)
}

static func authMeURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: authMePath(), queryItems: queryItems)
}

static func publicBookingsURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: publicBookingsPath(), queryItems: queryItems)
}

static func publicToursURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: publicToursPath(), queryItems: queryItems)
}

static func bookingsURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingsPath(), queryItems: queryItems)
}

static func bookingDetailURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingDetailPath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingChatURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingChatPath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingStageURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingStagePath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingAssignmentURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingAssignmentPath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingNoteURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingNotePath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingPricingURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingPricingPath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingOfferURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingOfferPath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingActivitiesURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingActivitiesPath(bookingId: bookingId), queryItems: queryItems)
}

static func bookingInvoicesURL(baseURL: URL, bookingId: String, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: bookingInvoicesPath(bookingId: bookingId), queryItems: queryItems)
}

static func atpStaffURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: atpStaffPath(), queryItems: queryItems)
}

static func toursURL(baseURL: URL, queryItems: [URLQueryItem] = []) -> URL {
    buildURL(baseURL: baseURL, path: toursPath(), queryItems: queryItems)
}

    }

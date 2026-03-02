import Foundation

// Generated from contracts/mobile-api.openapi.yaml. Do not edit by hand.

enum MobileAPIRequestFactory {
    static let contractVersion = "2026-03-02.1"
    static let bootstrapPath = "/public/v1/mobile/bootstrap"
    static let authMePath = "/auth/me"
    static let bookingsPath = "/api/v1/bookings"
    static let staffPath = "/api/v1/staff"

    static func bootstrapURL(baseURL: URL) -> URL {
        baseURL.appendingPathComponent(String(bootstrapPath.dropFirst()))
    }

    static func bookingsURL(baseURL: URL, page: Int, pageSize: Int) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(String(bookingsPath.dropFirst())), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize)),
            URLQueryItem(name: "sort", value: "created_at_desc")
        ]
        return components.url!
    }

    static func bookingDetailURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)")
    }

    static func bookingStageURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/stage")
    }

    static func bookingAssignmentURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/owner")
    }

    static func bookingNoteURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/notes")
    }

    static func bookingPricingURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/pricing")
    }

    static func bookingActivitiesURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/activities")
    }

    static func bookingInvoicesURL(baseURL: URL, bookingID: String) -> URL {
        baseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/invoices")
    }

    static func activeStaffURL(baseURL: URL) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(String(staffPath.dropFirst())), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "active", value: "true")]
        return components.url!
    }
}

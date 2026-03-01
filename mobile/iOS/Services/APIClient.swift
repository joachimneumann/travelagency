import Foundation

final class APIClient {
    enum APIError: LocalizedError {
        case invalidResponse
        case unauthorized
        case forbidden
        case server(String)
    }

    func fetchBookings(session: AuthSession, page: Int = 1, pageSize: Int = 20) async throws -> BookingListResponse {
        var components = URLComponents(url: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize)),
            URLQueryItem(name: "sort", value: "created_at_desc")
        ]
        return try await send(requestURL: components.url!, session: session)
    }

    func fetchBookingDetail(id: String, session: AuthSession) async throws -> BookingDetailResponse {
        try await send(requestURL: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings/\(id)"), session: session)
    }

    func fetchActivities(bookingID: String, session: AuthSession) async throws -> BookingActivitiesResponse {
        try await send(requestURL: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/activities"), session: session)
    }

    func fetchInvoices(bookingID: String, session: AuthSession) async throws -> BookingInvoicesResponse {
        try await send(requestURL: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/invoices"), session: session)
    }

    func fetchStaff(session: AuthSession) async throws -> StaffListResponse {
        var components = URLComponents(url: AppConfig.apiBaseURL.appendingPathComponent("api/v1/staff"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "active", value: "true")]
        return try await send(requestURL: components.url!, session: session)
    }

    func updateStage(bookingID: String, stage: String, session: AuthSession) async throws -> BookingUpdateResponse {
        try await send(
            requestURL: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/stage"),
            method: "PATCH",
            body: ["stage": stage],
            session: session
        )
    }

    func updateStaffAssignment(bookingID: String, staffID: String?, session: AuthSession) async throws -> BookingUpdateResponse {
        try await send(
            requestURL: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/owner"),
            method: "PATCH",
            body: ["staff": staffID ?? NSNull()],
            session: session
        )
    }

    func addActivity(bookingID: String, detail: String, session: AuthSession) async throws -> BookingActivityCreateResponse {
        try await send(
            requestURL: AppConfig.apiBaseURL.appendingPathComponent("api/v1/bookings/\(bookingID)/activities"),
            method: "POST",
            body: ["type": "NOTE", "detail": detail],
            session: session
        )
    }

    private func send<T: Decodable>(requestURL: URL, method: String = "GET", body: [String: Any]? = nil, session: AuthSession) async throws -> T {
        var request = URLRequest(url: requestURL)
        request.httpMethod = method
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch http.statusCode {
        case 200...299:
            return try JSONDecoder.api.decode(T.self, from: data)
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        default:
            let message = String(data: data, encoding: .utf8) ?? "Request failed"
            throw APIError.server(message)
        }
    }
}

private extension JSONDecoder {
    static var api: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        return decoder
    }
}

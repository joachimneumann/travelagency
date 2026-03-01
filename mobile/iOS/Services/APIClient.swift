import Foundation

final class APIClient {
    enum APIError: LocalizedError {
        case invalidResponse
        case unauthorized
        case forbidden
        case server(String)
        case bootstrapUnavailable(URL)

        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "The server returned an invalid response."
            case .unauthorized:
                return "Authentication is required."
            case .forbidden:
                return "You do not have permission to perform this action."
            case .server(let message):
                return message
            case .bootstrapUnavailable(let url):
                return "Could not reach the mobile bootstrap endpoint at \(url.absoluteString)."
            }
        }
    }

    func fetchBookings(session: AuthSession, page: Int = 1, pageSize: Int = 20) async throws -> BookingListResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingsURL(
                baseURL: AppConfig.apiBaseURL,
                page: page,
                pageSize: pageSize
            ),
            session: session
        )
    }

    func fetchBootstrap() async throws -> MobileBootstrapResponse {
        let bootstrapURL = MobileAPIRequestFactory.bootstrapURL(baseURL: AppConfig.apiBaseURL)
        var request = URLRequest(url: bootstrapURL)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.bootstrapUnavailable(bootstrapURL)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200...299).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Request failed"
            throw APIError.server(message)
        }
        return try JSONDecoder.api.decode(MobileBootstrapResponse.self, from: data)
    }

    func fetchBookingDetail(id: String, session: AuthSession) async throws -> BookingDetailResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingDetailURL(baseURL: AppConfig.apiBaseURL, bookingID: id),
            session: session
        )
    }

    func fetchActivities(bookingID: String, session: AuthSession) async throws -> BookingActivitiesResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingActivitiesURL(baseURL: AppConfig.apiBaseURL, bookingID: bookingID),
            session: session
        )
    }

    func fetchInvoices(bookingID: String, session: AuthSession) async throws -> BookingInvoicesResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingInvoicesURL(baseURL: AppConfig.apiBaseURL, bookingID: bookingID),
            session: session
        )
    }

    func fetchStaff(session: AuthSession) async throws -> StaffListResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.activeStaffURL(baseURL: AppConfig.apiBaseURL),
            session: session
        )
    }

    func updateStage(bookingID: String, stage: String, session: AuthSession) async throws -> BookingUpdateResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingStageURL(baseURL: AppConfig.apiBaseURL, bookingID: bookingID),
            method: "PATCH",
            body: ["stage": stage],
            session: session
        )
    }

    func updateStaffAssignment(bookingID: String, staffID: String?, session: AuthSession) async throws -> BookingUpdateResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingAssignmentURL(baseURL: AppConfig.apiBaseURL, bookingID: bookingID),
            method: "PATCH",
            body: ["staff": staffID ?? NSNull()],
            session: session
        )
    }

    func addActivity(bookingID: String, detail: String, session: AuthSession) async throws -> BookingActivityCreateResponse {
        try await send(
            requestURL: MobileAPIRequestFactory.bookingActivitiesURL(baseURL: AppConfig.apiBaseURL, bookingID: bookingID),
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

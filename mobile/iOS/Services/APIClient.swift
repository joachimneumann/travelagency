import Foundation

final class APIClient {
    enum APIError: LocalizedError {
        case invalidResponse
        case server(String)
        case bootstrapUnavailable(URL)

        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "The server returned an invalid response."
            case .server(let message):
                return message
            case .bootstrapUnavailable(let url):
                return "Could not reach the mobile bootstrap endpoint at \(url.absoluteString)."
            }
        }
    }

    func fetchBootstrap() async throws -> MobileBootstrapResponse {
        let bootstrapURL = AppConfig.mobileBootstrapURL()
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
}

private extension JSONDecoder {
    static var api: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        return decoder
    }
}

import Foundation

@MainActor
final class AppBootstrapStore: ObservableObject {
    enum State {
        case idle
        case loading
        case ready(MobileBootstrapResponse)
        case updateRequired(MobileBootstrapResponse)
        case failed(String)
    }

    @Published private(set) var state: State = .idle

    private let apiClient = APIClient()

    var isReady: Bool {
        if case .ready = state { return true }
        return false
    }

    func initialize() async {
        state = .loading
        do {
            let bootstrap = try await apiClient.fetchBootstrap()
            if requiresUpdate(minSupportedVersion: bootstrap.app.minSupportedVersion) || bootstrap.app.forceUpdate {
                state = .updateRequired(bootstrap)
                return
            }
            state = .ready(bootstrap)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    private func requiresUpdate(minSupportedVersion: String) -> Bool {
        compareVersions(AppConfig.currentAppVersion, minSupportedVersion) == .orderedAscending
    }

    private func compareVersions(_ lhs: String, _ rhs: String) -> ComparisonResult {
        let left = normalizedVersionComponents(lhs)
        let right = normalizedVersionComponents(rhs)
        let count = max(left.count, right.count)
        for index in 0..<count {
            let l = index < left.count ? left[index] : 0
            let r = index < right.count ? right[index] : 0
            if l < r { return .orderedAscending }
            if l > r { return .orderedDescending }
        }
        return .orderedSame
    }

    private func normalizedVersionComponents(_ value: String) -> [Int] {
        value
            .split(separator: ".")
            .map { segment in
                let digits = segment.prefix { $0.isNumber }
                return Int(digits) ?? 0
            }
    }
}

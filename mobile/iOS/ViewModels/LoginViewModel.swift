import Foundation

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var isLoading = false

    func login(sessionStore: SessionStore) async {
        isLoading = true
        defer { isLoading = false }
        await sessionStore.login()
    }
}

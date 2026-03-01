import SwiftUI

@main
struct AsiaTravelPlanApp: App {
    @StateObject private var sessionStore = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sessionStore)
                .task {
                    await sessionStore.restoreSessionIfPossible()
                }
        }
    }
}

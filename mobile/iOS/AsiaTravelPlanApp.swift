import SwiftUI

@main
struct AsiaTravelPlanApp: App {
    @StateObject private var sessionStore = SessionStore()
    @StateObject private var bootstrapStore = AppBootstrapStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sessionStore)
                .environmentObject(bootstrapStore)
                .task {
                    await bootstrapStore.initialize()
                    if bootstrapStore.isReady {
                        await sessionStore.restoreSessionIfPossible()
                    }
                }
        }
    }
}

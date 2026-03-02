import SwiftUI

@main
struct AsiaTravelPlanApp: App {
    @StateObject private var sessionStore = SessionStore()
    @StateObject private var bootstrapStore = AppBootstrapStore()
    @Environment(\.scenePhase) private var scenePhase

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
                .onChange(of: scenePhase) { _, newPhase in
                    guard newPhase == .active else { return }
                    Task {
                        if !bootstrapStore.isReady {
                            await bootstrapStore.initialize()
                        }
                        if bootstrapStore.isReady {
                            await sessionStore.restoreSessionIfPossible()
                        }
                    }
                }
        }
    }
}

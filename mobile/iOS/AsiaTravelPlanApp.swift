import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

@main
struct AsiaTravelPlanApp: App {
    @StateObject private var sessionStore = SessionStore()
    @StateObject private var bootstrapStore = AppBootstrapStore()

    init() {
#if canImport(UIKit)
        let itemAppearance = UITabBarItemAppearance()
        let smallFont = UIFont.systemFont(ofSize: 10, weight: .medium)
        itemAppearance.normal.titleTextAttributes = [.font: smallFont]
        itemAppearance.selected.titleTextAttributes = [.font: smallFont]
        itemAppearance.normal.iconColor = UIColor.secondaryLabel
        itemAppearance.selected.iconColor = UIColor.label
        itemAppearance.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: -2)
        itemAppearance.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: -2)

        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.stackedLayoutAppearance = itemAppearance
        appearance.compactInlineLayoutAppearance = itemAppearance
        appearance.inlineLayoutAppearance = itemAppearance

        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
#endif
    }

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

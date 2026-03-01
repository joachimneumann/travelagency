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
        let smallFont = UIFont.systemFont(ofSize: 9, weight: .medium)
        itemAppearance.normal.titleTextAttributes = [.font: smallFont]
        itemAppearance.selected.titleTextAttributes = [.font: smallFont]
        itemAppearance.normal.iconColor = UIColor.secondaryLabel
        itemAppearance.selected.iconColor = UIColor.label
        itemAppearance.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: -4)
        itemAppearance.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: -4)

        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.systemBackground
        appearance.shadowColor = UIColor.separator.withAlphaComponent(0.2)
        appearance.stackedLayoutAppearance = itemAppearance
        appearance.compactInlineLayoutAppearance = itemAppearance
        appearance.inlineLayoutAppearance = itemAppearance

        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
        UITabBar.appearance().itemPositioning = .centered
        UITabBar.appearance().itemWidth = 72
        UITabBar.appearance().itemSpacing = 8
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

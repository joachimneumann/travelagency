import SwiftUI

struct AppShellView: View {
    @State private var selectedTab: AppTab = .bookings

    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            Group {
                switch selectedTab {
                case .bookings:
                    BookingsListView()
                case .settings:
                    SettingsView()
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            CompactBottomBar(selectedTab: $selectedTab)
                .background(.thinMaterial)
                .overlay(alignment: .top) {
                    Divider()
                }
        }
    }
}

private enum AppTab: String, CaseIterable, Identifiable {
    case bookings
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .bookings:
            return "Bookings"
        case .settings:
            return "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .bookings:
            return "list.bullet.rectangle"
        case .settings:
            return "gearshape"
        }
    }
}

private struct CompactBottomBar: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        HStack(spacing: 6) {
            ForEach(AppTab.allCases) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: tab.systemImage)
                            .font(.system(size: 12, weight: .semibold))
                        Text(tab.title)
                            .font(.system(size: 8, weight: .medium))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedTab == tab ? Color.primary : Color.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 2)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 1)
        .padding(.bottom, 0)
        .frame(maxWidth: .infinity)
    }
}

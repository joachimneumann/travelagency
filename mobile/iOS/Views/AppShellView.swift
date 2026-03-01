import SwiftUI

struct AppShellView: View {
    @State private var selectedTab: AppTab = .bookings

    var body: some View {
        VStack(spacing: 0) {
            Group {
                switch selectedTab {
                case .bookings:
                    BookingsListView()
                case .settings:
                    SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            CompactBottomBar(selectedTab: $selectedTab)
        }
        .background(Color.white.ignoresSafeArea())
        .ignoresSafeArea(.container, edges: [.top, .bottom])
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
                    .frame(height: 40)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color.white)
        .overlay(alignment: .top) {
            Divider()
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, minHeight: 40, maxHeight: 40)
    }
}

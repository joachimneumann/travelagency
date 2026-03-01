import SwiftUI

struct BookingsListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingsViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Bookings")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                Group {
                    if viewModel.isLoading && viewModel.bookings.isEmpty {
                        ProgressView("Loading bookings...")
                            .font(.subheadline)
                    } else {
                        List(viewModel.bookings) { booking in
                            NavigationLink(value: booking.id) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(booking.destination ?? "Untitled booking")
                                        .font(.caption.weight(.semibold))
                                        .lineLimit(1)
                                    HStack(spacing: 6) {
                                        Text(booking.stage)
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(.primary)
                                        Text("•")
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                        Text(booking.staffName ?? "Unassigned")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                                .padding(.vertical, 0)
                            }
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 12))
                        }
                        .listStyle(.plain)
                        .environment(\.defaultMinListRowHeight, 38)
                        .refreshable {
                            if let session = sessionStore.session {
                                await viewModel.load(session: session)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .modifier(HideRootNavigationBarModifier())
            .navigationDestination(for: String.self) { bookingID in
                BookingDetailView(bookingID: bookingID) {
                    if !path.isEmpty {
                        path.removeLast()
                    }
                }
            }
            .task {
                guard let session = sessionStore.session else { return }
                await viewModel.load(session: session)
            }
            .alert("Bookings", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "Unknown error")
            }
        }
    }
}

private struct HideRootNavigationBarModifier: ViewModifier {
    func body(content: Content) -> some View {
#if os(iOS)
        content.toolbar(.hidden, for: .navigationBar)
#else
        content
#endif
    }
}

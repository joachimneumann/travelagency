import SwiftUI

struct BookingsListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingsViewModel()

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.bookings.isEmpty {
                ProgressView("Loading bookings...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                List(viewModel.bookings) { booking in
                    NavigationLink {
                        BookingDetailView(bookingID: booking.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(booking.destination ?? "Untitled booking")
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text("\(booking.stage) • \(booking.staffName ?? "Unassigned")")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        .padding(.vertical, 2)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    if let session = await sessionStore.validSession() {
                        await viewModel.load(session: session)
                    }
                }
            }
        }
        .navigationTitle("Bookings")
        .modifier(StandardNavigationTitleDisplayModeModifier())
        .task {
            guard let session = await sessionStore.validSession() else { return }
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

private struct StandardNavigationTitleDisplayModeModifier: ViewModifier {
    func body(content: Content) -> some View {
#if os(iOS)
        content.navigationBarTitleDisplayMode(.automatic)
#else
        content
#endif
    }
}

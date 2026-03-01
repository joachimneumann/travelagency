import SwiftUI

struct BookingsListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.bookings.isEmpty {
                    ProgressView("Loading bookings...")
                } else {
                    List(viewModel.bookings) { booking in
                        NavigationLink(value: booking.id) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(booking.destination ?? "Untitled booking")
                                    .font(.subheadline.weight(.semibold))
                                Text(booking.stage)
                                    .font(.caption.weight(.semibold))
                                Text(booking.staffName ?? "Unassigned")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        if let session = sessionStore.session {
                            await viewModel.load(session: session)
                        }
                    }
                }
            }
            .navigationTitle("Bookings")
            .navigationDestination(for: String.self) { bookingID in
                BookingDetailView(bookingID: bookingID)
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

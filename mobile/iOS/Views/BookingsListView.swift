import SwiftUI

struct BookingsListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = BookingsViewModel()

    var body: some View {
        content
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
    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.bookings.isEmpty {
            ProgressView("Loading bookings...")
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else {
            let bookings: [Booking] = viewModel.bookings
            List {
                ForEach(bookings, id: \.id) { booking in
                    NavigationLink {
                        BookingDetailView(bookingID: booking.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(displayBookingTitle(for: booking))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(verbatim: "\(booking.stage.rawValue) • \(booking.client_display_name ?? "Unassigned client")")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        .padding(.vertical, 2)
                    }
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

}

private func displayBookingTitle(for booking: Booking) -> String {
    let destinations = (booking.destination ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    return destinations.isEmpty ? "Booking" : destinations.joined(separator: ", ")
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

struct CustomersListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = CustomersViewModel()

    var body: some View {
        content
        .navigationTitle("Customers")
        .modifier(StandardNavigationTitleDisplayModeModifier())
        .task {
            guard let session = await sessionStore.validSession() else { return }
            await viewModel.load(session: session)
        }
        .alert("Customers", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.customers.isEmpty {
            ProgressView("Loading customers...")
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else {
            let customers: [Customer] = viewModel.customers
            List {
                Section {
                    HStack(spacing: 8) {
                        TextField("Search customers", text: $viewModel.searchDraft)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onSubmit {
                                Task {
                                    guard let session = await sessionStore.validSession() else { return }
                                    await viewModel.applySearch(session: session)
                                }
                            }
                        Button("Search") {
                            Task {
                                guard let session = await sessionStore.validSession() else { return }
                                await viewModel.applySearch(session: session)
                            }
                        }
                        .disabled(viewModel.isLoading)
                    }
                    if !viewModel.appliedSearch.isEmpty {
                        Button("Clear Search") {
                            Task {
                                guard let session = await sessionStore.validSession() else { return }
                                await viewModel.clearSearch(session: session)
                            }
                        }
                        .disabled(viewModel.isLoading)
                    }
                }

                if customers.isEmpty {
                    Section {
                        Text(
                            viewModel.appliedSearch.isEmpty
                                ? "No customers yet"
                                : "No customers found for \"\(viewModel.appliedSearch)\""
                        )
                        .foregroundStyle(.secondary)
                    }
                }

                ForEach(customers, id: \.client_id) { customer in
                    NavigationLink {
                        BookingCustomerDetailView(customerClientID: customer.client_id, initialCustomer: customer)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(displayName(for: customer))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(verbatim: subtitle(for: customer))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        .padding(.vertical, 2)
                    }
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

    private func displayName(for customer: Customer) -> String {
        let name = customer.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty { return name }
        return customer.email ?? customer.phone_number ?? customer.client_id
    }

    private func subtitle(for customer: Customer) -> String {
        let email = (customer.email ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let phone = (customer.phone_number ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !email.isEmpty && !phone.isEmpty {
            return "\(email) • \(phone)"
        }
        if !email.isEmpty { return email }
        if !phone.isEmpty { return phone }
        return customer.client_id
    }
}

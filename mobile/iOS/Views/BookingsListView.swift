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
            List {
                searchSection(
                    title: "Search bookings",
                    searchDraft: $viewModel.searchDraft,
                    isLoading: viewModel.isLoading,
                    appliedSearch: viewModel.appliedSearch,
                    onSearch: {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.applySearch(session: session)
                    },
                    onClear: {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.clearSearch(session: session)
                    }
                )

                if viewModel.bookings.isEmpty {
                    Section {
                        Text(viewModel.appliedSearch.isEmpty ? "No bookings yet" : "No bookings found for \"\(viewModel.appliedSearch)\"")
                            .foregroundStyle(.secondary)
                    }
                }

                ForEach(viewModel.bookings, id: \.id) { booking in
                    NavigationLink {
                        BookingDetailView(bookingID: booking.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(displayBookingTitle(for: booking))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(verbatim: bookingSubtitle(for: booking))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
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

struct CustomersListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = CustomersViewModel()

    var body: some View {
        content
            .navigationTitle("Customer Search")
            .modifier(StandardNavigationTitleDisplayModeModifier())
            .task {
                guard let session = await sessionStore.validSession() else { return }
                await viewModel.load(session: session)
            }
            .alert("Customer Search", isPresented: Binding(
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
            List {
                searchSection(
                    title: "Search persons inside bookings",
                    searchDraft: $viewModel.searchDraft,
                    isLoading: viewModel.isLoading,
                    appliedSearch: viewModel.appliedSearch,
                    onSearch: {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.applySearch(session: session)
                    },
                    onClear: {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.clearSearch(session: session)
                    }
                )

                if flattenedRows.isEmpty {
                    Section {
                        Text(viewModel.appliedSearch.isEmpty ? "No booking persons yet" : "No matches found for \"\(viewModel.appliedSearch)\"")
                            .foregroundStyle(.secondary)
                    }
                }

                ForEach(flattenedRows, id: \.id) { row in
                    NavigationLink {
                        BookingDetailView(bookingID: row.booking.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(row.person.name.isEmpty ? "Unnamed person" : row.person.name)
                                .font(.headline)
                            Text(verbatim: row.subtitle)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
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

    private var flattenedRows: [BookingPersonSearchRow] {
        viewModel.bookings.flatMap { booking in
            let persons = (booking.persons?.isEmpty == false) ? (booking.persons ?? []) : [fallbackPerson(for: booking)].compactMap { $0 }
            return persons.map { person in
                BookingPersonSearchRow(
                    id: "\(booking.id)-\(person.id ?? person.name)",
                    booking: booking,
                    person: person,
                    subtitle: bookingPersonSubtitle(for: person, booking: booking)
                )
            }
        }
    }
}

private struct BookingPersonSearchRow: Identifiable {
    let id: String
    let booking: Booking
    let person: BookingPerson
    let subtitle: String
}

private func searchSection(title: String, searchDraft: Binding<String>, isLoading: Bool, appliedSearch: String, onSearch: @escaping () async -> Void, onClear: @escaping () async -> Void) -> some View {
    Section {
        Text(title)
            .font(.footnote)
            .foregroundStyle(.secondary)
        HStack(spacing: 8) {
            TextField("Search", text: searchDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onSubmit {
                    Task { await onSearch() }
                }
            Button("Search") {
                Task { await onSearch() }
            }
            .disabled(isLoading)
        }
        if !appliedSearch.isEmpty {
            Button("Clear Search") {
                Task { await onClear() }
            }
            .disabled(isLoading)
        }
    }
}

private func displayBookingTitle(for booking: Booking) -> String {
    let destinations = (booking.destinations ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    return destinations.isEmpty ? "Booking" : destinations.joined(separator: ", ")
}

private func bookingSubtitle(for booking: Booking) -> String {
    let person = primaryPerson(for: booking) ?? fallbackPerson(for: booking)
    let personText = person.map(bookingPersonLine) ?? "No person yet"
    return "\(booking.stage.rawValue) • \(personText)"
}

private func bookingPersonSubtitle(for person: BookingPerson, booking: Booking) -> String {
    let contact = bookingPersonLine(person)
    let destinations = displayBookingTitle(for: booking)
    return "\(contact) • \(destinations)"
}

private func primaryPerson(for booking: Booking) -> BookingPerson? {
    let persons = booking.persons ?? []
    return persons.first(where: { $0.is_lead_contact == true }) ?? persons.first
}

private func fallbackPerson(for booking: Booking) -> BookingPerson? {
    guard let submission = booking.web_form_submission else { return nil }
    guard !(submission.name ?? "").isEmpty || submission.email != nil || submission.phone_number != nil else { return nil }
    return BookingPerson(
        id: nil,
        name: submission.name ?? "",
        emails: submission.email.map { [$0] },
        phone_numbers: submission.phone_number.map { [$0] },
        preferred_language: submission.preferred_language,
        date_of_birth: nil,
        nationality: nil,
        notes: nil,
        is_lead_contact: true,
        is_traveling: true
    )
}

private func bookingPersonLine(_ person: BookingPerson) -> String {
    let parts = [person.name] + (person.emails ?? []) + (person.phone_numbers ?? [])
    let normalized = parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    return normalized.isEmpty ? "Unnamed person" : normalized.joined(separator: " • ")
}

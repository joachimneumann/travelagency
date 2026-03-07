import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct BookingCustomerDetailView: View {
    let customerClientID: String
    let initialCustomer: Customer?

    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel: CustomerDetailViewModel
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var consentDraft = CustomerConsentDraft()
    @State private var isShowingConsentForm = false
    @State private var isShowingEvidenceImporter = false

    init(customerClientID: String, initialCustomer: Customer? = nil) {
        self.customerClientID = customerClientID
        self.initialCustomer = initialCustomer
        _viewModel = StateObject(
            wrappedValue: CustomerDetailViewModel(customerClientID: customerClientID, initialCustomer: initialCustomer)
        )
    }

    var body: some View {
        Form {
            if viewModel.isLoading && !viewModel.hasLoadedCustomer {
                Section {
                    ProgressView("Loading customer...")
                }
            } else {
                headerSection
                personalSection
                organizationSection
                addressSection
                consentsSection
                bookingsSection
                travelGroupsSection
                metadataSection
            }
        }
        .navigationTitle(viewModel.displayName)
        .modifier(InlineNavigationTitleDisplayModeModifier())
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(viewModel.isSaving ? "Updating…" : "Update") {
                    Task {
                        guard let session = await sessionStore.validSession() else { return }
                        await viewModel.save(session: session)
                    }
                }
                .disabled(!viewModel.canSave)
            }
        }
        .task {
            guard let session = await sessionStore.validSession() else { return }
            await viewModel.load(session: session)
        }
        .alert("Customer", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                await uploadPhoto(from: newItem)
                selectedPhotoItem = nil
            }
        }
        .fileImporter(
            isPresented: $isShowingEvidenceImporter,
            allowedContentTypes: [.image, .pdf],
            allowsMultipleSelection: false
        ) { result in
            handleEvidenceFile(result)
        }
    }

    private var headerSection: some View {
        Section {
            HStack(spacing: 16) {
                PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                    avatarView
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 6) {
                    Text(viewModel.displayName)
                        .font(.title3.weight(.semibold))
                    Text(verbatim: "ID: \(customerClientID)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if viewModel.isUploadingPhoto {
                        ProgressView("Uploading photo…")
                            .font(.footnote)
                    } else {
                        Text("Tap photo to change")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var avatarView: some View {
        Group {
            if let photoRef = viewModel.customer?.photo_ref,
               let url = URL(string: normalizedURL(from: photoRef)) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        placeholderAvatar
                    }
                }
            } else {
                placeholderAvatar
            }
        }
        .frame(width: 84, height: 84)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.secondary.opacity(0.18), lineWidth: 1))
    }

    private var placeholderAvatar: some View {
        ZStack {
            Circle().fill(Color(uiColor: .secondarySystemFill))
            Image(systemName: "person.crop.circle.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.secondary)
                .padding(10)
        }
    }

    private var personalSection: some View {
        Section("Customer") {
            TextField("Name", text: $viewModel.draft.name)
            TextField("Title", text: $viewModel.draft.title)

            if viewModel.draft.dateOfBirth == nil {
                Button("Set Date of Birth") {
                    viewModel.draft.dateOfBirth = Date()
                }
            } else {
                DatePicker(
                    "Date of Birth",
                    selection: Binding(
                        get: { viewModel.draft.dateOfBirth ?? Date() },
                        set: { viewModel.draft.dateOfBirth = $0 }
                    ),
                    displayedComponents: .date
                )
                Button("Clear Date of Birth", role: .destructive) {
                    viewModel.draft.dateOfBirth = nil
                }
            }

            Picker("Nationality", selection: $viewModel.draft.nationality) {
                Text("Not set").tag("")
                ForEach(CustomerDetailViewModel.countryOptions, id: \.self) { code in
                    Text(CustomerDetailViewModel.countryLabel(for: code)).tag(code)
                }
            }
            TextField("Phone Number", text: $viewModel.draft.phoneNumber)
                .textContentType(.telephoneNumber)
                .keyboardType(.phonePad)
            TextField("Email", text: $viewModel.draft.email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
            Picker("Preferred Language", selection: $viewModel.draft.preferredLanguage) {
                Text("Not set").tag("")
                ForEach(GeneratedLanguageCode.allCases, id: \.rawValue) { language in
                    Text(language.rawValue).tag(language.rawValue)
                }
            }
            Picker("Preferred Currency", selection: $viewModel.draft.preferredCurrency) {
                Text("Not set").tag("")
                ForEach(GeneratedCurrencyCode.allCases, id: \.rawValue) { currency in
                    Text(currency.rawValue.uppercased()).tag(currency.rawValue)
                }
            }
            Picker("Timezone", selection: $viewModel.draft.timezone) {
                Text("Not set").tag("")
                ForEach(CustomerDetailViewModel.timezoneOptions, id: \.self) { timezone in
                    Text(timezone).tag(timezone)
                }
            }
        }
    }

    private var organizationSection: some View {
        Section {
            Toggle("Organization", isOn: $viewModel.draft.hasOrganization.animation())
            if viewModel.draft.hasOrganization {
                TextField("Organization Name", text: $viewModel.draft.organizationName)
                TextField("Organization Address", text: $viewModel.draft.organizationAddress, axis: .vertical)
                TextField("Organization Phone Number", text: $viewModel.draft.organizationPhoneNumber)
                    .keyboardType(.phonePad)
                TextField("Organization Webpage", text: $viewModel.draft.organizationWebpage)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                TextField("Organization Email", text: $viewModel.draft.organizationEmail)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                TextField("Tax ID", text: $viewModel.draft.taxID)
            }
        }
    }

    private var addressSection: some View {
        Section("Address") {
            TextField("Address Line 1", text: $viewModel.draft.addressLine1)
            TextField("Address Line 2", text: $viewModel.draft.addressLine2)
            TextField("Postal Code", text: $viewModel.draft.addressPostalCode)
            TextField("City", text: $viewModel.draft.addressCity)
            Picker("Country Code", selection: $viewModel.draft.addressCountryCode) {
                Text("Not set").tag("")
                ForEach(CustomerDetailViewModel.countryOptions, id: \.self) { code in
                    Text(CustomerDetailViewModel.countryLabel(for: code)).tag(code)
                }
            }
            TextField("State Region", text: $viewModel.draft.addressStateRegion)
            VStack(alignment: .leading, spacing: 8) {
                Text("Notes")
                    .font(.subheadline.weight(.semibold))
                TextEditor(text: $viewModel.draft.notes)
                    .frame(minHeight: 120)
            }
            .padding(.vertical, 4)
        }
    }

    private var consentsSection: some View {
        Section {
            ForEach(viewModel.consents) { consent in
                VStack(alignment: .leading, spacing: 4) {
                    Text(consent.consent_type.rawValue.replacingOccurrences(of: "_", with: " "))
                        .font(.headline)
                    Text("\(consent.status.rawValue) • \(consent.captured_at)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if let capturedVia = consent.captured_via, !capturedVia.isEmpty {
                        Text(capturedVia)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let evidenceRef = consent.evidence_ref,
                       let url = URL(string: normalizedURL(from: evidenceRef)) {
                        Link("Open evidence", destination: url)
                            .font(.footnote)
                    }
                }
                .padding(.vertical, 4)
            }

            Button(isShowingConsentForm ? "Cancel" : "Add Consent") {
                isShowingConsentForm.toggle()
                if !isShowingConsentForm {
                    consentDraft = CustomerConsentDraft()
                }
            }

            if isShowingConsentForm {
                Picker("Consent Type", selection: $consentDraft.consentType) {
                    ForEach(CustomerDetailViewModel.consentTypeOptions, id: \.self) { option in
                        Text(option.replacingOccurrences(of: "_", with: " ")).tag(option)
                    }
                }
                Picker("Status", selection: $consentDraft.status) {
                    ForEach(CustomerDetailViewModel.consentStatusOptions, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                TextField("Captured Via", text: $consentDraft.capturedVia)
                DatePicker("Captured At", selection: $consentDraft.capturedAt, displayedComponents: [.date, .hourAndMinute])
                TextField("Evidence URL", text: $consentDraft.evidenceRef)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                HStack {
                    Text(consentDraft.evidenceFilename.isEmpty ? "No evidence file selected" : consentDraft.evidenceFilename)
                        .foregroundStyle(consentDraft.evidenceFilename.isEmpty ? .secondary : .primary)
                        .lineLimit(1)
                    Spacer()
                    Button("Choose File") {
                        isShowingEvidenceImporter = true
                    }
                    if !consentDraft.evidenceFilename.isEmpty {
                        Button("Clear", role: .destructive) {
                            consentDraft.clearEvidence()
                        }
                    }
                }
                Button("Save Consent") {
                    Task {
                        guard let session = await sessionStore.validSession() else { return }
                        let created = await viewModel.createConsent(draft: consentDraft, session: session)
                        if created {
                            consentDraft = CustomerConsentDraft()
                            isShowingConsentForm = false
                        }
                    }
                }
            }
        } header: {
            Text("Customer Consents")
        } footer: {
            if viewModel.consents.isEmpty {
                Text("No customer consents yet")
            }
        }
    }

    private var bookingsSection: some View {
        Section("Bookings") {
            if viewModel.bookings.isEmpty {
                Text("No bookings yet")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.bookings, id: \.id) { booking in
                    NavigationLink {
                        BookingDetailView(bookingID: booking.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(customerBookingTitle(for: booking))
                                .font(.headline)
                            Text("\(booking.stage.rawValue) • \(booking.id)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private var travelGroupsSection: some View {
        Section("Travel Group Members") {
            if viewModel.travelGroups.isEmpty {
                Text("No travel groups yet")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.travelGroups, id: \.id) { group in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(group.group_name)
                            .font(.headline)
                        Text(verbatim: group.id)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private var metadataSection: some View {
        Section {
            LabeledContent("Created At", value: viewModel.customer?.created_at ?? "-")
            LabeledContent("Updated At", value: viewModel.customer?.updated_at ?? "-")
            LabeledContent("Archived At", value: viewModel.customer?.archived_at ?? "-")
        }
    }

    private func uploadPhoto(from item: PhotosPickerItem) async {
        guard let session = await sessionStore.validSession() else { return }
        guard let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty else {
            viewModel.errorMessage = "Could not load the selected photo."
            return
        }
        let mimeType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
        let preferredExtension = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
        await viewModel.uploadPhoto(
            data: data,
            filename: "photo.\(preferredExtension)",
            mimeType: mimeType,
            session: session
        )
    }

    private func handleEvidenceFile(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            viewModel.errorMessage = error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            let didAccess = url.startAccessingSecurityScopedResource()
            defer {
                if didAccess {
                    url.stopAccessingSecurityScopedResource()
                }
            }
            do {
                let data = try Data(contentsOf: url)
                consentDraft.evidenceData = data
                consentDraft.evidenceFilename = url.lastPathComponent
                consentDraft.evidenceMimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            } catch {
                viewModel.errorMessage = error.localizedDescription
            }
        }
    }

    private func normalizedURL(from pathOrURL: String) -> String {
        if pathOrURL.hasPrefix("http://") || pathOrURL.hasPrefix("https://") {
            return pathOrURL
        }
        return URL(string: pathOrURL, relativeTo: AppConfig.apiBaseURL)?.absoluteURL.absoluteString ?? pathOrURL
    }
}

private func customerBookingTitle(for booking: Booking) -> String {
    let destinations = (booking.destination ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    return destinations.isEmpty ? "Booking" : destinations.joined(separator: ", ")
}

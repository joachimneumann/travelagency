import Foundation

struct CustomerEditDraft: Equatable {
    var name = ""
    var title = ""
    var dateOfBirth: Date?
    var nationality = ""
    var phoneNumber = ""
    var email = ""
    var preferredLanguage = ""
    var preferredCurrency = ""
    var timezone = ""
    var hasOrganization = false
    var organizationName = ""
    var organizationAddress = ""
    var organizationPhoneNumber = ""
    var organizationWebpage = ""
    var organizationEmail = ""
    var taxID = ""
    var addressLine1 = ""
    var addressLine2 = ""
    var addressPostalCode = ""
    var addressCity = ""
    var addressCountryCode = ""
    var addressStateRegion = ""
    var notes = ""

    init() {}

    init(customer: Customer) {
        name = customer.name
        title = customer.title ?? ""
        dateOfBirth = CustomerDetailViewModel.dateFormatter.date(from: customer.date_of_birth ?? "")
        nationality = customer.nationality ?? ""
        phoneNumber = customer.phone_number ?? ""
        email = customer.email ?? ""
        preferredLanguage = customer.preferred_language?.rawValue ?? ""
        preferredCurrency = customer.preferred_currency?.rawValue ?? ""
        timezone = customer.timezone ?? ""
        organizationName = customer.organization_name ?? ""
        organizationAddress = customer.organization_address ?? ""
        organizationPhoneNumber = customer.organization_phone_number ?? ""
        organizationWebpage = customer.organization_webpage ?? ""
        organizationEmail = customer.organization_email ?? ""
        taxID = customer.tax_id ?? ""
        hasOrganization = [
            organizationName,
            organizationAddress,
            organizationPhoneNumber,
            organizationWebpage,
            organizationEmail,
            taxID
        ].contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        addressLine1 = customer.address_line_1 ?? ""
        addressLine2 = customer.address_line_2 ?? ""
        addressPostalCode = customer.address_postal_code ?? ""
        addressCity = customer.address_city ?? ""
        addressCountryCode = customer.address_country_code ?? ""
        addressStateRegion = customer.address_state_region ?? ""
        notes = customer.notes ?? ""
    }
}

struct CustomerConsentDraft {
    var consentType = CustomerDetailViewModel.consentTypeOptions.first ?? "privacy_policy"
    var status = CustomerDetailViewModel.consentStatusOptions.first ?? "granted"
    var capturedVia = ""
    var capturedAt = Date()
    var evidenceRef = ""
    var evidenceFilename = ""
    var evidenceMimeType = ""
    var evidenceData: Data?

    mutating func clearEvidence() {
        evidenceFilename = ""
        evidenceMimeType = ""
        evidenceData = nil
    }
}

@MainActor
final class CustomerDetailViewModel: ObservableObject {
    static let consentTypeOptions = ["privacy_policy", "marketing_email", "marketing_whatsapp", "profiling"]
    static let consentStatusOptions = ["granted", "withdrawn", "unknown"]
    static let countryOptions: [String] = Locale.isoRegionCodes.sorted {
        CustomerDetailViewModel.countryLabel(for: $0) < CustomerDetailViewModel.countryLabel(for: $1)
    }
    static let timezoneOptions: [String] = TimeZone.knownTimeZoneIdentifiers.sorted()

    static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let isoDateTimeFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func countryLabel(for code: String) -> String {
        let locale = Locale.current
        let name = locale.localizedString(forRegionCode: code) ?? code
        return "\(name) (\(code))"
    }

    @Published private(set) var client: Client?
    @Published private(set) var customer: Customer?
    @Published private(set) var bookings: [Booking] = []
    @Published private(set) var consents: [CustomerConsent] = []
    @Published private(set) var documents: [CustomerDocument] = []
    @Published private(set) var travelGroups: [TravelGroup] = []
    @Published private(set) var travelGroupMembers: [TravelGroupMember] = []
    @Published var draft: CustomerEditDraft
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published private(set) var isUploadingPhoto = false
    @Published var errorMessage: String?

    let customerClientID: String

    private let apiClient = APIClient()

    init(customerClientID: String, initialCustomer: Customer? = nil) {
        self.customerClientID = customerClientID
        self.draft = initialCustomer.map(CustomerEditDraft.init(customer:)) ?? CustomerEditDraft()
        self.customer = initialCustomer
    }

    var displayName: String {
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty { return name }
        return customer?.name ?? "Customer"
    }

    var hasLoadedCustomer: Bool {
        customer != nil
    }

    var canSave: Bool {
        hasLoadedCustomer && hasChanges && !isSaving && !isUploadingPhoto
    }

    var hasChanges: Bool {
        guard let customer else { return false }
        return draft != CustomerEditDraft(customer: customer)
    }

    func load(session: AuthSession) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let detail = try await apiClient.fetchCustomerDetail(customerClientID: customerClientID, session: session)
            apply(detail: detail)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func save(session: AuthSession) async {
        guard let customer else { return }
        let customerHash = customer.customer_hash ?? ""
        isSaving = true
        defer { isSaving = false }
        do {
            let response = try await apiClient.updateCustomer(
                customerClientID: customerClientID,
                body: [
                    "customer_hash": customerHash,
                    "name": draft.name,
                    "title": draft.title,
                    "date_of_birth": draft.dateOfBirth.map(Self.dateFormatter.string(from:)) ?? "",
                    "nationality": draft.nationality,
                    "phone_number": draft.phoneNumber,
                    "email": draft.email,
                    "preferred_language": draft.preferredLanguage,
                    "preferred_currency": draft.preferredCurrency,
                    "timezone": draft.timezone,
                    "organization_name": draft.hasOrganization ? draft.organizationName : "",
                    "organization_address": draft.hasOrganization ? draft.organizationAddress : "",
                    "organization_phone_number": draft.hasOrganization ? draft.organizationPhoneNumber : "",
                    "organization_webpage": draft.hasOrganization ? draft.organizationWebpage : "",
                    "organization_email": draft.hasOrganization ? draft.organizationEmail : "",
                    "tax_id": draft.hasOrganization ? draft.taxID : "",
                    "address_line_1": draft.addressLine1,
                    "address_line_2": draft.addressLine2,
                    "address_postal_code": draft.addressPostalCode,
                    "address_city": draft.addressCity,
                    "address_country_code": draft.addressCountryCode,
                    "address_state_region": draft.addressStateRegion,
                    "notes": draft.notes
                ],
                session: session
            )
            client = response.client
            self.customer = response.customer
            draft = CustomerEditDraft(customer: response.customer)
        } catch APIClient.APIError.customerConflict(let message) {
            await refreshAfterConflict(session: session, message: message)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func uploadPhoto(data: Data, filename: String, mimeType: String, session: AuthSession) async {
        guard let customer else { return }
        let customerHash = customer.customer_hash ?? ""
        isUploadingPhoto = true
        defer { isUploadingPhoto = false }
        do {
            let response = try await apiClient.uploadCustomerPhoto(
                customerClientID: customerClientID,
                body: [
                    "customer_hash": customerHash,
                    "photo_upload": [
                        "filename": filename,
                        "mime_type": mimeType,
                        "data_base64": data.base64EncodedString()
                    ]
                ],
                session: session
            )
            client = response.client
            self.customer = response.customer
            draft = CustomerEditDraft(customer: response.customer)
        } catch APIClient.APIError.customerConflict(let message) {
            await refreshAfterConflict(session: session, message: message)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createConsent(draft consentDraft: CustomerConsentDraft, session: AuthSession) async -> Bool {
        guard let customer else { return false }
        let customerHash = customer.customer_hash ?? ""
        var body: [String: Any] = [
            "customer_hash": customerHash,
            "consent_type": consentDraft.consentType,
            "status": consentDraft.status,
            "captured_via": consentDraft.capturedVia,
            "captured_at": Self.isoDateTimeFormatter.string(from: consentDraft.capturedAt),
            "evidence_ref": consentDraft.evidenceRef
        ]
        if let evidenceData = consentDraft.evidenceData, !consentDraft.evidenceFilename.isEmpty {
            body["evidence_upload"] = [
                "filename": consentDraft.evidenceFilename,
                "mime_type": consentDraft.evidenceMimeType.isEmpty ? "application/octet-stream" : consentDraft.evidenceMimeType,
                "data_base64": evidenceData.base64EncodedString()
            ]
        }

        do {
            let response = try await apiClient.createCustomerConsent(
                customerClientID: customerClientID,
                body: body,
                session: session
            )
            client = response.client
            self.customer = response.customer
            consents.insert(response.consent, at: 0)
            self.draft = CustomerEditDraft(customer: response.customer)
            return true
        } catch APIClient.APIError.customerConflict(let message) {
            await refreshAfterConflict(session: session, message: message)
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func apply(detail: CustomerDetailResponse) {
        client = detail.client
        customer = detail.customer
        bookings = detail.bookings ?? []
        consents = (detail.consents ?? []).sorted { $0.captured_at > $1.captured_at }
        documents = detail.documents ?? []
        travelGroups = detail.travelGroups ?? []
        travelGroupMembers = detail.travelGroupMembers ?? []
        draft = CustomerEditDraft(customer: detail.customer)
    }

    private func refreshAfterConflict(session: AuthSession, message: String) async {
        do {
            let detail = try await apiClient.fetchCustomerDetail(customerClientID: customerClientID, session: session)
            apply(detail: detail)
            errorMessage = message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

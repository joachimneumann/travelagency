    import Foundation

    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    enum GeneratedBookingStage: String, CaseIterable, Codable, Hashable {
    case new = "NEW"
    case qualified = "QUALIFIED"
    case proposalSent = "PROPOSAL_SENT"
    case negotiation = "NEGOTIATION"
    case invoiceSent = "INVOICE_SENT"
    case paymentReceived = "PAYMENT_RECEIVED"
    case won = "WON"
    case lost = "LOST"
    case postTrip = "POST_TRIP"
    }

    enum GeneratedPaymentStatus: String, CaseIterable, Codable, Hashable {
    case pending = "PENDING"
    case paid = "PAID"
    case void = "VOID"
    }

    enum GeneratedPricingAdjustmentType: String, CaseIterable, Codable, Hashable {
    case discount = "DISCOUNT"
    case credit = "CREDIT"
    case surcharge = "SURCHARGE"
    }

    enum GeneratedOfferCategory: String, CaseIterable, Codable, Hashable {
    case accommodation = "ACCOMMODATION"
    case transportation = "TRANSPORTATION"
    case toursActivities = "TOURS_ACTIVITIES"
    case guideSupportServices = "GUIDE_SUPPORT_SERVICES"
    case meals = "MEALS"
    case feesTaxes = "FEES_TAXES"
    case discountsCredits = "DISCOUNTS_CREDITS"
    case other = "OTHER"
    }

        struct GeneratedSourceAttribution: Codable, Equatable {

    }

    struct GeneratedBookingActivity: Codable, Equatable, Identifiable {
    let id: String
    let bookingId: String
    let type: GeneratedBookingActivityType
    let actor: String
    let detail: String
    let createdAt: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case bookingId = "bookingId"
        case type = "type"
        case actor = "actor"
        case detail = "detail"
        case createdAt = "createdAt"
        }

    }

    struct GeneratedBookingInvoice: Codable, Equatable {

    }

    struct GeneratedBookingPricing: Codable, Equatable {

    }

    struct GeneratedBookingOfferCategoryRule: Codable, Equatable {
    let category: GeneratedOfferCategory
    let taxRateBasisPoints: Int

        private enum CodingKeys: String, CodingKey {
        case category = "category"
        case taxRateBasisPoints = "taxRateBasisPoints"
        }

    }

    struct GeneratedBookingOfferComponent: Codable, Equatable, Identifiable {
    let id: String
    let category: GeneratedOfferCategory
    let label: String
    let details: String?
    let quantity: Int
    let unitAmountCents: Int
    let taxRateBasisPoints: Int
    let lineTotalAmountCents: Int?
    let currency: GeneratedCurrencyCode
    let notes: String?
    let sortOrder: Int?
    let createdAt: String?
    let updatedAt: String?

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case category = "category"
        case label = "label"
        case details = "details"
        case quantity = "quantity"
        case unitAmountCents = "unitAmountCents"
        case taxRateBasisPoints = "taxRateBasisPoints"
        case lineTotalAmountCents = "lineTotalAmountCents"
        case currency = "currency"
        case notes = "notes"
        case sortOrder = "sortOrder"
        case createdAt = "createdAt"
        case updatedAt = "updatedAt"
        }

    }

    struct GeneratedBookingOfferTotals: Codable, Equatable {
    let netAmountCents: Int
    let taxAmountCents: Int
    let grossAmountCents: Int
    let componentsCount: Int

        private enum CodingKeys: String, CodingKey {
        case netAmountCents = "netAmountCents"
        case taxAmountCents = "taxAmountCents"
        case grossAmountCents = "grossAmountCents"
        case componentsCount = "componentsCount"
        }

    }

    struct GeneratedBookingOffer: Codable, Equatable {
    let currency: GeneratedCurrencyCode
    let categoryRules: [GeneratedBookingOfferCategoryRule]?
    let components: [GeneratedBookingOfferComponent]?
    let totals: GeneratedBookingOfferTotals
    let totalPriceCents: Int

        private enum CodingKeys: String, CodingKey {
        case currency = "currency"
        case categoryRules = "categoryRules"
        case components = "components"
        case totals = "totals"
        case totalPriceCents = "totalPriceCents"
        }

    }

    struct GeneratedBooking: Codable, Equatable, Identifiable {
    let id: String
    let booking_hash: String?
    let client_id: String?
    let client_type: GeneratedClientType?
    let client_display_name: String?
    let client_primary_phone_number: String?
    let client_primary_email: String?
    let stage: GeneratedBookingStage
    let atp_staff: String?
    let atp_staff_name: String?
    let destination: [String]?
    let style: [String]?
    let web_form_travel_month: String?
    let travel_start_day: String?
    let travel_end_day: String?
    let number_of_travelers: Int?
    let web_form_travel_duration: String?
    let web_form_travel_duration_days_min: Int?
    let web_form_travel_duration_days_max: Int?
    let preferredCurrency: GeneratedCurrencyCode?
    let notes: String?
    let service_level_agreement_due_at: String?
    let pricing: GeneratedBookingPricing
    let offer: GeneratedBookingOffer
    let source: GeneratedSourceAttribution?
    let createdAt: String
    let updatedAt: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case booking_hash = "booking_hash"
        case client_id = "client_id"
        case client_type = "client_type"
        case client_display_name = "client_display_name"
        case client_primary_phone_number = "client_primary_phone_number"
        case client_primary_email = "client_primary_email"
        case stage = "stage"
        case atp_staff = "atp_staff"
        case atp_staff_name = "atp_staff_name"
        case destination = "destination"
        case style = "style"
        case web_form_travel_month = "web_form_travel_month"
        case travel_start_day = "travel_start_day"
        case travel_end_day = "travel_end_day"
        case number_of_travelers = "number_of_travelers"
        case web_form_travel_duration = "web_form_travel_duration"
        case web_form_travel_duration_days_min = "web_form_travel_duration_days_min"
        case web_form_travel_duration_days_max = "web_form_travel_duration_days_max"
        case preferredCurrency = "preferredCurrency"
        case notes = "notes"
        case service_level_agreement_due_at = "service_level_agreement_due_at"
        case pricing = "pricing"
        case offer = "offer"
        case source = "source"
        case createdAt = "createdAt"
        case updatedAt = "updatedAt"
        }

    }


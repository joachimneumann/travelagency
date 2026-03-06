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


        private enum CodingKeys: String, CodingKey {

        }
    }

    struct GeneratedBookingActivity: Codable, Equatable {


        private enum CodingKeys: String, CodingKey {

        }
    }

    struct GeneratedBookingInvoice: Codable, Equatable {


        private enum CodingKeys: String, CodingKey {

        }
    }

    struct GeneratedBookingPricing: Codable, Equatable {


        private enum CodingKeys: String, CodingKey {

        }
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
    let bookingHash: String?
    let customerId: String
    let stage: GeneratedBookingStage
    let atp_staff: String?
    let atpStaffName: String?
    let destination: String?
    let style: String?
    let travelMonth: String?
    let travelers: Int?
    let duration: String?
    let budget: String?
    let preferredCurrency: GeneratedCurrencyCode?
    let notes: String?
    let pricing: GeneratedBookingPricing
    let offer: GeneratedBookingOffer
    let source: GeneratedSourceAttribution?
    let createdAt: String
    let updatedAt: String

        private enum CodingKeys: String, CodingKey {
        case id = "id"
        case bookingHash = "bookingHash"
        case customerId = "customerId"
        case stage = "stage"
        case atp_staff = "atp_staff"
        case atpStaffName = "atpStaffName"
        case destination = "destination"
        case style = "style"
        case travelMonth = "travelMonth"
        case travelers = "travelers"
        case duration = "duration"
        case budget = "budget"
        case preferredCurrency = "preferredCurrency"
        case notes = "notes"
        case pricing = "pricing"
        case offer = "offer"
        case source = "source"
        case createdAt = "createdAt"
        case updatedAt = "updatedAt"
        }
    }


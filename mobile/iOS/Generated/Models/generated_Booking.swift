    import Foundation

    // Generated from the normalized model IR exported from model/ir.
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

    struct GeneratedSourceAttribution: Codable, Equatable {
        let pageURL: String?
        let ipAddress: String?
        let ipCountryGuess: String?
        let utmSource: String?
        let utmMedium: String?
        let utmCampaign: String?
        let referrer: String?

        private enum CodingKeys: String, CodingKey {
            case pageURL = "page_url"
            case ipAddress = "ip_address"
            case ipCountryGuess = "ip_country_guess"
            case utmSource = "utm_source"
            case utmMedium = "utm_medium"
            case utmCampaign = "utm_campaign"
            case referrer
        }
    }

    struct GeneratedBookingPricingAdjustment: Codable, Identifiable, Equatable {
        let id: String
        let type: GeneratedPricingAdjustmentType
        let label: String
        let amountCents: Int
        let notes: String?

        private enum CodingKeys: String, CodingKey {
            case id
            case type
            case label
            case amountCents = "amount_cents"
            case notes
        }
    }

    struct GeneratedBookingPayment: Codable, Identifiable, Equatable {
        let id: String
        let label: String
        let dueDate: String?
        let netAmountCents: Int
        let taxRateBasisPoints: Int
        let taxAmountCents: Int
        let grossAmountCents: Int
        let status: GeneratedPaymentStatus
        let paidAt: String?
        let notes: String?

        private enum CodingKeys: String, CodingKey {
            case id
            case label
            case dueDate = "due_date"
            case netAmountCents = "net_amount_cents"
            case taxRateBasisPoints = "tax_rate_basis_points"
            case taxAmountCents = "tax_amount_cents"
            case grossAmountCents = "gross_amount_cents"
            case status
            case paidAt = "paid_at"
            case notes
        }
    }

    struct GeneratedBookingPricingSummary: Codable, Equatable {
        let agreedNetAmountCents: Int
        let adjustmentsDeltaCents: Int
        let adjustedNetAmountCents: Int
        let scheduledNetAmountCents: Int
        let unscheduledNetAmountCents: Int
        let scheduledTaxAmountCents: Int
        let scheduledGrossAmountCents: Int
        let paidGrossAmountCents: Int
        let outstandingGrossAmountCents: Int
        let isScheduleBalanced: Bool

        private enum CodingKeys: String, CodingKey {
            case agreedNetAmountCents = "agreed_net_amount_cents"
            case adjustmentsDeltaCents = "adjustments_delta_cents"
            case adjustedNetAmountCents = "adjusted_net_amount_cents"
            case scheduledNetAmountCents = "scheduled_net_amount_cents"
            case unscheduledNetAmountCents = "unscheduled_net_amount_cents"
            case scheduledTaxAmountCents = "scheduled_tax_amount_cents"
            case scheduledGrossAmountCents = "scheduled_gross_amount_cents"
            case paidGrossAmountCents = "paid_gross_amount_cents"
            case outstandingGrossAmountCents = "outstanding_gross_amount_cents"
            case isScheduleBalanced = "is_schedule_balanced"
        }
    }

    struct GeneratedBookingPricing: Codable, Equatable {
        let currency: GeneratedCurrencyCode
        let agreedNetAmountCents: Int
        let adjustments: [GeneratedBookingPricingAdjustment]
        let payments: [GeneratedBookingPayment]
        let summary: GeneratedBookingPricingSummary

        private enum CodingKeys: String, CodingKey {
            case currency
            case agreedNetAmountCents = "agreed_net_amount_cents"
            case adjustments
            case payments
            case summary
        }
    }

    struct GeneratedInvoiceLineItem: Codable, Identifiable, Equatable {
        let id: String
        let description: String
        let quantity: Int
        let unitAmountCents: Int
        let totalAmountCents: Int

        private enum CodingKeys: String, CodingKey {
            case id
            case description
            case quantity
            case unitAmountCents = "unit_amount_cents"
            case totalAmountCents = "total_amount_cents"
        }
    }

    struct GeneratedBookingInvoice: Codable, Identifiable, Equatable {
        let id: String
        let currency: GeneratedCurrencyCode
        let status: String
        let dueAmountCents: Int
        let notes: String?
        let items: [GeneratedInvoiceLineItem]

        private enum CodingKeys: String, CodingKey {
            case id
            case currency
            case status
            case dueAmountCents = "due_amount_cents"
            case notes
            case items
        }
    }

    struct GeneratedBookingActivity: Codable, Identifiable, Equatable {
        let id: String
        let type: String
        let createdAt: String
        let note: String?

        private enum CodingKeys: String, CodingKey {
            case id
            case type
            case createdAt = "created_at"
            case note
        }
    }

    struct GeneratedBooking: Codable, Identifiable, Equatable {
        let id: String
        let customerId: String?
        let customerName: String?
        let destination: String
        let style: String
        let travelMonth: String?
        let travelers: Int?
        let duration: String?
        let budget: String?
        let stage: GeneratedBookingStage
        let assignedStaffId: String?
        let assignedStaffName: String?
        let notes: String?
        let source: GeneratedSourceAttribution?
        let bookingHash: String?
        let pricing: GeneratedBookingPricing?

        private enum CodingKeys: String, CodingKey {
            case id
            case customerId = "customer_id"
            case customerName = "customer_name"
            case destination
            case style
            case travelMonth = "travel_month"
            case travelers
            case duration
            case budget
            case stage
            case assignedStaffId = "staff"
            case assignedStaffName = "staff_name"
            case notes
            case source
            case bookingHash = "booking_hash"
            case pricing
        }
    }

    extension GeneratedBooking {
        var staffId: String? { assignedStaffId }
        var staffName: String? { assignedStaffName }
    }

typealias BookingStage = GeneratedBookingStage
typealias PaymentStatus = GeneratedPaymentStatus
typealias PricingAdjustmentType = GeneratedPricingAdjustmentType
typealias SourceAttribution = GeneratedSourceAttribution
typealias BookingPricingAdjustment = GeneratedBookingPricingAdjustment
typealias BookingPayment = GeneratedBookingPayment
typealias BookingPricingSummary = GeneratedBookingPricingSummary
typealias BookingPricing = GeneratedBookingPricing
typealias InvoiceLineItem = GeneratedInvoiceLineItem
typealias BookingInvoice = GeneratedBookingInvoice
typealias BookingActivity = GeneratedBookingActivity
typealias Booking = GeneratedBooking

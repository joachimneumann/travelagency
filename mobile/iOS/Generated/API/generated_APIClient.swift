    import Foundation

    // Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

    enum GeneratedAPIEndpointKey: String, CaseIterable {
    case mobileBootstrap
    case authMe
    case publicBookings
    case bookings
    case bookingDetail
    case bookingChat
    case bookingStage
    case bookingAssignment
    case bookingNote
    case bookingPricing
    case bookingOffer
    case bookingActivities
    case bookingInvoices
    case atpStaff
    case customers
    case customerDetail
}

    enum GeneratedAPIClientMethod {
        static func httpMethod(for endpoint: GeneratedAPIEndpointKey) -> String {
        switch endpoint {
        case .mobileBootstrap: return "GET"
        case .authMe: return "GET"
        case .publicBookings: return "POST"
        case .bookings: return "GET"
        case .bookingDetail: return "GET"
        case .bookingChat: return "GET"
        case .bookingStage: return "PATCH"
        case .bookingAssignment: return "PATCH"
        case .bookingNote: return "PATCH"
        case .bookingPricing: return "PATCH"
        case .bookingOffer: return "PATCH"
        case .bookingActivities: return "GET"
        case .bookingInvoices: return "GET"
        case .atpStaff: return "GET"
        case .customers: return "GET"
        case .customerDetail: return "GET"
        }
    }
}

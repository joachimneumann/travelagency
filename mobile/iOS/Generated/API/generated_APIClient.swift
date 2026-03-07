    import Foundation

    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    enum GeneratedAPIEndpointKey: String, CaseIterable {
    case mobileBootstrap
    case authMe
    case publicBookings
    case publicTours
    case bookings
    case bookingDetail
    case bookingChat
    case bookingStage
    case bookingAssignment
    case bookingNote
    case bookingClient
    case bookingGroupMembers
    case bookingPricing
    case bookingOffer
    case bookingActivities
    case bookingInvoices
    case atpStaff
    case customers
    case customerDetail
    case customerUpdate
    case customerPhotoUpload
    case customerConsentCreate
    case travelGroups
    case travelGroupCreate
    case travelGroupDetail
    case travelGroupUpdate
    case tours
    case tourDetail
    case tourImage
    }

    enum GeneratedAPIClientMethod {
        static func httpMethod(for endpoint: GeneratedAPIEndpointKey) -> String {
            switch endpoint {
        case .mobileBootstrap: return "GET"
        case .authMe: return "GET"
        case .publicBookings: return "POST"
        case .publicTours: return "GET"
        case .bookings: return "GET"
        case .bookingDetail: return "GET"
        case .bookingChat: return "GET"
        case .bookingStage: return "PATCH"
        case .bookingAssignment: return "PATCH"
        case .bookingNote: return "PATCH"
        case .bookingClient: return "PATCH"
        case .bookingGroupMembers: return "POST"
        case .bookingPricing: return "PATCH"
        case .bookingOffer: return "PATCH"
        case .bookingActivities: return "GET"
        case .bookingInvoices: return "GET"
        case .atpStaff: return "GET"
        case .customers: return "GET"
        case .customerDetail: return "GET"
        case .customerUpdate: return "PATCH"
        case .customerPhotoUpload: return "POST"
        case .customerConsentCreate: return "POST"
        case .travelGroups: return "GET"
        case .travelGroupCreate: return "POST"
        case .travelGroupDetail: return "GET"
        case .travelGroupUpdate: return "PATCH"
        case .tours: return "GET"
        case .tourDetail: return "GET"
        case .tourImage: return "GET"
            }
        }
    }

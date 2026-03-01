import Foundation

struct BookingInvoicesResponse: Decodable {
    let items: [BookingInvoice]
    let total: Int?
}

struct BookingInvoice: Codable, Identifiable, Equatable {
    let id: String
    let invoiceNumber: String?
    let totalAmountCents: Int?
    let currency: String?
    let sentToCustomer: Bool?
    let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case invoiceNumber = "invoice_number"
        case totalAmountCents = "total_amount_cents"
        case currency
        case sentToCustomer = "sent_to_customer"
        case updatedAt = "updated_at"
    }
}

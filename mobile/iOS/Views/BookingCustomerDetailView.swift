import SwiftUI

struct BookingCustomerDetailView: View {
    let customer: Customer

    var body: some View {
        Form {
            Section("Customer") {
                LabeledContent("Name", value: customer.name)
                if let title = customer.title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    LabeledContent("Title", value: title)
                }
                LabeledContent("Email", value: customer.email ?? "-")
                LabeledContent("Phone", value: customer.phone_number ?? "-")
                LabeledContent("Language", value: customer.preferred_language ?? "-")
            }
        }
        .navigationTitle("Customer")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

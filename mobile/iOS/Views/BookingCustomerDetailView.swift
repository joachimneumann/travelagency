import SwiftUI

struct BookingCustomerDetailView: View {
    let customer: Customer

    var body: some View {
        Form {
            Section("Customer") {
                LabeledContent("Name", value: customer.name ?? "-")
                LabeledContent("Email", value: customer.email ?? "-")
                LabeledContent("Phone", value: customer.phone ?? "-")
                LabeledContent("Language", value: customer.language ?? "-")
            }
        }
        .navigationTitle("Customer")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

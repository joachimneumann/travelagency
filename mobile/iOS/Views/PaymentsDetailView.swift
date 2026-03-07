import SwiftUI

struct PaymentsDetailView: View {
    let pricing: BookingPricing

    var body: some View {
        Form {
            Section("Payments") {
                Text("Detailed payment schedules are not available in the current mobile API contract.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Payments")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

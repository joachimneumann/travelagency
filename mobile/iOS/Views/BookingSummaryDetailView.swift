import SwiftUI

struct BookingSummaryDetailView: View {
    let booking: Booking

    var body: some View {
        let destinations = booking.destination ?? []
        let styles = booking.style ?? []

        List {
            Section("Booking") {
                LabeledContent("Booking ID", value: booking.id)
                LabeledContent("Stage", value: booking.stage.rawValue)
                LabeledContent("Destination", value: destinations.isEmpty ? "—" : destinations.joined(separator: ", "))
                LabeledContent("Style", value: styles.isEmpty ? "—" : styles.joined(separator: ", "))
                if let web_form_travel_month = booking.web_form_travel_month, !web_form_travel_month.isEmpty {
                    LabeledContent("Travel Month", value: web_form_travel_month)
                }
                if let travelers = booking.number_of_travelers {
                    LabeledContent("Travelers", value: String(travelers))
                }
                LabeledContent("ATP staff", value: booking.atp_staff_name ?? "Unassigned")
            }
        }
        .navigationTitle("Booking")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

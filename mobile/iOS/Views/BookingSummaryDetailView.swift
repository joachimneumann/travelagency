import SwiftUI

struct BookingSummaryDetailView: View {
    let booking: Booking

    var body: some View {
        let destinations = (booking.destinations ?? []).map(\.rawValue)
        let styles = booking.travel_styles ?? []
        let submission = booking.web_form_submission

        List {
            Section("Booking") {
                LabeledContent("Booking ID", value: booking.id)
                LabeledContent("Stage", value: booking.stage.rawValue)
                LabeledContent("Destinations", value: destinations.isEmpty ? "—" : destinations.joined(separator: ", "))
                LabeledContent("Travel styles", value: styles.isEmpty ? "—" : styles.joined(separator: ", "))
                if let travelMonth = submission?.travel_month, !travelMonth.isEmpty {
                    LabeledContent("Travel Month", value: travelMonth)
                }
                if let travelers = submission?.number_of_travelers {
                    LabeledContent("Travelers", value: String(travelers))
                }
                LabeledContent("ATP staff", value: booking.atp_staff_name ?? "Unassigned")
            }
        }
        .navigationTitle("Booking")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

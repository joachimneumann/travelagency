import SwiftUI

struct BookingSummaryDetailView: View {
    let booking: Booking

    var body: some View {
        let destinations = booking.destination ?? []
        let styles = booking.style ?? []

        Form {
            Section("Booking") {
                LabeledContent("Booking ID", value: booking.id)
                LabeledContent("Stage", value: booking.stage.rawValue)
                LabeledContent("Destination", value: destinations.isEmpty ? "—" : destinations.joined(separator: ", "))
                LabeledContent("Style", value: styles.isEmpty ? "—" : styles.joined(separator: ", "))
                if let travelMonth = booking.travelMonth, !travelMonth.isEmpty {
                    LabeledContent("Travel Month", value: travelMonth)
                }
                if let travelers = booking.number_of_travelers {
                    LabeledContent("Travelers", value: String(travelers))
                }
                if let duration = booking.duration, !duration.isEmpty {
                    LabeledContent("Duration", value: duration)
                }
                if let budget = booking.budget, !budget.isEmpty {
                    LabeledContent("Budget", value: budget)
                }
                LabeledContent("ATP staff", value: booking.atp_staff_name ?? "Unassigned")
            }
        }
        .navigationTitle("Booking")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

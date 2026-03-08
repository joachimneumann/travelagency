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
                if let travelDuration = booking.travel_duration, !travelDuration.isEmpty {
                    LabeledContent("Travel duration", value: travelDuration)
                }
                if let budgetRange = formatBudgetRange(lower: booking.budget_lower_USD, upper: booking.budget_upper_USD) {
                    LabeledContent("Budget (USD)", value: budgetRange)
                }
                LabeledContent("ATP staff", value: booking.atp_staff_name ?? "Unassigned")
            }
        }
        .navigationTitle("Booking")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }

    private func formatBudgetRange(lower: Int?, upper: Int?) -> String? {
        if let lower, let upper {
            return "$\(lower)-$\(upper)"
        }
        if let lower {
            return "$\(lower)+"
        }
        if let upper {
            return "Up to $\(upper)"
        }
        return nil
    }
}

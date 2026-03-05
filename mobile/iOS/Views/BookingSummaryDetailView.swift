import SwiftUI

struct BookingSummaryDetailView: View {
    let booking: Booking

    var body: some View {
        Form {
            Section("Booking") {
                LabeledContent("Booking ID", value: booking.id)
                LabeledContent("Stage", value: booking.stage.rawValue)
                LabeledContent("Destination", value: booking.destination.isEmpty ? "—" : booking.destination)
                LabeledContent("Style", value: booking.style.isEmpty ? "—" : booking.style)
                if let travelMonth = booking.travelMonth, !travelMonth.isEmpty {
                    LabeledContent("Travel Month", value: travelMonth)
                }
                if let travelers = booking.travelers {
                    LabeledContent("Travelers", value: String(travelers))
                }
                if let duration = booking.duration, !duration.isEmpty {
                    LabeledContent("Duration", value: duration)
                }
                if let budget = booking.budget, !budget.isEmpty {
                    LabeledContent("Budget", value: budget)
                }
                if let source = booking.source, let pageURL = source.pageURL, !pageURL.isEmpty {
                    LabeledContent("Source", value: pageURL)
                }
                LabeledContent("Atp Staff", value: booking.assignedStaffName ?? "Unassigned")
            }
        }
        .navigationTitle("Booking")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

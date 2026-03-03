import SwiftUI

struct ActivitiesDetailView: View {
    let activities: [BookingActivity]

    var body: some View {
        Form {
            if activities.isEmpty {
                Section {
                    Text("No activities yet")
                        .foregroundStyle(.secondary)
                }
            } else {
                Section("Activities") {
                    ForEach(activities) { activity in
                        ActivityRowView(activity: activity)
                    }
                }
            }
        }
        .navigationTitle("Activities")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

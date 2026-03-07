import SwiftUI

struct ActivityRowView: View {
    let activity: BookingActivity

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(activity.type.rawValue)
                .font(.headline)
            Text(activity.detail)
                .font(.body)
            if !activity.actor.isEmpty {
                Text(activity.actor)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Text(activity.createdAt)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

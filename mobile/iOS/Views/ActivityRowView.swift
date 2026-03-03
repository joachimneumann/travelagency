import SwiftUI

struct ActivityRowView: View {
    let activity: BookingActivity

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(activity.type)
                .font(.headline)
            if let note = activity.note, !note.isEmpty {
                Text(note)
                    .font(.body)
            }
            Text(activity.createdAt)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

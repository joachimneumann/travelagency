import SwiftUI

struct TravelGroupsListView: View {
    var body: some View {
        List {
            Section {
                Text("Travel groups are managed in customer/booking workflows for now.")
                    .foregroundStyle(.secondary)
            } header: {
                Text("No travel group list endpoint in this app yet.")
            }
        }
        .navigationTitle("Travel Groups")
        .navigationBarTitleDisplayMode(.inline)
    }
}

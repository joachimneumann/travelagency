import SwiftUI

struct TravelGroupsListView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = TravelGroupsViewModel()

    var body: some View {
        content
        .navigationTitle("Travel Groups")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard let session = await sessionStore.validSession() else { return }
            await viewModel.load(session: session)
        }
        .alert("Travel Groups", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.groups.isEmpty {
            ProgressView("Loading travel groups...")
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else {
            List {
                if viewModel.groups.isEmpty {
                    Section {
                        Text("No travel groups yet")
                            .foregroundStyle(.secondary)
                    }
                }
                ForEach(viewModel.groups, id: \.id) { group in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(group.group_name)
                            .font(.headline)
                        Text(verbatim: group.client_id)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .padding(.vertical, 2)
                }
            }
            .listStyle(.plain)
            .refreshable {
                if let session = await sessionStore.validSession() {
                    await viewModel.load(session: session)
                }
            }
        }
    }
}

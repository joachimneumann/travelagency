import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 10) {
                Image("BrandLogo")
                    .resizable()
                    .scaledToFit()
                    .padding()
                    .padding(.trailing, 10)
            }
            .frame(maxWidth: .infinity)

            Button {
                Task { await viewModel.login(sessionStore: sessionStore) }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Log in")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(viewModel.isLoading)
            .controlSize(.large)
            .frame(maxWidth: 360)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 24)
    }
}

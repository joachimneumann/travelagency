import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image("BrandLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 116, height: 116)

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
            Spacer()
        }
        .padding(24)
    }
}

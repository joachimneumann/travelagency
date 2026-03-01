import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 16) {
            Image("BrandLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .padding(.top, 32)

            Button {
                Task { await viewModel.login(sessionStore: sessionStore) }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Log in")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(viewModel.isLoading)
            .controlSize(.small)
        }
        .frame(maxWidth: 320)
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 12)
    }
}

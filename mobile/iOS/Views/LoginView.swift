import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 20) {
                Image("BrandLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: proxy.size.width * 0.7)

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
                .controlSize(.regular)
                .frame(maxWidth: 360)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 24)
        }
    }
}

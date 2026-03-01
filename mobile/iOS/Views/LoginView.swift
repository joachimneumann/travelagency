import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 28) {
            HStack(spacing: 16) {
                Image("BrandMark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 72, height: 72)

                VStack(alignment: .leading, spacing: 4) {
                    Text("AsiaTravelPlan")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(Color(red: 22 / 255, green: 48 / 255, blue: 64 / 255))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)

                    Text("Southeast Asia Travel")
                        .font(.headline)
                        .foregroundStyle(Color(red: 75 / 255, green: 105 / 255, blue: 120 / 255))
                }
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

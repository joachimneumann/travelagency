import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "airplane.circle.fill")
                .font(.system(size: 54))
                .foregroundStyle(.teal)
            Text("AsiaTravelPlan")
                .font(.largeTitle.bold())
            Text("Internal mobile access for bookings")
                .foregroundStyle(.secondary)

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

            Text("Allowed roles: atp_admin, atp_manager, atp_accountant, atp_staff")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(24)
    }
}

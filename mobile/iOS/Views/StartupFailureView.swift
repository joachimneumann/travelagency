import SwiftUI

struct StartupFailureView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 46))
                .foregroundStyle(.red)
            Text("Startup failed")
                .font(.title.bold())
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Retry", action: retry)
                .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(24)
    }
}

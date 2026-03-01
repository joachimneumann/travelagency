import SwiftUI

struct UpdateRequiredView: View {
    let bootstrap: MobileBootstrapResponse

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "arrow.down.app.fill")
                .font(.system(size: 40))
                .foregroundStyle(.orange)
            Text("Please update")
                .font(.title2.bold())
            Text("This app build is no longer supported. Install the latest version before continuing.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) {
                LabeledContent("Installed", value: AppConfig.currentAppVersion)
                LabeledContent("Minimum", value: bootstrap.app.minSupportedVersion)
                LabeledContent("Latest", value: bootstrap.app.latestVersion)
                LabeledContent("Contract", value: bootstrap.api.contractVersion)
            }
            .padding(16)
            .background(Color.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
            Spacer()
        }
        .padding(24)
    }
}

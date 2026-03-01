import SwiftUI

struct UpdateRequiredView: View {
    let bootstrap: MobileBootstrapResponse

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "arrow.down.app.fill")
                .font(.system(size: 32))
                .foregroundStyle(.orange)
            Text("Please update")
                .font(.headline.bold())
            Text("This app build is no longer supported. Install the latest version before continuing.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) {
                LabeledContent("Installed", value: AppConfig.currentAppVersion)
                LabeledContent("Minimum", value: bootstrap.app.minSupportedVersion)
                LabeledContent("Latest", value: bootstrap.app.latestVersion)
                LabeledContent("Contract", value: bootstrap.api.contractVersion)
            }
            .font(.footnote)
            .padding(12)
            .background(Color.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        }
        .frame(maxWidth: 340)
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 12)
    }
}

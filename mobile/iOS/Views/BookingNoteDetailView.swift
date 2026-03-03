import SwiftUI

struct BookingNoteDetailView: View {
    @Binding var noteDraft: String
    let originalNote: String
    let isEditable: Bool
    let onSave: () -> Void

    var body: some View {
        Form {
            Section("Notes") {
                TextEditor(text: $noteDraft)
                    .frame(minHeight: 220)
                    .disabled(!isEditable)

                Button("Save Note") {
                    onSave()
                }
                .disabled(!isEditable || noteDraft == originalNote)
            }
        }
        .navigationTitle("Notes")
        .modifier(InlineNavigationTitleDisplayModeModifier())
    }
}

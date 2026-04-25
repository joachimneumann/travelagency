export function createBookingStyleDirtyBarController({
  els,
  backendT,
  readState,
  getDirtySectionLabels,
  getNoticeLabels,
  onSave,
  onDiscard,
  onBack
} = {}) {
  function bind() {
    els?.saveEditsBtn?.addEventListener("click", () => {
      onSave?.();
    });
    els?.discardEditsBtn?.addEventListener("click", () => {
      onDiscard?.();
    });
    els?.backBtn?.addEventListener("click", () => {
      onBack?.();
    });
  }

  function render() {
    if (!els?.dirtyBar || !els?.dirtyBarSummary || !els?.saveEditsBtn || !els?.discardEditsBtn) return;
    const labels = typeof getDirtySectionLabels === "function" ? getDirtySectionLabels() : [];
    const notices = typeof getNoticeLabels === "function" ? getNoticeLabels() : [];
    const barState = typeof readState === "function" ? readState() : {};
    const isDirty = labels.length > 0;
    const isSaving = barState.saving === true;
    const isDiscarding = barState.discarding === true;
    const isBusy = isSaving || isDiscarding;

    els.dirtyBar.classList.toggle("booking-dirty-bar--dirty", isDirty);
    els.dirtyBar.hidden = false;

    if (els.dirtyBarTitle) {
      if (isSaving) {
        els.dirtyBarTitle.textContent = backendT("booking.page_save.saving", "Saving edits...");
      } else if (isDiscarding) {
        els.dirtyBarTitle.textContent = backendT("booking.page_discard.running", "Discarding edits...");
      } else if (isDirty) {
        els.dirtyBarTitle.textContent = backendT("booking.page_save.unsaved", "Unsaved edits");
      } else if (barState.status === "saved") {
        els.dirtyBarTitle.textContent = backendT("booking.page_save.saved", "All edits saved");
      } else if (barState.status === "discarded") {
        els.dirtyBarTitle.textContent = backendT("booking.page_discard.saved", "All edits reverted");
      } else {
        els.dirtyBarTitle.textContent = backendT("booking.page_save.clean", "No unsaved edits");
      }
    }

    const summaryParts = [];
    if (isDirty) {
      summaryParts.push(backendT("booking.page_save.summary", "Changed sections: {sections}", { sections: labels.join(", ") }));
    }
    els.dirtyBarSummary.textContent = "";
    if (summaryParts.length) {
      els.dirtyBarSummary.append(document.createTextNode(summaryParts.join(" · ")));
    }
    for (const notice of notices) {
      const pill = document.createElement("span");
      pill.className = "booking-dirty-bar__notice-pill";
      pill.textContent = String(notice || "");
      els.dirtyBarSummary.append(pill);
    }

    if (els.saveErrorHint) {
      els.saveErrorHint.textContent = String(barState.error || "");
    }

    els.saveEditsBtn.disabled = isBusy || !isDirty;
    els.discardEditsBtn.disabled = isBusy || !isDirty;
  }

  return {
    bind,
    render
  };
}

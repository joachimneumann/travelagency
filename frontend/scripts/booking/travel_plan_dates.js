import { bookingT } from "./i18n.js";

export function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

export function formatIsoLocalDate(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextIsoDate(value) {
  const raw = String(value || "").trim();
  if (!isIsoDateString(raw)) return "";
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + 1);
  return formatIsoLocalDate(date);
}

export function deriveNextTravelPlanDayDate(days) {
  const items = Array.isArray(days) ? days : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const candidate = nextIsoDate(items[index]?.date);
    if (candidate) return candidate;
  }
  return "";
}

export function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function alignDateTimeLocalValue(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return raw;
  const date = new Date(`${match[1]}T${match[2]}:${match[3]}:00`);
  if (Number.isNaN(date.getTime())) return raw;
  date.setSeconds(0, 0);
  date.setMinutes(Math.round(date.getMinutes() / 5) * 5);
  return formatDateTimeLocal(date);
}

export function toDateTimeLocalValue(dayDate, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoDateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (isoDateTimeMatch) return alignDateTimeLocalValue(isoDateTimeMatch[1]);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) return alignDateTimeLocalValue(raw.replace(" ", "T"));
  if (/^\d{2}:\d{2}$/.test(raw) && String(dayDate || "").trim()) {
    return alignDateTimeLocalValue(`${String(dayDate).trim()}T${raw}`);
  }
  return "";
}

export function splitDateTimeValue(dayDate, value) {
  const aligned = toDateTimeLocalValue(dayDate, value);
  const match = aligned.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!match) {
    return {
      date: String(dayDate || "").trim(),
      time: ""
    };
  }
  return {
    date: match[1],
    time: match[2]
  };
}

export function combineDateAndTime(dateValue, timeValue) {
  const date = String(dateValue || "").trim();
  const time = String(timeValue || "").trim();
  if (!date || !time) return "";
  return alignDateTimeLocalValue(`${date}T${time}`);
}

export function isValidIsoCalendarDate(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function getTravelPlanDateValidationMessage(value, { allowPartial = false } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (allowPartial && normalized.length < 10) return "";
  if (!isValidIsoCalendarDate(normalized)) {
    return bookingT("booking.travel_plan.date_invalid", "Use YYYY-MM-DD, for example 1963-08-20.");
  }
  return "";
}

export function renderTravelPlanDateInput({ escapeHtml, id, dataAttribute, value = "", disabled = false, ariaLabel = "" }) {
  return `
      <div class="booking-person-modal__date-input travel-plan-date-input">
        <input
          id="${escapeHtml(id)}"
          class="travel-plan-date-input__text"
          data-travel-plan-date-text="true"
          ${dataAttribute}
          type="text"
          inputmode="numeric"
          spellcheck="false"
          placeholder="YYYY-MM-DD"
          pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
          maxlength="10"
          value="${escapeHtml(value || "")}"
          ${disabled ? "disabled" : ""}
          ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ""}
        />
        <button
          class="booking-person-modal__date-picker-btn travel-plan-date-input__picker-btn"
          data-travel-plan-date-picker-btn="${escapeHtml(id)}"
          type="button"
          aria-label="${escapeHtml(bookingT("booking.open_date_picker", "Open date picker"))}"
          ${disabled ? "disabled" : ""}
        >📅</button>
        <input
          id="${escapeHtml(`${id}_picker`)}"
          type="date"
          tabindex="-1"
          aria-hidden="true"
          class="booking-person-modal__date-picker-proxy"
          data-travel-plan-date-picker-for="${escapeHtml(id)}"
          ${disabled ? "disabled" : ""}
        />
      </div>
      <div class="error" data-travel-plan-date-error="${escapeHtml(id)}"></div>
    `;
}

export function setTravelPlanDateFieldValidation(textInput, message) {
  const field = textInput?.closest(".field");
  if (field instanceof HTMLElement) field.classList.toggle("invalid", Boolean(message));
  const errorNode = field?.querySelector(`[data-travel-plan-date-error="${textInput?.id || ""}"]`);
  if (errorNode instanceof HTMLElement) {
    errorNode.textContent = message || "";
  }
}

export function syncTravelPlanDatePickerValue(textInput, pickerInput) {
  if (!(textInput instanceof HTMLInputElement) || !(pickerInput instanceof HTMLInputElement)) return;
  const normalized = String(textInput.value || "").trim();
  pickerInput.value = isValidIsoCalendarDate(normalized) ? normalized : "";
}

export function validateTravelPlanDateTextInput(textInput, { allowPartial = false } = {}) {
  if (!(textInput instanceof HTMLInputElement)) return true;
  const message = getTravelPlanDateValidationMessage(textInput.value, { allowPartial });
  setTravelPlanDateFieldValidation(textInput, message);
  const pickerInput = document.getElementById(`${textInput.id}_picker`);
  if (pickerInput instanceof HTMLInputElement) {
    syncTravelPlanDatePickerValue(textInput, pickerInput);
  }
  return !message;
}

export function applyTravelPlanDatePickerValue(pickerInput) {
  if (!(pickerInput instanceof HTMLInputElement)) return null;
  const targetId = String(pickerInput.getAttribute("data-travel-plan-date-picker-for") || "").trim();
  const textInput = targetId ? document.getElementById(targetId) : null;
  if (!(textInput instanceof HTMLInputElement)) return null;
  textInput.value = String(pickerInput.value || "").trim();
  validateTravelPlanDateTextInput(textInput, { allowPartial: false });
  return textInput;
}

export function openTravelPlanDatePicker(button) {
  const targetId = String(button?.getAttribute("data-travel-plan-date-picker-btn") || "").trim();
  const pickerInput = targetId ? document.getElementById(`${targetId}_picker`) : null;
  const textInput = targetId ? document.getElementById(targetId) : null;
  if (!(pickerInput instanceof HTMLInputElement) || pickerInput.disabled) return;
  if (textInput instanceof HTMLInputElement) {
    syncTravelPlanDatePickerValue(textInput, pickerInput);
  }
  if (typeof pickerInput.showPicker === "function") {
    try {
      pickerInput.showPicker();
      return;
    } catch {
      // Fall through.
    }
  }
  pickerInput.focus();
  pickerInput.click();
}

export function validateTravelPlanDateFieldsInDom(root, { allowPartial = false, focusFirstInvalid = false } = {}) {
  if (!root) return { ok: true, message: "" };
  const dateInputs = Array.from(root.querySelectorAll('[data-travel-plan-date-text="true"]'));
  let firstInvalid = null;
  for (const textInput of dateInputs) {
    const isValid = validateTravelPlanDateTextInput(textInput, { allowPartial });
    if (!isValid && !firstInvalid) {
      firstInvalid = textInput;
    }
  }
  if (focusFirstInvalid && firstInvalid instanceof HTMLInputElement) {
    firstInvalid.focus();
  }
  return {
    ok: !firstInvalid,
    message: firstInvalid
      ? getTravelPlanDateValidationMessage(firstInvalid.value, { allowPartial: false })
      : ""
  };
}

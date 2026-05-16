const MODAL_ID = "englishTextGuardModal";
const MODAL_TITLE_ID = "englishTextGuardModalTitle";
const MODAL_DESCRIPTION_ID = "englishTextGuardModalDescription";
const MODAL_FIELD_ID = "englishTextGuardModalField";
const INVALID_CLASS = "english-text-guard--invalid";
const FIELD_TYPES_WITH_TEXT = new Set([
  "",
  "email",
  "search",
  "tel",
  "text",
  "url"
]);

const VIETNAMESE_DIACRITIC_PATTERN = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const VIETNAMESE_PHRASE_PATTERN = /\b(?:an trua|an toi|bao gom|buoi chieu|buoi sang|chuyen bay|don khach|du khach|du lich|gia tour|huong dan vien|khach san|khong bao gom|ngay dau|ngay thu|nhan phong|san bay|tham quan|tra phong)\b/i;
const VIETNAMESE_FUNCTION_WORDS = new Set([
  "anh",
  "ban",
  "bạn",
  "bao",
  "buoi",
  "buổi",
  "cac",
  "các",
  "cho",
  "chung",
  "chúng",
  "cua",
  "của",
  "den",
  "đến",
  "di",
  "đi",
  "duoc",
  "được",
  "hai",
  "hoac",
  "hoặc",
  "khach",
  "khách",
  "khi",
  "khong",
  "không",
  "la",
  "là",
  "mot",
  "một",
  "nay",
  "này",
  "nen",
  "nên",
  "neu",
  "nếu",
  "ngay",
  "ngày",
  "nhung",
  "những",
  "phai",
  "phải",
  "sau",
  "se",
  "sẽ",
  "tai",
  "tại",
  "tham",
  "thì",
  "toi",
  "tôi",
  "trong",
  "truoc",
  "trước",
  "tu",
  "từ",
  "va",
  "và",
  "ve",
  "về",
  "voi",
  "với"
]);

let initialized = false;
let modalPreviouslyFocusedElement = null;
const pendingChecks = new WeakMap();
const lastWarnedValues = new WeakMap();

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLang(value) {
  return normalizeText(value).toLowerCase().replace(/^english$/, "en");
}

function stripVietnameseMarks(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function wordTokens(value) {
  return normalizeText(value).match(/[\p{L}\p{M}]+/gu) || [];
}

export function isLikelyVietnameseText(value) {
  const text = normalizeText(value);
  if (!text) return false;
  const tokens = wordTokens(text);
  if (tokens.length < 2) return false;

  const lowerText = stripVietnameseMarks(text);
  if (VIETNAMESE_PHRASE_PATTERN.test(lowerText)) return true;

  let diacriticWordCount = 0;
  let functionWordCount = 0;

  tokens.forEach((token) => {
    const normalizedToken = stripVietnameseMarks(token);
    const rawToken = normalizeText(token).toLowerCase();
    if (VIETNAMESE_DIACRITIC_PATTERN.test(rawToken)) diacriticWordCount += 1;
    if (VIETNAMESE_FUNCTION_WORDS.has(rawToken) || VIETNAMESE_FUNCTION_WORDS.has(normalizedToken)) {
      functionWordCount += 1;
    }
  });

  if (!diacriticWordCount && functionWordCount < 3) return false;
  if (tokens.length <= 7) return functionWordCount >= 2 || (diacriticWordCount >= 2 && functionWordCount >= 1);
  return functionWordCount >= 3 || (diacriticWordCount >= 3 && functionWordCount >= 2);
}

function isTextInput(element) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return FIELD_TYPES_WITH_TEXT.has(normalizeText(element.type).toLowerCase());
}

function isEnglishExpectedField(element) {
  if (!isTextInput(element) || element.disabled || element.readOnly) return false;
  if (element.hasAttribute("data-english-text") && !normalizeText(element.getAttribute("data-english-text"))) return true;
  const expectedLanguage = normalizeLang(
    element.getAttribute("data-expected-language")
      || element.getAttribute("data-language-guard")
      || element.getAttribute("data-english-text")
  );
  if (expectedLanguage === "en" || expectedLanguage === "english" || expectedLanguage === "true") return true;

  const localizedRole = normalizeText(element.getAttribute("data-localized-role")).toLowerCase();
  const localizedLang = normalizeLang(element.getAttribute("data-localized-lang"));
  if (localizedRole === "source" && localizedLang === "en") return true;

  const tourLang = normalizeLang(element.getAttribute("data-tour-i18n-lang"));
  if (tourLang === "en") return true;

  return false;
}

function setFieldWarningState(element, isInvalid) {
  element.classList.toggle(INVALID_CLASS, isInvalid);
  const container = element.closest(".field, .localized-pair, .localized-editor, .tour-localized-content__field");
  if (container instanceof HTMLElement) {
    container.classList.toggle(INVALID_CLASS, isInvalid);
  }
  if (isInvalid) {
    element.setAttribute("aria-invalid", "true");
  } else if (element.getAttribute("aria-invalid") === "true") {
    element.removeAttribute("aria-invalid");
  }
}

function fieldLabelText(element) {
  if (element.id) {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((candidate) => candidate.htmlFor === element.id);
    const text = normalizeText(label?.textContent);
    if (text) return text;
  }
  const nearbyLabel = element
    .closest(".field, .localized-pair, .localized-editor, .tour-localized-content__field")
    ?.querySelector("label, .localized-pair__label, .localized-editor__label, .tour-localized-group__label");
  return normalizeText(nearbyLabel?.textContent);
}

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal instanceof HTMLElement) return modal;

  modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "modal english-text-guard-modal";
  modal.hidden = true;
  modal.lang = "vi";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", MODAL_TITLE_ID);
  modal.setAttribute("aria-describedby", MODAL_DESCRIPTION_ID);
  modal.innerHTML = `
    <div class="modal-panel english-text-guard-modal__panel" role="document">
      <div class="modal-head">
        <h2 id="${MODAL_TITLE_ID}">Vui lòng viết bằng tiếng Anh</h2>
        <button class="btn btn-ghost english-text-guard-modal__close" type="button" aria-label="Đóng">&times;</button>
      </div>
      <div class="modal-body english-text-guard-modal__body">
        <p id="${MODAL_DESCRIPTION_ID}">Nội dung của ô này phải được viết bằng tiếng Anh. Vui lòng xóa phần tiếng Việt và nhập lại bằng tiếng Anh trước khi lưu.</p>
        <p class="micro english-text-guard-modal__field" id="${MODAL_FIELD_ID}" hidden></p>
        <div class="english-text-guard-modal__actions">
          <button class="btn btn-primary english-text-guard-modal__ok" type="button">Đã hiểu</button>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (target === modal || (target instanceof Element && target.closest(".english-text-guard-modal__close, .english-text-guard-modal__ok"))) {
      closeModal();
    }
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  document.body?.appendChild(modal);
  return modal;
}

function openModalForField(element) {
  const modal = ensureModal();
  const fieldNode = document.getElementById(MODAL_FIELD_ID);
  const label = fieldLabelText(element);
  if (fieldNode instanceof HTMLElement) {
    if (label) {
      fieldNode.textContent = `Trường: ${label}`;
      fieldNode.hidden = false;
    } else {
      fieldNode.textContent = "";
      fieldNode.hidden = true;
    }
  }

  modalPreviouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  if (!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
  const okButton = modal.querySelector(".english-text-guard-modal__ok");
  if (okButton instanceof HTMLElement) okButton.focus();
  else modal.focus();
}

function closeModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!(modal instanceof HTMLElement)) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  if (modalPreviouslyFocusedElement?.isConnected) {
    modalPreviouslyFocusedElement.focus();
  }
  modalPreviouslyFocusedElement = null;
}

function checkField(element, { showModal = true } = {}) {
  if (!isEnglishExpectedField(element)) return false;
  const value = normalizeText(element.value);
  const isInvalid = isLikelyVietnameseText(value);
  setFieldWarningState(element, isInvalid);
  if (!isInvalid || !showModal) return isInvalid;

  const lastValue = lastWarnedValues.get(element);
  if (lastValue === value) return true;
  lastWarnedValues.set(element, value);
  openModalForField(element);
  return true;
}

function scheduleCheck(element) {
  const pending = pendingChecks.get(element);
  if (pending) window.clearTimeout(pending);
  pendingChecks.set(element, window.setTimeout(() => {
    pendingChecks.delete(element);
    checkField(element);
  }, 700));
}

function handleInput(event) {
  const target = event.target;
  if (!isEnglishExpectedField(target)) return;
  scheduleCheck(target);
}

function handleCommittedInput(event) {
  const target = event.target;
  if (!isEnglishExpectedField(target)) return;
  const pending = pendingChecks.get(target);
  if (pending) {
    window.clearTimeout(pending);
    pendingChecks.delete(target);
  }
  checkField(target);
}

export function initializeEnglishTextGuard() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  document.addEventListener("input", handleInput, true);
  document.addEventListener("change", handleCommittedInput, true);
  document.addEventListener("focusout", handleCommittedInput, true);
}

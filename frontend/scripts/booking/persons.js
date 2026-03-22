import { GENERATED_LANGUAGE_CODES } from "../../Generated/Models/generated_Language.js";
import {
  languageByApiValue,
  languageByCode
} from "../../../shared/generated/language_catalog.js";
import {
  bookingPersonCreateRequest,
  bookingPersonDocumentPictureRequest,
  bookingPersonDeleteRequest,
  bookingPersonPhotoRequest,
  bookingPersonUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  buildDocumentPayloadFromDraft,
  documentHasAnyData,
  formatPersonRoleLabel,
  getAbbreviatedPersonName,
  getPersonDocument,
  getPersonFooterRoleLabel,
  getPersonIdentityStatus,
  getPersonPrimaryRoleLabel,
  getPreferredPersonDocumentType,
  normalizePersonDocumentDraft,
  personHasCompleteAddress,
  personHasCompleteContact,
  personHasCompleteIdentityDocument,
  renderPersonCardStatusLine
} from "./person_helpers.js";
import { bookingT } from "./i18n.js";
import {
  getBookingPersons,
  getPersonInitials,
  isTravelingPerson,
  normalizeStringList
} from "../shared/booking_persons.js";
import { createSnapshotDirtyTracker } from "../shared/edit_state.js";
import { COUNTRY_CODE_OPTIONS } from "../shared/generated_catalogs.js";
import { renderBookingSectionHeader } from "./sections.js";

export function createBookingPersonsModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    bookingId,
    bookingPersonRoleOptions,
    personModalAutofillConfig,
    escapeHtml,
    normalizeText,
    resolvePersonPhotoSrc,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderBookingData,
    renderActionControls,
    setBookingSectionDirty
  } = ctx;

  let lastPersonModalTrigger = null;
  const personsDirtyTracker = createSnapshotDirtyTracker({
    captureSnapshot: () => serializePersonDrafts(),
    isEnabled: () => state.permissions.canEditBooking,
    onDirtyChange: (isDirty) => setBookingSectionDirty("persons", isDirty)
  });
  let activeDocumentPictureStatusPersonId = "";
  let documentPictureStatuses = {
    passport: "",
    national_id: ""
  };
  let activePersonModalStatusPersonId = "";
  let personModalActionStatus = "";
  let personModalSaveInFlight = false;
  let personModalDiscardInFlight = false;

  function normalizePersonLanguageCode(value) {
    const raw = normalizeText(value);
    if (!raw) return "";
    const byCode = languageByCode(raw);
    if (byCode && GENERATED_LANGUAGE_CODES.includes(byCode.code)) return byCode.code;
    const byApiValue = languageByApiValue(raw);
    if (byApiValue && GENERATED_LANGUAGE_CODES.includes(byApiValue.code)) return byApiValue.code;
    return "";
  }

  function formatPersonLanguageLabel(value) {
    const entry = languageByCode(normalizePersonLanguageCode(value));
    return entry?.nativeLabel || entry?.apiValue || String(value || "");
  }

  function getDisplayedTravelerCount() {
    return state.personDrafts.filter((person) => !person?._is_new && isTravelingPerson(person)).length;
  }

  function buildTravelerMismatchMessage(booking) {
    const declared = Number(booking?.web_form_submission?.number_of_travelers || 0);
    if (!declared) return "";
    const listed = getDisplayedTravelerCount();
    if (declared === listed) return "";
    const declaredLabel = bookingT(
      declared === 1 ? "booking.persons.traveler_one" : "booking.persons.traveler_many",
      declared === 1 ? "{count} traveler" : "{count} travelers",
      { count: declared }
    );
    if (listed < declared) {
      const listedLabel = listed === 1
        ? bookingT("booking.persons.one_traveler_only", "one traveler only")
        : bookingT("booking.persons.traveler_many_only", "{count} travelers only", { count: listed });
      return bookingT(
        "booking.persons.mismatch_less",
        "The web form indicates {declared}, but this booking currently has {listed}.",
        { declared: declaredLabel, listed: listedLabel }
      );
    }
    if (listed === 1) {
      return bookingT(
        "booking.persons.mismatch_one",
        "The web form indicates {declared}, but this booking currently has one traveler.",
        { declared: declaredLabel }
      );
    }
    return bookingT(
      "booking.persons.mismatch_more",
      "The web form indicates {declared}, but this booking currently has {listed} travelers.",
      { declared: declaredLabel, listed }
    );
  }

  function renderTravelerMismatchWarning() {
    if (!els.personsMismatchWarning) return;
    const message = buildTravelerMismatchMessage(state.booking);
    els.personsMismatchWarning.textContent = message;
    els.personsMismatchWarning.hidden = !message;
  }

  function buildCollapsedPersonSummary(person) {
    const personName = normalizeText(person?.name) || bookingT("booking.unnamed_person", "Unnamed person");
    const commentParts = [];
    const nationality = normalizeText(person?.nationality).toUpperCase();
    if (nationality) commentParts.push(nationality);
    commentParts.push(
      ...normalizeStringList(person?.roles)
        .filter((role) => role !== "traveler")
        .map((role) => formatPersonRoleLabel(role))
    );
    if (!commentParts.length) return personName;
    return `${personName} (${commentParts.join(", ")})`;
  }

  function renderPersonsSummaryText() {
    const persons = Array.isArray(state.personDrafts) ? state.personDrafts : [];
    if (!persons.length) {
      renderBookingSectionHeader(els.personsPanelSummary, { primary: bookingT("booking.no_persons", "No persons listed.") });
      return;
    }
    const traveling = persons.filter((person) => isTravelingPerson(person)).map((person) => buildCollapsedPersonSummary(person));
    const notTraveling = persons.filter((person) => !isTravelingPerson(person)).map((person) => buildCollapsedPersonSummary(person));
    const lines = [
      bookingT("booking.persons.traveling_summary", "{count} traveling: {people}", {
        count: traveling.length,
        people: traveling.length ? traveling.join(" · ") : bookingT("common.none", "none")
      })
    ];
    if (notTraveling.length) {
      lines.push(bookingT("booking.persons.not_traveling_summary", "Not traveling: {people}", { people: notTraveling.join(" · ") }));
    }
    renderBookingSectionHeader(els.personsPanelSummary, { primary: lines.join("\n") });
  }

  function clonePersonDraft(person = {}, index = 0) {
    return {
      _is_new: false,
      id: normalizeText(person.id) || `${bookingId || "booking"}_person_${index + 1}`,
      name: normalizeText(person.name) || "",
      photo_ref: normalizeText(person.photo_ref) || "",
      emails: Array.isArray(person.emails) ? [...person.emails] : [],
      phone_numbers: Array.isArray(person.phone_numbers) ? [...person.phone_numbers] : [],
      preferred_language: normalizePersonLanguageCode(person.preferred_language),
      date_of_birth: normalizeText(person.date_of_birth) || "",
      nationality: normalizeText(person.nationality) || "",
      address: person.address && typeof person.address === "object" ? { ...person.address } : {},
      roles: normalizeStringList(person.roles),
      consents: Array.isArray(person.consents) ? person.consents.map((consent) => ({ ...consent })) : [],
      documents: Array.isArray(person.documents)
        ? person.documents.map((document) => normalizePersonDocumentDraft(document, normalizeText(document?.document_type) || "other"))
        : [],
      notes: normalizeText(person.notes) || ""
    };
  }

  function buildEmptyPersonDraft() {
    return {
      _is_new: true,
      id: `${bookingId || "booking"}_person_${Date.now()}`,
      name: "",
      photo_ref: "",
      emails: [],
      phone_numbers: [],
      preferred_language: "",
      date_of_birth: "",
      nationality: "",
      address: {},
      roles: ["traveler"],
      consents: [],
      documents: [],
      notes: ""
    };
  }

  function ensurePersonDocument(draft, document_type) {
    if (!draft) return null;
    draft.documents = Array.isArray(draft.documents) ? draft.documents : [];
    const existing = getPersonDocument(draft, document_type);
    if (existing) return existing;
    const document = normalizePersonDocumentDraft(
      {
        id: `${normalizeText(draft.id) || bookingId || "booking"}_${document_type}`,
        document_type
      },
      document_type
    );
    draft.documents.push(document);
    return document;
  }

  function pruneEmptyPersonDocuments(draft) {
    if (!draft) return;
    draft.documents = (Array.isArray(draft.documents) ? draft.documents : []).filter(documentHasAnyData);
  }

  function updatePersonDocumentField(draft, document_type, field, value) {
    if (!draft) return;
    const normalizedValue = field === "issuing_country"
      ? normalizeText(value).toUpperCase()
      : field === "no_expiration_date"
        ? value === true
        : String(value || "");
    const document = ensurePersonDocument(draft, document_type);
    if (!document) return;
    document[field] = normalizedValue;
    if (document_type === "national_id" && field === "no_expiration_date" && normalizedValue === true) {
      document.expires_on = "";
    }
    document.document_type = document_type;
    const timestamp = new Date().toISOString();
    document.created_at = normalizeText(document.created_at) || timestamp;
    document.updated_at = timestamp;
    pruneEmptyPersonDocuments(draft);
  }

  function serializePersonDrafts(drafts = state.personDrafts) {
    return JSON.stringify(
      (Array.isArray(drafts) ? drafts : []).map((draft, index) => buildPersonPayloadFromDraft(draft, index))
    );
  }

  function serializeSavedPersonDrafts(booking = state.booking) {
    return serializePersonDrafts(getBookingPersons(booking).map(clonePersonDraft));
  }

  function markPersonsSnapshotClean(booking = state.booking) {
    if (typeof personsDirtyTracker.setCleanSnapshot === "function") {
      personsDirtyTracker.setCleanSnapshot(serializeSavedPersonDrafts(booking));
      return;
    }
    personsDirtyTracker.markClean();
  }

  function updatePersonsDirtyState() {
    return personsDirtyTracker.refresh();
  }

  function setPersonsEditorStatus(message) {
    if (!els.personsEditorStatus) return;
    els.personsEditorStatus.textContent = message || "";
  }

  function ensureActivePersonModalStatusPerson(personId = "") {
    const normalizedPersonId = normalizeText(personId);
    if (activePersonModalStatusPersonId !== normalizedPersonId) {
      activePersonModalStatusPersonId = normalizedPersonId;
      personModalActionStatus = "";
      personModalSaveInFlight = false;
      personModalDiscardInFlight = false;
    }
  }

  function setPersonModalActionStatus(message, personId = state.active_person_id) {
    ensureActivePersonModalStatusPerson(personId);
    personModalActionStatus = normalizeText(message) || "";
    if (els.personModalActionStatus instanceof HTMLElement) {
      els.personModalActionStatus.textContent = personModalActionStatus;
    }
  }

  function documentTypeLabel(documentType) {
    return documentType === "national_id"
      ? bookingT("booking.id_card", "ID card")
      : bookingT("booking.passport", "Passport");
  }

  function getPersonDocumentPictureElements(documentType) {
    if (documentType === "national_id") {
      return {
        uploadButton: document.getElementById("booking_person_modal_national_id_picture_upload_btn"),
        input: document.getElementById("booking_person_modal_national_id_picture_input"),
        previewImage: document.getElementById("booking_person_modal_national_id_picture_preview"),
        emptyNode: document.getElementById("booking_person_modal_national_id_picture_empty"),
        statusNode: document.getElementById("booking_person_modal_national_id_picture_status")
      };
    }
    return {
      uploadButton: document.getElementById("booking_person_modal_passport_picture_upload_btn"),
      input: document.getElementById("booking_person_modal_passport_picture_input"),
      previewImage: document.getElementById("booking_person_modal_passport_picture_preview"),
      emptyNode: document.getElementById("booking_person_modal_passport_picture_empty"),
      statusNode: document.getElementById("booking_person_modal_passport_picture_status")
    };
  }

  function resetDocumentPictureStatuses(personId = "") {
    activeDocumentPictureStatusPersonId = normalizeText(personId);
    documentPictureStatuses = {
      passport: "",
      national_id: ""
    };
  }

  function ensureDocumentPictureStatusPerson(personId = "") {
    const normalizedPersonId = normalizeText(personId);
    if (activeDocumentPictureStatusPersonId !== normalizedPersonId) {
      resetDocumentPictureStatuses(normalizedPersonId);
    }
  }

  function getPersonDocumentPictureStatus(documentType, personId = state.active_person_id) {
    ensureDocumentPictureStatusPerson(personId);
    const normalizedDocumentType = documentType === "national_id" ? "national_id" : "passport";
    return documentPictureStatuses[normalizedDocumentType] || "";
  }

  function setPersonDocumentPictureStatus(documentType, message, personId = state.active_person_id) {
    const normalizedDocumentType = documentType === "national_id" ? "national_id" : "passport";
    ensureDocumentPictureStatusPerson(personId);
    documentPictureStatuses[normalizedDocumentType] = normalizeText(message) || "";
    const { statusNode } = getPersonDocumentPictureElements(normalizedDocumentType);
    if (statusNode instanceof HTMLElement) {
      statusNode.textContent = documentPictureStatuses[normalizedDocumentType];
    }
  }

  function collectCommaSeparatedValues(values) {
    const items = Array.isArray(values) ? values : String(values || "").split(",");
    return Array.from(new Set(items.map((value) => normalizeText(value)).filter(Boolean)));
  }

  function isValidIsoCalendarDate(value) {
    const normalized = normalizeText(value);
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

  function getDateOfBirthValidationMessage(value, { allowPartial = false } = {}) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    if (allowPartial && normalized.length < 10) return "";
    if (!isValidIsoCalendarDate(normalized)) {
      return bookingT("booking.persons.date_of_birth_invalid", "Use YYYY-MM-DD, for example 1963-08-20.");
    }
    return "";
  }

  function getPersonDateFieldDescriptors() {
    return [
      {
        key: "date_of_birth",
        textInput: els.personModalDateOfBirth,
        pickerInput: els.personModalDateOfBirthPicker,
        pickerButton: els.personModalDateOfBirthPickerBtn,
        errorNode: els.personModalDateOfBirthError,
        getValue: (draft) => normalizeText(draft?.date_of_birth),
        setValue: (draft, value) => {
          if (!draft) return;
          draft.date_of_birth = normalizeText(value);
        }
      },
      {
        key: "passport_issued_on",
        textInput: document.getElementById("booking_person_modal_passport_issued_on"),
        pickerInput: document.getElementById("booking_person_modal_passport_issued_on_picker"),
        pickerButton: document.getElementById("booking_person_modal_passport_issued_on_picker_btn"),
        errorNode: document.getElementById("booking_person_modal_passport_issued_on_error"),
        getValue: (draft) => normalizeText(getPersonDocument(draft, "passport")?.issued_on),
        setValue: (draft, value) => updatePersonDocumentField(draft, "passport", "issued_on", normalizeText(value))
      },
      {
        key: "passport_expires_on",
        textInput: document.getElementById("booking_person_modal_passport_expires_on"),
        pickerInput: document.getElementById("booking_person_modal_passport_expires_on_picker"),
        pickerButton: document.getElementById("booking_person_modal_passport_expires_on_picker_btn"),
        errorNode: document.getElementById("booking_person_modal_passport_expires_on_error"),
        getValue: (draft) => normalizeText(getPersonDocument(draft, "passport")?.expires_on),
        setValue: (draft, value) => updatePersonDocumentField(draft, "passport", "expires_on", normalizeText(value))
      },
      {
        key: "national_id_issued_on",
        textInput: document.getElementById("booking_person_modal_national_id_issued_on"),
        pickerInput: document.getElementById("booking_person_modal_national_id_issued_on_picker"),
        pickerButton: document.getElementById("booking_person_modal_national_id_issued_on_picker_btn"),
        errorNode: document.getElementById("booking_person_modal_national_id_issued_on_error"),
        getValue: (draft) => normalizeText(getPersonDocument(draft, "national_id")?.issued_on),
        setValue: (draft, value) => updatePersonDocumentField(draft, "national_id", "issued_on", normalizeText(value))
      },
      {
        key: "national_id_expires_on",
        textInput: document.getElementById("booking_person_modal_national_id_expires_on"),
        pickerInput: document.getElementById("booking_person_modal_national_id_expires_on_picker"),
        pickerButton: document.getElementById("booking_person_modal_national_id_expires_on_picker_btn"),
        errorNode: document.getElementById("booking_person_modal_national_id_expires_on_error"),
        getValue: (draft) => normalizeText(getPersonDocument(draft, "national_id")?.expires_on),
        setValue: (draft, value) => updatePersonDocumentField(draft, "national_id", "expires_on", normalizeText(value))
      }
    ];
  }

  function findPersonDateFieldDescriptorByTextInput(target) {
    return getPersonDateFieldDescriptors().find((descriptor) => descriptor.textInput === target) || null;
  }

  function findPersonDateFieldDescriptorByPickerInput(target) {
    return getPersonDateFieldDescriptors().find((descriptor) => descriptor.pickerInput === target) || null;
  }

  function findPersonDateFieldDescriptorByPickerButton(target) {
    return getPersonDateFieldDescriptors().find((descriptor) => descriptor.pickerButton === target) || null;
  }

  function syncPersonDatePickerValue(descriptor, value) {
    if (!(descriptor?.pickerInput instanceof HTMLInputElement)) return;
    const normalized = normalizeText(value);
    descriptor.pickerInput.value = isValidIsoCalendarDate(normalized) ? normalized : "";
  }

  function setPersonDateFieldValidation(descriptor, message) {
    const field = descriptor?.textInput?.closest(".field");
    if (field instanceof HTMLElement) field.classList.toggle("invalid", Boolean(message));
    if (descriptor?.errorNode instanceof HTMLElement) {
      descriptor.errorNode.textContent = message || "";
    }
  }

  function validatePersonDateField(descriptor, value, { allowPartial = false } = {}) {
    const message = getDateOfBirthValidationMessage(value, { allowPartial });
    setPersonDateFieldValidation(descriptor, message);
    syncPersonDatePickerValue(descriptor, value);
    return !message;
  }

  function validatePersonDraft(draft, { allowPartialDateOfBirth = false, focusFirstInvalid = false } = {}) {
    if (!draft || typeof draft !== "object") return true;
    let firstInvalidDescriptor = null;
    for (const descriptor of getPersonDateFieldDescriptors()) {
      if (descriptor.key === "national_id_expires_on" && getPersonDocument(draft, "national_id")?.no_expiration_date === true) {
        setPersonDateFieldValidation(descriptor, "");
        syncPersonDatePickerValue(descriptor, "");
        continue;
      }
      const allowPartial = descriptor.key === "date_of_birth" ? allowPartialDateOfBirth : false;
      const value = descriptor.getValue(draft);
      const isValid = validatePersonDateField(descriptor, value, { allowPartial });
      if (!isValid && !firstInvalidDescriptor) {
        firstInvalidDescriptor = descriptor;
      }
    }
    if (focusFirstInvalid && firstInvalidDescriptor?.textInput instanceof HTMLElement) {
      firstInvalidDescriptor.textInput.focus();
    }
    return !firstInvalidDescriptor;
  }

  function buildPersonPayloadFromDraft(draft, index) {
    const address = draft?.address && typeof draft.address === "object" ? {
      line_1: normalizeText(draft.address.line_1),
      line_2: normalizeText(draft.address.line_2),
      city: normalizeText(draft.address.city),
      state_region: normalizeText(draft.address.state_region),
      postal_code: normalizeText(draft.address.postal_code),
      country_code: normalizeText(draft.address.country_code).toUpperCase()
    } : {};
    const cleanedAddress = Object.fromEntries(Object.entries(address).filter(([, value]) => value));

    return {
      id: normalizeText(draft?.id) || `${bookingId || "booking"}_person_${index + 1}`,
      name: normalizeText(draft?.name) || "",
      photo_ref: normalizeText(draft?.photo_ref) || undefined,
      emails: collectCommaSeparatedValues(draft?.emails),
      phone_numbers: collectCommaSeparatedValues(draft?.phone_numbers),
      preferred_language: normalizePersonLanguageCode(draft?.preferred_language) || undefined,
      date_of_birth: normalizeText(draft?.date_of_birth) || undefined,
      nationality: normalizeText(draft?.nationality).toUpperCase() || undefined,
      address: Object.keys(cleanedAddress).length ? cleanedAddress : undefined,
      roles: normalizeStringList(draft?.roles),
      consents: Array.isArray(draft?.consents) ? draft.consents.map((consent) => ({ ...consent })) : [],
      documents: (Array.isArray(draft?.documents) ? draft.documents : [])
        .map((document, document_index) => buildDocumentPayloadFromDraft(document, draft?.id, bookingId || "booking", document_index))
        .filter(Boolean),
      notes: normalizeText(draft?.notes) || undefined
    };
  }

  function personDraftHasMeaningfulInput(draft) {
    if (!draft || typeof draft !== "object") return false;
    const roles = normalizeStringList(draft.roles);
    const hasNonDefaultRoles = roles.length !== 1 || roles[0] !== "traveler";
    const addressValues = draft.address && typeof draft.address === "object" ? Object.values(draft.address) : [];
    return Boolean(
      normalizeText(draft.name) ||
      normalizeText(draft.photo_ref) ||
      collectCommaSeparatedValues(draft.emails).length ||
      collectCommaSeparatedValues(draft.phone_numbers).length ||
      normalizePersonLanguageCode(draft.preferred_language) ||
      normalizeText(draft.date_of_birth) ||
      normalizeText(draft.nationality) ||
      addressValues.some((value) => normalizeText(value)) ||
      hasNonDefaultRoles ||
      (Array.isArray(draft.consents) && draft.consents.length) ||
      (Array.isArray(draft.documents) && draft.documents.some(documentHasAnyData)) ||
      normalizeText(draft.notes)
    );
  }

  function buildStoredPersonPayload(booking, personId, fallbackIndex = 0) {
    const normalizedPersonId = normalizeText(personId);
    const persons = getBookingPersons(booking);
    const personIndex = persons.findIndex((person) => normalizeText(person?.id) === normalizedPersonId);
    if (personIndex < 0) return null;
    return buildPersonPayloadFromDraft(clonePersonDraft(persons[personIndex], personIndex), personIndex);
  }

  function isPersonDraftDirtyAgainstBooking(draft, booking = state.booking, fallbackIndex = 0) {
    if (!draft || typeof draft !== "object") return false;
    if (draft._is_new === true) return personDraftHasMeaningfulInput(draft);
    const draftPayload = buildPersonPayloadFromDraft(draft, fallbackIndex);
    const storedPayload = buildStoredPersonPayload(booking, draft.id, fallbackIndex);
    if (!storedPayload) return true;
    return JSON.stringify(draftPayload) !== JSON.stringify(storedPayload);
  }

  function isPersonDraftDirty(personId = state.active_person_id) {
    const normalizedPersonId = normalizeText(personId);
    const draftIndex = state.personDrafts.findIndex((draft) => normalizeText(draft?.id) === normalizedPersonId);
    if (draftIndex < 0) return false;
    return isPersonDraftDirtyAgainstBooking(state.personDrafts[draftIndex], state.booking, draftIndex);
  }

  function populateCountryCodeSelect(select, placeholderLabel = bookingT("booking.persons.select_nationality", "Select nationality")) {
    if (!(select instanceof HTMLSelectElement)) return;
    const current = normalizeText(select.value).toUpperCase();
    select.innerHTML = [
      `<option value="">${escapeHtml(placeholderLabel)}</option>`,
      ...COUNTRY_CODE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    ].join("");
    if (COUNTRY_CODE_OPTIONS.some((option) => option.value === current)) {
      select.value = current;
    }
  }

  function renderPersonsEditor({ include_modal = true } = {}) {
    if (!els.personsEditorList) return;
    const canEdit = state.permissions.canEditBooking;
    renderPersonsSummaryText();

    const personCards = state.personDrafts.map((person, index) => {
      const personName = normalizeText(person.name);
      const title = personName || bookingT("booking.unnamed_person", "Unnamed person");
      const identity = getPersonIdentityStatus(person);
      const hasCompleteContact = personHasCompleteContact(person);
      const hasCompleteAddress = personHasCompleteAddress(person);
      const roleLabel = getPersonFooterRoleLabel(person);
      const photoSrc = resolvePersonPhotoSrc(person.photo_ref);
      const initials = getPersonInitials(title);
      const statusMarkup = [
        renderPersonCardStatusLine(identity.label, identity.is_complete),
        renderPersonCardStatusLine(bookingT("booking.persons.contact", "Contact"), hasCompleteContact),
        renderPersonCardStatusLine(bookingT("booking.persons.address", "Address"), hasCompleteAddress)
      ].join("");
      const imageMarkup = normalizeText(person.photo_ref)
        ? `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(title)}" />`
        : !personName
          ? `<img src="assets/img/profile_person.png" alt="" />`
          : `<span class="booking-person-card__initials">${escapeHtml(initials)}</span>`;
      return `
        <button class="booking-person-card" type="button" data-person-card="${index}">
          <span class="booking-person-card__media">${imageMarkup}</span>
          <span class="booking-person-card__content">
            <span class="booking-person-card__title">${escapeHtml(title)}</span>
            <span class="booking-person-card__status-list">${statusMarkup}</span>
            <span class="booking-person-card__subtitle"></span>
          </span>
          <span class="booking-person-card__role-footer">${escapeHtml(roleLabel)}</span>
        </button>
      `;
    });

    const addCard = canEdit ? `
      <button class="booking-person-card booking-person-card--add" type="button" data-person-add="true" aria-label="${escapeHtml(bookingT("booking.persons.add_person", "Add person"))}">
        <span class="booking-person-card__add-layout">
          <span class="booking-person-card__media booking-person-card__media--add">
            <img src="assets/img/profile_person.png" alt="" />
          </span>
          <span class="booking-person-card__add-cta">
            <span class="booking-person-card__add-button">${escapeHtml(bookingT("common.new", "New"))}</span>
          </span>
        </span>
      </button>
    ` : "";

    if (!personCards.length && !addCard) {
      els.personsEditorList.innerHTML = `<div class="booking-person-card__empty">${escapeHtml(bookingT("booking.persons.no_persons_on_booking", "No persons listed on this booking."))}</div>`;
      finalizeClosePersonModal();
      return;
    }

    els.personsEditorList.innerHTML = `${personCards.join("")}${addCard}`;

    if (include_modal) renderPersonModal();
    renderTravelerMismatchWarning();
  }

  function handlePersonsEditorListClick(event) {
    const addCard = event.target.closest("[data-person-add]");
    if (addCard) {
      lastPersonModalTrigger = addCard;
      addPersonDraft();
      return;
    }
    const card = event.target.closest("[data-person-card]");
    if (!card) return;
    const index = Number(card.getAttribute("data-person-card"));
    if (!Number.isInteger(index) || index < 0 || index >= state.personDrafts.length) return;
    lastPersonModalTrigger = card;
    openPersonModal(index);
  }

  function addPersonDraft() {
    if (!state.permissions.canEditBooking || !state.booking) return;
    const draft = buildEmptyPersonDraft();
    state.personDrafts.push(draft);
    renderPersonsEditor();
    updatePersonsDirtyState();
    openPersonModal(state.personDrafts.length - 1);
    setPersonsEditorStatus("");
  }

  async function persistPersonDrafts(person_id = state.active_person_id) {
    if (!state.permissions.canEditBooking || !state.booking) return false;
    const targetPersonId = normalizeText(person_id) || normalizeText(state.active_person_id);
    const personIndex = state.personDrafts.findIndex((draft) => draft.id === targetPersonId);
    const currentDraft = personIndex >= 0 ? state.personDrafts[personIndex] : null;
    if (!currentDraft) return false;
    const isNewDraft = currentDraft._is_new === true;
    if (isNewDraft && !personDraftHasMeaningfulInput(currentDraft)) return true;
    if (!isPersonDraftDirtyAgainstBooking(currentDraft, state.booking, personIndex)) return true;
    if (!validatePersonDraft(currentDraft, { allowPartialDateOfBirth: false, focusFirstInvalid: targetPersonId === state.active_person_id })) {
      return false;
    }

    const previousBooking = state.booking;
    const previousDrafts = Array.isArray(state.personDrafts)
      ? state.personDrafts.map((draft) => JSON.parse(JSON.stringify(draft)))
      : [];
    const request = isNewDraft
      ? bookingPersonCreateRequest({
          baseURL: apiOrigin,
          params: { booking_id: state.booking.id }
        })
      : bookingPersonUpdateRequest({
          baseURL: apiOrigin,
          params: { booking_id: state.booking.id, person_id: targetPersonId }
        });
    const existingPersonIds = new Set(getBookingPersons(state.booking).map((person) => person.id));
    const activeLocalPersonId = normalizeText(state.active_person_id);
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_persons_revision: getBookingRevision("persons_revision"),
        person: buildPersonPayloadFromDraft(currentDraft, personIndex),
        actor: state.user
      }
    });
    if (!result?.booking) return false;

    const createdPersonId = isNewDraft
      ? normalizeText(
          result.booking?.persons?.find((person) => !existingPersonIds.has(normalizeText(person?.id)))?.id ||
          result.booking?.persons?.[result.booking.persons.length - 1]?.id
        )
      : "";
    state.booking = result.booking;
    state.personDrafts = getBookingPersons(state.booking).map(clonePersonDraft);
    previousDrafts.forEach((draft, index) => {
      const draftId = normalizeText(draft?.id);
      if (!draftId || draftId === targetPersonId || draftId === createdPersonId) return;
      if (draft._is_new === true) {
        if (personDraftHasMeaningfulInput(draft)) {
          state.personDrafts.push(draft);
        }
        return;
      }
      if (!isPersonDraftDirtyAgainstBooking(draft, previousBooking, index)) return;
      const nextIndex = state.personDrafts.findIndex((person) => normalizeText(person?.id) === draftId);
      if (nextIndex < 0) return;
      state.personDrafts[nextIndex] = draft;
    });
    markPersonsSnapshotClean(state.booking);
    const activePersonTargetId = createdPersonId || targetPersonId;
    state.active_person_id = activeLocalPersonId === targetPersonId ? activePersonTargetId : state.active_person_id;
    state.active_person_index = state.personDrafts.findIndex((person) => normalizeText(person?.id) === normalizeText(state.active_person_id));
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    if (isNewDraft && activeLocalPersonId === targetPersonId && createdPersonId) {
      const createdIndex = state.personDrafts.findIndex((person) => person.id === createdPersonId);
      if (createdIndex >= 0) openPersonModal(createdIndex);
    }
    return true;
  }

  async function savePersonDrafts(person_id = state.active_person_id) {
    return await persistPersonDrafts(person_id);
  }

  async function saveAllPersonDrafts() {
    if (!state.permissions.canEditBooking || !state.booking) return true;
    updatePersonsDirtyState();
    if (!state.dirty.persons) return true;
    const drafts = Array.isArray(state.personDrafts) ? state.personDrafts.map((draft) => JSON.parse(JSON.stringify(draft))) : [];
    let latestBooking = state.booking;

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const targetPersonId = normalizeText(draft?.id);
      const isNewDraft = draft?._is_new === true;
      if (isNewDraft && !personDraftHasMeaningfulInput(draft)) continue;

      const bookingPerson = getBookingPersons(latestBooking).find((person) => normalizeText(person.id) === targetPersonId) || null;
      const bookingPayload = bookingPerson ? buildPersonPayloadFromDraft(clonePersonDraft(bookingPerson, index), index) : null;
      const draftPayload = buildPersonPayloadFromDraft(draft, index);
      const hasChanges = isNewDraft || JSON.stringify(draftPayload) !== JSON.stringify(bookingPayload);
      if (!hasChanges) continue;

      if (!validatePersonDraft(draft, { allowPartialDateOfBirth: false, focusFirstInvalid: targetPersonId === state.active_person_id })) {
        return false;
      }

      const request = isNewDraft
        ? bookingPersonCreateRequest({
            baseURL: apiOrigin,
            params: { booking_id: latestBooking.id }
          })
        : bookingPersonUpdateRequest({
            baseURL: apiOrigin,
            params: { booking_id: latestBooking.id, person_id: targetPersonId }
          });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_persons_revision: Number(latestBooking.persons_revision || 0),
          person: draftPayload,
          actor: state.user
        }
      });
      if (!result?.booking) return false;
      latestBooking = result.booking;
    }

    state.booking = latestBooking;
    applyBookingPayload({ booking: latestBooking });
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    return true;
  }

  function updatePersonModalActionControls(draft, canEdit) {
    ensureActivePersonModalStatusPerson(draft?.id);
    const isDirty = isPersonDraftDirty(normalizeText(draft?.id));
    const isBusy = personModalSaveInFlight || personModalDiscardInFlight;
    if (els.personModalSaveBtn instanceof HTMLButtonElement) {
      els.personModalSaveBtn.disabled = !canEdit || isBusy || !isDirty;
    }
    if (els.personModalDiscardBtn instanceof HTMLButtonElement) {
      els.personModalDiscardBtn.disabled = !canEdit || isBusy || !isDirty;
    }
    if (els.personModalActionStatus instanceof HTMLElement) {
      if (personModalActionStatus) {
        els.personModalActionStatus.textContent = personModalActionStatus;
      } else if (isDirty) {
        els.personModalActionStatus.textContent = bookingT("booking.persons.unsaved_changes", "Unsaved traveler changes");
      } else {
        els.personModalActionStatus.textContent = "";
      }
    }
  }

  function discardPersonDraftChanges(personId = state.active_person_id) {
    const targetPersonId = normalizeText(personId);
    const personIndex = state.personDrafts.findIndex((draft) => normalizeText(draft?.id) === targetPersonId);
    const draft = personIndex >= 0 ? state.personDrafts[personIndex] : null;
    if (!draft) return false;
    clearTravelerDetailsLinkStatus();
    if (!isPersonDraftDirtyAgainstBooking(draft, state.booking, personIndex)) {
      setPersonModalActionStatus("", targetPersonId);
      updatePersonModalActionControls(draft, state.permissions.canEditBooking);
      return true;
    }
    if (draft._is_new === true) {
      state.personDrafts.splice(personIndex, 1);
      updatePersonsDirtyState();
      finalizeClosePersonModal();
      renderPersonsEditor({ include_modal: false });
      return true;
    }
    const storedPersons = getBookingPersons(state.booking);
    const storedIndex = storedPersons.findIndex((person) => normalizeText(person?.id) === targetPersonId);
    if (storedIndex < 0) return false;
    state.personDrafts[personIndex] = clonePersonDraft(storedPersons[storedIndex], storedIndex);
    setPersonModalActionStatus(bookingT("booking.persons.discarded_changes", "Traveler changes discarded"), targetPersonId);
    renderPersonsEditor();
    updatePersonsDirtyState();
    return true;
  }

  async function saveActivePersonDraft(options = {}) {
    const targetPersonId = normalizeText(options.person_id) || normalizeText(state.active_person_id);
    const personIndex = state.personDrafts.findIndex((draft) => normalizeText(draft?.id) === targetPersonId);
    const draft = personIndex >= 0 ? state.personDrafts[personIndex] : null;
    if (!draft) return false;
    personModalSaveInFlight = true;
    setPersonModalActionStatus(bookingT("booking.persons.saving", "Saving traveler..."), targetPersonId);
    updatePersonModalActionControls(draft, state.permissions.canEditBooking);
    const saved = await persistPersonDrafts(targetPersonId);
    personModalSaveInFlight = false;
    const activeDraft = state.personDrafts[state.active_person_index] || draft;
    if (saved) {
      setPersonModalActionStatus(bookingT("booking.persons.saved", "Traveler saved"), normalizeText(activeDraft?.id) || targetPersonId);
    } else {
      setPersonModalActionStatus("", targetPersonId);
    }
    updatePersonModalActionControls(activeDraft, state.permissions.canEditBooking);
    return saved;
  }

  function openPersonModal(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.personDrafts.length) return;
    state.active_person_index = index;
    state.active_person_id = state.personDrafts[index]?.id || "";
    state.active_person_document_type = getPreferredPersonDocumentType(state.personDrafts[index]);
    renderPersonModal();
    if (els.personModal) els.personModal.hidden = false;
  }

  function finalizeClosePersonModal() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && els.personModal?.contains(activeElement)) {
      activeElement.blur();
    }
    if (els.personModal) els.personModal.hidden = true;
    state.active_person_index = -1;
    state.active_person_id = "";
    state.active_person_document_type = "passport";
    if (els.personModalPhotoInput) els.personModalPhotoInput.value = "";
    const passportPictureInput = document.getElementById("booking_person_modal_passport_picture_input");
    const nationalIdPictureInput = document.getElementById("booking_person_modal_national_id_picture_input");
    if (passportPictureInput instanceof HTMLInputElement) passportPictureInput.value = "";
    if (nationalIdPictureInput instanceof HTMLInputElement) nationalIdPictureInput.value = "";
    resetDocumentPictureStatuses();
    activePersonModalStatusPersonId = "";
    personModalActionStatus = "";
    personModalSaveInFlight = false;
    personModalDiscardInFlight = false;
    if (lastPersonModalTrigger instanceof HTMLElement && document.contains(lastPersonModalTrigger)) {
      lastPersonModalTrigger.focus();
    }
  }

  async function closePersonModal() {
    const activeIndex = state.active_person_index;
    const draft = state.personDrafts[activeIndex];
    if (draft?._is_new && !personDraftHasMeaningfulInput(draft)) {
      state.personDrafts.splice(activeIndex, 1);
      finalizeClosePersonModal();
      renderPersonsEditor({ include_modal: false });
      updatePersonsDirtyState();
      setPersonsEditorStatus("");
      return;
    }
    finalizeClosePersonModal();
  }

  function triggerPersonPhotoPicker() {
    const draft = state.personDrafts[state.active_person_index];
    if (!state.permissions.canEditBooking || !draft || draft._is_new) return;
    if (els.personModalPhotoInput) els.personModalPhotoInput.click();
  }

  function triggerPersonDocumentPicturePicker(documentType) {
    const { uploadButton, input } = getPersonDocumentPictureElements(documentType);
    if (!(input instanceof HTMLInputElement)) return;
    if (uploadButton instanceof HTMLButtonElement && uploadButton.disabled) return;
    input.click();
  }

  function handlePersonModalKeydown(event) {
    if (event.key !== "Escape" || els.personModal?.hidden !== false) return;
    void closePersonModal();
  }

  function renderPersonModal() {
    if (!els.personModal) return;
    const draft = state.personDrafts[state.active_person_index];
    const isOpen = els.personModal.hidden === false;
    if (!draft) {
      if (isOpen) finalizeClosePersonModal();
      return;
    }

    const canEdit = state.permissions.canEditBooking;
    const personName = normalizeText(draft.name);
    const title = personName || bookingT("booking.unnamed_person", "Unnamed person");
    const initials = getPersonInitials(title);
    const photoSrc = resolvePersonPhotoSrc(draft.photo_ref);
    ensureDocumentPictureStatusPerson(draft.id);
    renderTravelerDetailsLinkActions();

    if (els.personModalSubtitle) {
      els.personModalSubtitle.textContent = `${getPersonPrimaryRoleLabel(draft)}`;
    }
    if (els.personModalPhoto) {
      const showProfileImage = Boolean(normalizeText(draft.photo_ref)) || !personName;
      els.personModalPhoto.src = normalizeText(draft.photo_ref) ? photoSrc : "assets/img/profile_person.png";
      els.personModalPhoto.alt = normalizeText(draft.photo_ref) ? title : "";
      els.personModalPhoto.hidden = !showProfileImage;
      els.personModalPhoto.style.display = showProfileImage ? "block" : "none";
    }
    if (els.personModalInitials) {
      els.personModalInitials.textContent = initials;
      const showInitials = !normalizeText(draft.photo_ref) && Boolean(personName);
      els.personModalInitials.hidden = !showInitials;
      els.personModalInitials.style.display = showInitials ? "block" : "none";
    }
    if (els.personModalName) {
      els.personModalName.value = normalizeText(draft.name) || "";
      els.personModalName.disabled = !canEdit;
    }
    if (els.personModalPreferredLanguage) {
      els.personModalPreferredLanguage.innerHTML = [
        `<option value="">${escapeHtml(bookingT("booking.persons.select_language", "Select language"))}</option>`,
        ...GENERATED_LANGUAGE_CODES.map((language) => `<option value="${escapeHtml(language)}">${escapeHtml(formatPersonLanguageLabel(language))}</option>`)
      ].join("");
      els.personModalPreferredLanguage.value = normalizePersonLanguageCode(draft.preferred_language) || "";
      els.personModalPreferredLanguage.disabled = !canEdit;
    }
    if (els.personModalDateOfBirth) {
      els.personModalDateOfBirth.value = normalizeText(draft.date_of_birth) || "";
      els.personModalDateOfBirth.disabled = !canEdit;
    }
    if (els.personModalNationality) {
      populateCountryCodeSelect(els.personModalNationality, bookingT("booking.persons.select_nationality", "Select nationality"));
      els.personModalNationality.value = normalizeText(draft.nationality) || "";
      els.personModalNationality.disabled = !canEdit;
    }
    if (els.personModalEmails) {
      els.personModalEmails.value = collectCommaSeparatedValues(draft.emails).join(", ");
      els.personModalEmails.disabled = !canEdit;
    }
    if (els.personModalPhoneNumbers) {
      els.personModalPhoneNumbers.value = collectCommaSeparatedValues(draft.phone_numbers).join(", ");
      els.personModalPhoneNumbers.disabled = !canEdit;
    }
    if (els.personModalRoles) {
      els.personModalRoles.innerHTML = bookingPersonRoleOptions.map((role) => `
        <label class="booking-person-modal__role">
          <input type="checkbox" data-person-role="${escapeHtml(role)}" ${draft.roles.includes(role) ? "checked" : ""} ${canEdit ? "" : "disabled"} />
          <span>${escapeHtml(formatPersonRoleLabel(role))}</span>
        </label>
      `).join("");
    }

    const passport = getPersonDocument(draft, "passport") || normalizePersonDocumentDraft({}, "passport");
    const nationalId = getPersonDocument(draft, "national_id") || normalizePersonDocumentDraft({}, "national_id");
    const activeDocumentType = state.active_person_document_type || getPreferredPersonDocumentType(draft);
    const fieldBindings = [
      [els.personModalAddressLine1, normalizeText(draft.address?.line_1) || ""],
      [els.personModalAddressLine2, normalizeText(draft.address?.line_2) || ""],
      [els.personModalCity, normalizeText(draft.address?.city) || ""],
      [els.personModalStateRegion, normalizeText(draft.address?.state_region) || ""],
      [els.personModalPostalCode, normalizeText(draft.address?.postal_code) || ""],
      [els.personModalCountryCode, normalizeText(draft.address?.country_code) || ""],
      [els.personModalNotes, normalizeText(draft.notes) || ""],
      [document.getElementById("booking_person_modal_passport_holder_name"), normalizeText(passport.holder_name) || ""],
      [document.getElementById("booking_person_modal_passport_number"), normalizeText(passport.document_number) || ""],
      [document.getElementById("booking_person_modal_passport_issuing_country"), normalizeText(passport.issuing_country) || ""],
      [document.getElementById("booking_person_modal_passport_issued_on"), normalizeText(passport.issued_on) || ""],
      [document.getElementById("booking_person_modal_passport_expires_on"), normalizeText(passport.expires_on) || ""],
      [document.getElementById("booking_person_modal_national_id_holder_name"), normalizeText(nationalId.holder_name) || ""],
      [document.getElementById("booking_person_modal_national_id_number"), normalizeText(nationalId.document_number) || ""],
      [document.getElementById("booking_person_modal_national_id_issuing_country"), normalizeText(nationalId.issuing_country) || ""],
      [document.getElementById("booking_person_modal_national_id_issued_on"), normalizeText(nationalId.issued_on) || ""],
      [document.getElementById("booking_person_modal_national_id_expires_on"), normalizeText(nationalId.expires_on) || ""]
    ];
    fieldBindings.forEach(([element, value]) => {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
      element.value = value;
      element.disabled = !canEdit;
    });
    getPersonDateFieldDescriptors().forEach((descriptor) => {
      if (descriptor.textInput instanceof HTMLInputElement) {
        descriptor.textInput.value = descriptor.getValue(draft) || "";
        descriptor.textInput.disabled = !canEdit;
      }
      if (descriptor.pickerInput instanceof HTMLInputElement) {
        descriptor.pickerInput.disabled = !canEdit;
        syncPersonDatePickerValue(descriptor, descriptor.getValue(draft));
      }
      if (descriptor.pickerButton instanceof HTMLButtonElement) {
        descriptor.pickerButton.disabled = !canEdit;
      }
      validatePersonDateField(descriptor, descriptor.getValue(draft), { allowPartial: false });
    });
    const nationalIdNoExpirationInput = document.getElementById("booking_person_modal_national_id_no_expiration_date");
    if (nationalIdNoExpirationInput instanceof HTMLInputElement) {
      nationalIdNoExpirationInput.checked = nationalId.no_expiration_date === true;
      nationalIdNoExpirationInput.disabled = !canEdit;
    }
    updateNationalIdExpirationInputState(canEdit);
    if (els.personModalPhotoInput) els.personModalPhotoInput.disabled = !canEdit || draft._is_new;
    if (els.personModalAvatarBtn) els.personModalAvatarBtn.disabled = !canEdit || draft._is_new;
    if (els.personModalDeleteBtn) {
      els.personModalDeleteBtn.disabled = !canEdit;
      els.personModalDeleteBtn.style.display = canEdit ? "" : "none";
    }
    updatePersonDocumentPictureControls(draft, canEdit, title);
    updateTravelerDetailsLinkActions(draft, canEdit);
    updatePersonModalActionControls(draft, canEdit);
    if (typeof ctx.updateCleanStateActionAvailability === "function") {
      ctx.updateCleanStateActionAvailability();
    }
    updatePersonModalDocumentSwitcher(draft, activeDocumentType, canEdit);
  }

  function updatePersonDocumentPictureControls(draft, canEdit, personLabel) {
    const isSavedPerson = Boolean(normalizeText(draft?.id)) && draft?._is_new !== true;
    const disabledStatusMessage = canEdit && !isSavedPerson
      ? bookingT(
          "booking.document_image.save_person_first",
          "Save this traveler first to upload a document image."
        )
      : "";

    ["passport", "national_id"].forEach((documentType) => {
      const { uploadButton, input, previewImage, emptyNode, statusNode } = getPersonDocumentPictureElements(documentType);
      const document = getPersonDocument(draft, documentType) || normalizePersonDocumentDraft({}, documentType);
      const pictureRef = normalizeText(document.document_picture_ref);

      if (previewImage instanceof HTMLImageElement) {
        if (pictureRef) {
          previewImage.src = resolvePersonPhotoSrc(pictureRef);
          previewImage.alt = `${personLabel} ${documentTypeLabel(documentType)}`;
        } else {
          previewImage.removeAttribute("src");
          previewImage.alt = "";
        }
        previewImage.hidden = !pictureRef;
      }

      if (emptyNode instanceof HTMLElement) {
        emptyNode.hidden = Boolean(pictureRef);
      }

      if (uploadButton instanceof HTMLButtonElement) {
        const isBaseDisabled = !canEdit || !isSavedPerson;
        uploadButton.disabled = isBaseDisabled;
        uploadButton.dataset.cleanStateBaseDisabled = isBaseDisabled ? "true" : "false";
        uploadButton.title = isBaseDisabled && disabledStatusMessage ? disabledStatusMessage : "";
      }

      if (input instanceof HTMLInputElement) {
        input.disabled = !canEdit || !isSavedPerson;
      }

      if (statusNode instanceof HTMLElement) {
        statusNode.textContent = getPersonDocumentPictureStatus(documentType, draft?.id) || disabledStatusMessage;
      }
    });
  }

  function updatePersonModalDocumentSwitcher(draft, activeDocumentType, canEdit) {
    const passportSwitch = document.getElementById("booking_person_modal_switch_passport");
    const nationalIdSwitch = document.getElementById("booking_person_modal_switch_national_id");
    const switches = [
      [passportSwitch, "passport", bookingT("booking.passport", "Passport")],
      [nationalIdSwitch, "national_id", bookingT("booking.id_card", "ID card")]
    ];
    switches.forEach(([button, documentType, label]) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = activeDocumentType === documentType;
      const isComplete = personHasCompleteIdentityDocument(draft, documentType);
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.disabled = !canEdit;
      button.innerHTML = isComplete
        ? `${escapeHtml(label)} <span class="booking-person-modal__document-switch-check" aria-hidden="true">&#10003;</span>`
        : escapeHtml(label);
    });
    document.querySelectorAll("[data-document-panel]").forEach((panel) => {
      const matches = panel.getAttribute("data-document-panel") === activeDocumentType;
      panel.hidden = !matches;
      panel.style.display = matches ? "" : "none";
    });

    const abbreviatedName = getAbbreviatedPersonName(draft?.name);
    const nationalityCode = normalizeText(draft?.nationality).toUpperCase() || bookingT("booking.code", "Code");
    Object.entries(personModalAutofillConfig).forEach(([id, config]) => {
      const button = document.getElementById(id);
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = config.document_type === activeDocumentType;
      button.hidden = !isActive;
      button.disabled = !canEdit;
      button.textContent = config.source === "name" ? abbreviatedName : nationalityCode;
    });
  }

  function updateNationalIdExpirationInputState(canEdit = state.permissions.canEditBooking) {
    const descriptor = getPersonDateFieldDescriptors().find((entry) => entry.key === "national_id_expires_on");
    const expiresInput = descriptor?.textInput;
    const noExpirationInput = document.getElementById("booking_person_modal_national_id_no_expiration_date");
    if (!(expiresInput instanceof HTMLInputElement)) return;
    const noExpiration = noExpirationInput instanceof HTMLInputElement && noExpirationInput.checked;
    expiresInput.disabled = !canEdit || noExpiration;
    if (descriptor?.pickerInput instanceof HTMLInputElement) {
      descriptor.pickerInput.disabled = !canEdit || noExpiration;
    }
    if (descriptor?.pickerButton instanceof HTMLButtonElement) {
      descriptor.pickerButton.disabled = !canEdit || noExpiration;
    }
  }

  function refreshOpenPersonModalHeader() {
    const draft = state.personDrafts[state.active_person_index];
    if (!draft) return;
    if (els.personModalSubtitle) {
      els.personModalSubtitle.textContent = `${getPersonPrimaryRoleLabel(draft)}`;
    }
    if (els.personModalInitials && !normalizeText(draft.photo_ref)) {
      els.personModalInitials.textContent = getPersonInitials(draft.name);
    }
  }

  function getTravelerDetailsLinkActionNodes() {
    return {
      copyButton: document.getElementById("booking_person_modal_traveler_details_copy_btn"),
      statusNode: document.getElementById("booking_person_modal_traveler_details_link_status")
    };
  }

  function clearTravelerDetailsLinkStatus() {
    const { statusNode } = getTravelerDetailsLinkActionNodes();
    if (statusNode instanceof HTMLElement) {
      statusNode.textContent = "";
    }
  }

  function renderTravelerDetailsLinkActions() {
    if (!(els.personModalPublicActionsMount instanceof HTMLElement)) return;
    els.personModalPublicActionsMount.innerHTML = `
      <div class="booking-person-modal__public-actions">
        <button
          class="booking-hero__id-copy"
          id="booking_person_modal_traveler_details_copy_btn"
          type="button"
          data-person-modal-traveler-details-action="copy"
        >${escapeHtml(bookingT("booking.traveler_details.copy_link", "Create and copy traveler details link"))}</button>
      </div>
      <span id="booking_person_modal_traveler_details_link_status" class="micro booking-person-modal__public-actions-status"></span>
    `;
  }

  function updateTravelerDetailsLinkActions(draft, canEdit) {
    const nodes = getTravelerDetailsLinkActionNodes();
    const actionButtons = [
      nodes.copyButton
    ].filter((button) => button instanceof HTMLButtonElement);
    const isDirty = isPersonDraftDirty(normalizeText(draft?.id));
    const isSavedPerson = Boolean(normalizeText(draft?.id)) && draft?._is_new !== true;
    const isTraveler = isTravelingPerson(draft);
    const hasDraftInput = personDraftHasMeaningfulInput(draft);
    const baseDisabled = !canEdit || !isTraveler || (!isSavedPerson && !hasDraftInput);
    let statusMessage = "";

    if (canEdit && !isTraveler) {
      statusMessage = bookingT(
        "booking.traveler_details.traveler_role_required",
        "Add the traveler role to enable the traveler details link."
      );
    } else if (canEdit && !isSavedPerson && !hasDraftInput) {
      statusMessage = bookingT(
        "booking.traveler_details.save_person_first",
        "Save this traveler first to enable the traveler details link."
      );
    }

    actionButtons.forEach((button) => {
      button.textContent = isDirty
        ? bookingT(
            "booking.traveler_details.save_and_copy_link",
            "Save traveler and copy traveler details link"
          )
        : bookingT("booking.traveler_details.copy_link", "Create and copy traveler details link");
      button.disabled = baseDisabled;
      button.title = baseDisabled && statusMessage ? statusMessage : "";
    });

    if (nodes.statusNode instanceof HTMLElement) {
      nodes.statusNode.textContent = statusMessage;
    }
  }

  function handlePersonModalInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const draft = state.personDrafts[state.active_person_index];
    if (!draft) return;
    const dateTextDescriptor = findPersonDateFieldDescriptorByTextInput(target);
    const datePickerDescriptor = findPersonDateFieldDescriptorByPickerInput(target);

    if (datePickerDescriptor) {
      const normalizedDate = normalizeText(target.value);
      if (datePickerDescriptor.textInput instanceof HTMLInputElement) {
        datePickerDescriptor.textInput.value = normalizedDate;
      }
      datePickerDescriptor.setValue(draft, normalizedDate);
      validatePersonDateField(datePickerDescriptor, normalizedDate, { allowPartial: false });
    } else if (dateTextDescriptor) {
      const normalizedDate = normalizeText(target.value);
      dateTextDescriptor.setValue(draft, normalizedDate);
      const allowPartial = event.type === "input";
      validatePersonDateField(dateTextDescriptor, normalizedDate, { allowPartial });
    } else if (target.dataset.personRole) {
      const role = normalizeText(target.dataset.personRole);
      const nextRoles = new Set(draft.roles);
      if (target.checked) nextRoles.add(role);
      else nextRoles.delete(role);
      draft.roles = Array.from(nextRoles);
    } else if (target.dataset.addressField) {
      draft.address = draft.address && typeof draft.address === "object" ? draft.address : {};
      const field = String(target.dataset.addressField || "");
      draft.address[field] = field === "country_code" ? normalizeText(target.value).toUpperCase() : target.value;
    } else if (target.dataset.documentField && target.dataset.documentType) {
      const documentField = target.dataset.documentField;
      const nextValue = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
      updatePersonDocumentField(draft, target.dataset.documentType, documentField, nextValue);
      if (documentField === "no_expiration_date") {
        updateNationalIdExpirationInputState(state.permissions.canEditBooking);
        if (target instanceof HTMLInputElement && target.checked) {
          const nationalIdExpiresInput = document.getElementById("booking_person_modal_national_id_expires_on");
          if (nationalIdExpiresInput instanceof HTMLInputElement) nationalIdExpiresInput.value = "";
          updatePersonDocumentField(draft, "national_id", "expires_on", "");
          const nationalIdExpiresDescriptor = getPersonDateFieldDescriptors().find((entry) => entry.key === "national_id_expires_on");
          if (nationalIdExpiresDescriptor) {
            setPersonDateFieldValidation(nationalIdExpiresDescriptor, "");
            syncPersonDatePickerValue(nationalIdExpiresDescriptor, "");
          }
        }
      }
    } else if (target.dataset.personField) {
      const field = String(target.dataset.personField || "");
      if (field === "emails" || field === "phone_numbers") {
        draft[field] = collectCommaSeparatedValues(target.value);
      } else if (field === "nationality") {
        draft[field] = normalizeText(target.value).toUpperCase();
        target.value = draft[field];
      } else {
        draft[field] = target.value;
      }
    } else {
      return;
    }

    setPersonModalActionStatus("", draft.id);
    clearTravelerDetailsLinkStatus();
    renderPersonsEditor({ include_modal: false });
    refreshOpenPersonModalHeader();
    updatePersonModalDocumentSwitcher(
      draft,
      state.active_person_document_type || getPreferredPersonDocumentType(draft),
      state.permissions.canEditBooking
    );
    updatePersonModalActionControls(draft, state.permissions.canEditBooking);
    updatePersonsDirtyState();
  }

  function openPersonDatePicker(button) {
    const descriptor = findPersonDateFieldDescriptorByPickerButton(button);
    if (!(descriptor?.pickerInput instanceof HTMLInputElement) || descriptor.pickerInput.disabled) return;
    const currentValue = normalizeText(descriptor.textInput?.value);
    syncPersonDatePickerValue(descriptor, currentValue);
    if (typeof descriptor.pickerInput.showPicker === "function") {
      try {
        descriptor.pickerInput.showPicker();
        return;
      } catch (_) {
        // Fall through to click/focus.
      }
    }
    descriptor.pickerInput.focus();
    descriptor.pickerInput.click();
  }

  async function handlePersonModalClick(event) {
    if (event.target === els.personModal) {
      await closePersonModal();
      return;
    }
    const draft = state.personDrafts[state.active_person_index];
    if (!draft) return;
    const documentPictureUpload = event.target.closest("[data-document-picture-upload]");
    if (documentPictureUpload) {
      triggerPersonDocumentPicturePicker(normalizeText(documentPictureUpload.getAttribute("data-document-picture-upload")));
      return;
    }
    const documentSwitch = event.target.closest("[data-document-switch]");
    if (documentSwitch) {
      state.active_person_document_type = normalizeText(documentSwitch.getAttribute("data-document-switch")) || "passport";
      renderPersonModal();
      return;
    }
    const autofillButton = event.target.closest(".booking-person-modal__autofill-btn");
    if (autofillButton) {
      const config = personModalAutofillConfig[autofillButton.id];
      if (!config) return;
      const sourceValue = config.source === "name"
        ? normalizeText(draft.name)
        : normalizeText(draft.nationality).toUpperCase();
      if (!sourceValue) return;
      updatePersonDocumentField(draft, config.document_type, config.field, sourceValue);
      renderPersonsEditor({ include_modal: false });
      renderPersonModal();
      updatePersonsDirtyState();
      return;
    }
    const datePickerButton = event.target.closest(".booking-person-modal__date-picker-btn");
    if (datePickerButton) {
      openPersonDatePicker(datePickerButton);
      return;
    }
    if (event.target.closest("#booking_person_modal_save_btn")) {
      await saveActivePersonDraft();
      return;
    }
    if (event.target.closest("#booking_person_modal_discard_btn")) {
      personModalDiscardInFlight = true;
      setPersonModalActionStatus(bookingT("booking.persons.discarding", "Discarding traveler changes..."), draft.id);
      updatePersonModalActionControls(draft, state.permissions.canEditBooking);
      discardPersonDraftChanges(draft.id);
      personModalDiscardInFlight = false;
      const activeDraft = state.personDrafts[state.active_person_index] || null;
      if (activeDraft) {
        updatePersonModalActionControls(activeDraft, state.permissions.canEditBooking);
      }
      return;
    }
    if (event.target.closest("#booking_person_modal_delete_btn")) {
      if (!window.confirm(bookingT("booking.persons.remove_confirm", "Remove {name} from the booking?", {
        name: normalizeText(draft.name) || bookingT("booking.persons.this_person", "this person")
      }))) return;
      if (draft._is_new) {
        state.personDrafts.splice(state.active_person_index, 1);
        finalizeClosePersonModal();
        renderPersonsEditor();
        updatePersonsDirtyState();
        return;
      }
      const request = bookingPersonDeleteRequest({
        baseURL: apiOrigin,
        params: { booking_id: state.booking.id, person_id: draft.id }
      });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_persons_revision: getBookingRevision("persons_revision"),
          actor: state.user
        }
      });
      if (!result?.booking) return;
      finalizeClosePersonModal();
      applyBookingPayload(result);
      renderBookingHeader();
      renderBookingData();
      renderActionControls();
      renderPersonsEditor();
    }
  }

  async function uploadPersonPhoto(index, input = els.personModalPhotoInput) {
    if (!state.permissions.canEditBooking || !state.booking) return;
    const person = state.personDrafts[index];
    if (!person || person._is_new) return;
    const file = input?.files?.[0] || null;
    if (!file) return;
    const base64 = await fileToBase64(file);
    const request = bookingPersonPhotoRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id, person_id: person.id }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_persons_revision: getBookingRevision("persons_revision"),
        filename: file.name,
        data_base64: base64,
        actor: state.user
      }
    });
    if (!result?.booking) return;

    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    if (state.active_person_index >= 0) openPersonModal(state.active_person_index);
  }

  async function uploadPersonDocumentPicture(index, documentType, input = getPersonDocumentPictureElements(documentType).input) {
    const normalizedDocumentType = documentType === "national_id" ? "national_id" : "passport";
    if (!state.permissions.canEditBooking || !state.booking) return;
    const person = state.personDrafts[index];
    const file = input?.files?.[0] || null;
    if (!person || !file) return;
    const personLabel = normalizeText(person.name) || bookingT("booking.unnamed_person", "Unnamed person");

    if (person._is_new) {
      setPersonDocumentPictureStatus(
        normalizedDocumentType,
        bookingT(
          "booking.document_image.save_person_first",
          "Save this traveler first to upload a document image."
        ),
        person.id
      );
      updatePersonDocumentPictureControls(person, state.permissions.canEditBooking, personLabel);
      if (input instanceof HTMLInputElement) input.value = "";
      return;
    }

    try {
      setPersonDocumentPictureStatus(
        normalizedDocumentType,
        bookingT("booking.document_image.uploading", "Uploading document image..."),
        person.id
      );
      updatePersonDocumentPictureControls(person, state.permissions.canEditBooking, personLabel);

      const base64 = await fileToBase64(file);
      const request = bookingPersonDocumentPictureRequest({
        baseURL: apiOrigin,
        params: {
          booking_id: state.booking.id,
          person_id: person.id,
          document_type: normalizedDocumentType
        }
      });
      const activeDocumentType = state.active_person_document_type || normalizedDocumentType;
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: {
          expected_persons_revision: getBookingRevision("persons_revision"),
          filename: file.name,
          data_base64: base64,
          actor: state.user
        }
      });
      if (!result?.booking) {
        setPersonDocumentPictureStatus(
          normalizedDocumentType,
          bookingT("booking.document_image.upload_failed", "Could not upload the document image."),
          person.id
        );
        updatePersonDocumentPictureControls(person, state.permissions.canEditBooking, personLabel);
        return;
      }

      applyBookingPayload(result);
      state.active_person_document_type = activeDocumentType;
      renderBookingHeader();
      renderBookingData();
      renderActionControls();
      renderPersonsEditor();

      const activeDraft = state.personDrafts[state.active_person_index] || person;
      setPersonDocumentPictureStatus(
        normalizedDocumentType,
        bookingT("booking.document_image.uploaded", "{document} image uploaded.", {
          document: documentTypeLabel(normalizedDocumentType)
        }),
        activeDraft.id || person.id
      );
      renderPersonModal();
    } catch {
      setPersonDocumentPictureStatus(
        normalizedDocumentType,
        bookingT("booking.document_image.upload_failed", "Could not upload the document image."),
        person.id
      );
      updatePersonDocumentPictureControls(person, state.permissions.canEditBooking, personLabel);
    } finally {
      if (input instanceof HTMLInputElement) input.value = "";
    }
  }

  async function fileToBase64(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        const comma = value.indexOf(",");
        resolve(comma >= 0 ? value.slice(comma + 1) : value);
      };
      reader.onerror = () => reject(reader.error || new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  function applyBookingPayload(payload = null) {
    const activePersonId = state.active_person_id;
    if (payload?.booking) {
      state.booking = payload.booking;
    }
    state.personDrafts = getBookingPersons(state.booking).map(clonePersonDraft);
    if (activePersonId) {
      state.active_person_index = state.personDrafts.findIndex((person) => person.id === activePersonId);
      if (state.active_person_index < 0) {
        state.active_person_id = "";
        finalizeClosePersonModal();
      } else {
        state.active_person_id = state.personDrafts[state.active_person_index]?.id || "";
      }
    }
    markPersonsSnapshotClean();
  }

  async function prepareTravelerDetailsLinkAction() {
    const draft = state.personDrafts[state.active_person_index];
    if (!draft) return false;
    if (!isPersonDraftDirty(normalizeText(draft.id))) return true;
    clearTravelerDetailsLinkStatus();
    return await saveActivePersonDraft({ person_id: draft.id });
  }

  function bindEvents() {
    if (els.personsEditorList) els.personsEditorList.addEventListener("click", handlePersonsEditorListClick);
    if (els.personModal) els.personModal.addEventListener("click", handlePersonModalClick);
    if (els.personModal) {
      els.personModal.addEventListener("input", handlePersonModalInput);
      els.personModal.addEventListener("change", handlePersonModalInput);
    }
    getPersonDateFieldDescriptors().forEach((descriptor) => {
      if (descriptor.textInput instanceof HTMLInputElement) {
        descriptor.textInput.addEventListener("blur", () => {
          validatePersonDateField(descriptor, descriptor.textInput?.value, { allowPartial: false });
        });
      }
    });
    if (els.personModalAvatarBtn) els.personModalAvatarBtn.addEventListener("click", triggerPersonPhotoPicker);
    if (els.personModalPhotoInput) {
      els.personModalPhotoInput.addEventListener("change", async () => {
        await uploadPersonPhoto(state.active_person_index, els.personModalPhotoInput);
      });
    }
    const passportPictureInput = document.getElementById("booking_person_modal_passport_picture_input");
    if (passportPictureInput instanceof HTMLInputElement) {
      passportPictureInput.addEventListener("change", async () => {
        await uploadPersonDocumentPicture(state.active_person_index, "passport", passportPictureInput);
      });
    }
    const nationalIdPictureInput = document.getElementById("booking_person_modal_national_id_picture_input");
    if (nationalIdPictureInput instanceof HTMLInputElement) {
      nationalIdPictureInput.addEventListener("change", async () => {
        await uploadPersonDocumentPicture(state.active_person_index, "national_id", nationalIdPictureInput);
      });
    }
    if (els.personModalCloseBtn) els.personModalCloseBtn.addEventListener("click", closePersonModal);
    window.addEventListener("keydown", handlePersonModalKeydown);
  }

  return {
    bindEvents,
    applyBookingPayload,
    renderPersonsEditor,
    closePersonModal,
    saveAllPersonDrafts,
    savePersonDrafts,
    saveActivePersonDraft,
    discardPersonDraftChanges,
    prepareTravelerDetailsLinkAction,
    isPersonDraftDirty
  };
}

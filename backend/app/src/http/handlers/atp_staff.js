import path from "node:path";
import { validateTranslationEntriesRequest } from "../../../Generated/API/generated_APIModels.js";
import { normalizeText } from "../../lib/text.js";
import { enumValueSetFor } from "../../lib/generated_catalogs.js";
import { execImageMagick } from "../../lib/imagemagick.js";
import { normalizeLanguageCode as normalizeCatalogLanguageCode } from "../../../../../shared/generated/language_catalog.js";

const LANGUAGE_CODE_SET = enumValueSetFor("LanguageCode");
const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");

function normalizeLanguageCodes(items) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => normalizeCatalogLanguageCode(item, { fallback: "" }))
        .filter((item) => item && LANGUAGE_CODE_SET.has(item))
    )
  );
}

function normalizeCountryCodes(items) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => normalizeText(item).toUpperCase())
        .filter((item) => item && COUNTRY_CODE_SET.has(item))
    )
  );
}

function normalizeLanguageCode(value, fallback = "en") {
  const normalized = normalizeCatalogLanguageCode(value, { fallback });
  return normalized && LANGUAGE_CODE_SET.has(normalized) ? normalized : fallback;
}

function translationEntriesToObject(entries) {
  return Object.fromEntries(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => [normalizeText(entry?.key), normalizeText(entry?.value)])
      .filter(([key, value]) => Boolean(key && value))
  );
}

function translationEntriesFromObject(entries) {
  return Object.entries(entries || {})
    .map(([key, value]) => ({ key: normalizeText(key), value: normalizeText(value) }))
    .filter((entry) => Boolean(entry.key && entry.value));
}

function normalizeQualificationEntries(items) {
  return Array.from(
    new Map(
      (Array.isArray(items) ? items : [])
        .map((entry) => [normalizeLanguageCode(entry?.lang, ""), normalizeText(entry?.value)])
        .filter(([lang, value]) => Boolean(lang && value && LANGUAGE_CODE_SET.has(lang)))
    ).entries()
  ).map(([lang, value]) => ({ lang, value }));
}

function buildUserResponse(user) {
  return { user };
}

export function createAtpStaffHandlers(deps) {
  const {
    getPrincipal,
    canViewAtpStaffProfiles,
    canEditAtpStaffProfiles,
    readBodyJson,
    sendJson,
    listAtpStaffDirectoryEntries,
    listPublicAtpStaffProfiles,
    buildAtpStaffDirectoryEntryByUsername,
    updateAtpStaffProfileByUsername,
    setAtpStaffPictureRefByUsername,
    resetAtpStaffPictureByUsername,
    translateEntries,
    execFile,
    mkdir,
    writeFile,
    rm,
    TEMP_UPLOAD_DIR,
    ATP_STAFF_PHOTOS_DIR,
    resolveAtpStaffPhotoDiskPath,
    sendFileWithCache,
    randomUUID
  } = deps;

  async function handleListAtpStaffDirectoryEntries(req, res) {
    const principal = getPrincipal(req);
    if (!canViewAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const items = await listAtpStaffDirectoryEntries();
      sendJson(res, 200, {
        items,
        total: items.length
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error?.message || error || "Could not load ATP staff profiles") });
    }
  }

  async function handleListPublicAtpStaffProfiles(_req, res) {
    try {
      const items = await listPublicAtpStaffProfiles();
      sendJson(res, 200, {
        items,
        total: items.length
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error?.message || error || "Could not load ATP staff team") });
    }
  }

  async function handlePublicAtpStaffPhoto(req, res, [rawRelativePath]) {
    const absolutePath = resolveAtpStaffPhotoDiskPath(rawRelativePath);
    if (!absolutePath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
  }

  async function handlePatchAtpStaffProfile(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const languages = normalizeLanguageCodes(payload?.languages ?? payload?.spoken_languages);
    if (!languages.length) {
      sendJson(res, 422, { error: "languages must contain at least one valid language code" });
      return;
    }
    const destinations = Array.isArray(payload?.destinations) ? normalizeCountryCodes(payload.destinations) : undefined;
    const fullName = payload?.full_name !== undefined ? normalizeText(payload.full_name) : undefined;
    const position = payload?.position !== undefined ? normalizeText(payload.position) : undefined;
    const positionI18n = Array.isArray(payload?.position_i18n)
      ? normalizeQualificationEntries(payload.position_i18n)
      : undefined;
    if (Array.isArray(payload?.position_i18n) && positionI18n.length !== payload.position_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each position translation requires a valid language code and non-empty text" });
      return;
    }
    const friendlyShortName = payload?.friendly_short_name !== undefined ? normalizeText(payload.friendly_short_name) : undefined;
    if (payload?.appears_in_team_web_page !== undefined && typeof payload.appears_in_team_web_page !== "boolean") {
      sendJson(res, 422, { error: "appears_in_team_web_page must be a boolean" });
      return;
    }
    const appearsInTeamWebPage = payload?.appears_in_team_web_page !== undefined
      ? payload.appears_in_team_web_page === true
      : undefined;

    const qualification = payload?.qualification !== undefined ? normalizeText(payload.qualification) : undefined;
    const qualificationI18n = Array.isArray(payload?.qualification_i18n)
      ? normalizeQualificationEntries(payload.qualification_i18n)
      : undefined;
    if (Array.isArray(payload?.qualification_i18n) && qualificationI18n.length !== payload.qualification_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each qualification translation requires a valid language code and non-empty text" });
      return;
    }
    const description = payload?.description !== undefined ? normalizeText(payload.description) : undefined;
    const descriptionI18n = Array.isArray(payload?.description_i18n)
      ? normalizeQualificationEntries(payload.description_i18n)
      : undefined;
    if (Array.isArray(payload?.description_i18n) && descriptionI18n.length !== payload.description_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each description translation requires a valid language code and non-empty text" });
      return;
    }
    const mobileDescription = payload?.mobile_description !== undefined ? normalizeText(payload.mobile_description) : undefined;
    const mobileDescriptionI18n = Array.isArray(payload?.mobile_description_i18n)
      ? normalizeQualificationEntries(payload.mobile_description_i18n)
      : undefined;
    if (Array.isArray(payload?.mobile_description_i18n)
      && mobileDescriptionI18n.length !== payload.mobile_description_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each mobile description translation requires a valid language code and non-empty text" });
      return;
    }

    const updated = await updateAtpStaffProfileByUsername(username, {
      languages,
      destinations,
      full_name: fullName,
      position,
      position_i18n: positionI18n,
      friendly_short_name: friendlyShortName,
      appears_in_team_web_page: appearsInTeamWebPage,
      qualification,
      qualification_i18n: qualificationI18n,
      description,
      description_i18n: descriptionI18n,
      mobile_description: mobileDescription,
      mobile_description_i18n: mobileDescriptionI18n
    });
    if (!updated) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    sendJson(res, 200, buildUserResponse(updated));
  }

  async function handleTranslateAtpStaffProfileFields(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
      validateTranslationEntriesRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const existing = await buildAtpStaffDirectoryEntryByUsername(username);
    if (!existing) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const sourceLang = normalizeLanguageCode(payload.source_lang, "en");
    const targetLang = normalizeLanguageCode(payload.target_lang, "en");
    const entries = translationEntriesToObject(payload.entries);
    if (!Object.keys(entries).length) {
      sendJson(res, 422, { error: "At least one source field is required." });
      return;
    }

    if (sourceLang === targetLang) {
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(entries)
      });
      return;
    }

    try {
      const translatedEntries = await translateEntries(entries, targetLang, {
        sourceLangCode: sourceLang,
        domain: "ATP staff profile text",
        allowGoogleFallback: true
      });
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(translatedEntries)
      });
    } catch (error) {
      if (error?.code === "TRANSLATION_NOT_CONFIGURED") {
        sendJson(res, 503, { error: String(error.message || "Translation provider is not configured.") });
        return;
      }
      if (error?.code === "TRANSLATION_INVALID_RESPONSE" || error?.code === "TRANSLATION_REQUEST_FAILED") {
        sendJson(res, 502, { error: String(error.message || "Translation request failed.") });
        return;
      }
      sendJson(res, 500, { error: String(error?.message || error || "Translation failed.") });
    }
  }

  async function processAtpStaffPhotoToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execImageMagick(execFile, [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "84",
      outputPath
    ]);
  }

  async function handleUploadAtpStaffPhoto(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const existing = await buildAtpStaffDirectoryEntryByUsername(username);
    if (!existing) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const filename = normalizeText(payload?.filename) || `${username}.upload`;
    const base64 = normalizeText(payload?.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }

    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${username}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${username}.webp`;
    const outputPath = path.join(ATP_STAFF_PHOTOS_DIR, outputName);

    try {
      await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
      await writeFile(tempInputPath, sourceBuffer);
      await processAtpStaffPhotoToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    const updated = await setAtpStaffPictureRefByUsername(username, `/content/atp_staff/photos/${outputName}`);
    if (!updated) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    sendJson(res, 200, buildUserResponse(updated));
  }

  async function handleDeleteAtpStaffPhoto(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const existing = await buildAtpStaffDirectoryEntryByUsername(username);
    if (!existing) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    await rm(path.join(ATP_STAFF_PHOTOS_DIR, `${username}.webp`), { force: true });
    const updated = await resetAtpStaffPictureByUsername(username);
    if (!updated) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    sendJson(res, 200, buildUserResponse(updated));
  }

  return {
    handleListAtpStaffDirectoryEntries,
    handleListPublicAtpStaffProfiles,
    handlePublicAtpStaffPhoto,
    handlePatchAtpStaffProfile,
    handleTranslateAtpStaffProfileFields,
    handleUploadAtpStaffPhoto,
    handleDeleteAtpStaffPhoto
  };
}

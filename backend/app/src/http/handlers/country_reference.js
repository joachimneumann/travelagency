import path from "node:path";
import { existsSync } from "node:fs";
import { DESTINATION_COUNTRY_CODE_SET } from "../../../../../shared/js/destination_country_codes.js";

export function createCountryReferenceHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    getPrincipal,
    canReadCountryReferenceInfo,
    canEditCountryReferenceInfo,
    readCountryPracticalInfo,
    persistCountryPracticalInfo,
    normalizeText,
    nowIso,
    repoRoot,
    execFile
  } = deps;

  const PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES = Object.freeze([
    path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs"),
    path.join(repoRoot, "scripts", "generate_public_homepage_assets.mjs")
  ]);
  let publicHomepageAssetGenerationQueue = Promise.resolve();

  function normalizeOptionalText(value) {
    const normalized = normalizeText(value);
    return normalized || null;
  }

  function contentSignature(item) {
    return JSON.stringify({
      country: normalizeText(item?.country).toUpperCase(),
      published_on_webpage: item?.published_on_webpage !== false,
      practical_tips: Array.isArray(item?.practical_tips) ? item.practical_tips.map((entry) => normalizeText(entry)).filter(Boolean) : [],
      emergency_contacts: Array.isArray(item?.emergency_contacts)
        ? item.emergency_contacts.map((entry) => ({
          label: normalizeText(entry?.label),
          phone: normalizeText(entry?.phone),
          ...(normalizeText(entry?.note) ? { note: normalizeText(entry.note) } : {})
        }))
        : []
    });
  }

  function sortCountryItems(items) {
    return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
      const leftCountry = normalizeText(left?.country).toUpperCase();
      const rightCountry = normalizeText(right?.country).toUpperCase();
      return leftCountry.localeCompare(rightCountry, "en");
    });
  }

  async function regeneratePublicHomepageAssets(reason, details = {}) {
    const task = async () => {
      const generatorPath = PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES.find((candidate) => existsSync(candidate));
      if (!generatorPath) {
        throw new Error("Could not find generate_public_homepage_assets.mjs in expected script locations.");
      }
      await execFile(process.execPath, [generatorPath], {
        cwd: repoRoot
      });
    };

    publicHomepageAssetGenerationQueue = publicHomepageAssetGenerationQueue.then(task, task);

    try {
      await publicHomepageAssetGenerationQueue;
      return { ok: true };
    } catch (error) {
      const message = String(error?.stderr || error?.message || error || "Static homepage asset generation failed.");
      console.error("[backend-public-homepage-assets] Generation failed.", {
        reason,
        ...details,
        error: message
      });
      return {
        ok: false,
        error: message
      };
    }
  }

  function validateAndNormalizeCountryPracticalInfoList(rawItems) {
    if (!Array.isArray(rawItems)) {
      return { ok: false, error: "items must be an array." };
    }

    const seenCountries = new Set();
    const normalizedItems = [];

    for (let index = 0; index < rawItems.length; index += 1) {
      const rawItem = rawItems[index];
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
        return { ok: false, error: `Country entry ${index + 1} must be an object.` };
      }

      const country = normalizeText(rawItem.country).toUpperCase();
      if (!country || !/^[A-Z]{2}$/.test(country)) {
        return { ok: false, error: `Country entry ${index + 1} must have a valid country code.` };
      }
      if (!DESTINATION_COUNTRY_CODE_SET.has(country)) {
        return { ok: false, error: `Country ${country} is not supported.` };
      }
      if (seenCountries.has(country)) {
        return { ok: false, error: `Country ${country} appears more than once.` };
      }
      seenCountries.add(country);
      if (rawItem.published_on_webpage !== undefined && typeof rawItem.published_on_webpage !== "boolean") {
        return { ok: false, error: `Country ${country} must use a boolean published_on_webpage flag.` };
      }

      const practical_tips = Array.from(
        new Set((Array.isArray(rawItem.practical_tips) ? rawItem.practical_tips : []).map((entry) => normalizeText(entry)).filter(Boolean))
      );

      const emergency_contacts = [];
      const rawContacts = Array.isArray(rawItem.emergency_contacts) ? rawItem.emergency_contacts : [];
      for (let contactIndex = 0; contactIndex < rawContacts.length; contactIndex += 1) {
        const rawContact = rawContacts[contactIndex];
        if (!rawContact || typeof rawContact !== "object" || Array.isArray(rawContact)) {
          return { ok: false, error: `Emergency contact ${contactIndex + 1} for ${country} must be an object.` };
        }
        const label = normalizeText(rawContact.label);
        const phone = normalizeText(rawContact.phone);
        const note = normalizeOptionalText(rawContact.note);
        if (!label && !phone && !note) continue;
        if (!label || !phone) {
          return { ok: false, error: `Emergency contact ${contactIndex + 1} for ${country} requires both label and phone.` };
        }
        emergency_contacts.push({
          label,
          phone,
          ...(note ? { note } : {})
        });
      }

      normalizedItems.push({
        country,
        published_on_webpage: rawItem.published_on_webpage !== false,
        practical_tips,
        emergency_contacts
      });
    }

    return { ok: true, items: sortCountryItems(normalizedItems) };
  }

  async function handleListCountryReferenceInfo(req, res) {
    const principal = getPrincipal(req);
    if (!canReadCountryReferenceInfo(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const payload = await readCountryPracticalInfo();
    const items = sortCountryItems(payload.items).map((item) => ({
      country: normalizeText(item?.country).toUpperCase(),
      published_on_webpage: item?.published_on_webpage !== false,
      practical_tips: Array.isArray(item?.practical_tips) ? item.practical_tips.map((entry) => normalizeText(entry)).filter(Boolean) : [],
      emergency_contacts: Array.isArray(item?.emergency_contacts)
        ? item.emergency_contacts.map((entry) => ({
          label: normalizeText(entry?.label),
          phone: normalizeText(entry?.phone),
          ...(normalizeText(entry?.note) ? { note: normalizeText(entry.note) } : {})
        }))
        : [],
      ...(normalizeText(item?.updated_at) ? { updated_at: normalizeText(item.updated_at) } : {})
    })).filter((item) => DESTINATION_COUNTRY_CODE_SET.has(item.country));

    sendJson(res, 200, {
      items,
      total: items.length
    });
  }

  async function handlePatchCountryReferenceInfo(req, res) {
    const principal = getPrincipal(req);
    if (!canEditCountryReferenceInfo(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const normalizedPayload = validateAndNormalizeCountryPracticalInfoList(payload?.items);
    if (!normalizedPayload.ok) {
      sendJson(res, 422, { error: normalizedPayload.error });
      return;
    }

    const current = await readCountryPracticalInfo();
    const existingByCountry = new Map(
      (Array.isArray(current?.items) ? current.items : []).map((item) => [normalizeText(item?.country).toUpperCase(), item])
    );

    const items = normalizedPayload.items.map((item) => {
      const existing = existingByCountry.get(item.country);
      const updated_at = existing && contentSignature(existing) === contentSignature(item)
        ? normalizeText(existing.updated_at) || nowIso()
        : nowIso();
      return {
        ...item,
        updated_at
      };
    });

    await persistCountryPracticalInfo({ items });
    const homepageAssets = await regeneratePublicHomepageAssets("country_reference_patch", {
      item_count: items.length
    });
    sendJson(res, 200, {
      items,
      total: items.length,
      homepage_assets: homepageAssets
    });
  }

  return {
    handleListCountryReferenceInfo,
    handlePatchCountryReferenceInfo
  };
}

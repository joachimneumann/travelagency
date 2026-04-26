import { validateTranslationRulesUpdateRequest } from "../../../Generated/API/generated_APIModels.js";
import { normalizeTranslationRules } from "../../lib/translation_rules.js";

export function createTranslationRulesHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    getPrincipal,
    canReadSettings,
    readTranslationRules,
    persistTranslationRules,
    nowIso
  } = deps;

  async function handleGetSettingsTranslationRules(req, res) {
    const principal = getPrincipal(req);
    if (!canReadSettings(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const payload = await readTranslationRules();
    sendJson(res, 200, {
      items: payload.items,
      total: payload.items.length,
      updated_at: payload.updated_at
    });
  }

  async function handlePatchSettingsTranslationRules(req, res) {
    const principal = getPrincipal(req);
    if (!canReadSettings(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
      payload = {
        ...payload,
        items: normalizeTranslationRules(payload?.items)
      };
      validateTranslationRulesUpdateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const items = normalizeTranslationRules(payload?.items);
    const saved = await persistTranslationRules({
      items,
      updated_at: nowIso()
    });
    sendJson(res, 200, {
      items: saved.items,
      total: saved.items.length,
      updated_at: saved.updated_at
    });
  }

  return {
    handleGetSettingsTranslationRules,
    handlePatchSettingsTranslationRules
  };
}

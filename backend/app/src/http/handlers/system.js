import { readFile } from "node:fs/promises";
import { normalizeText } from "../../lib/text.js";

export function createSystemHandlers({
  sendJson,
  nowIso,
  stageOrder,
  mobileAppConfig,
  mobileContractMetaPath,
  backendGeneratedRequestFactoryPath
}) {
  let mobileContractMetaPromise = null;

  async function readMobileContractMeta() {
    if (!mobileContractMetaPromise) {
      mobileContractMetaPromise = (async () => {
        try {
          const raw = await readFile(mobileContractMetaPath, "utf8");
          return JSON.parse(raw);
        } catch {
          try {
            const generatedFactorySource = await readFile(backendGeneratedRequestFactoryPath, "utf8");
            const match = generatedFactorySource.match(/GENERATED_CONTRACT_VERSION\s*=\s*"([^"]+)"/);
            if (match?.[1]) {
              return { modelVersion: match[1] };
            }
          } catch {
            // Fall through to unknown
          }
          return { modelVersion: "unknown" };
        }
      })();
    }
    return mobileContractMetaPromise;
  }

  async function handleHealth(_req, res) {
    sendJson(res, 200, {
      ok: true,
      service: "asiatravelplan-backend",
      stage_values: stageOrder,
      timestamp: nowIso()
    });
  }

  async function handleMobileBootstrap(_req, res) {
    const contractMeta = await readMobileContractMeta();
    sendJson(res, 200, {
      app: {
        min_supported_version: mobileAppConfig.minSupportedVersion,
        latest_version: mobileAppConfig.latestVersion,
        force_update: mobileAppConfig.forceUpdate
      },
      api: {
        contract_version: normalizeText(contractMeta.modelVersion) || "unknown"
      },
      features: {
        bookings: true,
        tours: false
      }
    });
  }

  return {
    handleHealth,
    handleMobileBootstrap
  };
}

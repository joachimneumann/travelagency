import {
  APP_ROLES,
  KEYCLOAK_DIRECTORY_CONFIG,
  RUNTIME_PATHS
} from "../src/config/runtime.js";
import { createAtpStaffDirectory } from "../src/lib/atp_staff_directory.js";
import { createKeycloakDirectory } from "../src/lib/keycloak_directory.js";
import { normalizeText } from "../src/lib/text.js";

function isLocalKeycloakBaseUrl(rawBaseUrl) {
  const baseUrl = normalizeText(rawBaseUrl);
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(baseUrl);
  }
}

async function main() {
  const keycloakBaseUrl = normalizeText(KEYCLOAK_DIRECTORY_CONFIG.keycloakBaseUrl || process.env.KEYCLOAK_BASE_URL || "");
  const keycloakRealm = normalizeText(KEYCLOAK_DIRECTORY_CONFIG.keycloakRealm || process.env.KEYCLOAK_REALM || "");
  const useLocalAdminDefaults = isLocalKeycloakBaseUrl(keycloakBaseUrl);
  const keycloakDirectoryUsername = normalizeText(
    KEYCLOAK_DIRECTORY_CONFIG.keycloakDirectoryUsername
    || process.env.KEYCLOAK_DIRECTORY_USERNAME
    || process.env.KEYCLOAK_ADMIN
    || (useLocalAdminDefaults ? "admin" : "")
  );
  const keycloakDirectoryPassword = normalizeText(
    KEYCLOAK_DIRECTORY_CONFIG.keycloakDirectoryPassword
    || process.env.KEYCLOAK_DIRECTORY_PASSWORD
    || process.env.KEYCLOAK_ADMIN_PASSWORD
    || (useLocalAdminDefaults ? "admin" : "")
  );
  const keycloakEnabled = KEYCLOAK_DIRECTORY_CONFIG.keycloakEnabled
    || Boolean(keycloakBaseUrl && keycloakRealm && keycloakDirectoryUsername && keycloakDirectoryPassword);

  const keycloakDirectory = createKeycloakDirectory({
    keycloakEnabled,
    keycloakBaseUrl,
    keycloakRealm,
    keycloakClientId: KEYCLOAK_DIRECTORY_CONFIG.keycloakClientId,
    keycloakAllowedRoles: new Set(Object.values(APP_ROLES).filter(Boolean)),
    keycloakDirectoryUsername,
    keycloakDirectoryPassword,
    keycloakDirectoryAdminRealm: KEYCLOAK_DIRECTORY_CONFIG.keycloakDirectoryAdminRealm
  });

  if (!keycloakDirectory.isConfigured()) {
    const missing = [];
    if (!keycloakEnabled) missing.push("KEYCLOAK_ENABLED");
    if (!keycloakBaseUrl) missing.push("KEYCLOAK_BASE_URL");
    if (!keycloakRealm) missing.push("KEYCLOAK_REALM");
    if (!keycloakDirectoryUsername) missing.push("KEYCLOAK_DIRECTORY_USERNAME/KEYCLOAK_ADMIN");
    if (!keycloakDirectoryPassword) missing.push("KEYCLOAK_DIRECTORY_PASSWORD/KEYCLOAK_ADMIN_PASSWORD");
    throw new Error(`Keycloak directory is not configured for ATP staff sync (missing: ${missing.join(", ") || "unknown"}).`);
  }

  const atpStaffDirectory = createAtpStaffDirectory({
    dataPath: RUNTIME_PATHS.atpStaffProfilesPath,
    photosDir: RUNTIME_PATHS.atpStaffPhotosDir,
    legacyDataPath: RUNTIME_PATHS.legacyRepoAtpStaffProfilesPath,
    legacyPhotosDir: RUNTIME_PATHS.legacyRepoAtpStaffPhotosDir,
    keycloakUsersSnapshotPath: RUNTIME_PATHS.keycloakUserSnapshotPath,
    keycloakDirectory,
    writeQueueRef: { current: Promise.resolve() },
    staffRoleNames: [APP_ROLES.ATP_STAFF, APP_ROLES.ADMIN]
  });

  const items = await atpStaffDirectory.syncProfilesFromKeycloak();
  console.log(`Synced ${items.length} ATP staff profile(s) from Keycloak into ${RUNTIME_PATHS.atpStaffProfilesPath}.`);
}

main().catch((error) => {
  console.error("[sync_atp_staff_from_keycloak]", error?.message || error);
  process.exit(1);
});

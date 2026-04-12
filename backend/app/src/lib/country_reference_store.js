import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text.js";

const DEFAULT_COUNTRY_PRACTICAL_INFO = Object.freeze([
  {
    country: "VN",
    published_on_webpage: true,
    practical_tips: [
      "Carry small cash for markets, taxis, and smaller family-run cafes outside the main tourist zones.",
      "During hot months, schedule walking-heavy sightseeing early and keep the middle of the day lighter.",
      "Light rain protection is useful year-round because showers can build quickly even on otherwise clear days."
    ],
    emergency_contacts: [
      { label: "Police", phone: "113" },
      { label: "Fire", phone: "114" },
      { label: "Ambulance", phone: "115" }
    ]
  },
  {
    country: "TH",
    published_on_webpage: true,
    practical_tips: [
      "Temples require shoulders and knees to be covered, so a light layer is worth carrying on day trips.",
      "Traffic can change transfer times sharply in Bangkok and Phuket, so avoid planning tight back-to-back appointments.",
      "A small amount of cash is still practical for tips, snacks, and local markets even when cards are widely accepted."
    ],
    emergency_contacts: [
      { label: "Tourist police", phone: "1155" },
      { label: "General emergency", phone: "191" },
      { label: "Ambulance and rescue", phone: "1669" }
    ]
  },
  {
    country: "KH",
    published_on_webpage: true,
    practical_tips: [
      "Temple mornings start early; lighter clothing, water, and sun protection make Siem Reap days much more comfortable.",
      "US dollars are still widely used, but small change often comes back in local currency, so keep both handy.",
      "Road transfers can feel longer than map times suggest, especially in wet weather."
    ],
    emergency_contacts: [
      { label: "Police", phone: "117" },
      { label: "Fire", phone: "118" },
      { label: "Ambulance", phone: "119" }
    ]
  },
  {
    country: "LA",
    published_on_webpage: true,
    practical_tips: [
      "Travel days in Laos are best kept intentionally light because mountain roads and river timing can shift the pace.",
      "ATMs are available in main towns, but carrying some cash before moving into smaller areas is still sensible.",
      "Evenings cool down faster in upland areas, so a light layer is useful after sunset."
    ],
    emergency_contacts: [
      { label: "Police", phone: "191" },
      { label: "Fire", phone: "190" },
      { label: "Ambulance", phone: "195" }
    ]
  }
]);

function normalizeEmergencyContact(item) {
  const label = normalizeText(item?.label);
  const phone = normalizeText(item?.phone);
  if (!label || !phone) return null;
  return {
    label,
    phone,
    ...(normalizeText(item?.note) ? { note: normalizeText(item.note) } : {})
  };
}

function normalizeCountryPracticalInfo(item) {
  const country = normalizeText(item?.country).toUpperCase();
  if (!country) return null;
  return {
    country,
    published_on_webpage: item?.published_on_webpage !== false,
    practical_tips: Array.from(new Set((Array.isArray(item?.practical_tips) ? item.practical_tips : []).map((tip) => normalizeText(tip)).filter(Boolean))),
    emergency_contacts: (Array.isArray(item?.emergency_contacts) ? item.emergency_contacts : []).map(normalizeEmergencyContact).filter(Boolean),
    ...(normalizeText(item?.updated_at) ? { updated_at: normalizeText(item.updated_at) } : {})
  };
}

export function createCountryReferenceStore({ dataPath, writeQueueRef, nowIso }) {
  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    try {
      await readFile(dataPath, "utf8");
    } catch {
      await writeFile(
        dataPath,
        `${JSON.stringify({
          items: DEFAULT_COUNTRY_PRACTICAL_INFO.map((item) => ({
            ...item,
            updated_at: nowIso()
          }))
        }, null, 2)}\n`,
        "utf8"
      );
    }
  }

  async function readCountryPracticalInfo() {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      items: (Array.isArray(parsed?.items) ? parsed.items : [])
        .map((item) => normalizeCountryPracticalInfo(item))
        .filter(Boolean)
    };
  }

  async function persistCountryPracticalInfo(payload) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  return {
    ensureStorage,
    readCountryPracticalInfo,
    persistCountryPracticalInfo
  };
}

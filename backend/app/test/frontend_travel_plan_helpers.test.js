import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const helperPath = path.join(repoRoot, "frontend", "scripts", "booking", "travel_plan_helpers.js");
const imagesModulePath = path.join(repoRoot, "frontend", "scripts", "booking", "travel_plan_images.js");
const editorCorePath = path.join(repoRoot, "frontend", "scripts", "shared", "travel_plan_editor_core.js");

async function loadHelpers() {
  global.window = {
    ...(global.window || {}),
    __BOOKING_CONTENT_LANG: "en"
  };
  return await import(`${pathToFileURL(helperPath).href}?test=${Date.now()}`);
}

async function loadImagesModule() {
  global.window = {
    ...(global.window || {}),
    __BOOKING_CONTENT_LANG: "en"
  };
  return await import(`${pathToFileURL(imagesModulePath).href}?test=${Date.now()}`);
}

async function loadEditorCore() {
  global.window = {
    ...(global.window || {}),
    __BOOKING_CONTENT_LANG: "en"
  };
  return await import(`${pathToFileURL(editorCorePath).href}?test=${Date.now()}`);
}

test("normalizeTravelPlanDraft preserves localized maps while keeping flat source text authoritative", async () => {
  const { normalizeTravelPlanDraft } = await loadHelpers();

  const normalized = normalizeTravelPlanDraft({
    days: [
      {
        id: "day_1",
        title: "English day",
        title_i18n: {
          vi: "Ngay tieng Viet",
          de: "Deutscher Tag"
        },
        primary_location_id: "region_central",
        secondary_location_id: "place_hue",
        experience_highlight_ids: ["iconic_landmarks", "cultural_heritage", "iconic_landmarks", ""],
        notes: "English notes",
        notes_i18n: {
          vi: "Ghi chu"
        },
        services: [
          {
            id: "service_1",
            timing_kind: "label",
            time_label: "Morning",
            time_label_i18n: {
              vi: "Buoi sang"
            },
            kind: "other",
            title: "English service",
            title_i18n: {
              vi: "Dich vu"
            },
            details: "English details",
            details_i18n: {
              vi: "Chi tiet"
            },
            image_subtitle: "English subtitle",
            image_subtitle_i18n: {
              vi: "Phu de"
            },
            image: {
              id: "image_1",
              storage_path: "/tmp/service.webp",
              caption: "English caption",
              caption_i18n: {
                vi: "Chu thich"
              },
              alt_text: "English alt text",
              alt_text_i18n: {
                vi: "Van ban thay the"
              }
            }
          }
        ]
      }
    ],
    translation_meta: {
      vi: {
        source_lang: "en",
        source_hash: "hash_1",
        origin: "machine",
        updated_at: "2026-04-25T10:00:00.000Z",
        manual_keys: ["travel_plan.day_1.title", "travel_plan.day_1.title"]
      }
    }
  }, {
    sourceLang: "en",
    targetLang: "en"
  });

  const day = normalized.days[0];
  const service = day.services[0];
  assert.equal(day.title, "English day");
  assert.deepEqual(day.title_i18n, {
    vi: "Ngay tieng Viet",
    de: "Deutscher Tag",
    en: "English day"
  });
  assert.equal(day.primary_location_id, "region_central");
  assert.equal(day.secondary_location_id, "place_hue");
  assert.deepEqual(day.experience_highlight_ids, ["iconic_landmarks"]);
  assert.equal(day.notes, "English notes");
  assert.deepEqual(day.notes_i18n, {
    vi: "Ghi chu",
    en: "English notes"
  });
  assert.equal(service.time_label, "Morning");
  assert.deepEqual(service.time_label_i18n, {
    vi: "Buoi sang",
    en: "Morning"
  });
  assert.equal(service.title, "English service");
  assert.deepEqual(service.title_i18n, {
    vi: "Dich vu",
    en: "English service"
  });
  assert.equal(service.details, "English details");
  assert.deepEqual(service.details_i18n, {
    vi: "Chi tiet",
    en: "English details"
  });
  assert.equal(service.image_subtitle, "English subtitle");
  assert.deepEqual(service.image_subtitle_i18n, {
    vi: "Phu de",
    en: "English subtitle"
  });
  assert.equal(service.image.caption, "English caption");
  assert.deepEqual(service.image.caption_i18n, {
    vi: "Chu thich",
    en: "English caption"
  });
  assert.equal(service.image.alt_text, "English alt text");
  assert.deepEqual(service.image.alt_text_i18n, {
    vi: "Van ban thay the",
    en: "English alt text"
  });
  assert.deepEqual(normalized.translation_meta, {
    vi: {
      source_lang: "en",
      source_hash: "hash_1",
      origin: "machine",
      updated_at: "2026-04-25T10:00:00.000Z",
      manual_keys: ["travel_plan.day_1.title"]
    }
  });
});

test("normalizeTravelPlanDraft does not restore a cleared source field from translations", async () => {
  const { normalizeTravelPlanDraft } = await loadHelpers();

  const normalized = normalizeTravelPlanDraft({
    days: [
      {
        id: "day_1",
        title: "",
        title_i18n: {
          vi: "Ngay tieng Viet"
        },
        services: [
          {
            id: "service_1",
            timing_kind: "label",
            kind: "other",
            title: "",
            title_i18n: {
              vi: "Dich vu"
            }
          }
        ]
      }
    ]
  }, {
    sourceLang: "en",
    targetLang: "en"
  });

  assert.equal(normalized.days[0].title, "");
  assert.deepEqual(normalized.days[0].title_i18n, {
    vi: "Ngay tieng Viet"
  });
  assert.equal(normalized.days[0].services[0].title, "");
  assert.deepEqual(normalized.days[0].services[0].title_i18n, {
    vi: "Dich vu"
  });
});

test("normalizeTravelPlanDraft ignores legacy destinations without explicit scope", async () => {
  const { normalizeTravelPlanDraft } = await loadHelpers();

  const legacyOnly = normalizeTravelPlanDraft({
    destinations: ["VN"],
    destination_scope: [],
    days: []
  });
  assert.deepEqual(legacyOnly.destination_scope, []);
  assert.deepEqual(legacyOnly.destinations, []);

  const scoped = normalizeTravelPlanDraft({
    destinations: ["TH"],
    destination_scope: [
      { destination: "VN", regions: [], places: [] }
    ],
    days: []
  });
  assert.deepEqual(scoped.destination_scope, [{ destination: "VN", regions: [], places: [] }]);
  assert.deepEqual(scoped.destinations, ["VN"]);
});

test("normalizeTravelPlanDraft preserves boundary placement choices", async () => {
  const { normalizeTravelPlanDraft } = await loadHelpers();

  const normalized = normalizeTravelPlanDraft({
    boundary_logistics: {
      arrival: {
        id: "arrival_service",
        boundary_kind: "arrival",
        enabled: true,
        timing_kind: "label",
        kind: "transport",
        title: "Airport pickup",
        presentation: {
          attach_to: "before_first_day",
          position: "start"
        }
      },
      departure: {
        id: "departure_service",
        boundary_kind: "departure",
        enabled: true,
        timing_kind: "label",
        kind: "transport",
        title: "Airport drop-off",
        presentation: {
          attach_to: "after_last_day",
          position: "end"
        }
      }
    },
    days: []
  });

  assert.equal(normalized.boundary_logistics.arrival.presentation.attach_to, "before_first_day");
  assert.equal(normalized.boundary_logistics.departure.presentation.attach_to, "after_last_day");
});

test("experience highlight labels follow the display language while preserving English ids", async () => {
  const { resolveTravelPlanExperienceHighlightTitle } = await loadEditorCore();
  const highlight = {
    id: "beaches_islands",
    title: "Beaches and Islands",
    title_i18n: {
      en: "Beaches and Islands",
      vi: "Bãi biển và đảo"
    }
  };

  assert.equal(
    resolveTravelPlanExperienceHighlightTitle(highlight, {
      displayLang: "vi",
      sourceLang: "en",
      fallbackTitle: highlight.id
    }),
    "Bãi biển và đảo"
  );
  assert.equal(highlight.id, "beaches_islands");
});

test("travel-plan image module can use entity-specific delete request builders", async () => {
  const { createBookingTravelPlanImagesModule } = await loadImagesModule();
  const service = {
    id: "service_1",
    image: {
      id: "image_1",
      storage_path: "/public/v1/tour-images/tour_1/service.webp"
    }
  };
  const state = {
    permissions: { canEditBooking: true },
    booking: { id: "tour_1" }
  };
  const fetchCalls = [];
  const statuses = [];
  let appliedBooking = null;
  let loadedActivities = false;

  const module = createBookingTravelPlanImagesModule({
    state,
    els: {},
    apiOrigin: "http://example.test",
    fetchBookingMutation: async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        booking: {
          id: "tour_1",
          travel_plan: {
            days: [
              {
                id: "day_1",
                services: [{ ...service, image: null }]
              }
            ]
          }
        }
      };
    },
    getBookingRevision: () => 12,
    escapeHtml: (value) => String(value ?? ""),
    ensureTravelPlanReadyForMutation: async () => true,
    findDraftItem: () => service,
    applyTravelPlanMutationBooking: (booking) => {
      appliedBooking = booking;
    },
    loadActivities: async () => {
      loadedActivities = true;
    },
    travelPlanStatus: (message, type) => {
      statuses.push({ message, type });
    },
    buildServiceImageDeleteRequest: ({ state: requestState, dayId, itemId, imageId }) => ({
      url: `/custom/tours/${requestState.booking.id}/days/${dayId}/services/${itemId}/images/${imageId}`,
      method: "DELETE",
      body: { actor: "tester" }
    })
  });

  await module.removeTravelPlanServiceImage("day_1", "service_1", "image_1");

  assert.deepEqual(fetchCalls, [
    {
      url: "/custom/tours/tour_1/days/day_1/services/service_1/images/image_1",
      options: {
        method: "DELETE",
        body: { actor: "tester" }
      }
    }
  ]);
  assert.equal(appliedBooking?.id, "tour_1");
  assert.equal(loadedActivities, true);
  assert.equal(statuses.at(-1)?.type, "success");
});

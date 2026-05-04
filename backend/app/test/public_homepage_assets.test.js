import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { generatePublicHomepageAssets } from "../../../scripts/assets/generate_public_homepage_assets.mjs";

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=";

test("generatePublicHomepageAssets writes static tours, team, and copied assets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const frontendI18nDir = path.join(root, "frontend", "data", "i18n", "frontend");
  const destinationCatalogPath = path.join(toursRoot, "destinations.json");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");
  const homepageHtmlPath = path.join(root, "frontend", "pages", "index.html");
  const generatedHomepageHtmlPath = path.join(frontendDataDir, "index.html");
  const generatedSitemapPath = path.join(frontendDataDir, "sitemap.xml");
  const homepageCopyGlobalPath = path.join(frontendDataDir, "public-homepage-copy.global.js");
  const homepageInitialBundlePath = path.join(frontendDataDir, "public-homepage-main.bundle.js");

  await mkdir(path.join(toursRoot, "tour_alpha"), { recursive: true });
  await mkdir(path.join(toursRoot, "tour_hidden"), { recursive: true });
  await mkdir(path.join(toursRoot, "tour_unpublished"), { recursive: true });
  await mkdir(path.join(staffRoot, "photos"), { recursive: true });
  await mkdir(frontendI18nDir, { recursive: true });
  await mkdir(path.dirname(homepageHtmlPath), { recursive: true });

  await writeJson(path.join(frontendI18nDir, "en.json"), {
    "hero.title": "Private holidays in Vietnam, Thailand, Cambodia and Laos",
    "hero.title_with_destinations": "Private holidays in {destinations}"
  });
  await writeJson(path.join(frontendI18nDir, "de.json"), {
    "hero.title": "Privaturlaub in Vietnam, Thailand, Kambodscha und Laos",
    "hero.title_with_destinations": "Privaturlaub in {destinations}"
  });
  await writeFile(
    homepageHtmlPath,
    '<!doctype html><html><head><title data-i18n-id="meta.home_title">Old title</title><meta name="description" content="Old description" data-i18n-content-id="meta.home_description"><meta property="og:title" content="Old title" data-i18n-content-id="meta.home_title"><script type="application/ld+json">{"@context":"https://schema.org","@type":"TravelAgency","description":"Old schema","areaServed":["Vietnam","Thailand"]}</script></head><body><h1 id="heroTitle" class="hero-title-only" data-i18n-id="hero.title">Old title</h1><script src="/frontend/data/generated/homepage/public-homepage-copy.global.js"></script></body></html>\n'
  );

  await writeJson(path.join(contentRoot, "country_reference_info.json"), {
    items: [
      { country: "VN", published_on_webpage: true },
      { country: "TH", published_on_webpage: false },
      { country: "KH", published_on_webpage: false },
      { country: "LA", published_on_webpage: false }
    ]
  });

  await writeJson(path.join(toursRoot, "tour_alpha", "tour.json"), {
    id: "tour_alpha",
    title: { en: "Alpha tour", de: "Alpha Reise" },
    seo_slug: "alpha-custom-route",
    short_description: { en: "Alpha description", de: "Alpha Beschreibung" },
    styles: ["budget"],
    image: "/public/v1/tour-images/tour_alpha/alpha.png",
    travel_plan: {
      tour_card_primary_image_id: "travel_plan_service_image_featured",
      tour_card_image_ids: [
        "travel_plan_service_image_featured",
        "travel_plan_service_image_pickup"
      ],
      destination_scope: [
        {
          destination: "VN",
          areas: [
            {
              area_id: "area_central",
              places: [
                { place_id: "place_hoi_an" }
              ]
            }
          ]
        },
        { destination: "TH", areas: [] }
      ],
      days: [
        {
          day_number: 1,
          title: "Arrival day",
          title_i18n: { de: "Ankunftstag" },
          services: [
            {
              title: "Airport pick-up",
              title_i18n: { de: "Flughafenabholung" },
              details: "Private transfer to the hotel.",
              details_i18n: { de: "Privater Transfer zum Hotel." },
              image: {
                id: "travel_plan_service_image_pickup",
                storage_path: "/public/v1/tour-images/tour_alpha/travel-plan-services/pickup.png",
                alt_text: "Driver at arrivals",
                alt_text_i18n: { en: "Driver at arrivals", de: "Fahrer bei der Ankunft" },
                include_in_travel_tour_card: true
              }
            },
            {
              title: "Featured viewpoint",
              title_i18n: { de: "Aussichtspunkt" },
              details: "The selected card image should be first.",
              details_i18n: { de: "Das ausgewählte Kartenbild sollte zuerst erscheinen." },
              image: {
                id: "travel_plan_service_image_featured",
                storage_path: "/public/v1/tour-images/tour_alpha/travel-plan-services/featured.png",
                alt_text: "Featured viewpoint",
                alt_text_i18n: { en: "Featured viewpoint", de: "Aussichtspunkt" },
                include_in_travel_tour_card: true
              }
            },
            {
              title: "Legacy included image",
              title_i18n: { de: "Altes ausgewähltes Bild" },
              details: "The ordered selection should be authoritative.",
              details_i18n: { de: "Die sortierte Auswahl sollte maßgeblich sein." },
              image: {
                id: "travel_plan_service_image_legacy",
                storage_path: "/public/v1/tour-images/tour_alpha/travel-plan-services/legacy.png",
                alt_text: "Legacy viewpoint",
                alt_text_i18n: { en: "Legacy viewpoint", de: "Alter Aussichtspunkt" },
                include_in_travel_tour_card: true
              }
            }
          ]
        }
      ]
    },
    priority: 80,
    updated_at: "2026-04-14T12:34:56.000Z"
  });
  await writeFile(path.join(toursRoot, "tour_alpha", "alpha.png"), Buffer.from(TINY_PNG_BASE64, "base64"));
  await mkdir(path.join(toursRoot, "tour_alpha", "travel-plan-services"), { recursive: true });
  await writeFile(path.join(toursRoot, "tour_alpha", "travel-plan-services", "pickup.png"), Buffer.from(TINY_PNG_BASE64, "base64"));
  await writeFile(path.join(toursRoot, "tour_alpha", "travel-plan-services", "featured.png"), Buffer.from(TINY_PNG_BASE64, "base64"));
  await writeFile(path.join(toursRoot, "tour_alpha", "travel-plan-services", "legacy.png"), Buffer.from(TINY_PNG_BASE64, "base64"));
  await writeJson(path.join(contentRoot, "translations", "customers", "marketing-tours.vi.json"), {
    items: [
      { source_text: "Alpha tour", target_text: "Tour Alpha" },
      { source_text: "Alpha description", target_text: "Mo ta Alpha" },
      { source_text: "Arrival day", target_text: "Ngay den" },
      { source_text: "Airport pick-up", target_text: "Don san bay" },
      { source_text: "Private transfer to the hotel.", target_text: "Xe rieng ve khach san." },
      { source_text: "Driver at arrivals", target_text: "Tai xe tai sanh den" }
    ]
  });
  await writeJson(path.join(contentRoot, "one-pagers", "manifest.json"), {
    tours: [
      {
        id: "tour_alpha",
        artifacts: [
          {
            lang: "en",
            pdf: "pdfs/tour_alpha/en.pdf",
            selected_experience_highlight_ids: [
              "iconic_landmarks",
              "delicious_cuisine",
              "cultural_heritage",
              "local_experiences"
            ]
          },
          {
            lang: "de",
            pdf: "pdfs/tour_alpha/de.pdf",
            selected_experience_highlight_ids: [
              "iconic_landmarks",
              "delicious_cuisine"
            ]
          },
          {
            lang: "vi",
            pdf: "pdfs/tour_alpha/vi.pdf",
            selected_experience_highlight_ids: [
              "iconic_landmarks",
              "delicious_cuisine",
              "cultural_heritage",
              "local_experiences"
            ]
          }
        ]
      }
    ]
  });

  await writeJson(path.join(toursRoot, "tour_hidden", "tour.json"), {
    id: "tour_hidden",
    title: { en: "Hidden tour" },
    short_description: { en: "Should not appear" },
    styles: ["luxury"],
    image: "/public/v1/tour-images/tour_hidden/hidden.png",
    travel_plan: {
      destination_scope: [
        { destination: "TH", areas: [] }
      ],
      days: []
    },
    priority: 20,
    updated_at: "2026-04-14T10:00:00.000Z"
  });
  await writeFile(path.join(toursRoot, "tour_hidden", "hidden.png"), Buffer.from(TINY_PNG_BASE64, "base64"));

  await writeJson(path.join(toursRoot, "tour_unpublished", "tour.json"), {
    id: "tour_unpublished",
    title: { en: "Unpublished tour", de: "Unveroffentlichte Reise" },
    short_description: { en: "Should not appear even though its destination is public." },
    styles: ["luxury"],
    published_on_webpage: false,
    travel_plan: {
      destination_scope: [
        { destination: "VN", areas: [] }
      ],
      days: []
    },
    priority: 90,
    updated_at: "2026-04-14T11:00:00.000Z"
  });

  await writeJson(destinationCatalogPath, {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 1 },
      { code: "TH", label: "Thailand", sort_order: 2 }
    ],
    destination_areas: [
      { id: "area_central", destination: "VN", code: "central", name: "Central", sort_order: 1 },
      { id: "area_north", destination: "VN", code: "north", name: "North", sort_order: 2 }
    ],
    destination_places: [
      { id: "place_hoi_an", area_id: "area_central", code: "hoi-an", name: "Hoi An", sort_order: 1 },
      { id: "place_unused", area_id: "area_central", code: "unused", name: "Unused", sort_order: 2 },
      { id: "place_hanoi", area_id: "area_north", code: "hanoi", name: "Hanoi", sort_order: 3 }
    ]
  });

  await writeJson(path.join(staffRoot, "staff.json"), {
    staff: {
      joachim: {
        name: "Joachim",
        position: { en: "Founder", de: "Grunder" },
        description: { en: "Long intro", de: "Lange intro" },
        short_description: { en: "Short intro", de: "Kurze intro" },
        picture: "joachim.webp",
        team_order: 1,
        languages: ["en", "de"],
        destinations: ["VN", "TH"],
        appears_in_team_web_page: true
      },
      hidden: {
        name: "Hidden",
        position: { en: "Hidden" },
        picture: "hidden.webp",
        appears_in_team_web_page: false
      },
      alpha: {
        name: "Alpha",
        position: { en: "Guide" },
        picture: "alpha.webp",
        team_order: 10,
        appears_in_team_web_page: true
      },
      beta: {
        name: "Beta",
        position: { en: "Guide" },
        picture: "/assets/generated/homepage/team/beta.webp?v=12345",
        team_order: 2,
        appears_in_team_web_page: true
      },
      gamma: {
        name: "Gamma",
        position: { en: "Guide" },
        picture: "/assets/generated/homepage/team/stale-gamma.webp?v=12345",
        team_order: 3,
        appears_in_team_web_page: true
      }
    }
  });
  await writeFile(path.join(staffRoot, "photos", "joachim.webp"), "joachim-image");
  await writeFile(path.join(staffRoot, "photos", "hidden.webp"), "hidden-image");
  await writeFile(path.join(staffRoot, "photos", "alpha.webp"), "alpha-image");
  await writeFile(path.join(staffRoot, "photos", "beta.webp"), "beta-image");
  await writeFile(path.join(staffRoot, "photos", "gamma.webp"), "gamma-image");

  await generatePublicHomepageAssets({
    toursRoot,
    staffRoot,
    countryReferenceInfoPath: path.join(contentRoot, "country_reference_info.json"),
    destinationCatalogPath,
    frontendDataDir,
    tourOutputDir,
    teamOutputDir,
    frontendI18nDir,
    homepageCopyGlobalPath,
    homepageTemplatePath: homepageHtmlPath,
    languages: ["en", "de", "vi"]
  });

  const publicToursEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.en.json"), "utf8"));
  const publicToursDe = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.de.json"), "utf8"));
  const publicToursVi = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.vi.json"), "utf8"));
  const publicTourDestinationsEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tour-destinations.en.json"), "utf8"));
  const publicTourDetailsEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tour-details.en.tour_alpha.json"), "utf8"));
  const publicTourDetailsDe = JSON.parse(await readFile(path.join(frontendDataDir, "public-tour-details.de.tour_alpha.json"), "utf8"));
  const publicTourDetailsVi = JSON.parse(await readFile(path.join(frontendDataDir, "public-tour-details.vi.tour_alpha.json"), "utf8"));
  const publicTeam = JSON.parse(await readFile(path.join(frontendDataDir, "public-team.json"), "utf8"));
  const publicReels = JSON.parse(await readFile(path.join(root, "frontend", "data", "generated", "reels", "public-reels.json"), "utf8"));
  const homepageCopyGlobal = await readFile(homepageCopyGlobalPath, "utf8");
  const homepageInitialBundle = await readFile(homepageInitialBundlePath, "utf8");
  const homepageHtml = await readFile(homepageHtmlPath, "utf8");
  const generatedHomepageHtml = await readFile(generatedHomepageHtmlPath, "utf8");
  const generatedSitemap = await readFile(generatedSitemapPath, "utf8");
  const generatedDestinationHtml = await readFile(path.join(frontendDataDir, "seo", "destinations", "vietnam.html"), "utf8");
  const generatedStyleHtml = await readFile(path.join(frontendDataDir, "seo", "travel-styles", "budget.html"), "utf8");
  const generatedTourHtml = await readFile(path.join(frontendDataDir, "seo", "tours", "alpha-custom-route.html"), "utf8");

  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_alpha");
  assert.equal(publicToursEn.items[0].seo_slug, "alpha-custom-route");
  assert.doesNotMatch(JSON.stringify(publicToursEn), /tour_unpublished|Unpublished tour/);
  assert.deepEqual(publicToursEn.items[0].destination_codes, ["vietnam"]);
  assert.deepEqual(publicToursEn.available_destinations, [{ code: "vietnam", label: "Vietnam" }]);
  assert.equal(publicToursEn.available_destination_scope_catalog, undefined);
  assert.deepEqual(publicTourDestinationsEn.available_destination_scope_catalog, {
    destinations: [{ code: "vietnam", country_code: "VN", label: "Vietnam" }],
    areas: [{ id: "area_central", destination: "vietnam", country_code: "VN", code: "central", label: "Central" }],
    places: [{ id: "place_hoi_an", area_id: "area_central", code: "hoi-an", label: "Hoi An" }]
  });
  assert.equal("travel_plan" in publicToursEn.items[0], false);
  assert.equal(publicToursEn.items[0].travel_plan_day_count, 1);
  assert.equal(publicToursEn.items[0].has_travel_plan_details, true);
  assert.match(publicToursEn.items[0].travel_plan_details_url, /^\/frontend\/data\/generated\/homepage\/public-tour-details\.en\.tour_alpha\.json\?v=/);
  assert.deepEqual(publicToursEn.items[0].destination_scope, [
    {
      destination: "VN",
      areas: [
        {
          area_id: "area_central",
          places: [
            { place_id: "place_hoi_an" }
          ]
        }
      ]
    }
  ]);
  assert.equal(publicTourDetailsEn.travel_plan.tour_card_primary_image_id, "travel_plan_service_image_featured");
  assert.deepEqual(publicTourDetailsEn.travel_plan.tour_card_image_ids, [
    "travel_plan_service_image_featured",
    "travel_plan_service_image_pickup"
  ]);
  assert.match(publicToursEn.items[0].pictures[0], /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/featured\.(png|webp)\?v=/);
  assert.match(publicToursEn.items[0].pictures[1], /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/pickup\.(png|webp)\?v=/);
  assert.equal(publicToursEn.items[0].pictures.length, 2);
  assert.match(
    publicTourDetailsEn.travel_plan.days[0].services[0].image.storage_path,
    /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/pickup\.(png|webp)\?v=/
  );
  assert.equal(publicTourDetailsEn.travel_plan.days[0].services[0].image.alt_text, "Driver at arrivals");
  assert.equal(publicTourDetailsEn.travel_plan.days[0].services[0].image.include_in_travel_tour_card, true);
  assert.equal(publicTourDetailsEn.travel_plan.days[0].services[2].image.include_in_travel_tour_card, false);
  assert.equal(publicTourDetailsEn.one_pager_pdf_url, "/content/one-pagers/pdfs/tour_alpha/en.pdf");
  assert.deepEqual(publicTourDetailsEn.one_pager_experience_highlight_ids, [
    "iconic_landmarks",
    "delicious_cuisine",
    "cultural_heritage",
    "local_experiences"
  ]);
  assert.deepEqual(publicTourDetailsEn.one_pager_experience_highlights.map((item) => item.title), [
    "Iconic Landmarks",
    "Delicious Cuisine",
    "Cultural Heritage",
    "Local Experiences"
  ]);
  assert.deepEqual(publicTourDetailsEn.one_pager_experience_highlights.map((item) => item.image_src), [
    "/assets/img/experience-highlights/01.png",
    "/assets/img/experience-highlights/04.png",
    "/assets/img/experience-highlights/02.png",
    "/assets/img/experience-highlights/03.png"
  ]);
  assert.equal("image" in publicToursEn.items[0], false);

  assert.equal(publicToursDe.items[0].title, "Alpha Reise");
  assert.equal(publicToursDe.items[0].seo_slug, "alpha-custom-route");
  assert.equal(publicToursDe.items[0].short_description, "Alpha Beschreibung");
  assert.equal(publicTourDetailsDe.one_pager_pdf_url, "/content/one-pagers/pdfs/tour_alpha/de.pdf");
  assert.equal(publicTourDetailsDe.one_pager_experience_highlight_ids.length, 4);
  assert.equal(new Set(publicTourDetailsDe.one_pager_experience_highlight_ids).size, 4);
  assert.ok(publicTourDetailsDe.one_pager_experience_highlight_ids.includes("iconic_landmarks"));
  assert.ok(publicTourDetailsDe.one_pager_experience_highlight_ids.includes("delicious_cuisine"));
  assert.equal(publicTourDetailsDe.one_pager_experience_highlights.length, 4);
  assert.equal(publicToursVi.items[0].title, "Tour Alpha");
  assert.equal(publicToursVi.items[0].short_description, "Mo ta Alpha");
  assert.equal(publicTourDetailsVi.one_pager_pdf_url, "/content/one-pagers/pdfs/tour_alpha/vi.pdf");
  assert.deepEqual(publicTourDetailsVi.one_pager_experience_highlights.map((item) => item.title), [
    "Địa danh biểu tượng",
    "Ẩm thực đặc sắc",
    "Di sản văn hóa",
    "Trải nghiệm địa phương"
  ]);
  assert.equal(publicTourDetailsVi.travel_plan.days[0].title_i18n.vi, "Ngay den");
  assert.equal(publicTourDetailsVi.travel_plan.days[0].services[0].title_i18n.vi, "Don san bay");
  assert.equal(publicTourDetailsVi.travel_plan.days[0].services[0].details_i18n.vi, "Xe rieng ve khach san.");
  assert.equal(publicTourDetailsVi.travel_plan.days[0].services[0].image.alt_text_i18n.vi, "Tai xe tai sanh den");
  assert.match(
    publicTourDetailsDe.travel_plan.days[0].services[0].image.storage_path,
    /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/pickup\.(png|webp)\?v=/
  );
  assert.deepEqual(publicToursDe.available_styles, [{ code: "budget", label: "Budget" }]);
  assert.deepEqual(publicToursVi.available_styles, [{ code: "budget", label: "Tiết kiệm" }]);
  assert.deepEqual(publicReels, { items: [] });
  assert.match(homepageCopyGlobal, /heroTitleByLang/);
  assert.match(homepageCopyGlobal, /metaTitleByLang/);
  assert.match(homepageCopyGlobal, /metaDescriptionByLang/);
  assert.match(homepageCopyGlobal, /areaServed/);
  assert.match(homepageCopyGlobal, /assetUrls/);
  assert.match(homepageCopyGlobal, /public-tours\.en\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-tour-destinations\.en\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-team\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-reels\.json\?v=/);
  assert.match(homepageCopyGlobal, /"en": "Private holidays in Vietnam"/);
  assert.match(homepageCopyGlobal, /"de": "Privaturlaub in Vietnam"/);
  assert.match(homepageCopyGlobal, /"en": "AsiaTravelPlan \| Private holidays in Vietnam"/);
  assert.match(homepageCopyGlobal, /Private holidays in Vietnam with clear pricing and local support/);
  assert.match(homepageInitialBundle, /function createFrontendToursController/);
  assert.doesNotMatch(homepageInitialBundle, /function frontendT\(/);
  assert.match(homepageInitialBundle, /const frontendT = \(id, fallback, vars\) => \{/);
  assert.match(homepageInitialBundle, /<a class="btn tour-card__show-more"/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/main_booking_form_options\.js"\)/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/main_reels\.js"\)/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/shared\/auth\.js"\)/);
  assert.doesNotMatch(
    homepageInitialBundle,
    /tour_style_catalog|TOUR_STYLE_CODE_OPTIONS|generated_catalogs/,
    "Generated homepage runtime should read travel-style labels from public-tours.<lang>.json, not the shared style catalog"
  );
  assert.match(homepageHtml, />Old title</);
  assert.match(generatedHomepageHtml, /<title data-i18n-id="meta\.home_title">AsiaTravelPlan \| Private holidays in Vietnam<\/title>/);
  assert.match(generatedHomepageHtml, /content="Private holidays in Vietnam with clear pricing and local support\. Book a free discovery call\."/);
  assert.match(generatedHomepageHtml, />Private holidays in Vietnam<\/h1>/);
  assert.match(generatedHomepageHtml, /"areaServed": \[\s*"Vietnam"\s*\]/);
  assert.doesNotMatch(generatedHomepageHtml, /Thailand/);
  const generatedTravelAgencySchema = JSON.parse(generatedHomepageHtml.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1] || "{}");
  assert.equal(generatedTravelAgencySchema.telephone, "+84 354999192");
  assert.equal(generatedTravelAgencySchema.email, "info@asiatravelplan.com");
  assert.equal(generatedTravelAgencySchema.identifier?.value, "4001328591");
  assert.deepEqual(
    generatedTravelAgencySchema.address?.map((address) => address.name),
    ["Head office in Hội An", "Office in Hà Nội"]
  );
  assert.equal(generatedTravelAgencySchema.contactPoint?.[0]?.url, "https://wa.me/84354999192");
  assert.match(generatedSitemap, /https:\/\/asiatravelplan\.com\/destinations\/vietnam/);
  assert.match(generatedSitemap, /https:\/\/asiatravelplan\.com\/travel-styles\/budget/);
  assert.match(generatedSitemap, /https:\/\/asiatravelplan\.com\/tours\/alpha-custom-route/);
  assert.doesNotMatch(generatedSitemap, /tour_unpublished/);
  assert.match(generatedSitemap, /https:\/\/asiatravelplan\.com\/privacy\.html/);
  assert.match(generatedDestinationHtml, /<h1>Private tours in Vietnam<\/h1>/);
  assert.match(generatedDestinationHtml, /"@type":"WebPage"/);
  assert.match(generatedDestinationHtml, /<a href="\/tours\/alpha-custom-route">Alpha tour<\/a>/);
  assert.match(generatedStyleHtml, /<h1>Budget private tours<\/h1>/);
  assert.match(generatedTourHtml, /<title>Alpha tour \| AsiaTravelPlan<\/title>/);
  assert.match(generatedTourHtml, /<meta name="twitter:title" content="Alpha tour \| AsiaTravelPlan" \/>/);
  assert.match(generatedTourHtml, /"@type":"WebPage"/);
  assert.match(generatedTourHtml, /"@type":"TouristTrip"/);
  assert.doesNotMatch(homepageHtml, /public-homepage-copy\.manifest\.json/);

  assert.equal(publicTeam.total, 4);
  assert.equal(publicTeam.items[0].username, "joachim");
  assert.equal(publicTeam.items[0].name, "Joachim");
  assert.equal(publicTeam.items[0].position, "Founder");
  assert.equal(publicTeam.items[0].team_order, 1);
  assert.equal(publicTeam.items[1].username, "beta");
  assert.equal(publicTeam.items[1].team_order, 2);
  assert.match(publicTeam.items[1].picture_ref, /^\/assets\/generated\/homepage\/team\/beta\.webp\?v=/);
  assert.equal(publicTeam.items[2].username, "gamma");
  assert.equal(publicTeam.items[2].team_order, 3);
  assert.match(publicTeam.items[2].picture_ref, /^\/assets\/generated\/homepage\/team\/gamma\.webp\?v=/);
  assert.equal(publicTeam.items[3].username, "alpha");
  assert.equal(publicTeam.items[3].team_order, 10);
  assert.match(publicTeam.items[0].picture_ref, /^\/assets\/generated\/homepage\/team\/joachim\.webp\?v=/);
  assert.equal("appears_in_team_web_page" in publicTeam.items[0], false);

  const copiedTourAssetPath = new URL(publicToursEn.items[0].pictures[0], "https://asiatravelplan.test").pathname;
  const copiedServiceAssetPath = new URL(publicTourDetailsEn.travel_plan.days[0].services[0].image.storage_path, "https://asiatravelplan.test").pathname;
  const copiedTourAsset = await stat(path.join(tourOutputDir, copiedTourAssetPath.replace(/^\/assets\/generated\/homepage\/tours\//, "")));
  const copiedServiceAsset = await stat(path.join(tourOutputDir, copiedServiceAssetPath.replace(/^\/assets\/generated\/homepage\/tours\//, "")));
  const copiedTeamAsset = await stat(path.join(teamOutputDir, "joachim.webp"));
  assert.ok(copiedTourAsset.isFile());
  assert.ok(copiedServiceAsset.isFile());
  assert.ok(copiedTeamAsset.isFile());
});

test("generatePublicHomepageAssets fails when a tour destination is not listed in destinations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-missing-destination-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const frontendI18nDir = path.join(root, "frontend", "data", "i18n", "frontend");
  const destinationCatalogPath = path.join(toursRoot, "destinations.json");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");

  await mkdir(path.join(toursRoot, "tour_unlisted_destination"), { recursive: true });
  await mkdir(frontendI18nDir, { recursive: true });
  await writeJson(path.join(frontendI18nDir, "en.json"), {
    "hero.title": "Private holidays in Vietnam",
    "hero.title_with_destinations": "Private holidays in {destinations}"
  });
  await writeJson(path.join(contentRoot, "country_reference_info.json"), { items: [] });
  await writeJson(destinationCatalogPath, {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 1 }
    ]
  });
  await writeJson(path.join(toursRoot, "tour_unlisted_destination", "tour.json"), {
    id: "tour_unlisted_destination",
    title: { en: "Unlisted destination tour" },
    short_description: { en: "Should fail before deployment assets are generated." },
    travel_plan: {
      destination_scope: [
        { destination: "TH", areas: [] }
      ],
      days: []
    },
    updated_at: "2026-04-14T12:34:56.000Z"
  });

  await assert.rejects(
    generatePublicHomepageAssets({
      toursRoot,
      staffRoot,
      countryReferenceInfoPath: path.join(contentRoot, "country_reference_info.json"),
      destinationCatalogPath,
      frontendDataDir,
      tourOutputDir,
      teamOutputDir,
      frontendI18nDir,
      languages: ["en"]
    }),
    /not listed in .*destinations\.json: tour_unlisted_destination: thailand/
  );
});

test("generatePublicHomepageAssets falls back when a visible tour image is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-missing-tour-image-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const frontendI18nDir = path.join(root, "frontend", "data", "i18n", "frontend");
  const destinationCatalogPath = path.join(toursRoot, "destinations.json");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");

  await mkdir(path.join(toursRoot, "tour_missing_image"), { recursive: true });
  await mkdir(frontendI18nDir, { recursive: true });
  await writeJson(path.join(frontendI18nDir, "en.json"), {
    "hero.title": "Private holidays in Vietnam",
    "hero.title_with_destinations": "Private holidays in {destinations}"
  });
  await writeJson(path.join(contentRoot, "country_reference_info.json"), { items: [] });
  await writeJson(destinationCatalogPath, {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 1 }
    ]
  });
  await writeJson(path.join(toursRoot, "tour_missing_image", "tour.json"), {
    id: "tour_missing_image",
    title: { en: "Missing image tour" },
    short_description: { en: "Visible but stale image reference" },
    image: "/public/v1/tour-images/tour_missing_image/missing.png",
    travel_plan: {
      tour_card_image_ids: [
        "travel_plan_service_image_missing_one",
        "travel_plan_service_image_missing_two"
      ],
      destination_scope: [
        { destination: "VN", areas: [] }
      ],
      days: [{
        services: [
          {
            title: "Missing image one",
            image: {
              id: "travel_plan_service_image_missing_one",
              storage_path: "/public/v1/tour-images/tour_missing_image/missing-one.png",
              include_in_travel_tour_card: true
            }
          },
          {
            title: "Missing image two",
            image: {
              id: "travel_plan_service_image_missing_two",
              storage_path: "/public/v1/tour-images/tour_missing_image/missing-two.png",
              include_in_travel_tour_card: true
            }
          }
        ]
      }]
    },
    priority: 10,
    updated_at: "2026-04-14T12:34:56.000Z"
  });

  await generatePublicHomepageAssets({
    toursRoot,
    staffRoot,
    countryReferenceInfoPath: path.join(contentRoot, "country_reference_info.json"),
    destinationCatalogPath,
    frontendDataDir,
    tourOutputDir,
    teamOutputDir,
    frontendI18nDir,
    languages: ["en"]
  });

  const homepageCopy = await stat(path.join(frontendDataDir, "public-homepage-copy.global.js"));
  const publicToursEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.en.json"), "utf8"));
  assert.ok(homepageCopy.isFile());
  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_missing_image");
  assert.deepEqual(publicToursEn.items[0].pictures, []);
  assert.equal("image" in publicToursEn.items[0], false);
});

test("generatePublicHomepageAssets fails when a visible staff photo is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-missing-photo-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const frontendI18nDir = path.join(root, "frontend", "data", "i18n", "frontend");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");
  const homepageCopyGlobalPath = path.join(frontendDataDir, "public-homepage-copy.global.js");

  await mkdir(toursRoot, { recursive: true });
  await mkdir(path.join(staffRoot, "photos"), { recursive: true });
  await mkdir(frontendI18nDir, { recursive: true });

  await writeJson(path.join(frontendI18nDir, "en.json"), {
    "hero.title": "Private holidays in Vietnam",
    "hero.title_with_destinations": "Private holidays in {destinations}"
  });
  await writeJson(path.join(contentRoot, "country_reference_info.json"), { items: [] });
  await writeJson(path.join(staffRoot, "staff.json"), {
    staff: {
      vic: {
        name: "Vic",
        appears_in_team_web_page: true
      }
    }
  });
  await writeFile(path.join(staffRoot, "photos", "vic.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

  await assert.rejects(
    generatePublicHomepageAssets({
      toursRoot,
      staffRoot,
      countryReferenceInfoPath: path.join(contentRoot, "country_reference_info.json"),
      frontendDataDir,
      tourOutputDir,
      teamOutputDir,
      frontendI18nDir,
      homepageCopyGlobalPath,
      languages: ["en"]
    }),
    /Public staff profile "vic" is missing a usable picture file/
  );
});

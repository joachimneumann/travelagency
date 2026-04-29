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
  const storePath = path.join(root, "backend", "app", "data", "store.json");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");
  const homepageHtmlPath = path.join(root, "frontend", "pages", "index.html");
  const generatedHomepageHtmlPath = path.join(frontendDataDir, "index.html");
  const generatedSitemapPath = path.join(frontendDataDir, "sitemap.xml");
  const homepageCopyGlobalPath = path.join(frontendDataDir, "public-homepage-copy.global.js");
  const homepageInitialBundlePath = path.join(frontendDataDir, "public-homepage-main.bundle.js");

  await mkdir(path.join(toursRoot, "tour_alpha"), { recursive: true });
  await mkdir(path.join(toursRoot, "tour_hidden"), { recursive: true });
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
    short_description: { en: "Alpha description", de: "Alpha Beschreibung" },
    styles: ["budget"],
    image: "/public/v1/tour-images/tour_alpha/alpha.png",
    travel_plan: {
      tour_card_primary_image_id: "travel_plan_service_image_featured",
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
          title: { en: "Arrival day", de: "Ankunftstag" },
          services: [
            {
              title: { en: "Airport pick-up", de: "Flughafenabholung" },
              details: { en: "Private transfer to the hotel.", de: "Privater Transfer zum Hotel." },
              image: {
                id: "travel_plan_service_image_pickup",
                storage_path: "/public/v1/tour-images/tour_alpha/travel-plan-services/pickup.png",
                alt_text: "Driver at arrivals",
                alt_text_i18n: { en: "Driver at arrivals", de: "Fahrer bei der Ankunft" },
                include_in_travel_tour_card: true
              }
            },
            {
              title: { en: "Featured viewpoint", de: "Aussichtspunkt" },
              details: { en: "The selected card image should be first.", de: "Das ausgewählte Kartenbild sollte zuerst erscheinen." },
              image: {
                id: "travel_plan_service_image_featured",
                storage_path: "/public/v1/tour-images/tour_alpha/travel-plan-services/featured.png",
                alt_text: "Featured viewpoint",
                alt_text_i18n: { en: "Featured viewpoint", de: "Aussichtspunkt" },
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

  await writeJson(storePath, {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 1 }
    ],
    destination_areas: [
      { id: "area_central", destination: "VN", code: "central", name: "Central", sort_order: 1 }
    ],
    destination_places: [
      { id: "place_hoi_an", area_id: "area_central", code: "hoi-an", name: "Hoi An", sort_order: 1 }
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
    storePath,
    frontendDataDir,
    tourOutputDir,
    teamOutputDir,
    frontendI18nDir,
    homepageCopyGlobalPath,
    homepageTemplatePath: homepageHtmlPath,
    languages: ["en", "de"]
  });

  const publicToursEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.en.json"), "utf8"));
  const publicToursDe = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.de.json"), "utf8"));
  const publicTeam = JSON.parse(await readFile(path.join(frontendDataDir, "public-team.json"), "utf8"));
  const publicReels = JSON.parse(await readFile(path.join(root, "frontend", "data", "generated", "reels", "public-reels.json"), "utf8"));
  const homepageCopyGlobal = await readFile(homepageCopyGlobalPath, "utf8");
  const homepageInitialBundle = await readFile(homepageInitialBundlePath, "utf8");
  const homepageHtml = await readFile(homepageHtmlPath, "utf8");
  const generatedHomepageHtml = await readFile(generatedHomepageHtmlPath, "utf8");
  const generatedSitemap = await readFile(generatedSitemapPath, "utf8");
  const generatedDestinationHtml = await readFile(path.join(frontendDataDir, "seo", "destinations", "vietnam.html"), "utf8");
  const generatedStyleHtml = await readFile(path.join(frontendDataDir, "seo", "travel-styles", "budget.html"), "utf8");
  const generatedTourHtml = await readFile(path.join(frontendDataDir, "seo", "tours", "alpha-tour-alpha.html"), "utf8");

  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_alpha");
  assert.deepEqual(publicToursEn.items[0].destination_codes, ["vietnam"]);
  assert.deepEqual(publicToursEn.available_destinations, [{ code: "vietnam", label: "Vietnam" }]);
  assert.deepEqual(publicToursEn.available_destination_scope_catalog, {
    destinations: [{ code: "vietnam", country_code: "VN", label: "Vietnam" }],
    areas: [{ id: "area_central", destination: "vietnam", country_code: "VN", code: "central", label: "Central" }],
    places: [{ id: "place_hoi_an", area_id: "area_central", code: "hoi-an", label: "Hoi An" }]
  });
  assert.equal(publicToursEn.items[0].travel_plan.tour_card_primary_image_id, "travel_plan_service_image_featured");
  assert.match(publicToursEn.items[0].pictures[0], /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/featured\.(png|webp)\?v=/);
  assert.match(publicToursEn.items[0].pictures[1], /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/pickup\.(png|webp)\?v=/);
  assert.match(
    publicToursEn.items[0].travel_plan.days[0].services[0].image.storage_path,
    /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/pickup\.(png|webp)\?v=/
  );
  assert.equal(publicToursEn.items[0].travel_plan.days[0].services[0].image.alt_text, "Driver at arrivals");
  assert.equal(publicToursEn.items[0].travel_plan.days[0].services[0].image.include_in_travel_tour_card, true);
  assert.equal("image" in publicToursEn.items[0], false);

  assert.equal(publicToursDe.items[0].title, "Alpha Reise");
  assert.equal(publicToursDe.items[0].short_description, "Alpha Beschreibung");
  assert.match(
    publicToursDe.items[0].travel_plan.days[0].services[0].image.storage_path,
    /^\/assets\/generated\/homepage\/tours\/tour_alpha\/travel-plan-services\/pickup\.(png|webp)\?v=/
  );
  assert.deepEqual(publicToursDe.available_styles, [{ code: "budget", label: "Budget" }]);
  assert.deepEqual(publicReels, { items: [] });
  assert.match(homepageCopyGlobal, /heroTitleByLang/);
  assert.match(homepageCopyGlobal, /metaTitleByLang/);
  assert.match(homepageCopyGlobal, /metaDescriptionByLang/);
  assert.match(homepageCopyGlobal, /areaServed/);
  assert.match(homepageCopyGlobal, /assetUrls/);
  assert.match(homepageCopyGlobal, /public-tours\.en\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-team\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-reels\.json\?v=/);
  assert.match(homepageCopyGlobal, /"en": "Private holidays in Vietnam"/);
  assert.match(homepageCopyGlobal, /"de": "Privaturlaub in Vietnam"/);
  assert.match(homepageCopyGlobal, /"en": "AsiaTravelPlan \| Private holidays in Vietnam"/);
  assert.match(homepageCopyGlobal, /Private holidays in Vietnam with clear pricing and local support/);
  assert.match(homepageInitialBundle, /function createFrontendToursController/);
  assert.doesNotMatch(homepageInitialBundle, /function frontendT\(/);
  assert.match(homepageInitialBundle, /const frontendT = \(id, fallback, vars\) => \{/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/main_booking_form_options\.js"\)/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/main_reels\.js"\)/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/shared\/auth\.js"\)/);
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
  assert.match(generatedSitemap, /https:\/\/asiatravelplan\.com\/tours\/alpha-tour-alpha/);
  assert.match(generatedSitemap, /https:\/\/asiatravelplan\.com\/privacy\.html/);
  assert.match(generatedDestinationHtml, /<h1>Private tours in Vietnam<\/h1>/);
  assert.match(generatedDestinationHtml, /"@type":"WebPage"/);
  assert.match(generatedDestinationHtml, /<a href="\/tours\/alpha-tour-alpha">Alpha tour<\/a>/);
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
  const copiedServiceAssetPath = new URL(publicToursEn.items[0].travel_plan.days[0].services[0].image.storage_path, "https://asiatravelplan.test").pathname;
  const copiedTourAsset = await stat(path.join(tourOutputDir, copiedTourAssetPath.replace(/^\/assets\/generated\/homepage\/tours\//, "")));
  const copiedServiceAsset = await stat(path.join(tourOutputDir, copiedServiceAssetPath.replace(/^\/assets\/generated\/homepage\/tours\//, "")));
  const copiedTeamAsset = await stat(path.join(teamOutputDir, "joachim.webp"));
  assert.ok(copiedTourAsset.isFile());
  assert.ok(copiedServiceAsset.isFile());
  assert.ok(copiedTeamAsset.isFile());
});

test("generatePublicHomepageAssets falls back when a visible tour image is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-missing-tour-image-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const frontendI18nDir = path.join(root, "frontend", "data", "i18n", "frontend");
  const storePath = path.join(root, "backend", "app", "data", "store.json");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");

  await mkdir(path.join(toursRoot, "tour_missing_image"), { recursive: true });
  await mkdir(frontendI18nDir, { recursive: true });
  await writeJson(path.join(frontendI18nDir, "en.json"), {
    "hero.title": "Private holidays in Vietnam",
    "hero.title_with_destinations": "Private holidays in {destinations}"
  });
  await writeJson(path.join(contentRoot, "country_reference_info.json"), { items: [] });
  await writeJson(storePath, {});
  await writeJson(path.join(toursRoot, "tour_missing_image", "tour.json"), {
    id: "tour_missing_image",
    title: { en: "Missing image tour" },
    short_description: { en: "Visible but stale image reference" },
    image: "/public/v1/tour-images/tour_missing_image/missing.png",
    travel_plan: {
      destination_scope: [
        { destination: "VN", areas: [] }
      ],
      days: []
    },
    priority: 10,
    updated_at: "2026-04-14T12:34:56.000Z"
  });

  await generatePublicHomepageAssets({
    toursRoot,
    staffRoot,
    countryReferenceInfoPath: path.join(contentRoot, "country_reference_info.json"),
    storePath,
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
  const storePath = path.join(root, "backend", "app", "data", "store.json");
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
  await writeJson(storePath, {});
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
      storePath,
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

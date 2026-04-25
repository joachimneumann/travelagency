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
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");
  const homepageHtmlPath = path.join(root, "frontend", "pages", "index.html");
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
    '<!doctype html><html><body><h1 id="heroTitle" class="hero-title-only" data-i18n-id="hero.title">Old title</h1><script src="/frontend/data/generated/homepage/public-homepage-copy.global.js"></script></body></html>\n'
  );

  await writeJson(path.join(contentRoot, "country_reference_info.json"), {
    items: [
      { country: "VN", published_on_webpage: true },
      { country: "TH", published_on_webpage: false }
    ]
  });

  await writeJson(path.join(toursRoot, "tour_alpha", "tour.json"), {
    id: "tour_alpha",
    title: { en: "Alpha tour", de: "Alpha Reise" },
    short_description: { en: "Alpha description", de: "Alpha Beschreibung" },
    destinations: ["vietnam", "thailand"],
    styles: ["budget"],
    image: "/public/v1/tour-images/tour_alpha/alpha.png",
    priority: 80,
    updated_at: "2026-04-14T12:34:56.000Z"
  });
  await writeFile(path.join(toursRoot, "tour_alpha", "alpha.png"), Buffer.from(TINY_PNG_BASE64, "base64"));

  await writeJson(path.join(toursRoot, "tour_hidden", "tour.json"), {
    id: "tour_hidden",
    title: { en: "Hidden tour" },
    short_description: { en: "Should not appear" },
    destinations: ["thailand"],
    styles: ["luxury"],
    image: "/public/v1/tour-images/tour_hidden/hidden.png",
    priority: 20,
    updated_at: "2026-04-14T10:00:00.000Z"
  });
  await writeFile(path.join(toursRoot, "tour_hidden", "hidden.png"), Buffer.from(TINY_PNG_BASE64, "base64"));

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
    frontendDataDir,
    tourOutputDir,
    teamOutputDir,
    frontendI18nDir,
    homepageCopyGlobalPath,
    homepageHtmlPath,
    languages: ["en", "de"]
  });

  const publicToursEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.en.json"), "utf8"));
  const publicToursDe = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.de.json"), "utf8"));
  const publicTeam = JSON.parse(await readFile(path.join(frontendDataDir, "public-team.json"), "utf8"));
  const publicReels = JSON.parse(await readFile(path.join(root, "frontend", "data", "generated", "reels", "public-reels.json"), "utf8"));
  const homepageCopyGlobal = await readFile(homepageCopyGlobalPath, "utf8");
  const homepageInitialBundle = await readFile(homepageInitialBundlePath, "utf8");
  const homepageHtml = await readFile(homepageHtmlPath, "utf8");

  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_alpha");
  assert.deepEqual(publicToursEn.items[0].destination_codes, ["vietnam"]);
  assert.deepEqual(publicToursEn.available_destinations, [{ code: "vietnam", label: "Vietnam" }]);
  assert.match(publicToursEn.items[0].image, /^\/assets\/generated\/homepage\/tours\/tour_alpha\/alpha\.(png|webp)\?v=/);

  assert.equal(publicToursDe.items[0].title, "Alpha Reise");
  assert.equal(publicToursDe.items[0].short_description, "Alpha Beschreibung");
  assert.deepEqual(publicToursDe.available_styles, [{ code: "budget", label: "Budget" }]);
  assert.deepEqual(publicReels, { items: [] });
  assert.match(homepageCopyGlobal, /heroTitleByLang/);
  assert.match(homepageCopyGlobal, /assetUrls/);
  assert.match(homepageCopyGlobal, /public-tours\.en\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-team\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-reels\.json\?v=/);
  assert.match(homepageCopyGlobal, /"en": "Private holidays in Vietnam"/);
  assert.match(homepageCopyGlobal, /"de": "Privaturlaub in Vietnam"/);
  assert.match(homepageInitialBundle, /function createFrontendToursController/);
  assert.doesNotMatch(homepageInitialBundle, /function frontendT\(/);
  assert.match(homepageInitialBundle, /const frontendT = \(id, fallback, vars\) => \{/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/main_booking_form_options\.js"\)/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/main_reels\.js"\)/);
  assert.match(homepageInitialBundle, /import\("\/frontend\/scripts\/shared\/auth\.js"\)/);
  assert.match(homepageHtml, />Old title</);
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

  const copiedTourAssetName = path.basename(new URL(publicToursEn.items[0].image, "https://asiatravelplan.test").pathname);
  const copiedTourAsset = await stat(path.join(tourOutputDir, "tour_alpha", copiedTourAssetName));
  const copiedTeamAsset = await stat(path.join(teamOutputDir, "joachim.webp"));
  assert.ok(copiedTourAsset.isFile());
  assert.ok(copiedTeamAsset.isFile());
});

test("generatePublicHomepageAssets falls back when a visible tour image is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-missing-tour-image-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const frontendI18nDir = path.join(root, "frontend", "data", "i18n", "frontend");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");

  await mkdir(path.join(toursRoot, "tour_missing_image"), { recursive: true });
  await mkdir(frontendI18nDir, { recursive: true });
  await writeJson(path.join(frontendI18nDir, "en.json"), {
    "hero.title": "Private holidays in Vietnam",
    "hero.title_with_destinations": "Private holidays in {destinations}"
  });
  await writeJson(path.join(contentRoot, "country_reference_info.json"), { items: [] });
  await writeJson(path.join(toursRoot, "tour_missing_image", "tour.json"), {
    id: "tour_missing_image",
    title: { en: "Missing image tour" },
    short_description: { en: "Visible but stale image reference" },
    destinations: ["vietnam"],
    image: "/public/v1/tour-images/tour_missing_image/missing.png",
    priority: 10,
    updated_at: "2026-04-14T12:34:56.000Z"
  });

  await generatePublicHomepageAssets({
    toursRoot,
    staffRoot,
    countryReferenceInfoPath: path.join(contentRoot, "country_reference_info.json"),
    frontendDataDir,
    tourOutputDir,
    teamOutputDir,
    frontendI18nDir,
    languages: ["en"]
  });

  const publicToursEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.en.json"), "utf8"));
  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_missing_image");
  assert.deepEqual(publicToursEn.items[0].pictures, []);
  assert.equal(publicToursEn.items[0].image, "/assets/img/marketing_tours.png");
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
      languages: ["en"]
    }),
    /Public staff profile "vic" is missing a usable picture file/
  );
});

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
        full_name: "Joachim Neumann",
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
        full_name: "Hidden Staff",
        position: { en: "Hidden" },
        picture: "hidden.webp",
        appears_in_team_web_page: false
      }
    }
  });
  await writeFile(path.join(staffRoot, "photos", "joachim.webp"), "joachim-image");
  await writeFile(path.join(staffRoot, "photos", "hidden.webp"), "hidden-image");

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
  const homepageCopyGlobal = await readFile(homepageCopyGlobalPath, "utf8");
  const homepageHtml = await readFile(homepageHtmlPath, "utf8");

  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_alpha");
  assert.deepEqual(publicToursEn.items[0].destination_codes, ["vietnam"]);
  assert.deepEqual(publicToursEn.available_destinations, [{ code: "vietnam", label: "Vietnam" }]);
  assert.match(publicToursEn.items[0].image, /^\/assets\/generated\/homepage\/tours\/tour_alpha\/alpha\.webp\?v=/);

  assert.equal(publicToursDe.items[0].title, "Alpha Reise");
  assert.equal(publicToursDe.items[0].short_description, "Alpha Beschreibung");
  assert.deepEqual(publicToursDe.available_styles, [{ code: "budget", label: "Budget" }]);
  assert.match(homepageCopyGlobal, /heroTitleByLang/);
  assert.match(homepageCopyGlobal, /assetUrls/);
  assert.match(homepageCopyGlobal, /public-tours\.en\.json\?v=/);
  assert.match(homepageCopyGlobal, /public-team\.json\?v=/);
  assert.match(homepageCopyGlobal, /"en": "Private holidays in Vietnam"/);
  assert.match(homepageCopyGlobal, /"de": "Privaturlaub in Vietnam"/);
  assert.match(homepageHtml, />Private holidays in Vietnam</);
  assert.match(homepageHtml, /public-homepage-copy\.global\.js\?v=/);

  assert.equal(publicTeam.total, 1);
  assert.equal(publicTeam.items[0].username, "joachim");
  assert.equal(publicTeam.items[0].full_name, "Joachim Neumann");
  assert.equal(publicTeam.items[0].position, "Founder");
  assert.match(publicTeam.items[0].picture_ref, /^\/assets\/generated\/homepage\/team\/joachim\.webp\?v=/);
  assert.equal("appears_in_team_web_page" in publicTeam.items[0], false);

  const copiedTourAsset = await stat(path.join(tourOutputDir, "tour_alpha", "alpha.webp"));
  const copiedTeamAsset = await stat(path.join(teamOutputDir, "joachim.webp"));
  assert.ok(copiedTourAsset.isFile());
  assert.ok(copiedTeamAsset.isFile());
});

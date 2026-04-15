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

test("generatePublicHomepageAssets writes static tours, team, and copied assets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-homepage-assets-"));
  const contentRoot = path.join(root, "content");
  const toursRoot = path.join(contentRoot, "tours");
  const staffRoot = path.join(contentRoot, "atp_staff");
  const frontendDataDir = path.join(root, "frontend", "data", "generated", "homepage");
  const tourOutputDir = path.join(root, "assets", "generated", "homepage", "tours");
  const teamOutputDir = path.join(root, "assets", "generated", "homepage", "team");

  await mkdir(path.join(toursRoot, "tour_alpha"), { recursive: true });
  await mkdir(path.join(toursRoot, "tour_hidden"), { recursive: true });
  await mkdir(path.join(staffRoot, "photos"), { recursive: true });

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
    image: "/public/v1/tour-images/tour_alpha/alpha.webp",
    priority: 80,
    updated_at: "2026-04-14T12:34:56.000Z"
  });
  await writeFile(path.join(toursRoot, "tour_alpha", "alpha.webp"), "alpha-image");

  await writeJson(path.join(toursRoot, "tour_hidden", "tour.json"), {
    id: "tour_hidden",
    title: { en: "Hidden tour" },
    short_description: { en: "Should not appear" },
    destinations: ["thailand"],
    styles: ["luxury"],
    image: "/public/v1/tour-images/tour_hidden/hidden.webp",
    priority: 20,
    updated_at: "2026-04-14T10:00:00.000Z"
  });
  await writeFile(path.join(toursRoot, "tour_hidden", "hidden.webp"), "hidden-image");

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
    languages: ["en", "de"]
  });

  const publicToursEn = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.en.json"), "utf8"));
  const publicToursDe = JSON.parse(await readFile(path.join(frontendDataDir, "public-tours.de.json"), "utf8"));
  const publicTeam = JSON.parse(await readFile(path.join(frontendDataDir, "public-team.json"), "utf8"));

  assert.equal(publicToursEn.items.length, 1);
  assert.equal(publicToursEn.items[0].id, "tour_alpha");
  assert.deepEqual(publicToursEn.items[0].destination_codes, ["vietnam"]);
  assert.deepEqual(publicToursEn.available_destinations, [{ code: "vietnam", label: "Vietnam" }]);
  assert.match(publicToursEn.items[0].image, /^\/assets\/generated\/homepage\/tours\/tour_alpha\/alpha\.webp\?v=/);

  assert.equal(publicToursDe.items[0].title, "Alpha Reise");
  assert.equal(publicToursDe.items[0].short_description, "Alpha Beschreibung");
  assert.deepEqual(publicToursDe.available_styles, [{ code: "budget", label: "Budget" }]);

  assert.equal(publicTeam.total, 1);
  assert.equal(publicTeam.items[0].username, "joachim");
  assert.equal(publicTeam.items[0].position, "Founder");
  assert.match(publicTeam.items[0].picture_ref, /^\/assets\/generated\/homepage\/team\/joachim\.webp\?v=/);
  assert.equal(publicTeam.items[0].appears_in_team_web_page, true);

  const copiedTourAsset = await stat(path.join(tourOutputDir, "tour_alpha", "alpha.webp"));
  const copiedTeamAsset = await stat(path.join(teamOutputDir, "joachim.webp"));
  assert.ok(copiedTourAsset.isFile());
  assert.ok(copiedTeamAsset.isFile());
});

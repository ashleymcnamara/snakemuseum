// Build script for the Snake Museum.
//
// 1. Scans games/*/meta.json
// 2. Validates each against games/schema.json (fails the build on any error)
// 3. Copies every game's files to site/games/<slug>/
// 4. Writes the site/games.json manifest the gallery reads
//
// Zero runtime dependencies — Node's stdlib only. Run with `npm run build`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, loadJson } from "./lib/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gamesDir = path.join(repoRoot, "games");
const siteDir = path.join(repoRoot, "site");
const outGamesDir = path.join(siteDir, "games");
const manifestPath = path.join(siteDir, "games.json");
const schemaPath = path.join(gamesDir, "schema.json");

function listGameSlugs() {
  return fs
    .readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function main() {
  const schema = loadJson(schemaPath);
  const slugs = listGameSlugs();
  const games = [];
  const problems = [];

  for (const slug of slugs) {
    const dir = path.join(gamesDir, slug);
    const metaPath = path.join(dir, "meta.json");

    if (!fs.existsSync(metaPath)) {
      problems.push(`games/${slug}: missing meta.json`);
      continue;
    }
    if (!fs.existsSync(path.join(dir, "index.html"))) {
      problems.push(`games/${slug}: missing index.html`);
      continue;
    }

    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch (e) {
      problems.push(`games/${slug}/meta.json: invalid JSON (${e.message})`);
      continue;
    }

    const { valid, errors } = validate(meta, schema);
    if (!valid) {
      problems.push(`games/${slug}/meta.json:\n    - ${errors.join("\n    - ")}`);
      continue;
    }

    const hasThumb = fs.existsSync(path.join(dir, "thumbnail.png"));
    games.push({
      slug,
      title: meta.title,
      author: meta.author,
      githubHandle: meta.githubHandle,
      description: meta.description,
      createdAt: meta.createdAt,
      tags: meta.tags,
      path: `games/${slug}/index.html`,
      thumbnail: hasThumb ? `games/${slug}/thumbnail.png` : null,
    });
  }

  if (problems.length) {
    console.error("✖ Build failed — fix these games before deploying:\n");
    console.error(problems.map((p) => "  • " + p).join("\n"));
    process.exit(1);
  }

  // newest first, then alphabetical
  games.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.title.localeCompare(b.title)));

  // (re)assemble the deployable game files under site/games/<slug>/
  fs.rmSync(outGamesDir, { recursive: true, force: true });
  fs.mkdirSync(outGamesDir, { recursive: true });
  for (const game of games) {
    fs.cpSync(path.join(gamesDir, game.slug), path.join(outGamesDir, game.slug), { recursive: true });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: games.length,
    games,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`✔ Built ${games.length} game(s) → site/games.json`);
  for (const g of games) console.log(`   • ${g.slug} — "${g.title}" by @${g.githubHandle}`);
}

main();

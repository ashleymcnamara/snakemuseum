// Build script for the Snake Museum.
//
// 1. Scans games/*/meta.json
// 2. Validates each against games/schema.json (fails the build on any error)
// 3. Copies every game's files to site/games/<slug>/
// 4. Writes the site/games.json manifest the gallery reads
// 5. Regenerates the SEO artifacts into the Pages publish root:
//      - JSON-LD (schema.org WebSite + CollectionPage + ItemList) injected into
//        site/index.html between the SNAKE-MUSEUM:JSONLD markers
//      - site/robots.txt and site/sitemap.xml
//      - site/og-image.png (1200x630 branded social card)
//
// Zero runtime dependencies — Node's stdlib only. Run with `npm run build`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, loadJson } from "./lib/schema.js";
import { generateOgImage } from "./gen-og-image.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gamesDir = path.join(repoRoot, "games");
const siteDir = path.join(repoRoot, "site");
const outGamesDir = path.join(siteDir, "games");
const manifestPath = path.join(siteDir, "games.json");
const schemaPath = path.join(gamesDir, "schema.json");
const indexPath = path.join(siteDir, "index.html");

const BASE = "https://snakemuseum.dev";
const SITE_NAME = "Snake Museum";
const SITE_DESC =
  "A curated, open-source gallery of community-built snake games. Every exhibit is self-contained and plays in a sandboxed iframe.";
const AUTHOR = { name: "Ashley McNamara", url: "https://github.com/ashleymcnamara" };

const JSONLD_START = "<!-- SNAKE-MUSEUM:JSONLD:START -->";
const JSONLD_END = "<!-- SNAKE-MUSEUM:JSONLD:END -->";

function listGameSlugs() {
  return fs
    .readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function gameUrl(slug) {
  return `${BASE}/games/${slug}/`;
}

function buildJsonLd(games) {
  const website = {
    "@type": "WebSite",
    "@id": `${BASE}/#website`,
    name: SITE_NAME,
    url: `${BASE}/`,
    description: SITE_DESC,
    inLanguage: "en",
    publisher: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
  };

  const itemList = {
    "@type": "ItemList",
    numberOfItems: games.length,
    itemListElement: games.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: gameUrl(g.slug),
      item: {
        "@type": "VideoGame",
        name: g.title,
        url: gameUrl(g.slug),
        description: g.description,
        image: `${BASE}/games/${g.slug}/thumbnail.png`,
        datePublished: g.createdAt,
        applicationCategory: "Game",
        gamePlatform: "Web browser",
        operatingSystem: "Any modern web browser",
        author: { "@type": "Person", name: g.author, url: `https://github.com/${g.githubHandle}` },
        keywords: (g.tags || []).join(", "),
      },
    })),
  };

  const collection = {
    "@type": "CollectionPage",
    "@id": `${BASE}/#collection`,
    name: `${SITE_NAME} — The Collection`,
    url: `${BASE}/`,
    description: SITE_DESC,
    isPartOf: { "@id": `${BASE}/#website` },
    mainEntity: itemList,
  };

  return { "@context": "https://schema.org", "@graph": [website, collection] };
}

function injectJsonLd(games) {
  let html = fs.readFileSync(indexPath, "utf8");
  const start = html.indexOf(JSONLD_START);
  const end = html.indexOf(JSONLD_END);
  if (start === -1 || end === -1) {
    console.warn("  ! JSON-LD markers not found in site/index.html; skipping injection");
    return;
  }
  const json = JSON.stringify(buildJsonLd(games), null, 2)
    .split("\n")
    .map((line) => "  " + line)
    .join("\n");
  const block =
    JSONLD_START +
    '\n  <script type="application/ld+json">\n' +
    json +
    "\n  </script>\n  " +
    JSONLD_END;
  html = html.slice(0, start) + block + html.slice(end + JSONLD_END.length);
  fs.writeFileSync(indexPath, html);
}

function writeRobots() {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`;
  fs.writeFileSync(path.join(siteDir, "robots.txt"), body);
}

function writeSitemap(games) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${BASE}/`, lastmod: today, changefreq: "weekly", priority: "1.0" },
    ...games.map((g) => ({
      loc: gameUrl(g.slug),
      lastmod: g.createdAt,
      changefreq: "monthly",
      priority: "0.8",
    })),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          "  <url>\n" +
          `    <loc>${u.loc}</loc>\n` +
          `    <lastmod>${u.lastmod}</lastmod>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          "  </url>"
      )
      .join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(path.join(siteDir, "sitemap.xml"), body);
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
    console.error("Build failed - fix these games before deploying:\n");
    console.error(problems.map((p) => "  - " + p).join("\n"));
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

  // SEO artifacts
  injectJsonLd(games);
  writeRobots();
  writeSitemap(games);
  generateOgImage(path.join(siteDir, "og-image.png"));

  console.log(`Built ${games.length} game(s) -> site/games.json`);
  for (const g of games) console.log(`   - ${g.slug} - "${g.title}" by @${g.githubHandle}`);
  console.log("Generated JSON-LD, robots.txt, sitemap.xml, og-image.png");
}

main();

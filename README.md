# Snake Museum

**[Snake Museum](https://ashleymcnamara.github.io/snakemuseum/)** — a curated, static gallery of
community-submitted snake games. Every exhibit is a tiny, self-contained web game
built by someone in the community. Browse the gallery, hit **Play**, and the game
runs right in your browser inside a locked-down sandbox.

There is **no backend**. The whole site is static and hosted on Netlify.
New games are added by opening a **pull request** that drops a folder into
`games/`. CI validates it, a human reviews it, and merging to `main`
deploys the updated gallery.

---

## How to play

1. Visit **[ashleymcnamara.github.io/snakemuseum](https://ashleymcnamara.github.io/snakemuseum/)**.
2. Browse the gallery — search or filter by tag.
3. Click **Play** on any card. The game opens in a sandboxed player.

Most games use the **arrow keys** or **WASD**; the reference game
([`games/classic-snake`](games/classic-snake)) also supports touch swipes,
`Space` to pause, and `Enter` to restart.

## How to submit a game

Pull requests are the way in. In short:

1. **Fork** this repo.
2. **Copy** the template game: `cp -r games/classic-snake games/your-game`.
3. **Edit** `index.html` (your game), `meta.json` (your details), and replace
   `thumbnail.png` with a screenshot.
4. **Validate** locally: `node scripts/validate-submission.js games/your-game`.
5. **Open a PR.** CI runs the same validation and a maintainer reviews it.

Full, step-by-step instructions and all the rules are in
**[CONTRIBUTING.md](CONTRIBUTING.md)**.

Prefer not to open a PR? There's a friendly fallback
[issue form](https://github.com/ashleymcnamara/snakemuseum/issues/new?template=submit-game.yml),
but PRs are the primary path.

## Security model (important)

Every game is **untrusted, community-authored code**, so the museum never runs it
with any privileges:

- Games play inside `<iframe sandbox="allow-scripts">` — **and deliberately _not_
  `allow-same-origin`**. Without `allow-same-origin` the framed document gets an
  **opaque origin**: it can run its own scripts but **cannot read the museum's
  cookies, `localStorage`, or DOM**, and can't act as this site.
- **No secrets are ever passed into a frame.** There's nothing sensitive on the
  page to steal — the site is fully static.
- The gallery page ships a **strict Content Security Policy** and loads **no
  third-party scripts** whatsoever.
- Submissions are additionally screened by **CI** (see `scripts/validate-submission.js`)
  and by **human review** before they can be merged.

This defense-in-depth (sandbox + CSP + CI + review) is why a static, no-backend
site can safely host arbitrary community games.

## Local development

Requires Node.js 18+ (no dependencies to install).

```bash
npm run build     # scan games/, validate, generate site/games.json + site/games/*
                  # and the SEO artifacts (JSON-LD, robots.txt, sitemap.xml, og-image.png)
npm run serve     # serve the built site at http://localhost:8080
npm start         # build + serve in one go

npm run validate  # validate all game folders (same checks CI runs)
node scripts/validate-submission.js games/classic-snake   # validate one game
```

> The gallery fetches `games.json`, so it needs to be served over HTTP (use
> `npm run serve`) rather than opened with a `file://` URL.

## Project structure

```
games/
  schema.json          JSON Schema every meta.json must satisfy
  classic-snake/       reference game + the copy-me template
    index.html         self-contained game (inline CSS/JS, no network)
    meta.json          title, author, githubHandle, description, createdAt, tags
    thumbnail.png      card image
scripts/
  build.js             builds site/games.json + copies games into site/games/*
                       and regenerates the JSON-LD, robots.txt, sitemap.xml, og-image.png
  validate-submission.js   the PR/CI security + format gate
  gen-thumbnail.js     zero-dep PNG generator used for the seed thumbnail
  gen-og-image.js      zero-dep 1200x630 branded Open Graph image generator
  serve.js             zero-dep static server for local preview
  lib/schema.js        tiny zero-dep JSON Schema (subset) validator
  lib/png.js           shared zero-dep RGB raster + PNG encoder
site/
  index.html           the gallery (strict CSP, full SEO head, no third-party scripts)
  styles.css  app.js   gallery styling + logic
  favicon.svg          monochrome vector snake favicon
.github/
  workflows/validate.yml   validate PRs that touch games/**
  workflows/deploy.yml     optional manual build + publish to GitHub Pages
  ISSUE_TEMPLATE/submit-game.yml   fallback submission form
```

`site/games.json`, `site/games/`, `site/robots.txt`, `site/sitemap.xml`, and
`site/og-image.png` are **generated** by `npm run build` and are not committed
(see `.gitignore`); the host builds them fresh on deploy.

## Hosting & custom domain

The live site is published via **GitHub Pages** at
[ashleymcnamara.github.io/snakemuseum](https://ashleymcnamara.github.io/snakemuseum/)
(build command `npm run build`, publish directory `site`).

> **Note:** The custom domain `snakemuseum.dev` is not currently active. The
> GitHub Pages URL above is the working entry point.

## License

The Snake Museum **site and tooling** are released under the
[MIT License](LICENSE). **Individual games** under `games/<slug>/` remain the work
of their respective authors, who are credited via each game's `meta.json`.

# Contributing a game to the Snake Museum

Thanks for adding to the collection! Every game in the museum is a small,
self-contained web game contributed via pull request. This guide walks you
through it and lists the rules your submission must follow.

---

## The 5-step submission flow

### 1. Fork & clone

Fork this repository on GitHub, then clone your fork locally.

### 2. Copy the template game

The reference game **`games/classic-snake/`** doubles as the template. Copy it to
a new folder named after your game (use a lowercase, hyphenated **slug**):

```bash
cp -r games/classic-snake games/your-game
```

Your folder must contain exactly these three files (plus any extra local assets
you need, within the rules below):

```
games/your-game/
  index.html      # your game — fully self-contained
  meta.json       # your game's metadata (see schema below)
  thumbnail.png   # a screenshot / card image
```

### 3. Build your game (`index.html`)

Edit `index.html` into your own game. It must be **fully self-contained**: all
CSS and JavaScript inline or in **local** files inside your folder — **no
external network requests of any kind** (no CDNs, no web fonts, no analytics, no
`fetch`). Think of it as a game that works with the network unplugged.

You can keep hacking on the classic-snake code, or start from scratch. Test it by
opening your `index.html` directly in a browser.

### 4. Fill in `meta.json`

Describe your game. Every field is required. It must validate against
[`games/schema.json`](games/schema.json):

| Field          | Type              | Rules                                                                 |
| -------------- | ----------------- | --------------------------------------------------------------------- |
| `title`        | string            | 1–80 characters. Your game's display name.                            |
| `author`       | string            | 1–80 characters. How you want to be credited.                         |
| `githubHandle` | string            | Your GitHub username, no `@` (letters, numbers, hyphens; up to 39).   |
| `description`  | string            | 1–500 characters. Shown on your game's card.                          |
| `createdAt`    | string (ISO date) | `YYYY-MM-DD`, e.g. `2026-07-04`.                                       |
| `tags`         | string[]          | 0–10 unique tags, each 1–30 chars (e.g. `classic`, `arcade`, `hard`). |

Example:

```json
{
  "title": "Neon Snake",
  "author": "Ada Lovelace",
  "githubHandle": "ada",
  "description": "A synthwave take on snake with a speed-ramping twist.",
  "createdAt": "2026-07-04",
  "tags": ["neon", "arcade", "hard"]
}
```

### 5. Add a thumbnail and open your PR

Replace `thumbnail.png` with a real screenshot of your game (PNG). **Validate
locally**, then open a pull request:

```bash
node scripts/validate-submission.js games/your-game
```

Open a PR that adds your `games/your-game/` folder. CI runs the exact same
validation, and a maintainer reviews it. Once merged to `main`, the site
redeploys automatically and your game appears in the gallery.

---

## The rules

Your submission is checked by `scripts/validate-submission.js` (locally and in
CI). It will **fail with an itemized list of reasons** if any of these aren't met:

### Required files

- `index.html`, `meta.json`, and `thumbnail.png` must all be present.

### Valid metadata

- `meta.json` must validate against [`games/schema.json`](games/schema.json)
  (see the table above).

### Self-contained — no external network

Your game must make **no external requests**. The validator scans `.html`/`.js`
and rejects, among others:

- `fetch(`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`
- `<script src="http…">` and `@import url(http…)` (external scripts/styles/CDNs)
- analytics / tracking of any kind

### No sandbox-escape or dangerous APIs

Rejected patterns include:

- `eval(` and `new Function(` (dynamic code execution)
- `document.cookie`, `document.write(`
- `window.top`, `window.parent`, `parent.…` (trying to reach the host page)
- nested `<iframe>`, `<object>`, `<embed>`
- long base64 blobs (a common way to hide payloads — keep assets as real files)

> These would be neutralized by the sandbox anyway, but we reject them up front so
> the collection stays clean and reviewable.

### Allowed file types only

Every file in your folder must be one of:

```
.html  .css  .js  .json  .png  .jpg  .jpeg  .gif  .svg  .webp  .md
```

### Size cap

- The whole `games/your-game/` folder must be **under 2 MB**. Optimize images;
  don't ship huge assets.

---

## Why these rules? (the security model)

The museum is a **static site with no backend**, and it runs **your untrusted
code** on visitors' browsers. To keep everyone safe:

- Games run inside `<iframe sandbox="allow-scripts">` — **without**
  `allow-same-origin`. That gives your game an **opaque origin**: it can run its
  own scripts but **cannot** read the site's cookies, storage, or DOM.
- The gallery ships a strict Content Security Policy and loads no third-party
  scripts.
- CI + human review are the final gate.

The rules above make submissions easy to review and keep the whole gallery
trustworthy. Thanks for helping keep the museum a safe, fun place to visit!

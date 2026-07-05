"use strict";

// Snake Museum gallery.
// Ported from the design mockup (previously an inline <script>); moved to a
// local file so the strict, third-party-free CSP needs no 'unsafe-inline'.
//
// Adapted for the real architecture:
//   - the games come from the generated site/games.json manifest (not a
//     hardcoded array), and each card shows the game's real thumbnail.png;
//   - each exhibit is its own self-contained folder, so a game opens at its
//     real path (games/<slug>/index.html) — there is no ?theme= parameter.
//
// Playing a game injects it into a SANDBOXED iframe whose sandbox attribute is
// exactly "allow-scripts" — deliberately WITHOUT "allow-same-origin", so each
// game runs in an opaque origin and cannot touch this site's cookies, storage,
// or DOM. No secrets are ever passed into the frame.
const GAME_SANDBOX = "allow-scripts";

const grid = document.getElementById("grid");
const countEl = document.getElementById("count");

const viewer = document.getElementById("viewer");
const frame = document.getElementById("v-frame");
const vTitle = document.getElementById("v-title");
const vAuthor = document.getElementById("v-author");
const vClose = document.getElementById("v-close");

let lastFocused = null;

// Monochrome inline-SVG snake (no emoji) shown if a thumbnail image fails to load.
const FALLBACK_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>" +
      "<rect width='100%' height='100%' fill='#071410'/>" +
      "<path d='M108 138h36v-30h30v-30h34' fill='none' stroke='#1c4433' stroke-width='12' stroke-linecap='round' stroke-linejoin='round'/>" +
      "<circle cx='208' cy='78' r='9' fill='#1c4433'/></svg>"
  );

// Constant, monochrome inline-SVG play icon (no emoji). Safe to assign as
// innerHTML — it is a fixed string, never game-supplied data.
const PLAY_ICON =
  "<svg width='14' height='14' viewBox='0 0 24 24' aria-hidden='true'>" +
  "<path d='M8 5v14l11-7z' fill='currentColor'/></svg>";

function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
  }
  for (const child of children || []) if (child) node.appendChild(child);
  return node;
}

function githubUrl(handle) {
  return "https://github.com/" + encodeURIComponent(handle);
}

// Build a card. Game fields (title/author/description/tags) come from
// PR-submitted meta.json and are treated as UNTRUSTED, so they are inserted as
// text nodes — never via innerHTML — to keep the gallery XSS-safe.
function buildCard(game) {
  const img = el("img", {
    src: game.thumbnail || FALLBACK_THUMB,
    alt: "",
    loading: "lazy",
    decoding: "async",
  });
  img.addEventListener("error", () => {
    if (img.src !== FALLBACK_THUMB) img.src = FALLBACK_THUMB;
  });

  const pill = el("span", { class: "btn" });
  pill.innerHTML = PLAY_ICON; // constant string, not game data
  pill.appendChild(document.createTextNode("Play"));
  const overlay = el("span", { class: "play-overlay", "aria-hidden": "true" }, [pill]);

  // The whole 16:10 thumbnail is a real, focusable, tappable button (not a
  // hover-only overlay). Its aria-label is the accessible name, so the
  // decorative <img> uses alt="".
  const thumb = el(
    "button",
    {
      class: "thumb",
      type: "button",
      "aria-label": "Play " + game.title + " by " + game.author,
    },
    [img, overlay]
  );
  thumb.addEventListener("click", () => openGame(game));

  const authorLink = el("a", {
    text: "@" + game.githubHandle,
    href: githubUrl(game.githubHandle),
    target: "_blank",
    rel: "noopener noreferrer",
  });
  const author = el("p", { class: "author" }, [
    document.createTextNode("by "),
    authorLink,
    document.createTextNode(" \u00b7 " + game.author),
  ]);

  const tags = el(
    "ul",
    { class: "tags", "aria-label": "Tags" },
    (game.tags || []).map((t) => el("li", { class: "tag", text: t }))
  );

  const body = el("div", { class: "card-body" }, [
    el("h3", { text: game.title }),
    author,
    el("p", { class: "desc", text: game.description }),
    tags,
  ]);

  return el("article", { class: "card" }, [thumb, body]);
}

// ---- Sandboxed viewer -------------------------------------------------------
function openGame(game) {
  lastFocused = document.activeElement;
  // v-title's first child is the "Game" text node (followed by <small>).
  vTitle.firstChild.textContent = game.title;
  vAuthor.textContent = "by @" + game.githubHandle;

  // Re-assert the sandbox (no allow-same-origin) before loading, defence in
  // depth alongside the static attribute in the markup.
  frame.setAttribute("sandbox", GAME_SANDBOX);
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.src = game.path;

  viewer.classList.add("open");
  document.body.style.overflow = "hidden";
  vClose.focus();
}

function closeGame() {
  if (!viewer.classList.contains("open")) return;
  viewer.classList.remove("open");
  frame.src = "about:blank"; // unload the iframe / stop the game
  document.body.style.overflow = "";
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

vClose.addEventListener("click", closeGame);
viewer.addEventListener("click", (e) => {
  if (e.target === viewer) closeGame();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeGame();
});

// ---- Boot -------------------------------------------------------------------
async function boot() {
  try {
    const res = await fetch("games.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const games = Array.isArray(data) ? data : data.games || [];
    countEl.textContent = String(games.length);
    grid.replaceChildren(...games.map(buildCard));
  } catch (err) {
    grid.textContent =
      "Couldn't load games.json. Run `npm run build`, then serve the site/ folder (e.g. `npm run serve`).";
  }
}

boot();

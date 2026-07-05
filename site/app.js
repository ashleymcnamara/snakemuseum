"use strict";

// Snake Museum gallery.
// Loads the generated manifest (games.json) and renders each game as a card.
// Playing a game injects it into a SANDBOXED iframe: the sandbox attribute is
// exactly "allow-scripts" — deliberately WITHOUT "allow-same-origin", so each
// game runs in an opaque origin and cannot touch this site's cookies, storage,
// or DOM. No secrets are ever passed into the frame.
const GAME_SANDBOX = "allow-scripts";

const gallery = document.getElementById("gallery");
const tagbar = document.getElementById("tagbar");
const searchInput = document.getElementById("search");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");

const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalClose = document.getElementById("modal-close");
const modalTitle = document.getElementById("modal-title");
const modalAuthor = document.getElementById("modal-author");
const modalNewtab = document.getElementById("modal-newtab");
const modalStage = document.getElementById("modal-stage");

const state = { games: [], search: "", activeTags: new Set() };
let lastFocused = null;

// Monochrome inline-SVG snake (no emoji) shown if a thumbnail fails to load.
const FALLBACK_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>" +
      "<rect width='100%' height='100%' fill='#0e1524'/>" +
      "<path d='M108 138h36v-30h30v-30h34' fill='none' stroke='#2b3a54' stroke-width='12' stroke-linecap='round' stroke-linejoin='round'/>" +
      "<circle cx='208' cy='78' r='9' fill='#2b3a54'/></svg>"
  );

// Constant, monochrome inline-SVG icons (safe to assign as innerHTML — no
// scripts, no external requests; keeps the strict CSP clean).
const ICONS = {
  play:
    "<svg class='ico' viewBox='0 0 24 24' aria-hidden='true'>" +
    "<path d='M8 5v14l11-7z' fill='currentColor'/></svg>",
};

function iconSpan(svg, className) {
  const span = el("span", { class: className, "aria-hidden": "true" });
  span.innerHTML = svg;
  return span;
}

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

function buildCard(game) {
  const thumb = el("img", {
    class: "card-thumb",
    src: game.thumbnail || FALLBACK_THUMB,
    alt: "Gameplay thumbnail for " + game.title,
    loading: "lazy",
    decoding: "async",
  });
  thumb.addEventListener("error", () => {
    if (thumb.src !== FALLBACK_THUMB) thumb.src = FALLBACK_THUMB;
  });

  // Always-visible, focusable, tappable play control on the thumbnail — never
  // a hover-only overlay (hover doesn't exist on touch; keyboard needs focus).
  const playOverlay = el("button", {
    class: "card-play",
    type: "button",
    "aria-label": "Play " + game.title,
  });
  playOverlay.appendChild(iconSpan(ICONS.play, "card-play-badge"));
  playOverlay.addEventListener("click", () => openGame(game));

  const frame = el("div", { class: "card-frame" }, [thumb, playOverlay]);

  const authorLink = el("a", {
    text: "@" + game.githubHandle,
    href: githubUrl(game.githubHandle),
    rel: "noopener noreferrer",
  });
  const author = el("p", { class: "card-author" }, [
    document.createTextNode("by " + game.author + " · "),
    authorLink,
  ]);

  const tagItems = (game.tags || []).map((t) => el("li", { class: "card-tag", text: t }));
  const tags = tagItems.length
    ? el("ul", { class: "card-tags", "aria-label": "Tags" }, tagItems)
    : null;

  const cta = el("button", { class: "card-cta", type: "button" }, [
    iconSpan(ICONS.play, "cta-ico"),
    el("span", { text: "Play game" }),
  ]);
  cta.addEventListener("click", () => openGame(game));

  const body = el("div", { class: "card-body" }, [
    el("h3", { class: "card-title", text: game.title }),
    author,
    el("p", { class: "card-desc", text: game.description }),
    tags,
    cta,
  ]);

  return el("article", { class: "card" }, [frame, body]);
}

function matches(game) {
  const q = state.search.trim().toLowerCase();
  if (q) {
    const hay = [game.title, game.author, game.githubHandle, game.description]
      .concat(game.tags || [])
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.activeTags.size) {
    const has = (game.tags || []).some((t) => state.activeTags.has(t));
    if (!has) return false;
  }
  return true;
}

function render() {
  const visible = state.games.filter(matches);
  gallery.replaceChildren(...visible.map(buildCard));

  emptyEl.hidden = visible.length !== 0;
  const total = state.games.length;
  countEl.textContent = visible.length === total
    ? total + (total === 1 ? " game" : " games")
    : visible.length + " of " + total + " games";
}

function buildTagbar() {
  const all = new Set();
  for (const g of state.games) for (const t of g.tags || []) all.add(t);

  const chips = [...all].sort().map((tag) => {
    const chip = el("button", {
      class: "tag-chip",
      type: "button",
      text: tag,
      "aria-pressed": "false",
    });
    chip.addEventListener("click", () => {
      if (state.activeTags.has(tag)) state.activeTags.delete(tag);
      else state.activeTags.add(tag);
      chip.setAttribute("aria-pressed", state.activeTags.has(tag) ? "true" : "false");
      render();
    });
    return chip;
  });
  tagbar.replaceChildren(...chips);
}

// ---- Modal player ----------------------------------------------------------
function openGame(game) {
  lastFocused = document.activeElement;
  modalTitle.textContent = game.title;

  modalAuthor.replaceChildren(
    document.createTextNode("by " + game.author + " · "),
    el("a", { text: "@" + game.githubHandle, href: githubUrl(game.githubHandle), rel: "noopener noreferrer" })
  );
  modalNewtab.href = game.path;

  const frame = el("iframe", {
    title: game.title + " — sandboxed game",
    loading: "lazy",
  });
  // Set sandbox explicitly (no allow-same-origin) BEFORE assigning src.
  frame.setAttribute("sandbox", GAME_SANDBOX);
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.src = game.path;
  modalStage.replaceChildren(frame);

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modalClose.focus();
  document.addEventListener("keydown", onKeydown);
}

function closeGame() {
  modal.hidden = true;
  modalStage.replaceChildren(); // unload the iframe / stop the game
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

function onKeydown(e) {
  if (e.key === "Escape") closeGame();
}

modalClose.addEventListener("click", closeGame);
modalBackdrop.addEventListener("click", closeGame);
searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  render();
});

// ---- Boot ------------------------------------------------------------------
async function boot() {
  try {
    const res = await fetch("games.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    state.games = Array.isArray(data) ? data : data.games || [];
  } catch (err) {
    countEl.textContent = "";
    emptyEl.hidden = false;
    emptyEl.textContent =
      "Couldn't load games.json. Run `npm run build`, then serve the site/ folder (e.g. `npm run serve`).";
    return;
  }
  buildTagbar();
  render();
}

boot();

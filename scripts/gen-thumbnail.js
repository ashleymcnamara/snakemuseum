// Generates a game's thumbnail.png — a representative snake board
// (grid + snake + apple) rendered in the game's palette. Zero dependencies
// (see scripts/lib/png.js).
//
//   node scripts/gen-thumbnail.js [outputPath] [theme]
//
// With no theme it renders the classic green board (byte-identical to the
// original reference thumbnail). Pass a theme slug to bake in that game's
// palette so every exhibit's card reflects its own colors.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas, encodePNG, verticalGradient, fillRect, fillCircle, fillCapsule, setPx, lerp } from "./lib/png.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const WIDTH = 640;
const HEIGHT = 400;
const CELL = 20;
const COLS = WIDTH / CELL;
const ROWS = HEIGHT / CELL;

// Exact palette of the original classic thumbnail. Used when no theme is given
// so games/classic-snake/thumbnail.png stays byte-for-byte identical.
const CLASSIC = {
  bgTop: [22, 35, 59],
  bgBottom: [11, 15, 24],
  grid: [30, 48, 43],
  frame: [64, 110, 92],
  apple: [255, 93, 108],
  appleHi: [255, 170, 178],
  stem: [120, 74, 48],
  leaf: [82, 224, 138],
  snakeTail: [28, 150, 92],
  snakeHead: [74, 232, 138],
  headBright: [125, 255, 171],
  eye: [6, 35, 26],
};

// Base palettes for the themed exhibits (bg / snake / head / food).
const THEMES = {
  "neon-nibbler": { bg: [10, 6, 32], snake: [168, 85, 247], head: [233, 213, 255], food: [34, 211, 238] },
  "sunset-serpent": { bg: [26, 13, 8], snake: [251, 146, 60], head: [255, 237, 213], food: [244, 63, 94] },
  "deep-ocean": { bg: [4, 18, 31], snake: [56, 189, 248], head: [224, 242, 254], food: [251, 191, 36] },
  "monochrome": { bg: [11, 11, 11], snake: [200, 200, 200], head: [255, 255, 255], food: [245, 245, 245] },
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function derivePalette(base) {
  const { bg, snake, head, food } = base;
  return {
    bgTop: mix(bg, snake, 0.16),
    bgBottom: bg,
    grid: mix(bg, snake, 0.13),
    frame: mix(bg, snake, 0.45),
    apple: food,
    appleHi: mix(food, [255, 255, 255], 0.45),
    stem: mix(bg, snake, 0.35),
    leaf: snake,
    snakeTail: mix(snake, bg, 0.42),
    snakeHead: snake,
    headBright: head,
    eye: bg,
  };
}

export function generateThumbnail(outPath, theme) {
  const pal = theme && THEMES[theme] ? derivePalette(THEMES[theme]) : CLASSIC;
  const c = createCanvas(WIDTH, HEIGHT);

  verticalGradient(c, pal.bgTop, pal.bgBottom);

  // subtle grid
  for (let i = 1; i < COLS; i++) for (let y = 0; y < HEIGHT; y++) setPx(c, i * CELL, y, ...pal.grid);
  for (let j = 1; j < ROWS; j++) for (let x = 0; x < WIDTH; x++) setPx(c, x, j * CELL, ...pal.grid);

  // framed border
  fillRect(c, 0, 0, WIDTH, 3, pal.frame);
  fillRect(c, 0, HEIGHT - 3, WIDTH, 3, pal.frame);
  fillRect(c, 0, 0, 3, HEIGHT, pal.frame);
  fillRect(c, WIDTH - 3, 0, 3, HEIGHT, pal.frame);

  const cc = (col, row) => [col * CELL + CELL / 2, row * CELL + CELL / 2];

  // apple / food pellet
  const apple = cc(24, 8);
  fillCircle(c, apple[0], apple[1], CELL * 0.42, pal.apple);
  fillCircle(c, apple[0] - 3, apple[1] - 3, CELL * 0.16, pal.appleHi);
  fillRect(c, Math.round(apple[0]) - 1, Math.round(apple[1] - CELL * 0.55), 2, 5, pal.stem);
  fillCircle(c, apple[0] + 5, apple[1] - CELL * 0.5, 3, pal.leaf);

  // snake — a pleasant curve, head bright, tail darker
  const body = [
    [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
    [11, 11], [11, 10], [12, 10], [13, 10], [14, 10],
    [15, 10], [16, 10], [17, 10], [18, 10], [19, 10],
  ];
  const R = CELL * 0.44;
  for (let i = 0; i < body.length - 1; i++) {
    const t = i / (body.length - 1);
    const color = [
      lerp(pal.snakeTail[0], pal.snakeHead[0], t),
      lerp(pal.snakeTail[1], pal.snakeHead[1], t),
      lerp(pal.snakeTail[2], pal.snakeHead[2], t),
    ];
    const a = cc(body[i][0], body[i][1]);
    const b = cc(body[i + 1][0], body[i + 1][1]);
    fillCapsule(c, a[0], a[1], b[0], b[1], R * (0.7 + 0.3 * (1 - t)), color);
  }
  const head = cc(body[body.length - 1][0], body[body.length - 1][1]);
  fillCircle(c, head[0], head[1], R, pal.headBright);
  fillCircle(c, head[0] + 4, head[1] - 4, 2.4, pal.eye);
  fillCircle(c, head[0] + 4, head[1] + 4, 2.4, pal.eye);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodePNG(c));
  return outPath;
}

function main() {
  const outArg = process.argv[2];
  const theme = process.argv[3];
  const outPath = outArg
    ? path.resolve(outArg)
    : path.join(repoRoot, "games", "classic-snake", "thumbnail.png");
  generateThumbnail(outPath, theme);
  console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT})${theme ? " theme=" + theme : ""}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();

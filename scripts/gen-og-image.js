// Generates the 1200x630 open-graph / social share image into the Pages publish
// root (site/og-image.png). Dark branded card: "SNAKE MUSEUM" wordmark (drawn
// with a tiny built-in bitmap font) + a snake motif. Zero dependencies.
//
//   node scripts/gen-og-image.js [outputPath]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas, encodePNG, verticalGradient, fillRect, fillCircle, fillCapsule, setPx, lerp } from "./lib/png.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const WIDTH = 1200;
const HEIGHT = 630;

// 5x7 uppercase bitmap font — only the glyphs needed for "SNAKE MUSEUM".
const FONT = {
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
};

function advanceOf(ch, s, gap) {
  return (ch === " " ? 3 * s : 5 * s) + gap;
}
function measure(text, s, gap) {
  let w = 0;
  for (const ch of text) w += advanceOf(ch, s, gap);
  return w - gap;
}
function drawText(c, text, x, y, s, gap, color) {
  let cx = x;
  for (const ch of text) {
    const g = FONT[ch];
    if (g) {
      for (let r = 0; r < g.length; r++) {
        for (let col = 0; col < g[r].length; col++) {
          if (g[r][col] === "#") fillRect(c, cx + col * s, y + r * s, s, s, color);
        }
      }
    }
    cx += advanceOf(ch, s, gap);
  }
}

export function generateOgImage(outPath) {
  const c = createCanvas(WIDTH, HEIGHT);

  verticalGradient(c, [21, 33, 56], [8, 12, 20]);

  // faint grid texture
  const GRID = [26, 40, 60];
  for (let x = 40; x < WIDTH; x += 40) for (let y = 0; y < HEIGHT; y++) setPx(c, x, y, ...GRID);
  for (let y = 40; y < HEIGHT; y += 40) for (let x = 0; x < WIDTH; x++) setPx(c, x, y, ...GRID);

  // green frame
  const FRAME = [64, 110, 92];
  fillRect(c, 0, 0, WIDTH, 6, FRAME);
  fillRect(c, 0, HEIGHT - 6, WIDTH, 6, FRAME);
  fillRect(c, 0, 0, 6, HEIGHT, FRAME);
  fillRect(c, WIDTH - 6, 0, 6, HEIGHT, FRAME);

  // wordmark
  const INK = [234, 241, 251];
  const scale = 16;
  const gap = 16;
  const text = "SNAKE MUSEUM";
  const w = measure(text, scale, gap);
  const tx = Math.round((WIDTH - w) / 2);
  const ty = 176;
  drawText(c, text, tx, ty, scale, gap, INK);

  // green accent underline
  const ACCENT = [82, 224, 138];
  fillRect(c, tx, ty + 7 * scale + 26, w, 8, ACCENT);

  // snake motif (lower third)
  const pts = [
    [360, 500], [430, 500], [500, 500], [545, 470],
    [560, 430], [620, 415], [690, 415], [760, 415], [820, 415],
  ];
  const R = 22;
  for (let i = 0; i < pts.length - 1; i++) {
    const t = i / (pts.length - 1);
    const color = [lerp(28, 74, t), lerp(150, 232, t), lerp(92, 138, t)];
    fillCapsule(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], R * (0.75 + 0.25 * (1 - t)), color);
  }
  const hx = pts[pts.length - 1][0];
  const hy = pts[pts.length - 1][1];
  fillCircle(c, hx, hy, R, [125, 255, 171]);
  fillCircle(c, hx + 6, hy - 6, 3, [6, 35, 26]);
  fillCircle(c, hx + 6, hy + 6, 3, [6, 35, 26]);

  // apple in front of the snake
  fillCircle(c, hx + 60, hy, 18, [255, 93, 108]);
  fillCircle(c, hx + 54, hy - 6, 6, [255, 170, 178]);
  fillCircle(c, hx + 66, hy - 20, 5, [82, 224, 138]);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodePNG(c));
  return outPath;
}

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, "site", "og-image.png");
  generateOgImage(outPath);
  console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();

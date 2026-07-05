// Generates games/classic-snake/thumbnail.png — a representative snake board
// (grid + snake + apple). Zero dependencies (see scripts/lib/png.js).
//
//   node scripts/gen-thumbnail.js [outputPath]

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

export function generateThumbnail(outPath) {
  const c = createCanvas(WIDTH, HEIGHT);

  verticalGradient(c, [22, 35, 59], [11, 15, 24]);

  // subtle grid
  const GRID = [30, 48, 43];
  for (let i = 1; i < COLS; i++) for (let y = 0; y < HEIGHT; y++) setPx(c, i * CELL, y, ...GRID);
  for (let j = 1; j < ROWS; j++) for (let x = 0; x < WIDTH; x++) setPx(c, x, j * CELL, ...GRID);

  // framed border
  const FRAME = [64, 110, 92];
  fillRect(c, 0, 0, WIDTH, 3, FRAME);
  fillRect(c, 0, HEIGHT - 3, WIDTH, 3, FRAME);
  fillRect(c, 0, 0, 3, HEIGHT, FRAME);
  fillRect(c, WIDTH - 3, 0, 3, HEIGHT, FRAME);

  const cc = (col, row) => [col * CELL + CELL / 2, row * CELL + CELL / 2];

  // apple
  const apple = cc(24, 8);
  fillCircle(c, apple[0], apple[1], CELL * 0.42, [255, 93, 108]);
  fillCircle(c, apple[0] - 3, apple[1] - 3, CELL * 0.16, [255, 170, 178]);
  fillRect(c, Math.round(apple[0]) - 1, Math.round(apple[1] - CELL * 0.55), 2, 5, [120, 74, 48]);
  fillCircle(c, apple[0] + 5, apple[1] - CELL * 0.5, 3, [82, 224, 138]);

  // snake — a pleasant curve, head bright, tail darker
  const body = [
    [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
    [11, 11], [11, 10], [12, 10], [13, 10], [14, 10],
    [15, 10], [16, 10], [17, 10], [18, 10], [19, 10],
  ];
  const R = CELL * 0.44;
  for (let i = 0; i < body.length - 1; i++) {
    const t = i / (body.length - 1);
    const color = [lerp(28, 74, t), lerp(150, 232, t), lerp(92, 138, t)];
    const a = cc(body[i][0], body[i][1]);
    const b = cc(body[i + 1][0], body[i + 1][1]);
    fillCapsule(c, a[0], a[1], b[0], b[1], R * (0.7 + 0.3 * (1 - t)), color);
  }
  const head = cc(body[body.length - 1][0], body[body.length - 1][1]);
  fillCircle(c, head[0], head[1], R, [125, 255, 171]);
  fillCircle(c, head[0] + 4, head[1] - 4, 2.4, [6, 35, 26]);
  fillCircle(c, head[0] + 4, head[1] + 4, 2.4, [6, 35, 26]);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodePNG(c));
  return outPath;
}

function main() {
  const outPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repoRoot, "games", "classic-snake", "thumbnail.png");
  generateThumbnail(outPath);
  console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();

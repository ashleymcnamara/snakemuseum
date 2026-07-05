// Zero-dependency thumbnail generator.
//
// Draws a representative "Classic Snake" board (grid + snake + apple) into an
// RGB framebuffer and encodes it as a real PNG using only Node's built-in zlib.
// No canvas/native deps. Used to produce games/classic-snake/thumbnail.png.
//
//   node scripts/gen-thumbnail.js [outputPath]

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "games", "classic-snake", "thumbnail.png");

const WIDTH = 640;
const HEIGHT = 400;
const CELL = 20; // 32 x 20 grid
const COLS = WIDTH / CELL;
const ROWS = HEIGHT / CELL;

const buf = Buffer.alloc(WIDTH * HEIGHT * 3);

function setPx(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function fillCircle(cx, cy, radius, [r, g, b]) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(x, y, r, g, b);
    }
  }
}

function fillCapsule(x1, y1, x2, y2, radius, color) {
  // thick line between two points = many circles (cheap, fine for a thumbnail)
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    fillCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius, color);
  }
}

function drawRect(x, y, w, h, [r, g, b]) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(xx, yy, r, g, b);
}

// 1) vertical gradient background
const TOP = [22, 35, 59];
const BOTTOM = [11, 15, 24];
for (let y = 0; y < HEIGHT; y++) {
  const t = y / (HEIGHT - 1);
  const r = lerp(TOP[0], BOTTOM[0], t);
  const g = lerp(TOP[1], BOTTOM[1], t);
  const b = lerp(TOP[2], BOTTOM[2], t);
  for (let x = 0; x < WIDTH; x++) setPx(x, y, r, g, b);
}

// 2) subtle grid
const GRID = [30, 48, 43];
for (let i = 1; i < COLS; i++) for (let y = 0; y < HEIGHT; y++) setPx(i * CELL, y, ...GRID);
for (let j = 1; j < ROWS; j++) for (let x = 0; x < WIDTH; x++) setPx(x, j * CELL, ...GRID);

// 3) framed border, like a museum exhibit
const FRAME = [64, 110, 92];
drawRect(0, 0, WIDTH, 3, FRAME);
drawRect(0, HEIGHT - 3, WIDTH, 3, FRAME);
drawRect(0, 0, 3, HEIGHT, FRAME);
drawRect(WIDTH - 3, 0, 3, HEIGHT, FRAME);

// helper: cell center in pixels
const c = (col, row) => [col * CELL + CELL / 2, row * CELL + CELL / 2];

// 4) apple
const apple = c(24, 8);
fillCircle(apple[0], apple[1], CELL * 0.42, [255, 93, 108]);
fillCircle(apple[0] - 3, apple[1] - 3, CELL * 0.16, [255, 170, 178]); // highlight
drawRect(Math.round(apple[0]) - 1, Math.round(apple[1] - CELL * 0.55), 2, 5, [120, 74, 48]); // stem
fillCircle(apple[0] + 5, apple[1] - CELL * 0.5, 3, [82, 224, 138]); // leaf

// 5) snake — a pleasant S-curve, head bright, tail darker
const body = [
  [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
  [11, 11], [11, 10], [12, 10], [13, 10], [14, 10],
  [15, 10], [16, 10], [17, 10], [18, 10], [19, 10],
];
const R = CELL * 0.44;
for (let i = 0; i < body.length - 1; i++) {
  const t = i / (body.length - 1); // 0 = tail, 1 = head
  const color = [lerp(28, 74, t), lerp(150, 232, t), lerp(92, 138, t)];
  const a = c(body[i][0], body[i][1]);
  const b = c(body[i + 1][0], body[i + 1][1]);
  fillCapsule(a[0], a[1], b[0], b[1], R * (0.7 + 0.3 * (1 - t)), color);
}
// head
const head = c(body[body.length - 1][0], body[body.length - 1][1]);
fillCircle(head[0], head[1], R, [125, 255, 171]);
fillCircle(head[0] + 4, head[1] - 4, 2.4, [6, 35, 26]); // eyes (moving right)
fillCircle(head[0] + 4, head[1] + 4, 2.4, [6, 35, 26]);

// ---- PNG encoding ----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 2;   // color type: truecolor RGB
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace

// add a filter byte (0 = none) at the start of every scanline
const raw = Buffer.alloc(HEIGHT * (WIDTH * 3 + 1));
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (WIDTH * 3 + 1)] = 0;
  buf.copy(raw, y * (WIDTH * 3 + 1) + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT}, ${png.length} bytes)`);

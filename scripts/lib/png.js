// Zero-dependency RGB raster + PNG encoder shared by the thumbnail and
// open-graph image generators. Node stdlib only (zlib for DEFLATE).

import zlib from "node:zlib";

export function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function createCanvas(width, height) {
  return { width, height, buf: Buffer.alloc(width * height * 3) };
}

export function setPx(c, x, y, r, g, b) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 3;
  c.buf[i] = r;
  c.buf[i + 1] = g;
  c.buf[i + 2] = b;
}

export function fillRect(c, x, y, w, h, [r, g, b]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(c, xx, yy, r, g, b);
  }
}

export function fillCircle(c, cx, cy, radius, [r, g, b]) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(c, x, y, r, g, b);
    }
  }
}

export function fillCapsule(c, x1, y1, x2, y2, radius, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    fillCircle(c, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius, color);
  }
}

export function verticalGradient(c, top, bottom) {
  for (let y = 0; y < c.height; y++) {
    const t = y / (c.height - 1);
    const r = lerp(top[0], bottom[0], t);
    const g = lerp(top[1], bottom[1], t);
    const b = lerp(top[2], bottom[2], t);
    for (let x = 0; x < c.width; x++) setPx(c, x, y, r, g, b);
  }
}

// ---- PNG encoding (truecolor RGB, filter 0) --------------------------------
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

export function encodePNG(c) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.width, 0);
  ihdr.writeUInt32BE(c.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = c.width * 3 + 1;
  const raw = Buffer.alloc(c.height * rowLen);
  for (let y = 0; y < c.height; y++) {
    raw[y * rowLen] = 0; // filter: none
    c.buf.copy(raw, y * rowLen + 1, y * c.width * 3, (y + 1) * c.width * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

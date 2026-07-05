// Tiny zero-dependency static file server for local preview of the built site.
// Serves the site/ directory. Run with `npm run serve` (after `npm run build`).
//
//   node scripts/serve.js [port]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "site");
const port = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let rel = urlPath.replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";

  const filePath = path.join(root, rel);
  // prevent path traversal outside site/
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("404 Not Found");
      return;
    }
    const type = TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type }).end(data);
  });
});

server.listen(port, () => {
  console.log(`Snake Museum preview → http://localhost:${port}`);
  console.log(`Serving ${root}`);
  console.log("Press Ctrl+C to stop.");
});

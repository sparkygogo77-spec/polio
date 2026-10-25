/**
 * Serves the Agents dock: the page the helper will show inside the Builder
 * as a frame. Until the helper exists this is the whole server, and it plays
 * the fake runner (helper/fake.ts) in the page.
 *
 *   node helper/dock/serve.mjs [port]      # 3151 by default, then /dock
 *
 * It holds the helper's safety rules from the start, so the real helper can
 * take this file over: 127.0.0.1 only, the Host header must be ours (that
 * stops DNS rebinding), only files under helper/ are served, and only the
 * Builder may frame the page. TypeScript is served with its types stripped,
 * so the dock imports contract.ts and fake.ts exactly as the tests do.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HELPER = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDER = "https://polio-two.vercel.app";
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".ts": "text/javascript", ".svg": "image/svg+xml" };

const stripped = new Map();
async function body(file) {
  const raw = await readFile(file, "utf8");
  if (extname(file) !== ".ts") return raw;
  if (!stripped.has(file)) stripped.set(file, stripTypeScriptTypes(raw, { mode: "strip" }));
  return stripped.get(file);
}

/** Resolves with the listening server; `port: 0` picks a free one. */
export function serveDock({ port = 3151 } = {}) {
  const server = createServer(async (req, res) => {
    const own = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`];
    if (!own.includes(req.headers.host ?? "")) { res.writeHead(403).end("not this host"); return; }
    if (req.method !== "GET") { res.writeHead(405).end(); return; }
    const path = new URL(req.url ?? "/", "http://x").pathname;
    // Browsers ask for this on their own; answer so the page logs no 404.
    if (path === "/favicon.ico") { res.writeHead(204, { "cache-control": "max-age=86400" }).end(); return; }
    // The page lives at /dock/, so its own files and ../fake.ts resolve.
    if (path === "/" || path === "/dock") { res.writeHead(302, { location: `/dock/${new URL(req.url ?? "/", "http://x").search}` }).end(); return; }
    const rel = path === "/dock/" ? "dock/index.html" : decodeURIComponent(path).replace(/^\/+/, "");
    const file = resolve(HELPER, rel);
    if (!file.startsWith(HELPER + sep)) { res.writeHead(404).end(); return; }
    try {
      const text = await body(file);
      res.writeHead(200, {
        "content-type": `${TYPES[extname(file)] ?? "text/plain"}; charset=utf-8`,
        "content-security-policy": `frame-ancestors ${BUILDER}; default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`,
        "cache-control": "no-store",
      }).end(text);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const server = await serveDock({ port: Number(process.argv[2] ?? 3151) });
  console.log(`dock on http://127.0.0.1:${server.address().port}/dock`);
}

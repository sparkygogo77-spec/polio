/**
 * Serves the Agents dock: the page the helper will show inside the Builder
 * as a frame. Until the helper exists this is the whole server, and it plays
 * the fake runner (helper/fake.ts) in the page.
 *
 *   node helper/dock/serve.mjs [port]        # 3151 by default, then /dock
 *   node helper/dock/serve.mjs [port] --pc   # also reads the real PC: /dock?tab=pc&pc=live
 *
 * It holds the helper's safety rules from the start, so the real helper can
 * take this file over: 127.0.0.1 only, the Host header must be ours (that
 * stops DNS rebinding), only files under helper/ are served, and only the
 * Builder may frame the page. TypeScript is served with its types stripped,
 * so the dock imports contract.ts and fake.ts exactly as the tests do.
 *
 * With pc on, it also answers "Everything Claude is doing" (helper/pc):
 * GET /api/pc/now, and POST /api/pc/stop and /api/pc/stop-idle with a contract message.
 * A POST must come from this page itself (its Origin is ours and it sends
 * x-polio-dock), so another site open in the browser can't press Stop. Until
 * the runner's pairing token exists, that is the guard: run it only while
 * you are looking at it.
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

async function readJson(req) {
  let text = "";
  for await (const chunk of req) { text += chunk; if (text.length > 4096) throw new Error("too long"); }
  return JSON.parse(text);
}

const json = (res, code, body) => res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));

/** Resolves with the listening server; `port: 0` picks a free one. `pc` turns the real PC reader on. */
export async function serveDock({ port = 3151, pc = false } = {}) {
  const watch = pc ? (await import("../pc/watch.ts")).pcWatch() : null;
  const { problems } = await import("../contract.ts");
  const server = createServer(async (req, res) => {
    const own = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`];
    if (!own.includes(req.headers.host ?? "")) { res.writeHead(403).end("not this host"); return; }
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (path.startsWith("/api/pc/")) {
      if (!watch) { json(res, 404, { error: "start with --pc to read the PC" }); return; }
      try {
        if (req.method === "GET" && path === "/api/pc/now") { json(res, 200, await watch.read()); return; }
        const fromPage = own.some((h) => req.headers.origin === `http://${h}`) && req.headers["x-polio-dock"] === "1";
        if (req.method !== "POST" || !fromPage) { res.writeHead(403).end("not from the dock"); return; }
        const m = await readJson(req);
        const p = problems(m);
        if (p.length) { json(res, 400, { error: p.join("; ") }); return; }
        if (path === "/api/pc/stop" && m.kind === "pc-stop") { json(res, 200, await watch.stop(m.pid, m.created, m.confirmSession)); return; }
        if (path === "/api/pc/stop-idle" && m.kind === "pc-stop-idle") { json(res, 200, await watch.stopIdle(m.minutes)); return; }
        json(res, 400, { error: "wrong message for this path" });
      } catch (e) { json(res, 500, { error: String(e?.message ?? e) }); }
      return;
    }
    if (req.method !== "GET") { res.writeHead(405).end(); return; }
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
  server.on("close", () => watch?.close());
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const pc = process.argv.includes("--pc");
  const server = await serveDock({ port: Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 3151), pc });
  console.log(`dock on http://127.0.0.1:${server.address().port}/dock${pc ? "?tab=pc&pc=live" : ""}`);
}

/**
 * The helper's loopback server (proposal, section 4, "Safety").
 *
 * - Listens on 127.0.0.1 only, so nothing off the PC can reach it.
 * - Host must be exactly 127.0.0.1:<port>. That stops DNS rebinding, where
 *   a site's own name is made to point at 127.0.0.1: the browser would
 *   still send that site's name as Host.
 * - Two origins, and what each may do:
 *     https://polio-two.vercel.app   the Builder page: only GET /health, to
 *                                    see that a helper is there (CORS allows
 *                                    exactly this origin, nothing else)
 *     http://127.0.0.1:<port>        the dock: the frame this server draws
 *                                    inside the Builder (GET /dock). Pairing,
 *                                    requests, the stream and every control
 *   A request with any other Origin, or none, is refused (GET /dock alone
 *   is a page load, which carries no Origin; the page's frame-ancestors
 *   lets only the Builder frame it).
 * - Everything after pairing needs the token, which lives in the dock frame
 *   and never in a URL. A script on the Builder page (a captured site's,
 *   say) can't read the frame or send its Origin, so it can't drive this.
 * - Pause, Stop and the rest are taken only from the dock, and only as J.
 *
 * The stream is newline-delimited JSON over a plain streamed response, not
 * a WebSocket (Chrome's local-network rules gate those separately).
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { problems, type Message } from "../contract.ts";
import type { Runner } from "../agents/runner.ts";
import type { Pairing } from "./pairing.ts";

export const BUILDER_ORIGIN = "https://polio-two.vercel.app";
export const HELPER_PORT = 47821;
const MAX_BODY = 1 << 20;
const DOCK_PAGE = fileURLToPath(new URL("../dock/index.html", import.meta.url));
/** One plain file name inside helper/dock: no folders, no dot-dot. */
const DOCK_FILE = /^\/dock\/[a-z0-9-]+\.(ts|css|js|mjs|svg)$/;
const TYPES: Record<string, string> = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".ts": "text/javascript", ".svg": "image/svg+xml" };

export type HelperServer = { server: Server; port: number; close(): Promise<void> };

type Who = "builder" | "dock" | "none";

export async function startHelperServer(opts: {
  runner: Runner; pairing: Pairing; port?: number; builderOrigin?: string;
}): Promise<HelperServer> {
  const builder = opts.builderOrigin ?? BUILDER_ORIGIN;
  let port = opts.port ?? HELPER_PORT;
  const streams = new Set<ServerResponse>();

  const send = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra });
    res.end(JSON.stringify(body));
  };
  const refuse = (res: ServerResponse, status: number, error: string) => send(res, status, { ok: false, error });

  const whoIs = (req: IncomingMessage): Who | null => {
    const o = req.headers.origin;
    if (o === undefined) return "none";
    if (o === builder) return "builder";
    if (o === `http://127.0.0.1:${port}`) return "dock";
    return null;
  };
  const bearer = (req: IncomingMessage) => {
    const h = req.headers.authorization ?? "";
    return h.startsWith("Bearer ") ? h.slice(7) : null;
  };
  const body = (req: IncomingMessage) => new Promise<unknown>((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Error("too big")); req.destroy(); } else parts.push(c); });
    req.on("end", () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {}); } catch { reject(new Error("not JSON")); } });
    req.on("error", reject);
  });

  const onMessage = (m: Message) => { const line = JSON.stringify(m) + "\n"; for (const s of streams) s.write(line); };
  const unsubscribe = opts.runner.subscribe(onMessage);

  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (req.headers.host !== `127.0.0.1:${port}`) return refuse(res, 421, "wrong Host: the helper answers only to 127.0.0.1");
    const who = whoIs(req);
    if (who === null) return refuse(res, 403, "this origin may not use the helper");
    const path = new URL(req.url ?? "/", `http://127.0.0.1:${port}`).pathname;
    const method = req.method ?? "GET";

    // The Builder page may only ask whether a helper is here.
    if (who === "builder") {
      const cors = { "access-control-allow-origin": builder, vary: "Origin" };
      if (path === "/health" && method === "OPTIONS") {
        res.writeHead(204, { ...cors, "access-control-allow-methods": "GET", "access-control-max-age": "600" });
        return res.end();
      }
      if (path === "/health" && method === "GET") return send(res, 200, { helper: true, paired: opts.pairing.paired }, cors);
      return refuse(res, 403, "the Builder page can't drive the helper: the dock does");
    }

    // The dock's own files: a page load or its module imports. Nothing else
    // under helper/ is served.
    if (method === "GET" && (path === "/" || path === "/dock")) {
      res.writeHead(302, { location: "/dock/" });
      return res.end();
    }
    // Browsers ask for this on their own; an empty answer keeps the dock's log clean.
    if (method === "GET" && path === "/favicon.ico") {
      res.writeHead(204, { "cache-control": "max-age=86400" });
      return res.end();
    }
    if (method === "GET" && (path === "/dock/" || DOCK_FILE.test(path) || path === "/contract.ts" || path === "/fake.ts")) {
      const file = path === "/dock/" ? DOCK_PAGE : fileURLToPath(new URL(`..${path}`, import.meta.url));
      const kind = extname(file);
      const page = path === "/dock/" && !existsSync(DOCK_PAGE);
      if (!page && !existsSync(file)) return refuse(res, 404, "no such file");
      let text = page ? PLACEHOLDER : readFileSync(file, "utf8");
      if (kind === ".ts") text = stripTypeScriptTypes(text, { mode: "strip" });
      res.writeHead(200, {
        "content-type": `${TYPES[kind] ?? "text/plain"}; charset=utf-8`, "cache-control": "no-store", "x-content-type-options": "nosniff",
        "content-security-policy": `frame-ancestors ${builder}; default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`,
        "referrer-policy": "no-referrer",
      });
      return res.end(text);
    }
    if (who === "none") return refuse(res, 403, "a request with no Origin can't use the helper");

    // From here on: the dock.
    if (method === "POST" && path === "/pair/start") return send(res, 200, opts.pairing.start());
    if (method === "POST" && path === "/pair") {
      const b = (await body(req)) as { code?: unknown };
      const r = opts.pairing.finish(b?.code);
      return send(res, r.ok ? 200 : 403, r);
    }
    if (!opts.pairing.check(bearer(req))) return refuse(res, 401, "pair first: the token is missing or wrong");

    if (method === "POST" && path === "/unpair") { opts.pairing.unpair(); for (const s of streams) s.end(); return send(res, 200, { ok: true }); }
    if (method === "GET" && path === "/stream") {
      res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      for (const m of opts.runner.snapshot()) res.write(JSON.stringify(m) + "\n");
      streams.add(res);
      const beat = setInterval(() => res.write("\n"), 15_000);
      res.on("close", () => { clearInterval(beat); streams.delete(res); });
      return;
    }
    if (method === "POST" && path === "/request") {
      const b = await body(req);
      const p = problems(b);
      if (p.length) return refuse(res, 400, p.join("; "));
      try { return send(res, 200, { ok: true, plan: opts.runner.submit(b as never) }); }
      catch (e) { return refuse(res, 409, String((e as Error).message)); }
    }
    if (method === "POST" && path === "/control") {
      const b = (await body(req)) as Record<string, unknown>;
      // Whoever holds the dock is J. A control from the dock that claims to
      // be the runner is refused, the spend-cap pause included.
      if (b?.by !== "j") return refuse(res, 403, "controls from the dock are J's");
      const r = await opts.runner.control(b as never);
      return send(res, r.ok ? 200 : 409, r);
    }
    return refuse(res, 404, "no such thing");
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((e) => { if (!res.headersSent) refuse(res, 400, String(e?.message ?? e)); else res.end(); });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  port = (server.address() as { port: number }).port;
  return {
    server, port,
    close: () => new Promise<void>((resolve) => {
      unsubscribe();
      for (const s of streams) s.end();
      server.close(() => resolve());
      server.closeAllConnections?.();
    }),
  };
}

const PLACEHOLDER = `<!doctype html><meta charset="utf-8"><title>Polio Helper</title>
<body style="font:14px system-ui;padding:16px">Polio Helper is running. The dock page (helper/dock) isn't installed yet.</body>`;

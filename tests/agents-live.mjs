/**
 * Agents panel, live: the dock talks to the real helper, and the site relay.
 *
 * Part 1, the relay (no browser): the helper's POST /site takes a call only
 * with a lane ticket and no Origin, hands it to the newest paired dock stream,
 * and answers with the dock's POST /site/reply. A page (any Origin), a call
 * with no ticket, a dropped lane's ticket, or a reply without the token gets
 * nothing. The real MCP server (helper/mcp/site.ts) goes through it end to end.
 *
 * Part 2, the dock (headless browser): a stand-in Builder at
 * https://polio-two.vercel.app (routed) frames the helper's /dock. The dock
 * has no fake runner: it asks to pair, takes the code shown on the PC, opens
 * the stream, plans through POST /request, starts with approve controls, and
 * draws the lanes the helper streams. A site call from a lane reaches the
 * Builder through the frame and the Builder's answer comes back to the lane.
 * A reload keeps the pairing; Unpair asks for it again.
 *
 *   node --import <pw-args.mjs> tests/agents-live.mjs
 */
import { request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = (code) => {
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(code ?? (pass === results.length ? 0 : 1));
};

let Sv = null, Pa = null, T = null, F = null, C = null;
try {
  Sv = await import("../helper/server/server.ts");
  Pa = await import("../helper/server/pairing.ts");
  T = await import("../helper/server/tickets.ts");
  F = await import("../helper/fake.ts");
  C = await import("../helper/contract.ts");
  await import("../helper/dock/live.ts").catch((e) => { if (!/document|window|localStorage/.test(e.message)) throw e; });
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the server, the tickets and the dock's live link load", !!(Sv && Pa && T && F && C));
if (!(Sv && Pa && T && F && C)) done(1);

/** A stand-in runner: the plan and lane rows of the fake script, under the dock's own request id. */
function standIn() {
  const listeners = new Set();
  const controls = [];
  const said = [];
  const emit = (m) => { said.push(m); for (const fn of listeners) fn(m); };
  const script = F.fakeScript();
  let reqId = null;
  return {
    controls, said,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot: () => said.filter((m) => m.kind !== "plan"),
    submit(req) {
      reqId = req.id;
      const plan = { ...script.find((m) => m.kind === "plan"), requestId: req.id };
      emit(plan);
      emit({ ...script.find((m) => m.kind === "lane"), requestId: req.id, stepsDone: 6, stepNow: "merge", state: "only-you", note: "waiting for Start" });
      return plan;
    },
    async control(c) {
      controls.push(c);
      if (c.do === "approve") for (const m of script) {
        if (m.kind === "lane" && m.stepsDone >= 6 && m.state !== "only-you") emit({ ...m, requestId: reqId });
        if (m.kind === "merge") emit(m);
        if (m.kind === "spend") emit({ ...m, requestId: reqId });
      }
      return { ok: true };
    },
  };
}

const call = (port, method, path, { origin, token, ticket, body } = {}) => new Promise((resolve, reject) => {
  const headers = { host: `127.0.0.1:${port}` };
  if (origin) headers.origin = origin;
  if (token) headers.authorization = `Bearer ${token}`;
  if (ticket !== undefined) headers["x-polio-lane"] = ticket;
  if (body !== undefined) headers["content-type"] = "application/json";
  const req = httpRequest({ host: "127.0.0.1", port, method, path, headers }, (res) => {
    let text = "";
    res.on("data", (c) => { text += c; });
    res.on("end", () => { let json = null; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode, json, text }); });
  });
  req.on("error", reject);
  if (body !== undefined) req.write(JSON.stringify(body));
  req.end();
});

/** Opens /stream as the dock does and collects its lines. */
function openStream(port, token) {
  const lines = [];
  let res = null;
  const ready = new Promise((ok) => {
    const req = httpRequest({ host: "127.0.0.1", port, path: "/stream", headers: { host: `127.0.0.1:${port}`, origin: `http://127.0.0.1:${port}`, authorization: `Bearer ${token}` } }, (r) => {
      res = r; let buf = "";
      r.on("data", (c) => { buf += c; let at; while ((at = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, at); buf = buf.slice(at + 1); if (l.trim()) lines.push(JSON.parse(l)); } });
      ok(r.statusCode);
    });
    req.end();
  });
  return { lines, ready, close: () => res?.destroy() };
}
const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } return null; };
const siteReq = (op = "read") => ({ source: "polio-dock", kind: "site", v: 1, id: "agent-1", op });

// ---- part 1: the relay -----------------------------------------------------------

{
  const shown = [];
  const pairing = new Pa.Pairing({ show: (c) => shown.push(c) });
  const tickets = new T.SiteTickets();
  const helper = await Sv.startHelperServer({ runner: standIn(), pairing, tickets, port: 0, siteWaitMs: 400 });
  const port = helper.port, DOCK = `http://127.0.0.1:${port}`;
  try {
    await call(port, "POST", "/pair/start", { origin: DOCK });
    const token = (await call(port, "POST", "/pair", { origin: DOCK, body: { code: shown.at(-1) } })).json?.token;
    const ticket = tickets.issue("calm-hero");

    check("a ticket is not the pairing token and opens no stream", ticket !== token && (await call(port, "GET", "/stream", { origin: DOCK, token: ticket })).status === 401);
    check("/site with no ticket is refused", (await call(port, "POST", "/site", { body: siteReq() })).status === 401);
    check("/site with a made-up ticket is refused", (await call(port, "POST", "/site", { ticket: "x".repeat(32), body: siteReq() })).status === 401);
    check("/site from a page (the Builder's Origin) is refused, ticket or not", (await call(port, "POST", "/site", { origin: Sv.BUILDER_ORIGIN, ticket, body: siteReq() })).status === 403);
    check("/site from the dock's own Origin is refused (a lane's call has none)", (await call(port, "POST", "/site", { origin: DOCK, ticket, body: siteReq() })).status === 403);
    check("/site that isn't a site request is refused", (await call(port, "POST", "/site", { ticket, body: { ...siteReq(), op: "publish" } })).status === 400);
    const noDock = await call(port, "POST", "/site", { ticket, body: siteReq() });
    check("with no dock open the lane is told so", noDock.status === 503 && /dock isn't open/.test(noDock.json?.says ?? ""), noDock.text);

    const s = openStream(port, token);
    await s.ready;
    const pending = call(port, "POST", "/site", { ticket, body: siteReq("read") });
    const line = await until(() => s.lines.find((l) => l.kind === "site"));
    check("the call goes down the paired dock's stream, named for its lane", line?.lane === "calm-hero" && line.request.op === "read" && line.request.source === "polio-dock", JSON.stringify(line));
    check("the helper gives the call its own id", typeof line?.request.id === "string" && line.request.id.startsWith("calm-hero-"));
    const reply = { source: "polio-builder", kind: "site", v: 1, id: line?.request.id, ok: true, result: { parts: 3 } };
    check("a reply without the token is refused", (await call(port, "POST", "/site/reply", { origin: DOCK, body: reply })).status === 401);
    check("a reply from the Builder's Origin is refused", (await call(port, "POST", "/site/reply", { origin: Sv.BUILDER_ORIGIN, token, body: reply })).status === 403);
    check("a reply to an id nobody waits on is refused", (await call(port, "POST", "/site/reply", { origin: DOCK, token, body: { ...reply, id: "nope" } })).status === 404);
    check("the paired dock's reply is taken", (await call(port, "POST", "/site/reply", { origin: DOCK, token, body: reply })).status === 200);
    const got = await pending;
    check("the lane gets the Builder's answer", got.status === 200 && got.json?.ok === true && got.json.result?.parts === 3, got.text);
    check("a reply is good once", (await call(port, "POST", "/site/reply", { origin: DOCK, token, body: reply })).status === 404);

    const slow = await call(port, "POST", "/site", { ticket, body: siteReq() });
    check("a Builder that doesn't answer gives the lane a plain no, not a hang", slow.status === 200 && slow.json?.ok === false && /in time/.test(slow.json.says), slow.text);

    // The real MCP server, as a lane's agent would run it.
    const site = spawn(process.execPath, [fileURLToPath(new URL("../helper/mcp/site.ts", import.meta.url))], {
      env: { ...process.env, POLIO_SITE_RELAY: `${DOCK}/site`, POLIO_SITE_TICKET: ticket }, stdio: ["pipe", "pipe", "ignore"],
    });
    let out = "";
    site.stdout.on("data", (c) => { out += c; });
    const seen = s.lines.filter((l) => l.kind === "site").length;
    site.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "site.read", arguments: {} } })}\n`);
    const viaMcp = await until(() => s.lines.filter((l) => l.kind === "site")[seen]);
    if (viaMcp) await call(port, "POST", "/site/reply", { origin: DOCK, token, body: { ...reply, id: viaMcp.request.id, result: { site: "sol", parts: 800 } } });
    const rpc = await until(() => out.includes("\n") && JSON.parse(out.split("\n")[0]));
    site.kill();
    check("site.read from the real MCP server comes back through the relay", rpc?.id === 7 && /"parts": 800/.test(rpc.result?.content?.[0]?.text ?? ""), out.slice(0, 200));

    tickets.drop("calm-hero");
    check("a dropped lane's ticket stops working", (await call(port, "POST", "/site", { ticket, body: siteReq() })).status === 401);
    s.close();
  } finally { await helper.close(); }
}

// A PC lane gets its own ticket in its environment, and loses it when it ends.
{
  const tickets = new T.SiteTickets();
  let seen = null, finish = null;
  const inner = { where: "pc", pays: "plan", can: { pause: true, stop: true, tokens: true },
    start(spec) { seen = spec.env; return { events: (async function* () { await new Promise((r) => { finish = r; }); yield { type: "ended", ok: true, reason: "done" }; })(), steer: async () => {}, stop: async () => {} }; } };
  const run = T.withSiteTickets(inner, tickets, "http://127.0.0.1:47822/site").start({ lane: "calm-hero", env: { PATH: "x" } });
  const it = run.events[Symbol.asyncIterator]();
  const first = it.next();
  check("a PC lane starts with its own ticket and the relay's address", tickets.check(seen?.POLIO_SITE_TICKET) === "calm-hero" && seen.POLIO_SITE_RELAY === "http://127.0.0.1:47822/site" && seen.PATH === "x");
  finish(); await first; await it.next();
  check("the ticket is dropped when the lane ends", tickets.check(seen?.POLIO_SITE_TICKET) === null);
  const { readFileSync, mkdtempSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(T.siteMcpConfig(mkdtempSync(join(tmpdir(), "site-mcp-"))), "utf8"));
  check("the MCP config names the site server", /site\.ts$/.test(cfg.mcpServers?.["polio-site"]?.args?.[0] ?? ""));
}

// ---- part 2: the dock on the real helper -----------------------------------------

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require("playwright-core")); } catch { /* below */ }
check("a browser kit is there", !!chromium);
{
  const { readFileSync } = await import("node:fs");
  const dock = readFileSync(new URL("../src/features/agents/AgentsDock.tsx", import.meta.url), "utf8");
  check("the Builder's dock frame delegates Local Network Access (Chrome blocks 127.0.0.1 frames without it)", /<iframe[\s\S]*?allow="local-network-access"[\s\S]*?\/>/.test(dock));
}
if (!chromium) done(1);

{
  const shown = [];
  const pairing = new Pa.Pairing({ show: (c) => shown.push(c) });
  const tickets = new T.SiteTickets();
  const runner = standIn();
  const helper = await Sv.startHelperServer({ runner, pairing, tickets, port: 0 });
  const port = helper.port, HELPER = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext();
    // Chrome's Local Network Access: J says yes once to polio-two.vercel.app reaching his PC.
    await ctx.grantPermissions(["local-network-access"], { origin: "https://polio-two.vercel.app" });
    // The stand-in Builder: frames the dock and answers site calls as bridge.ts does (only from the frame, only to its origin).
    await ctx.route("https://polio-two.vercel.app/**", (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body>
      <iframe id="dock" allow="local-network-access" src="${HELPER}/dock/" style="width:380px;height:900px"></iframe>
      <script>
        window.asked = [];
        addEventListener("message", (e) => {
          const f = document.getElementById("dock");
          if (e.origin !== "${HELPER}" || e.source !== f.contentWindow || e.data?.kind !== "site") return;
          window.asked.push(e.data);
          e.source.postMessage({ source: "polio-builder", kind: "site", v: 1, id: e.data.id, ok: true, result: { applied: e.data.name ?? null, op: e.data.op } }, "${HELPER}");
        });
      </script>` }));
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    if (process.env.LIVE_DEBUG) { page.on("console", (m) => console.log("   console:", m.text())); page.on("response", (r) => r.url().startsWith(HELPER) && !/\.(ts|css)$/.test(r.url()) && console.log("   resp:", r.status(), r.request().method(), r.url())); }
    await page.goto("https://polio-two.vercel.app/builder");
    const frame = await until(() => page.frames().find((f) => f.url().startsWith(HELPER)), 8000);
    await frame.waitForSelector("body[data-dock-ready]");
    await frame.waitForSelector("body[data-helper-state='pair']", { timeout: 5000 }).catch(() => {});

    const first = await frame.evaluate(() => ({
      live: window.__dock.live, helper: document.body.dataset.helperState, pairShown: !document.querySelector("[data-pair]").hidden,
      rows: document.querySelectorAll("[data-lane-row]").length, said: document.querySelector("[data-helper]").textContent,
    }));
    check("the dock runs on the helper, not the fake runner", first.live === true && first.rows === 0, JSON.stringify(first));
    check("unpaired, it asks to pair", first.helper === "pair" && first.pairShown, JSON.stringify(first));

    await frame.click("[data-pair-start]");
    const code = await until(() => shown.at(-1));
    check("Show a code puts a code on the PC, not in the dock", /^\d{6}$/.test(code ?? "") && !(await frame.content()).includes(code));
    await frame.fill("[data-pair-code]", `${code.slice(0, 3)} ${code.slice(3)}`);
    await frame.click("[data-pair-send]");
    await frame.waitForSelector("body[data-helper-state='live']", { timeout: 5000 }).catch(() => {});
    const paired = await frame.evaluate(() => ({ say: document.querySelector("[data-pair-say]").textContent, helper: document.body.dataset.helperState, pairHidden: document.querySelector("[data-pair]").hidden, url: location.href }));
    check("the code pairs it and the stream opens", paired.helper === "live" && paired.pairHidden, JSON.stringify(paired));
    check("the token is in no URL", !/token|Bearer/i.test(paired.url));

    await frame.fill("[data-prompt]", "Add a gallery page to the export");
    await frame.click("[data-plan-it]");
    await frame.waitForSelector("[data-plan-card]", { timeout: 5000 }).catch(() => {});
    const planned = await frame.evaluate(() => ({ card: !!document.querySelector("[data-plan-card]"), lanes: document.querySelectorAll(".plan-lanes li").length, req: window.__dock.request?.id }));
    check("Plan it goes to the helper and draws its plan", planned.card && planned.lanes === 1 && planned.req?.startsWith("req-"), JSON.stringify(planned));
    const waiting = await frame.waitForSelector("[data-lane-row='export-gallery'][data-state='only-you']", { timeout: 3000 }).then(() => true).catch(() => false);
    check("the waiting lane arrives on the stream", waiting);

    await frame.click("[data-start]");
    await frame.waitForSelector("[data-lane-row='export-gallery'][data-state='done']", { timeout: 5000 }).catch(() => {});
    check("Start sends approve as J for each lane", runner.controls.some((c) => c.do === "approve" && c.by === "j" && c.lane === "export-gallery"), JSON.stringify(runner.controls));
    const ring = await frame.evaluate(() => {
      const row = document.querySelector("[data-lane-row='export-gallery']");
      return { state: row?.dataset.state, steps: row?.dataset.stepsDone, merge: document.querySelector("[data-merge-line='export-gallery']")?.dataset.status, plan: document.querySelector("[data-meter='plan']")?.textContent.replace(/\s+/g, " ").trim() };
    });
    check("the ring fills from the stream: 8/8, done", ring.state === "done" && ring.steps === "8", JSON.stringify(ring));
    check("merge and spend lines come from the stream too", ring.merge === "checked" && /41% of your 5-hour limit/.test(ring.plan ?? ""), JSON.stringify(ring));

    // A lane's site call: helper → dock frame → Builder → back.
    const ticket = tickets.issue("export-gallery");
    const applied = await call(port, "POST", "/site", { ticket, body: { source: "polio-dock", kind: "site", v: 1, id: "x", op: "apply", site: "sol", name: "calmer hero", steps: [{ op: "setLook", patch: {} }] } });
    check("a site call reaches the Builder through the paired frame and comes back", applied.status === 200 && applied.json?.ok === true && applied.json.result?.applied === "calmer hero", applied.text);
    const builderSaw = await page.evaluate(() => window.asked.map((a) => ({ op: a.op, source: a.source, token: JSON.stringify(a).includes("Bearer") })));
    check("the Builder got exactly one call, as the dock, with no token", builderSaw.length === 1 && builderSaw[0].source === "polio-dock" && !builderSaw[0].token, JSON.stringify(builderSaw));

    // A page script can't answer for the Builder: a reply from the wrong window is dropped.
    const before = await frame.evaluate(() => window.__dock.siteLog.length);
    const pendingCall = call(port, "POST", "/site", { ticket, body: { source: "polio-dock", kind: "site", v: 1, id: "y", op: "read" } });
    await page.evaluate(() => { window.asked.length = 0; });
    const injected = await frame.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 300));
      const w = window.__dock.siteLog.at(-1);
      // The frame posting to itself has its own origin, not the Builder's: it must be ignored.
      window.postMessage({ source: "polio-builder", kind: "site", v: 1, id: w.id, ok: false, says: "spoofed" }, "*");
      await new Promise((r) => setTimeout(r, 100));
      return { n: window.__dock.siteLog.length, ok: w.ok };
    });
    const real = await pendingCall;
    check("a reply not from the Builder parent is ignored; the real one wins", injected.n === before + 1 && real.json?.ok === true, JSON.stringify({ injected, real: real.json }));

    // Reload keeps the pairing.
    await frame.goto(`${HELPER}/dock/`);
    const again = await frame.waitForSelector("body[data-helper-state='live']", { timeout: 5000 }).then(() => true).catch(() => false);
    check("a reload of the dock stays paired (no new code)", again && shown.length === 1);
    const snap = await frame.evaluate(() => document.querySelector("[data-lane-row='export-gallery']")?.dataset.state);
    check("after a reload the snapshot redraws the lanes", snap === "done", String(snap));

    // Unpair: the token goes and the dock asks again.
    const token = await frame.evaluate(() => localStorage.getItem("polio-helper-token"));
    await call(port, "POST", "/unpair", { origin: HELPER, token });
    const asked = await frame.waitForSelector("body[data-helper-state='pair']", { timeout: 6000 }).then(() => true).catch(() => false);
    check("after Unpair the dock asks to pair again and forgets the token", asked && (await frame.evaluate(() => localStorage.getItem("polio-helper-token"))) === null);

    // ?fake=1 still plays the fake runner, and never touches the helper.
    const fakePage = await ctx.newPage();
    const hits = [];
    fakePage.on("request", (r) => { if (/\/(stream|request|control|pair)/.test(r.url())) hits.push(r.url()); });
    await fakePage.goto(`${HELPER}/dock/?fake=1&delay=0`);
    await fakePage.waitForSelector("body[data-dock-ready]");
    const fk = await fakePage.evaluate(() => ({ live: window.__dock.live, rows: document.querySelectorAll("[data-lane-row]").length, said: document.querySelector("[data-helper]").textContent }));
    check("?fake=1 plays the fake runner and never calls the helper", fk.live === false && fk.rows > 0 && hits.length === 0, JSON.stringify({ fk, hits }));

    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await browser.close();
    await helper.close();
  }
}

done();

#!/usr/bin/env node
/**
 * THE DECISIONS PANEL (J, 2026-11-03): the coordinator's questions in the
 * Agents dock, above the rings, answered by a press beside what they are
 * about, written back into handovers/lanes.json through the helper's one
 * write route.
 *
 *   1. pure: the questions read in order, open ones counted, a picture that
 *      climbs out of handovers/ dropped, the chats a question is about;
 *   2. the helper: pictures served read-only (an html one sandboxed), nothing
 *      else under handovers/ and nothing outside it; POST /lanes/answer sets
 *      answer and answeredAt of that question and nothing else, keeping the
 *      file's indent and line ends, from the Builder's origin only;
 *   3. in the Builder, on the fixture: the open questions listed in order with
 *      their pictures (an image, an html page live in a sandboxed frame), the
 *      answered one folded with "change", the orbs marked; a press goes to the
 *      helper and the file holds it, the orb pulses; "Or type" sends words;
 *      Esc does nothing; with the helper down a press is refused with the
 *      message, and a reload still shows the last questions read.
 *   4. round 2: a Details button opens a strip with the chat, its state and
 *      when it was last heard from. Of the chat's history only the lines
 *      the coordinator marked `public: true` reach the page (J, 2026-11-08);
 *      an unmarked line never does. With none marked the strip says
 *      "No shared timeline yet". The timeline checks see the
 *      newest change, "Earlier" going back step by step to the chat's start
 *      and "Collapse" folding it. The area picture is drawn where a question has one, and none where it
 *      hasn't; "New options, because:" goes to POST /lanes/ask, which writes
 *      ask and askedAt only, from the Builder's origin only.
 *
 *   LANES_FILE=tests/fixtures/lanes.json LANES_BEATS=tests/fixtures/no-beats npx next start -p 3421
 *   node tests/decisions-panel.mjs http://127.0.0.1:3421
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3421").replace(/\/$/, "");
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const FIXTURE_FILE = new URL("./fixtures/lanes.json", import.meta.url);
const FIXTURE = JSON.parse(readFileSync(FIXTURE_FILE, "utf8"));
const em = FIXTURE.coordinators[2].chats[0], imp = FIXTURE.coordinators[2].chats[1];

/* A handovers folder of our own: the fixture's lanes.json written with a one-space indent and Windows line ends, its pictures, and a file just outside it. */
const root = mkdtempSync(join(tmpdir(), "decisions-"));
const handovers = join(root, "handovers");
mkdirSync(join(handovers, "decisions"), { recursive: true });
const LANES = join(handovers, "lanes.json");
const writeLanes = () => writeFileSync(LANES, JSON.stringify(FIXTURE, null, 1).replace(/\n/g, "\r\n") + "\r\n");
writeLanes();
copyFileSync(new URL("./fixtures/decisions/a.png", import.meta.url), join(handovers, "decisions", "a.png"));
copyFileSync(new URL("./fixtures/decisions/b.html", import.meta.url), join(handovers, "decisions", "b.html"));
writeFileSync(join(handovers, "decisions", ".hidden.png"), "x");
writeFileSync(join(handovers, "notes.md"), "a note");
mkdirSync(join(handovers, "probes"));
writeFileSync(join(handovers, "probes", "probe.mjs"), "export const x = 1;");
writeFileSync(join(root, "outside.png"), "outside");
const lanesNow = () => JSON.parse(readFileSync(LANES, "utf8"));
const question = (f, id) => f.decisions.find((d) => d.id === id);
/** Everything but the answers: what a press must never touch. */
const rest = (f) => JSON.stringify({ ...f, decisions: f.decisions.map(({ answer, answeredAt, ...d }) => d) });
/** Everything but the asks: what an ask for new options must never touch. */
const restAsk = (f) => JSON.stringify({ ...f, decisions: f.decisions.map(({ ask, askedAt, ...d }) => d) });
/** Export motion's steps as the panel shows them: only the public ones, newest first. */
const emSteps = em.history.filter((h) => h.public === true && h.text.trim()).map((h) => h.text).reverse();
/** Every non-blank step as written, newest first (what the client reads from a raw feed). */
const emAll = em.history.filter((h) => h.text.trim()).map((h) => h.text).reverse();
/** The lines the coordinator did not mark: not a word of them may reach the page. */
const emHidden = em.history.filter((h) => h.public !== true && h.text.trim()).map((h) => h.text.trim());

/* 1. Pure. */
let L = null;
try { L = await import("../src/features/agents/lanes.ts"); } catch (e) { check("the pure module loads", false, String(e?.message ?? e).slice(0, 120)); }
if (L) {
  const feed = L.readFeed(FIXTURE);
  check("the questions are read in their order, answered ones kept", feed?.questions?.map((d) => d.id).join() === "tidy-scale,popup-design,merge-order", feed?.questions?.map((d) => d.id).join());
  check("…and the open ones are what wait on J", feed?.decisions === 2 && L.isOpen(feed.questions[1]) && !L.isOpen(feed.questions[0]));
  check("a count alone (the feed as it began) still counts", L.readFeed({ coordinators: [], decisions: 4 }).decisions === 4 && L.readFeed({ coordinators: [], decisions: 4 }).questions.length === 0);
  const pd = feed?.questions?.[1];
  check("options keep their key, words, picture and the writer's pick", pd?.options.length === 3 && pd.options[0].picture === "decisions/a.png" && pd.options[0].pick === true && pd.options[1].pick === false);
  check("a picture that climbs out of handovers/ is dropped", pd?.options[2].picture === "");
  check("a picture is an image or an html page under handovers/, nothing else", L.pictureKind("open/x/a.png") === "image" && L.pictureKind("open/x/a.html") === "page" && [
    "../a.png", "/etc/a.png", "a/../../b.png", "C:/x/a.png", "https://evil.test/a.png", "a\\b.png", ".hidden/a.png", "lanes.json", "notes.md", "a/./b.png", "a//b.png",
  ].every((p) => L.pictureKind(p) === null));
  check("a question finds its chats by lane, name or id, however written", L.chatsAbout(feed, "export-motion")[0]?.id === em.id && L.chatsAbout(feed, "Import checkup")[0]?.id === imp.id && L.chatsAbout(feed, em.id)[0]?.id === em.id && L.chatsAbout(feed, "").length === 0);
  check("a question with no id, no words or a nameless option is left out, not guessed", L.readDecisions([{ question: "x" }, { id: "y" }, { id: "z", question: "q", options: [{ label: "no key" }] }]).map((d) => `${d.id}:${d.options.length}`).join() === "z:0");
  check("last heard from, in words", L.agoOf("2026-11-03T09:00:00Z", Date.parse("2026-11-03T09:04:30Z")) === "4 min ago" && L.agoOf("", 0) === "" && L.agoOf(null, 0) === "");
  const emRead = feed?.coordinators?.[2]?.chats?.[0];
  check("a chat's history is read oldest first, a step without words left out", emRead?.history?.length === 4 && emRead.history.map((h) => h.text).reverse().join("|") === emAll.join("|") && L.readHistory("x").length === 0 && L.readHistory([{ at: 0, text: "a" }])[0]?.at === "1970-01-01T00:00:00.000Z", String(emRead?.history?.length));
  check("a question's area is a picture under handovers/, one that climbs out is dropped", feed?.questions?.[2]?.area === "decisions/a.png" && feed.questions[1].area === "" && L.readDecisions([{ id: "x", question: "q", area: "../a.png" }])[0]?.area === "");
  check("…and J's ask is read with it", L.readDecisions([{ id: "x", question: "q", ask: "cheaper", askedAt: "2026-11-03T10:00:00Z" }])[0]?.ask === "cheaper" && feed.questions[1].ask === "");
  check("a step's time is short, in J's own time", L.whenOf("2026-11-03T09:00:00.000Z").length > 0 && L.whenOf("2026-11-03T09:00:00.000Z").length < 24 && L.whenOf("") === "");
}

/* 2. The helper. */
const runner = { subscribe: () => () => {}, snapshot: () => [], submit: async () => ({}), control: async () => ({ ok: true }) };
let Sv = null, helper = null, Pairing = null;
const call = (port, path, { origin = null, method = "GET", body = null } = {}) => new Promise((resolve, reject) => {
  const headers = { ...(origin ? { origin } : {}), ...(body !== null ? { "content-type": "application/json" } : {}) };
  const req = request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
    const parts = []; res.on("data", (c) => parts.push(c));
    res.on("end", () => { const buf = Buffer.concat(parts); let json = null; try { json = JSON.parse(buf.toString("utf8")); } catch {} resolve({ status: res.statusCode, headers: res.headers, buf, json }); });
  });
  req.on("error", reject); if (body !== null) req.write(typeof body === "string" ? body : JSON.stringify(body)); req.end();
});
try {
  Sv = await import("../helper/server/server.ts");
  ({ Pairing } = await import("../helper/server/pairing.ts"));
  helper = await Sv.startHelperServer({ runner, pairing: new Pairing({ show() {} }), port: 0, lanes: { file: LANES, beats: join(root, "beats") } });
  const P = helper.port, B = Sv.BUILDER_ORIGIN;
  const png = await call(P, "/lanes/file/decisions/a.png");
  check("a picture loads with no Origin, as an <img> asks for it", png.status === 200 && png.headers["content-type"] === "image/png" && png.buf.equals(readFileSync(join(handovers, "decisions", "a.png"))), String(png.status));
  const page = await call(P, "/lanes/file/decisions/b.html");
  check("an html picture is always sandboxed, and only the Builder may frame it", page.status === 200 && /sandbox allow-scripts/.test(page.headers["content-security-policy"] ?? "") && !/allow-same-origin/.test(page.headers["content-security-policy"] ?? "") && (page.headers["content-security-policy"] ?? "").includes(`frame-ancestors ${B}`), page.headers["content-security-policy"]);
  const refused = await Promise.all(["/lanes/file/lanes.json", "/lanes/file/notes.md", "/lanes/file/probes/probe.mjs", "/lanes/file/decisions/.hidden.png", "/lanes/file/..%2Foutside.png", "/lanes/file/decisions/..%2F..%2Foutside.png", "/lanes/file/%2E%2E/outside.png", "/lanes/file/decisions/nope.png", "/lanes/file/decisions%5C..%5C..%5Coutside.png", "/lanes/file/C:/Windows/win.ini", "/lanes/file/C%3A%2FUsers%2Fa.png", "/lanes/file/decisions/C:a.png"].map((p) => call(P, p)));
  /* A climb is refused either way: as no such picture, or (once the URL has folded it away) as outside /lanes/file altogether. */
  check("nothing else under handovers/ and nothing outside it: lanes.json, notes, scripts, hidden files, dot-dot, backslashes, drive letters", refused.every((r) => r.status === 404 || r.status === 403) && refused.every((r) => !r.buf.toString().includes("outside")), refused.map((r) => r.status).join());
  check("another origin can't load a picture", (await call(P, "/lanes/file/decisions/a.png", { origin: "https://evil.test" })).status === 403);
  check("nor write a picture", (await call(P, "/lanes/file/decisions/a.png", { origin: B, method: "POST", body: {} })).status === 403);

  const pre = await call(P, "/lanes/answer", { origin: B, method: "OPTIONS" });
  check("the Builder may ask to send an answer (CORS for it alone)", pre.status === 204 && pre.headers["access-control-allow-origin"] === B && /POST/.test(pre.headers["access-control-allow-methods"] ?? "") && /content-type/.test(pre.headers["access-control-allow-headers"] ?? ""));
  const before = lanesNow();
  const ok = await call(P, "/lanes/answer", { origin: B, method: "POST", body: { id: "popup-design", answer: " a ", state: "done", note: "changed" } });
  const after = lanesNow();
  check("a press from the Builder writes the answer and when", ok.status === 200 && ok.json?.ok === true && question(after, "popup-design").answer === "a" && Math.abs(Date.parse(question(after, "popup-design").answeredAt) - Date.now()) < 10_000, JSON.stringify(ok.json));
  check("…and nothing else in the file, whatever else it was sent", rest(after) === rest(before) && question(after, "merge-order").answer === "" && question(after, "tidy-scale").answer === "b");
  const text = readFileSync(LANES, "utf8");
  check("…keeping the file's indent and line ends", /^\{\r\n "/.test(text) && !/[^\r]\n/.test(text) && text.endsWith("}\r\n"));
  const bad = await Promise.all([
    call(P, "/lanes/answer", { origin: B, method: "POST", body: { id: "nope", answer: "a" } }),
    call(P, "/lanes/answer", { origin: B, method: "POST", body: { id: "merge-order", answer: "   " } }),
    call(P, "/lanes/answer", { origin: B, method: "POST", body: { id: "merge-order", answer: "x".repeat(2001) } }),
    call(P, "/lanes/answer", { origin: B, method: "POST", body: { id: "merge-order" } }),
    call(P, "/lanes/answer", { origin: B, method: "POST", body: "{not json" }),
  ]);
  check("no such question, an empty or too long answer, or not JSON: refused, said why", bad.map((r) => r.status).join() === "404,400,400,400,400" && bad.every((r) => typeof r.json?.error === "string" && r.headers["access-control-allow-origin"] === B), bad.map((r) => r.status).join());
  const strangers = await Promise.all([
    call(P, "/lanes/answer", { origin: "https://evil.test", method: "POST", body: { id: "merge-order", answer: "a" } }),
    call(P, "/lanes/answer", { method: "POST", body: { id: "merge-order", answer: "a" } }),
    call(P, "/lanes/answer", { origin: `http://127.0.0.1:${P}`, method: "POST", body: { id: "merge-order", answer: "a" } }),
  ]);
  check("another origin, no origin, even the dock without its token: refused", strangers.map((r) => r.status).join() === "403,403,401", strangers.map((r) => r.status).join());
  check("…and the file holds only the one answer", question(lanesNow(), "merge-order").answer === "" && rest(lanesNow()) === rest(before));
  /* Round 2: an ask for new options. */
  const preAsk = await call(P, "/lanes/ask", { origin: B, method: "OPTIONS" });
  check("the Builder may ask to send an ask for new options (CORS for it alone)", preAsk.status === 204 && preAsk.headers["access-control-allow-origin"] === B && /POST/.test(preAsk.headers["access-control-allow-methods"] ?? ""));
  const beforeAsk = lanesNow();
  const asked = await call(P, "/lanes/ask", { origin: B, method: "POST", body: { id: "merge-order", ask: " cheaper ones ", answer: "a", answeredAt: "x", note: "changed" } });
  const afterAsk = lanesNow();
  check("an ask from the Builder writes the words and when", asked.status === 200 && asked.json?.ok === true && question(afterAsk, "merge-order").ask === "cheaper ones" && Math.abs(Date.parse(question(afterAsk, "merge-order").askedAt) - Date.now()) < 10_000, JSON.stringify(asked.json));
  check("…and nothing else: the answer is left as it was", restAsk(afterAsk) === restAsk(beforeAsk) && question(afterAsk, "merge-order").answer === "" && question(afterAsk, "popup-design").answer === "a");
  const badAsk = await Promise.all([
    call(P, "/lanes/ask", { origin: "https://evil.test", method: "POST", body: { id: "merge-order", ask: "x" } }),
    call(P, "/lanes/ask", { method: "POST", body: { id: "merge-order", ask: "x" } }),
    call(P, "/lanes/ask", { origin: B, method: "POST", body: { id: "nope", ask: "x" } }),
    call(P, "/lanes/ask", { origin: B, method: "POST", body: { id: "merge-order", ask: "  " } }),
  ]);
  check("an ask from another origin or none is refused, as is one to no question or with no words", badAsk.map((r) => r.status).join() === "403,403,404,400" && question(lanesNow(), "merge-order").ask === "cheaper ones", badAsk.map((r) => r.status).join());
  check("the Builder still can't write the feed itself or reach a control", (await call(P, "/lanes", { origin: B, method: "POST", body: {} })).status === 403 && (await call(P, "/control", { origin: B, method: "POST", body: { by: "j" } })).status === 403);
  await helper.close();
  const bare = await Sv.startHelperServer({ runner, pairing: new Pairing({ show() {} }), port: 0 });
  check("a helper with no lanes file says so to an answer or an ask, and has no pictures", (await call(bare.port, "/lanes/answer", { origin: B, method: "POST", body: { id: "x", answer: "a" } })).status === 404 && (await call(bare.port, "/lanes/ask", { origin: B, method: "POST", body: { id: "x", ask: "a" } })).status === 404 && (await call(bare.port, "/lanes/file/decisions/a.png")).status === 404);
  await bare.close();
} catch (e) { check("the helper", false, String(e?.stack ?? e).slice(0, 300)); }

/* 3. The route serves the fixture's pictures where the Builder runs on this PC. */
const routed = await fetch(`${BASE}/api/lanes/file/decisions/a.png`).catch(() => null);
const routedPage = await fetch(`${BASE}/api/lanes/file/decisions/b.html`).catch(() => null);
const routedNo = await Promise.all(["lanes.json", "..%2F..%2Fpackage.json", "decisions/nope.png"].map((p) => fetch(`${BASE}/api/lanes/file/${p}`).then((r) => r.status).catch(() => 0)));
check("/api/lanes/file serves a picture beside the lanes file, an html one sandboxed, nothing else", routed?.status === 200 && routed.headers.get("content-type") === "image/png" && /sandbox allow-scripts/.test(routedPage?.headers.get("content-security-policy") ?? "") && routedNo.every((s) => s === 404), `${routed?.status} ${routedNo.join()}`);

/* 4. In the Builder: the real helper server, on a port of its own, stands in for the one at 47821. */
writeLanes();
let live = null;
try { live = await Sv.startHelperServer({ runner, pairing: new Pairing({ show() {} }), port: 0, builderOrigin: new URL(BASE).origin, lanes: { file: LANES, beats: join(root, "beats") } }); } catch (e) { check("a stand-in helper starts", false, String(e?.message ?? e)); }
const posts = [], asks = [];
/* The feed as the helper serves it: names, states, the public lines of each history and the questions, never a note or an unmarked line. */
const { namesOnly, publicHistory } = await import("../helper/server/lanes.ts");
const served = () => namesOnly(lanesNow());
{
  const chats = served().coordinators.flatMap((c) => c.chats);
  const text = JSON.stringify(served());
  const emServed = chats.find((x) => x.id === em.id);
  check("the helper serves only the lines marked public, each as its time and words and nothing else", emHidden.length === 2 && emSteps.length === 2 && emServed?.history?.length === 2 && emServed.history.every((h) => Object.keys(h).sort().join() === "at,text") && emServed.history.map((h) => h.text).reverse().join("|") === emSteps.join("|"), JSON.stringify(emServed?.history));
  check("…an unmarked line, a note or a last line never leaves the PC", !emHidden.some((t) => text.includes(t)) && !text.includes(em.note) && !text.includes(em.last) && (chats.find((x) => x.id === imp.id)?.history?.length ?? -1) === 0, text.slice(0, 200));
  check("publicHistory takes `public: true` only, never a truthy stand-in, and drops everything but time and words", publicHistory([{ at: "a", text: "x", public: true, note: "n" }, { at: "b", text: "y", public: "yes" }, { at: "c", text: "z", public: 1 }, { at: "d", text: "w" }, null, "s"]).map((h) => JSON.stringify(h)).join() === '{"at":"a","text":"x"}' && publicHistory("x").length === 0);
}
/** Forward the page's call to the stand-in, as the page sent it, and hand its answer back. */
async function forward(route) {
  const r = route.request(), u = new URL(r.url());
  if (u.pathname === "/lanes/answer" || u.pathname === "/lanes/ask" || u.pathname.startsWith("/lanes/file/")) {
    if (r.method() === "POST") (u.pathname === "/lanes/ask" ? asks : posts).push(r.postData());
    const res = await call(live.port, u.pathname + u.search, { origin: r.headers()["origin"] ?? null, method: r.method(), body: r.method() === "POST" ? r.postData() ?? "" : null });
    const headers = Object.fromEntries(Object.entries(res.headers).filter(([k]) => !["connection", "transfer-encoding", "keep-alive", "date"].includes(k)));
    return route.fulfill({ status: res.status, headers, body: res.buf });
  }
  return route.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!doctype html><title>dock stub</title><body>dock" });
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
/* The feed is our handovers folder's, so an answer written there comes back on the next read. */
await ctx.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: served(), beats: [], now: Date.now() }) }));
await ctx.route(`${HELPER}/**`, forward);
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-agents-button]", { timeout: 30000 }).catch(() => {});
await page.locator("[data-agents-button]").click().catch(() => {});
await page.waitForSelector("[data-decision]", { timeout: 15000 }).catch(() => {});

const panel = () => page.evaluate(() => ({
  open: [...document.querySelectorAll("article[data-decision]")].map((e) => e.getAttribute("data-decision")),
  answered: [...document.querySelectorAll("[data-answered]")].map((e) => `${e.getAttribute("data-decision")}=${e.getAttribute("data-answered")}`),
  count: document.querySelector("[data-decisions-count]")?.textContent ?? null,
  asks: Object.fromEntries([...document.querySelectorAll("[data-lanes-asks]")].map((e) => [e.getAttribute("data-lanes-orb"), e.getAttribute("data-lanes-asks")])),
  dock: Math.round(document.querySelector("[data-agents-dock]")?.getBoundingClientRect().width ?? 0),
  order: [...document.querySelectorAll("[data-decisions],[data-lanes-atom],[data-lanes-menu],[data-lanes-notes]")].map((e) => [...e.attributes].find((a) => a.name.startsWith("data-"))?.name),
}));
let s = await panel();
check("the Agents button opens a column down the right: questions, the rings, then the notes", s.dock === 460 && s.order.join() === "data-decisions,data-lanes-atom,data-lanes-menu,data-lanes-notes", `${s.dock} ${s.order.join()}`);
check("the open questions are listed, in order", s.open.join() === "popup-design,merge-order" && s.count === "2 decisions wait on you", `${s.open.join()} / ${s.count}`);
check("the answered one is folded to a line with its answer and change", s.answered.join() === "tidy-scale=b" && /B · Six/.test(await page.locator('[data-decision="tidy-scale"]').textContent()) && (await page.locator('[data-decision-change="tidy-scale"]').count()) === 1);
check("the chats a question is about are marked on their orbs", s.asks[em.id] === "1" && s.asks[imp.id] === "1" && Object.keys(s.asks).length === 2, JSON.stringify(s.asks));

const img = page.locator('[data-decision="popup-design"] img[data-decision-picture="a"]');
await img.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForFunction(() => { const i = document.querySelector('img[data-decision-picture="a"]'); return i?.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
check("a pictured option draws its picture", await img.evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false));
const frameEl = page.locator('[data-decision="popup-design"] iframe[data-decision-picture="b"]');
await frameEl.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(800);
const frame = page.frames().find((f) => f.url().endsWith("/decisions/b.html"));
const inside = frame ? await frame.evaluate(() => ({ live: document.body.dataset.live, parent: document.body.dataset.parent })).catch((e) => ({ e: String(e) })) : null;
check("an html option is shown live in a frame: its script runs", inside?.live === "yes", JSON.stringify(inside));
check("…sandboxed (scripts only: no same origin, no top navigation): it can't reach the Builder's page", inside?.parent === "blocked" && (await frameEl.getAttribute("sandbox")) === "allow-scripts");
check("the option whose picture climbed out shows none, and the writer's pick is marked", /no picture/.test(await page.locator('[data-decision="popup-design"] [data-decision-option="c"]').textContent()) && (await page.locator('[data-decision="popup-design"] [data-decision-option="a"] [data-decision-pick]').count()) === 1);

/* Beside the orb: a question under the pointer lights the chat it is about. */
await page.locator('[data-decision="popup-design"] h3').hover();
await page.waitForTimeout(150);
const lit = await page.evaluate((id) => Number(document.querySelector(`[data-lanes-orb="${id}"]`)?.dataset.scale), em.id);
check("a question under the pointer lights its chat's orb", lit === 1.3, String(lit));

/* Round 2: Details. */
const strip = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-decision-strip="${id}"]`);
  return el ? { chat: el.querySelector("[data-decision-chat]")?.getAttribute("data-decision-chat"), steps: [...el.querySelectorAll("[data-decision-step]")].map((li) => li.lastElementChild?.textContent), earlier: !!el.querySelector("[data-decision-earlier]"), collapse: !!el.querySelector("[data-decision-collapse]"), area: !!el.querySelector("[data-decision-area]"), text: el.textContent } : null;
}, id);
check("each open question has a Details button, and no strip shows until it is pressed", (await page.locator("[data-decision-details]").count()) === 2 && (await page.locator("[data-decision-strip]").count()) === 0);
await page.locator('[data-decision-details="popup-design"]').click().catch(() => {});
let st = await strip("popup-design");
check("Details opens a strip with the chat the question belongs to, its state and when it was last heard from", st?.chat === em.id && /Export motion/.test(st.text) && /needs you/.test(st.text) && /ago|just now/.test(st.text) && (await page.locator('[data-decision-details="popup-design"]').getAttribute("aria-expanded")) === "true", JSON.stringify(st));
check("…and its newest public change, none of the unmarked lines' words", st?.steps.length === 1 && st.steps[0] === emSteps[0] && !emHidden.some((t) => st.text.includes(t)), JSON.stringify(st?.steps));
{
  const seen = [];
  for (let i = 0; i < 6 && st?.earlier; i++) { await page.locator('[data-decision-earlier="popup-design"]').click().catch(() => {}); st = await strip("popup-design"); seen.push(st.steps.length); }
  check("Earlier reveals one more public step a press, in order, back to the chat's start", seen.join() === "2" && st.steps.join("|") === emSteps.join("|") && !st.earlier && /the chat's start/.test(st.text), `${seen.join()} ${st?.steps.join("|")}`);
  /* A picture of the strip with its two public lines, for whoever asks (STRIP_SHOT); otherwise it goes to the temp folder. */
  await page.screenshot({ path: process.env.STRIP_SHOT || join(root, "strip.png"), clip: { x: 1440 - 480, y: 0, width: 480, height: 900 } }).catch(() => {});
  await page.locator('[data-decision-collapse="popup-design"]').click().catch(() => {});
  st = await strip("popup-design");
  check("Collapse folds it back to the newest", st?.steps.length === 1 && st.steps[0] === emSteps[0] && !st.collapse);
}
check("a question with no area picture shows no picture box", st?.area === false);
await page.locator('[data-decision-details="merge-order"]').click().catch(() => {});
const area = page.locator('[data-decision-area="merge-order"] img[data-decision-area-picture]');
await area.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForFunction(() => { const i = document.querySelector('[data-decision-area="merge-order"] img'); return i?.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
check("a question with an area picture draws it, captioned with its chat", await area.evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false) && /Import checkup/.test((await page.locator('[data-decision-area="merge-order"] figcaption').textContent().catch(() => "")) ?? ""));
check("…and with none of its lines marked public, no step and \"No shared timeline yet\"", (await strip("merge-order"))?.steps.length === 0 && !(await strip("merge-order")).earlier && (await page.locator('[data-decision-timeline-empty="merge-order"]').textContent().catch(() => "")) === "No shared timeline yet" && !(await strip("merge-order")).text.includes(imp.history[0].text));
await page.locator('[data-decision-ask="merge-order"]').fill("Cheaper ones, please").catch(() => {});
await page.locator('[data-decision-ask-send="merge-order"]').click().catch(() => {});
await page.waitForSelector('[data-decision-asked="merge-order"]', { timeout: 5000 }).catch(() => {});
check("New options, because: sends {id, ask} to the helper", asks.length === 1 && asks[0] === JSON.stringify({ id: "merge-order", ask: "Cheaper ones, please" }), asks.join(" | "));
check("…the file holds the ask and its time, the answer untouched", question(lanesNow(), "merge-order").ask === "Cheaper ones, please" && !!question(lanesNow(), "merge-order").askedAt && question(lanesNow(), "merge-order").answer === "");
check("…and the question says it asked for new options", /Asked for new options/.test((await page.locator('[data-decision-asked="merge-order"]').textContent().catch(() => "")) ?? ""));
await page.locator('[data-decision-details="popup-design"]').click().catch(() => {});
check("the same button closes the strip; the other stays open", (await strip("popup-design")) === null && (await strip("merge-order")) !== null);

/* A press. */
await page.locator('[data-decision="popup-design"] [data-decision-press="a"]').click();
await page.waitForSelector('[data-answered][data-decision="popup-design"]', { timeout: 5000 }).catch(() => {});
const pulse = await page.waitForFunction((id) => document.querySelector(`[data-lanes-orb="${id}"]`)?.hasAttribute("data-lanes-pulse"), em.id, { timeout: 2000 }).then(() => true).catch(() => false);
let f = lanesNow();
check("a press sends {id, answer} to the helper", posts.length === 1 && posts[0] === JSON.stringify({ id: "popup-design", answer: "a" }), posts.join(" | "));
check("…and the file holds it", question(f, "popup-design").answer === "a" && !!question(f, "popup-design").answeredAt && question(f, "merge-order").answer === "");
check("…the question folds to answered", (await panel()).answered.includes("popup-design=a"));
check("…and the orb of the chat it is about pulses once", pulse);
await page.waitForTimeout(1500);
check("…once", !(await page.evaluate((id) => document.querySelector(`[data-lanes-orb="${id}"]`)?.hasAttribute("data-lanes-pulse"), em.id)));

/* Change it, by words. */
await page.locator('[data-decision-change="popup-design"]').click();
await page.locator('[data-decision-type="popup-design"]').fill("A tag, but smaller");
await page.locator('[data-decision-send="popup-design"]').click();
await page.waitForSelector('[data-answered="A tag, but smaller"]', { timeout: 5000 }).catch(() => {});
check("change opens it again, and Or type sends the words", question(lanesNow(), "popup-design").answer === "A tag, but smaller" && posts.length === 2);

/* Nothing is modal. */
await page.keyboard.press("Escape");
await page.mouse.click(200, 500);
await page.waitForTimeout(300);
check("Esc and a click away change nothing", (await page.locator("[data-decisions]").count()) === 1 && (await page.locator("article[data-decision]").count()) === 1 && posts.length === 2);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-agents-button]", { timeout: 30000 }).catch(() => {});
await page.locator("[data-agents-button]").click().catch(() => {});
await page.waitForSelector("[data-answered]", { timeout: 10000 }).catch(() => {});
s = await panel();
check("after a reload the answers come back from the file", s.answered.includes("popup-design=A tag, but smaller") && s.open.join() === "merge-order" && s.count === "1 decision waits on you", JSON.stringify(s));
await ctx.close();

/* The helper down: the questions still show, and a press says why it can't go. */
writeLanes();
const before = readFileSync(LANES, "utf8");
const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let feedUp = true;
await c2.route("**/api/lanes", (r) => (feedUp ? r.fallback() : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: null, beats: [], now: Date.now() }) })));
await c2.route(`${HELPER}/**`, (r) => r.abort("connectionrefused"));
const p2 = await c2.newPage();
p2.on("pageerror", (e) => errors.push(e.message));
await p2.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await p2.waitForSelector("[data-agents-button]", { timeout: 30000 }).catch(() => {});
await p2.locator("[data-agents-button]").click().catch(() => {});
await p2.waitForSelector("article[data-decision]", { timeout: 15000 }).catch(() => {});
await p2.waitForSelector("[data-decisions-offline]", { timeout: 6000 }).catch(() => {});
check("with the helper down the panel says presses can't be sent until it runs", /can't be sent until it runs/.test((await p2.locator("[data-decisions-offline]").textContent().catch(() => "")) ?? ""));
await p2.locator('[data-decision="merge-order"] [data-decision-press="a"]').click().catch(() => {});
await p2.waitForSelector('[data-decision-said="merge-order"]', { timeout: 8000 }).catch(() => {});
const said = (await p2.locator('[data-decision-said="merge-order"]').textContent().catch(() => "")) ?? "";
check("…a press is refused with the message", /^Not sent: .*helper/.test(said), said);
await p2.locator('[data-decision-details="merge-order"]').click().catch(() => {});
await p2.locator('[data-decision-ask="merge-order"]').fill("Other ones").catch(() => {});
await p2.locator('[data-decision-ask-send="merge-order"]').click().catch(() => {});
await p2.waitForSelector('[data-decision-ask-said="merge-order"]', { timeout: 8000 }).catch(() => {});
const askDown = (await p2.locator('[data-decision-ask-said="merge-order"]').textContent().catch(() => "")) ?? "";
check("…so is an ask for new options", /^Not sent: .*helper/.test(askDown) && (await p2.locator('[data-decision-asked="merge-order"]').count()) === 0, askDown);
check("…stays open, and the file is untouched", (await p2.locator('article[data-decision="merge-order"]').count()) === 1 && readFileSync(LANES, "utf8") === before);
feedUp = false;
await p2.reload({ waitUntil: "domcontentloaded" });
await p2.waitForSelector("[data-agents-button]", { timeout: 30000 }).catch(() => {});
await p2.locator("[data-agents-button]").click().catch(() => {});
await p2.waitForSelector("article[data-decision]", { timeout: 10000 }).catch(() => {});
check("with nothing to read, a reload still shows the last questions read", (await p2.locator("article[data-decision]").count()) === 2);
await c2.close();

await live?.close();
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);

#!/usr/bin/env node
/**
 * A PAGE THAT SAYS WHEN IT IS READY, AND ONE PAGE PER SCREEN.
 *
 * PonsStars' preview.html builds its 23 screens in hidden frames and sets
 * `data-preview="ready"` on its body when it is done. Captured at load it
 * came back as 54 parts: one screen's worth, no state screens, no chart
 * pictures. So the capturer waits for a page that marks itself as still
 * building (ready.mjs), leaves the lists of such a page whole (list-trim.js),
 * and takes a list of query-string pages, one Builder page each:
 * `/preview.html?still=1&screen=*` is every screen the page lists.
 *
 *   · the plan: a `*` page is one line until the run, its record keeps that
 *     line, a query page gets a plain path and name (`/preview-lobby`, Lobby);
 *   · the values of `screen` are read off the page once it is ready;
 *   · the whole page, captured: waited for, every screen in it, its charts
 *     as pictures;
 *   · `?screen=*`, captured: one Builder page per screen in the document.
 *
 * And fast (J, 2026-10-02: PonsStars' 23 screens took an hour, each screen
 * pressing about 20 controls and loading itself again for each): a still
 * screen or one of a screen list is read once, nothing pressed and no
 * behaviours driven, with the capture's default switches on; the pages run
 * three at a time; on PonsStars the list takes under 5 minutes, with the
 * same parts per screen as a capture that only looks. A control out of the
 * pointer's reach is not worth a page load each (reach.html): one at most.
 *
 * Its own server serves the folder: PonsStars' web/ when given, else a
 * small page built the same way (tests/fixtures/ready-page). No network.
 *
 *   node tests/capture-ready.mjs [path to the PonsStars web folder]
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A folder, if one is given; an address handed by the test runner is not one. */
const arg = process.argv.slice(2).find((a) => !/^https?:\/\//.test(a));
const given = arg ? resolve(arg) : null;
const folder = given ?? join(here, "fixtures", "ready-page");
const pst = !!given;
if (!existsSync(join(folder, "preview.html"))) { console.error(`No preview.html in ${folder}`); process.exit(2); }

const { plan, run, pageList, queryPage } = await import("../capture/site/capture/capture-site.mjs");
const { listValues, starOf } = await import("../capture/site/capture/ready.mjs");

/*
 * The folder, served as a static site, from a process of its own: the
 * capture runs its browsers synchronously (spawnSync), and a server in this
 * process would never answer them.
 */
const SERVE = `
const { createServer } = require("node:http"); const { readFileSync, existsSync, statSync } = require("node:fs"); const { join, extname } = require("node:path");
const folder = process.argv[1], spare = process.argv[2];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(folder, path === "/" ? "index.html" : path);
  if (!existsSync(file)) file = join(spare, path);
  if (!(file.startsWith(folder) || file.startsWith(spare)) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
server.listen(0, "127.0.0.1", () => console.log(server.address().port));`;
const server = spawn(process.execPath, ["-e", SERVE, folder, join(here, "fixtures", "ready-page")], { stdio: ["ignore", "pipe", "inherit"] });
const port = await new Promise((ok) => server.stdout.once("data", (d) => ok(Number(String(d).trim()))));
const origin = `http://127.0.0.1:${port}`;
const root = mkdtempSync(join(tmpdir(), "capture-ready-"));
const quiet = { behaviours: false, states: false, network: false, agree: false };

try {
  /* The plan, with no browser. */
  const star = "/preview.html?still=1&screen=*";
  const p0 = plan({ url: origin, name: "ready", pages: `${star}, /gallery.html`, root, ...quiet });
  check("a ?screen=* page is one line until the run", p0.routes.pages.length === 2 && p0.routes.pages[0].star?.field === "screen" && p0.routes.pages[0].star?.base === "/preview.html?still=1");
  check("its record keeps the line as asked, so capturing again asks the same", JSON.stringify(p0.record.pages) === JSON.stringify([star, "/gallery.html"]));
  const q = pageList("/preview.html?still=1&screen=leaderboard-empty")[0];
  check("a query page is asked for at its address, kept at a plain path, named for its telling value", q.route === "/preview.html?still=1&screen=leaderboard-empty" && q.path === "/preview-leaderboard-empty" && q.name === "Leaderboard empty" && q.id === "page_preview_leaderboard_empty", JSON.stringify(q));
  check("a plain page is named without its .html", pageList("/gallery.html")[0].name === "Gallery");
  check("starOf finds the field and the address to read it from", JSON.stringify(starOf("/p.html?a=1&screen=*")) === JSON.stringify({ field: "screen", base: "/p.html?a=1" }) && starOf("/p.html?screen=x") === null && queryPage("/p") === null);

  /* The screens, read off the page once it says it is ready. */
  const listed = await listValues(`${origin}/preview.html?still=1`, "screen");
  const want = pst ? 23 : 12;
  check(`every screen is read off the page once it is ready (${want})`, listed.values.length === want && (!listed.waited || listed.waited.done), `${listed.values.length}: ${listed.values.join(", ")}; ${listed.waited ? `waited ${listed.waited.secs} s` : "ready as it loaded"}`);

  /* The whole page, captured. */
  const whole = plan({ url: origin, name: "whole", pages: "/preview.html", root, ...quiet });
  run(whole);
  const cap = JSON.parse(readFileSync(join(whole.captureDir, "routes", `${whole.captures[0].id}.json`), "utf8"));
  const text = JSON.stringify(cap.tree);
  check("the capture waited for the page to say it is ready", !/Building/.test(text) && (pst ? /23 screens/.test(text) : /Done\./.test(text)));
  const doc = JSON.parse(readFileSync(join(whole.outDir, "site", "document.json"), "utf8"));
  const parts = (doc.nodes ?? []).length;
  const pngs = (text.match(/"src":"data:image\/png/g) ?? []).length;
  check(`every screen is in it, its lists left whole (${pst ? "over 1000 parts, not 54" : "all 12 screens"})`, pst ? parts > 1000 : listed.values.every((v) => text.includes(`preview.html?screen=${v}`)), `${parts} parts`);
  check("its charts come in as pictures", pngs >= want, `${pngs} chart pictures`);

  /* One Builder page per screen, with the capture's own switches (presses and behaviours on), timed. */
  const each = plan({ url: origin, name: "each", pages: pst ? star : "/preview.html?screen=*", root, gate: "hide" });
  const t0 = Date.now();
  const failed = run(each);
  const secs = Math.round((Date.now() - t0) / 1000);
  const doc2 = JSON.parse(readFileSync(join(each.outDir, "site", "document.json"), "utf8"));
  const pages = doc2.pages ?? [];
  check(`?screen=* is one Builder page per screen (${want}), none failed`, pages.length === want && failed === 0, `${pages.length} pages, ${failed} failed`);
  check("each at a plain path, named for its screen", pages.every((x) => /^\/preview-[a-z0-9-]+$/.test(x.path)) && pages.some((x) => x.name === "Lobby"), pages.slice(0, 4).map((x) => `${x.path} ${x.name}`).join(", "));
  const rec = JSON.parse(readFileSync(each.recordFile, "utf8"));
  check("a screen of the list is read once: nothing pressed, no behaviours driven", each.captures.every((c) => !c.args.includes("--states") && !c.args.includes("--behaviours")) && each.captures.every((c) => c.args.includes("--network")));
  check(`the list is captured in under ${pst ? "5 minutes" : "2 minutes"}`, secs < (pst ? 300 : 120), `${secs} s for ${pages.length} screens, ${each.jobs} at a time`);
  /* The same parts as a capture of the same screens that only looks, one at a time. */
  const firstTwo = listed.values.slice(0, 2);
  const looked = plan({ url: origin, name: "looked", pages: firstTwo.map((v) => (pst ? `/preview.html?still=1&screen=${v}` : `/preview.html?screen=${v}`)).join(","), root, gate: "hide", behaviours: false, states: false, jobs: 1 });
  run(looked);
  const perPage = (d) => { const c = {}; for (const n of d.nodes) c[n.pageId] = (c[n.pageId] ?? 0) + 1; return c; };
  const a = perPage(doc2), b = perPage(JSON.parse(readFileSync(join(looked.outDir, "site", "document.json"), "utf8")));
  const same = Object.keys(b).length === 2 && Object.entries(b).every(([id, n]) => a[id] === n);
  const pics = (dir) => { try { return readdirSync(join(dir, "assets", "pictures")).length; } catch { return 0; } };
  check("the same parts per screen as a capture that only looks", same, JSON.stringify({ list: Object.fromEntries(Object.keys(b).map((id) => [id, a[id]])), looked: b }));
  check("and its pictures", pics(each.outDir) >= pics(looked.outDir) && pics(each.outDir) > 0, `${pics(each.outDir)} pictures in the list, ${pics(looked.outDir)} in two screens`);
  check("the record says the line as asked", rec.pages.length === 1 && rec.pages[0].endsWith("screen=*"), JSON.stringify(rec.pages));
  /* A screen with a chart: PonsStars' match in play, or the stand-in's first. */
  const pick = pst ? "mid-match" : listed.values[0];
  const c = each.captures.find((x) => x.args[1].endsWith(`screen=${pick}`));
  const one = c ? JSON.parse(readFileSync(c.args[2], "utf8")) : {};
  const oneText = JSON.stringify(one.tree ?? null);
  const others = listed.values.filter((v) => v !== pick && !v.startsWith(pick));
  check("a screen's page holds that screen alone, with its chart", (oneText.match(/"src":"data:image\/png/g) ?? []).length >= 1 && !others.some((v) => oneText.includes(`screen=${v}&`) || oneText.includes(`screen=${v}"`)), `${one.url}: ${(oneText.match(/"src":"data:image\/png/g) ?? []).length} chart pictures`);

  /* Controls the pointer cannot reach (a pane over a picture of a page): at most one page load for them all, the reachable ones still pressed. */
  const out = join(root, "reach.json");
  const r = spawnSync(process.execPath, [join(here, "..", "capture", "site", "capture", "capture-route.mjs"), `${origin}/reach.html`, out, "--width", "1440", "--height", "900", "--states", "--hide-gate"], { encoding: "utf8" });
  const said = r.stderr ?? "";
  const reach = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const loads = (said.match(/loaded again/g) ?? []).length;
  check("controls out of reach cost one page load at most, not one each", r.status === 0 && loads <= 1 && (said.match(/not pressed/g) ?? []).length >= 5, `${loads} loads; ${(said.match(/not pressed/g) ?? []).length} not pressed`);
  check("the controls in reach are still pressed", (reach.states ?? []).length === 3, `${(reach.states ?? []).length} states`);
} finally {
  server.kill();
  rmSync(root, { recursive: true, force: true });
}

const failedN = results.filter((x) => !x).length;
console.log(`\n${results.length - failedN}/${results.length} passed`);
process.exit(failedN ? 1 : 0);

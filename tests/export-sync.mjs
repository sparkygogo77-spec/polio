#!/usr/bin/env node
/**
 * EXPORT AGAIN, AND A FILE EDITED BY HAND IS KEPT (create-system "(d) Export",
 * "Staying in sync with later edits"; `send-out/exportSync.ts`, the Export
 * dialog `ExportDialog.tsx`).
 *
 * Each exported file has one owner. Polio owns what it writes; a file edited
 * in the repository since is the person's, and the next export keeps it.
 * Tokens are only values, so they are always written again.
 *
 *   1. pure, on each site's clean export, against a repository held in
 *      memory: the first export writes everything and its record; a section
 *      and tokens.css are then edited by hand, and a token is changed in the
 *      Builder; the second export KEEPS the section (and its record says it
 *      is now "code"), writes tokens.css again with the new value, and writes
 *      again every file nobody touched; a third export still keeps the
 *      section; the repository after it passes `next build`, with the hand
 *      edit and the new token both in it;
 *   2. in the Builder (with a Builder url): the dialog offers Exact look and
 *      Clean code; a zip of each holds the app, the tokens, POLIO.md,
 *      design/record.json, vercel.json (Next.js) and polio/export.json; to a
 *      repository it goes through Go live, and on a second export the file
 *      edited in the repository is not sent and the dialog says it was kept.
 *
 *   npx next start -p 3091
 *   node tests/export-sync.mjs http://127.0.0.1:3091 <capture folder> [...]
 *   PAGES_DUMP=<folder with board.json and site/> node tests/export-sync.mjs   (part 1 only)
 *
 * Covers: src/features/studio/send-out/exportSync.ts, src/features/studio/send-out/exportRun.ts, src/features/studio/ExportDialog.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { EXPORT_RECORD, gitBlobSha, readRecord, recordFile, syncPlan, tokenNames } from "../src/features/studio/send-out/index.ts";
import { setTokenValue } from "../src/features/studio/system/link.ts";
import { buildApp } from "./lib/export-app.mjs";
import { cleanExport, dumpedSite, importedSite } from "./lib/export-input.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const [BASE, ...captures] = process.argv.slice(2);
const sources = process.env.PAGES_DUMP ? process.env.PAGES_DUMP.split(",").map((d) => () => dumpedSite(d)) : captures.map((c) => () => importedSite(browser, BASE, c));

const text = (c) => (typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
const sha = (f) => gitBlobSha(typeof f.content === "string" ? { content: f.content } : { content: Buffer.from(f.content).toString("base64"), encoding: "base64" });
const shasOf = async (files) => Promise.all(files.map(async (f) => ({ path: f.path, sha: await sha(f) })));
const branchOf = async (repo) => new Map(await Promise.all([...repo].map(async ([path, content]) => [path, await sha({ content })])));
const meta = (n) => ({ mode: "clean", target: "next-tailwind", at: new Date(Date.UTC(2026, 9, 24 + n)).toISOString(), system: null });

/** Applies a plan to the repository held in memory: the files it writes, and its record. */
function apply(repo, files, plan) {
  const write = new Set(plan.write);
  for (const f of files) if (write.has(f.path)) repo.set(f.path, f.content);
  repo.set(EXPORT_RECORD, recordFile(plan.record).content);
}

for (const load of sources) {
  const site = await load();
  console.log(`\n${site.name}`);

  /* 1. Pure, against a repository in memory. */
  const one = cleanExport(site, { library: true });
  const repo = new Map();
  const plan1 = syncPlan(null, await shasOf(one.files), new Map(), meta(0));
  check("the first export writes every file", plan1.write.length === one.files.length && !plan1.keep.length, `${plan1.write.length} files`);
  apply(repo, one.files, plan1);
  check("…and carries polio/export.json, every file Polio's", Object.values(readRecord(repo.get(EXPORT_RECORD)).files).every((f) => f.owner === "polio") && Object.keys(readRecord(repo.get(EXPORT_RECORD)).files).length === one.files.length);

  const section = one.files.find((f) => f.path.startsWith("components/sections/"))?.path;
  const edit = "\n// Edited by hand: the hero's words are mine now.\n";
  repo.set(section, `${text(repo.get(section))}${edit}`);
  repo.set("tokens/tokens.css", `${text(repo.get("tokens/tokens.css"))}\n/* a hand edit to a token file */\n`);
  const accent = one.system.tokens.colour.find((t) => t.role === "accent") ?? one.system.tokens.colour[0];
  const two = cleanExport(site, { library: true, edit: (s) => setTokenValue(s, accent.id, "rgb(255, 0, 255)") });
  const plan2 = syncPlan(readRecord(repo.get(EXPORT_RECORD)), await shasOf(two.files), await branchOf(repo), meta(1));
  check("a section edited by hand is kept", plan2.keep.includes(section) && !plan2.write.includes(section), `${section}; kept ${plan2.keep.length}: ${plan2.keep.slice(0, 3).join(", ")}`);
  check("…and the record now says it is the person's", plan2.record.files[section]?.owner === "code");
  check("tokens are always written again, even edited by hand", plan2.write.includes("tokens/tokens.css") && plan2.write.includes("tokens/tokens.json"));
  check("every file nobody touched is written again", plan2.write.length === two.files.length - 1, `${plan2.write.length} of ${two.files.length}`);
  apply(repo, two.files, plan2);
  const css = text(repo.get("tokens/tokens.css"));
  const accentVar = tokenNames(two.system).get(accent.id).css;
  check("the repository holds the hand edit and the new token value", text(repo.get(section)).includes(edit.trim()) && css.includes(`${accentVar}: rgb(255, 0, 255);`) && !css.includes("a hand edit to a token file"));
  const plan3 = syncPlan(readRecord(repo.get(EXPORT_RECORD)), await shasOf(two.files), await branchOf(repo), meta(2));
  check("a third export still keeps the person's file", plan3.keep.includes(section) && plan3.record.files[section]?.owner === "code");
  const app = await buildApp(`sync-${site.name}`, [...repo].filter(([p]) => p !== EXPORT_RECORD).map(([path, content]) => ({ path, content })));
  check("the repository after the re-export passes next build", app.ok, app.ok ? "" : app.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 6).join(" / "));
  if (app.ok) check("…and its built CSS paints with the token changed in the Builder", /255,\s*0,\s*255|#f0f\b|#ff00ff/i.test(app.css()));

  /* 2. In the Builder: the dialog, a zip, and a repository. */
  if (!site.page) continue;
  const b = site.page;
  const pushes = [];
  let branch = new Map();
  let record = null;
  await b.route("**/api/studio/publish**", async (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === "GET" && u.searchParams.get("tree")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tree: [...branch].map(([path, s]) => ({ path, sha: s })) }) });
    if (r.request().method() === "POST") {
      const body = JSON.parse(r.request().postData() ?? "{}");
      pushes.push(body);
      /* A staging request (a big push's parts) is answered as the route answers it: each file staged, by a sha. */
      if (body.stage) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, staged: (body.files ?? []).map((f, i) => ({ path: f.path, sha: String(i).padStart(40, "1") })) }) });
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sha: "0".repeat(40), commitUrl: "https://example.invalid/c", branch: "main", repo: "someone/mochi-export", files: (body.files ?? []).length, changed: (body.files ?? []).length, total: (body.files ?? []).length + (body.staged ?? []).length, deployed: false, hook: false }) });
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: true, token: "browser", repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } }) });
  });
  await b.route("https://api.github.com/repos/someone/**", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith(`/contents/${EXPORT_RECORD}`) && record) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: Buffer.from(record).toString("base64"), encoding: "base64" }) });
    return r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not Found" }) });
  });
  const openDialog = async () => {
    await b.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
    /* A big board takes a while to be ready for the palette: tried again until the dialog is up. */
    for (let i = 0; i < 6; i++) {
      await b.waitForTimeout(i ? 4000 : 1500);
      await b.keyboard.press("Escape");
      await b.keyboard.press("Control+k");
      await b.waitForTimeout(500);
      await b.keyboard.type("Export…: exact look");
      await b.waitForTimeout(600);
      await b.keyboard.press("Enter");
      if (await b.locator("[data-export-dialog]").waitFor({ timeout: 8000 }).then(() => true, () => false)) return;
    }
    await b.locator("[data-export-dialog]").waitFor({ timeout: 10000 });
  };
  await openDialog();
  check("the dialog offers Exact look and Clean code", (await b.locator("[data-export-mode]").count()) === 2 && (await b.locator('[data-export-mode="exact"]').isChecked()));
  const zipOf = async (mode) => {
    await b.locator(`[data-export-mode="${mode}"]`).check();
    await b.locator('[data-export-to="zip"]').check();
    const [dl] = await Promise.all([b.waitForEvent("download", { timeout: 300000 }), b.locator("[data-export-go]").click()]);
    const buf = await (await import("node:fs/promises")).readFile(await dl.path());
    const names = [], files = [];
    for (let i = 0; i + 30 < buf.length; ) { if (buf.readUInt32LE(i) !== 0x04034b50) break; const size = buf.readUInt32LE(i + 18), n = buf.readUInt16LE(i + 26); const path = buf.subarray(i + 30, i + 30 + n).toString("utf8"); names.push(path); files.push({ path, content: buf.subarray(i + 30 + n, i + 30 + n + size) }); i += 30 + n + size; }
    return { names, buf, files };
  };
  for (const mode of ["exact", "clean"]) {
    if (mode === "clean") await openDialog();
    const { names, buf, files } = await zipOf(mode);
    const built = await buildApp(`zip-${mode}-${site.name}`, files);
    check(`the ${mode === "exact" ? "Exact look" : "Clean code"} zip, as downloaded, passes next build`, built.ok, built.ok ? "" : built.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 6).join(" / "));
    const has = (p) => names.includes(p);
    const shared = ["tokens/tokens.json", "tokens/tokens.css", "tokens/tailwind.css", "tokens/tokens.ts", "POLIO.md", "design/record.json", "vercel.json", "package.json", "postcss.config.mjs", EXPORT_RECORD, "app/page.tsx", "app/layout.tsx", "app/globals.css"];
    const own = mode === "exact" ? ["app/markup.ts"] : ["components/ui/index.ts"];
    const missing = [...shared, ...own].filter((p) => !has(p));
    check(`a zip of ${mode === "exact" ? "Exact look" : "Clean code"} holds the app, the tokens, POLIO.md, the record and polio/export.json`, !missing.length, `${names.length} files${missing.length ? `; missing ${missing.join(", ")}` : ""}`);
    check(`…vercel.json says Next.js, and package.json has Tailwind (${mode})`, buf.includes(Buffer.from('"framework": "nextjs"')) && buf.includes(Buffer.from('"tailwindcss"')));
    if (mode === "clean") check("…POLIO.md lists what is still placed by hand", buf.includes(Buffer.from("## Still placed by hand")));
  }

  /* To a repository, twice: the second keeps the file edited there. */
  await b.evaluate(() => { const raw = JSON.parse(localStorage.getItem("builder.builds")); raw.state.projects = raw.state.projects.map((p) => (p.id === raw.state.activeId ? { ...p, repo: { owner: "someone", name: "mochi-export", branch: "main" } } : p)); localStorage.setItem("builder.builds", JSON.stringify(raw)); });
  const toRepo = async () => {
    await openDialog();
    await b.locator('[data-export-mode="clean"]').check();
    await b.locator('[data-export-to="repo"]').check();
    await b.locator("[data-export-deploy]").uncheck();
    await b.waitForTimeout(500);
    const said = await b.locator("[data-export-line]").textContent({ timeout: 2000 }).catch(() => null);
    for (let i = 0; i < 600 && /Reading/.test((await b.locator("[data-export-line]").textContent().catch(() => "")) ?? ""); i++) await b.waitForTimeout(500);
    const line = (await b.locator("[data-export-line]").textContent().catch(() => null)) ?? said;
    const before = pushes.length;
    await b.locator("[data-export-go]").click();
    /* A big export goes up in several requests (staged parts, then the commit): until the commit, the one that is not staging. */
    for (let i = 0; i < 1200 && !pushes.slice(before).some((p) => !p.stage); i++) await b.waitForTimeout(500);
    await b.waitForTimeout(1500);
    return { line, pushed: pushes.slice(before) };
  };
  /* Every file one export put up, over all its requests: the ones it sent, and the ones its last request names by sha (staged earlier, or already on the branch). */
  const sentBy = (pushed) => [...new Set(pushed.flatMap((p) => [...(p.files ?? []).map((f) => f.path), ...(p.stage ? [] : (p.staged ?? []).map((f) => f.path))]))];
  const first = await toRepo();
  const sent1 = sentBy(first.pushed);
  check("to the repository it goes through Go live, the record with it", sent1.includes(EXPORT_RECORD) && sent1.includes("tokens/tokens.json"), `${sent1.length} files sent, in ${first.pushed.length} request${first.pushed.length === 1 ? "" : "s"}`);
  const rec1 = first.pushed.flatMap((p) => p.files ?? []).find((f) => f.path === EXPORT_RECORD);
  record = rec1?.encoding === "gzip" ? (await import("node:zlib")).gunzipSync(Buffer.from(rec1.content, "base64")).toString("utf8") : rec1?.content ?? null;
  const owned = Object.entries(readRecord(record)?.files ?? {});
  const handFile = owned.map(([p]) => p).find((p) => p.startsWith("components/sections/"));
  branch = new Map(owned.map(([p, f]) => [p, p === handFile ? "f".repeat(40) : f.sha]));
  branch.set(EXPORT_RECORD, "e".repeat(40));
  const second = await toRepo();
  const sent2 = sentBy(second.pushed);
  check("on the second export the file edited in the repository is not sent", !!handFile && !sent2.includes(handFile) && sent2.includes("tokens/tokens.css"), `${handFile}; ${sent2.length} sent or named`);
  check("…and the dialog said it was kept", /1 file was edited in the repo: kept/.test(second.line ?? ""), second.line ?? "");
  await b.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

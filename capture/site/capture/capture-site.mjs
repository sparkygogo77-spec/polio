#!/usr/bin/env node
/**
 * Any address, captured whole into its own `sites/<name>/`.
 *
 * Today the root `site/` holds one site (SOLCINERATOR), captured by hand
 * from `routes.json`. This is the same capture and the same converter, run
 * for an address somebody types, into a folder beside the others rather
 * than over that one:
 *
 *   sites/<name>/capture/routes.json      the pages, as this wrote them
 *   sites/<name>/capture/routes/<id>.json one capture per page
 *   sites/<name>/capture/ledger.txt       what the converter printed
 *   sites/<name>/capture/run.json         where and when it was taken
 *   sites/<name>/assets/source            the bytes the pages showed
 *   sites/<name>/site/document.json       the Builder's document
 *   sites/<name>/assets/pictures          its pictures
 *
 *   node capture/site/capture/capture-site.mjs --url <address> --name <folder> [--pages "/, /docs"]
 *        [--width 1440 --height 900] [--wallet] [--no-agree | --hide-gate] [--no-behaviours] [--no-states] [--no-network] [--shots <dir>]
 *        [--crawl [--skip "/rewards"] [--limit 30]]
 *   node capture/site/capture/capture-site.mjs --reconvert --name <folder>   (the committed captures, converted again; no browser)
 *
 * `--crawl` also takes the same-site pages they link to: each plain page
 * once, and one representative of each pattern (`/token/:id`), whose ids
 * are kept in routes.json and run.json as `crawl` (linkPatterns).
 *
 * A terms gate over the page (a box to tick, an Accept) is agreed to
 * before anything is read (`--agree`), unless `--no-agree`.
 *
 * Every page is captured with `--behaviours` (what its scripts do: a
 * loader, reveals, a scrolled header, parallax, a marquee) unless
 * `--no-behaviours`; `--shots <dir>` keeps a picture of the window at each
 * step of it, one folder per page.
 *
 * `plan` is the pure part — every command this would run, as data — so
 * the check reads the plan and no browser is opened. The workflow at
 * `.github/workflows/capture.yml` runs this and commits the folder to a
 * branch `captures/<name>`, from where the Builder reads it.
 */
import { mkdirSync, writeFileSync, readFileSync, openSync, closeSync, existsSync } from "node:fs";
import { keepOwner } from "./keep-owner.mjs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The folder name a site is kept under: lowered, dashes, never the root site's own folders, never a path. */
export function siteName(raw) {
  const typed = String(raw ?? "").trim();
  if (/[\/\\]|\.\./.test(typed)) return null; /* a name, not a path */
  const s = typed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s || s.length > 64) return null;
  if (["site", "sites", "capture", "assets", "app", "public"].includes(s)) return null;
  return s;
}

/** A name for a site from its address, when none was typed. */
export function nameFrom(url) {
  try { return siteName(new URL(url).hostname.replace(/^www\./, "").split(".").slice(0, -1).join("-") || new URL(url).hostname); } catch { return null; }
}

/** The pages to capture, from a comma list of paths. Empty means the home page. */
export function pageList(raw) {
  const paths = String(raw ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean).map((p) => (p.startsWith("/") ? p : `/${p}`));
  if (!paths.length) paths.push("/");
  const seen = new Set();
  return paths.filter((p) => !seen.has(p) && seen.add(p)).map((path) => {
    const slug = path === "/" ? "home" : path.replace(/^\/+|\/+$/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const name = path === "/" ? "Home" : path.split("/").filter(Boolean).at(-1).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { id: `page_${slug}`, path, route: path, name };
  });
}

/*
 * ONE PAGE PER TEMPLATE (the owner's rule, docs/fidelity/stonkfun-xyz.md).
 * A capture is for the design: its parts, what they do, how they move. A
 * site's many pages of one template (stonkfun.xyz's ~400 `/token/<address>`)
 * are that design once and the backend's data the rest of the time, so a
 * crawl takes one representative per pattern and keeps the ids as words.
 */
/** A path segment that reads as an id: a number, a uuid, a hash, a long address. */
const strongId = (seg) => /^[0-9a-f]{8,}$/i.test(seg) || /^[0-9a-f-]{32,36}$/i.test(seg) || (/^[A-Za-z0-9_-]{6,}$/.test(seg) && /\d/.test(seg) && /[a-z]/i.test(seg));
const idLike = (seg) => /^\d+$/.test(seg) || strongId(seg);
/** Siblings under one parent that make a pattern even when they do not read as ids. */
const SIBLINGS_MIN = 6;
/**
 * Same-site paths, sorted into plain pages and patterns: paths that differ
 * only in one id-like segment (two or more; one is enough when it is a
 * hash, an address or a short id of letters and digits), or many (SIBLINGS_MIN) last
 * segments under one parent, are one pattern (`/token/:id`) with its first
 * path as the representative and every id kept.
 */
export function linkPatterns(paths, { min = SIBLINGS_MIN } = {}) {
  const uniq = [...new Set(paths)];
  const groups = new Map();
  const add = (key, path, id) => { const g = groups.get(key) ?? { pattern: key, paths: [], ids: [] }; if (!g.paths.includes(path)) { g.paths.push(path); g.ids.push(id); } groups.set(key, g); };
  for (const path of uniq) {
    const segs = path.split("/").filter(Boolean);
    segs.forEach((seg, i) => { if (idLike(seg)) add("/" + segs.map((x, j) => (j === i ? ":id" : x)).join("/"), path, seg); });
  }
  /* A number is an id among others (/blog/2024/…); a hash, an address or a short id of letters and digits (gotchi's /g/de9xw93a) is one alone. */
  for (const [k, g] of groups) if (g.paths.length < 2 && !g.ids.every(strongId)) groups.delete(k);
  /* A sibling of the same length and letters as a pattern's ids is one of them (gotchi's /g/zcsupzwa beside /g/de9xw93a). */
  for (const g of groups.values()) {
    const at = g.pattern.split("/").filter(Boolean).indexOf(":id");
    const lens = new Set(g.ids.map((x) => x.length));
    for (const path of uniq) {
      const segs = path.split("/").filter(Boolean);
      const seg = segs[at];
      if (g.paths.includes(path) || !seg || !/^[A-Za-z0-9_-]+$/.test(seg) || !lens.has(seg.length)) continue;
      if ("/" + segs.map((x, j) => (j === at ? ":id" : x)).join("/") === g.pattern) { g.paths.push(path); g.ids.push(seg); }
    }
  }
  const taken = new Set([...groups.values()].flatMap((g) => g.paths));
  const byParent = new Map();
  for (const path of uniq) {
    if (taken.has(path)) continue;
    const segs = path.split("/").filter(Boolean);
    if (segs.length < 2) continue;
    const key = "/" + [...segs.slice(0, -1), ":id"].join("/");
    const g = byParent.get(key) ?? { pattern: key, paths: [], ids: [] };
    g.paths.push(path); g.ids.push(segs.at(-1)); byParent.set(key, g);
  }
  for (const g of byParent.values()) if (g.paths.length >= min) { groups.set(g.pattern, g); g.paths.forEach((x) => taken.add(x)); }
  const patterns = [...groups.values()].map((g) => ({ pattern: g.pattern, representative: g.paths[0], ids: g.ids, count: g.ids.length }));
  return { pages: uniq.filter((x) => !taken.has(x)), patterns };
}

/** The same-site paths a captured page links to: its `a href`s, without query, hash or files. */
export function linksOf(capture, origin) {
  const out = [];
  const host = (h) => h.replace(/^www\./, "");
  const base = new URL(origin);
  const walk = (n) => {
    if (n.href) {
      try {
        const u = new URL(n.href, capture.url ?? origin);
        if (/^https?:$/.test(u.protocol) && host(u.hostname) === host(base.hostname) && !/\.(png|jpe?g|gif|webp|svg|pdf|zip|json|xml|txt|ico|mp4|webm)$/i.test(u.pathname)) out.push(u.pathname.replace(/\/+$/, "") || "/");
      } catch { /* not an address */ }
    }
    for (const k of n.kids ?? []) walk(k);
  };
  if (capture.tree) walk(capture.tree);
  for (const href of capture.links ?? []) walk({ href });
  return [...new Set(out)];
}

/** Everything a capture would do, as data. Runs nothing. */
export function plan({ url, name, pages, root, viewport = [1440, 900], wallet = false, agree = true, gate = "agree", behaviours = true, shots = null, states = true, network = true, crawl = false, skip = [], limit = 30 }) {
  const site = new URL(url);
  const folder = siteName(name) ?? nameFrom(url);
  if (!folder) throw new Error(`A name is needed: letters, digits and dashes. "${name}" is not one.`);
  const outDir = join(root, "sites", folder);
  const captureDir = join(outDir, "capture");
  const assets = join(outDir, "assets", "source");
  const routes = {
    _: `The pages of ${site.origin}, as typed into the capture; taken by site/capture/capture-site.mjs.`,
    site: site.origin,
    viewport,
    /* A site given at a folder (trendtrader.pro/ttp/) is that folder: the page typed as `/` is the address itself. */
    pages: pageList(pages).map((p) => (p.path === "/" && site.pathname !== "/" ? pageList(site.pathname)[0] : p)).map((p) => ({ ...p, wallet, agree })),
  };
  /*
   * ONE PAGE PER TEMPLATE, of the pages given too: two or more of one
   * template (/burned/<id>, /burned/<other id>) are captured once, the first,
   * and the template kept in routes.json (`templates`) so the converter links
   * every page of it to the one taken.
   */
  {
    const lp = linkPatterns(routes.pages.map((x) => x.path));
    const drop = new Set();
    routes.templates = [];
    for (const pt of lp.patterns) {
      if (pt.count < 2) continue;
      const rep = routes.pages.find((x) => x.path === pt.representative);
      if (!rep) continue;
      rep.pattern = pt.pattern;
      for (const id of pt.ids) { const path = pt.pattern.replace(":id", id); if (path !== pt.representative) drop.add(path); }
      routes.templates.push({ pattern: pt.pattern, representative: rep.id, ids: pt.ids });
    }
    routes.pages = routes.pages.filter((x) => !drop.has(x.path));
    if (!routes.templates.length) delete routes.templates;
  }
  /* …and its crawl stays inside the folders of the pages given, never the rest of the host. */
  const scope = site.pathname === "/" ? ["/"] : [...new Set(routes.pages.map((x) => x.path.slice(0, x.path.lastIndexOf("/") + 1) || "/"))];
  const captureOf = (p) => ({
    id: p.id,
    args: [
      join(here, "capture-route.mjs"),
      p.route === "/" ? site.href : site.origin + p.route,
      join(captureDir, "routes", `${p.id}.json`),
      "--width", String(viewport[0]), "--height", String(viewport[1]),
      "--assets", assets,
      ...(wallet ? ["--wallet"] : []),
      /* A terms gate: agreed to (the default), or with `--hide-gate` hidden in the capture's own browser and never agreed to. */
      ...(gate === "hide" ? ["--hide-gate"] : agree ? ["--agree"] : []),
      /* What the page's scripts do (docs/behaviours.md): a loader, reveals, a scrolled header, parallax, a marquee. */
      ...(behaviours ? ["--behaviours"] : []),
      ...(behaviours && shots ? ["--behaviours-shots", join(shots, p.id)] : []),
      /* What each press of a row of cards or buttons shows (check-states.mjs), unless `--no-states`. */
      ...(states ? ["--states"] : []),
      /* Every data request the page makes on its own, as an API map with samples (network.mjs), unless `--no-network`. */
      ...(network ? ["--network"] : []),
    ],
  });
  const captures = routes.pages.map(captureOf);
  const convert = { args: [join(here, "capture-to-document.mjs"), join(captureDir, "routes.json"), outDir, "--assets", assets] };
  const record = { version: 1, url: site.href, name: folder, pages: routes.pages.map((p) => p.path), viewport, takenAt: null };
  const skipped = pageList(skip.join(",")).map((x) => x.path).filter(() => skip.length);
  return { name: folder, outDir, captureDir, routesFile: join(captureDir, "routes.json"), ledgerFile: join(captureDir, "ledger.txt"), recordFile: join(captureDir, "run.json"), routes, captures, convert, record, captureOf, crawl: crawl ? { skip: skipped, limit, origin: site.origin, scope } : null };
}

/** Run the plan: the captures, then the converter. Returns how many pages failed. */
export function run(p) {
  mkdirSync(join(p.captureDir, "routes"), { recursive: true });
  mkdirSync(join(p.outDir, "assets", "source"), { recursive: true });
  writeFileSync(p.routesFile, JSON.stringify(p.routes, null, 2) + "\n");
  let failed = 0;
  const take = (c) => {
    const r = spawnSync(process.execPath, c.args, { stdio: "inherit" });
    if (r.status !== 0) { failed++; console.error(`${c.id}: capture failed`); }
    return r.status === 0;
  };
  for (const c of p.captures) take(c);
  if (p.crawl) crawlOn(p, take);
  if (failed === p.captures.length) return failed;
  if (!convertKeeping(p)) return failed + 1;
  writeFileSync(p.recordFile, JSON.stringify({ ...p.record, pages: p.routes.pages.map((x) => x.path), takenAt: new Date().toISOString(), failed, ...(p.routes.crawl ? { crawl: p.routes.crawl } : {}) }, null, 2) + "\n");
  return failed;
}

/**
 * The captures as the document, keeping what the owner set on the document as
 * it was (keep-owner.mjs): the converter's ledger written, the owner's fields
 * carried and said. False when the converter failed.
 */
export function convertKeeping(p) {
  const docFile = join(p.outDir, "site", "document.json");
  let was = null;
  try { was = JSON.parse(readFileSync(docFile, "utf8")); } catch { /* converted for the first time */ }
  const ledger = openSync(p.ledgerFile, "w");
  const r = spawnSync(process.execPath, p.convert.args, { stdio: ["ignore", ledger, "inherit"] });
  closeSync(ledger);
  if (r.status !== 0) { console.error("convert failed"); return false; }
  if (was) {
    const { doc, kept } = keepOwner(was, JSON.parse(readFileSync(docFile, "utf8")));
    if (kept.length) {
      writeFileSync(docFile, JSON.stringify(doc, null, 2) + "\n");
      for (const k of kept) console.error(`kept the owner's on ${k.id}${k.selector ? ` (${k.selector})` : ""}: ${k.what.join("; ")}`);
    }
  }
  return true;
}

/**
 * A SITE CONVERTED AGAIN FROM WHAT IS COMMITTED (`--reconvert`), no browser.
 * share.xyz's document predates two days of converter fixes, and where the
 * live site cannot be opened (a machine whose browser does not trust its
 * proxy) it can still take them: its committed captures, run through today's
 * converter, the owner's own fields kept as a retake keeps them
 * (docs/fidelity/reimport-plan.md). The captures, the pictures and run.json
 * are left as they are.
 */
export function reconvertPlan(root, name) {
  const outDir = join(root, "sites", name);
  const captureDir = join(outDir, "capture");
  return {
    name, outDir, captureDir, ledgerFile: join(captureDir, "ledger.txt"),
    convert: { args: [join(here, "capture-to-document.mjs"), join(captureDir, "routes.json"), outDir, "--assets", join(outDir, "assets", "source")] },
  };
}

/**
 * The crawl: every page captured is read for its same-site links; a plain
 * page is captured once, a pattern by its representative only, until no
 * page is new or `limit` pages are taken. What was found is written into
 * routes.json (`crawl`: the patterns with every id, and the pages skipped).
 */
function crawlOn(p, take) {
  /* Links come without a trailing slash (/ttp), a typed folder with one (/ttp/): one page. */
  const bare = (x) => x.replace(/\/+$/, "") || "/";
  const scope = p.crawl.scope ?? ["/"];
  const inside = (x) => scope.some((f) => f === "/" || `${bare(x)}/`.startsWith(f));
  const done = new Set(p.routes.pages.map((x) => bare(x.path)));
  const seen = new Set(done);
  const outside = new Set();
  const patterns = new Map();
  const skip = new Set(p.crawl.skip);
  const capOf = (c) => { try { return JSON.parse(readFileSync(c.args[2], "utf8")); } catch { return null; } };
  const queue = [...p.captures];
  while (queue.length) {
    const cap = capOf(queue.shift());
    if (!cap) continue;
    for (const l of linksOf(cap, p.crawl.origin)) (inside(l) ? seen : outside).add(l);
    const sorted = linkPatterns([...seen].filter((x) => !skip.has(x)));
    for (const pt of sorted.patterns) {
      const had = patterns.get(pt.pattern);
      if (had) { for (const id of pt.ids) if (!had.ids.includes(id)) had.ids.push(id); had.count = had.ids.length; } else patterns.set(pt.pattern, { ...pt });
    }
    const wanted = [...sorted.pages.filter((x) => !done.has(bare(x))), ...[...patterns.values()].filter((pt) => !p.routes.pages.some((x) => x.pattern === pt.pattern) && !done.has(bare(pt.representative))).map((pt) => pt)];
    for (const w of wanted) {
      if (p.routes.pages.length >= p.crawl.limit) break;
      const isPattern = typeof w === "object";
      const path = isPattern ? w.representative : w;
      const [page] = pageList(path);
      if (isPattern) {
        const slug = w.pattern.split("/").filter((x) => x && x !== ":id").join("_").toLowerCase().replace(/[^a-z0-9_]+/g, "_") || "item";
        let id = `page_${slug}`; for (let i = 2; p.routes.pages.some((x) => x.id === id); i++) id = `page_${slug}_${i}`;
        Object.assign(page, { id, name: page.name && slug.split("_").map((x) => x[0].toUpperCase() + x.slice(1)).join(" "), pattern: w.pattern });
      }
      const full = { ...page, wallet: p.routes.pages[0]?.wallet ?? false, agree: p.routes.pages[0]?.agree ?? true };
      done.add(bare(path));
      p.routes.pages.push(full);
      const c = p.captureOf(full);
      p.captures.push(c);
      if (take(c)) queue.push(c);
    }
  }
  /* A page taken before its pattern was known is the pattern's now: kept only as its representative. */
  const final = linkPatterns([...seen].filter((x) => !skip.has(x)));
  for (const pt of final.patterns) {
    const had = patterns.get(pt.pattern) ?? pt;
    for (const id of pt.ids) if (!had.ids.includes(id)) had.ids.push(id);
    had.count = had.ids.length; patterns.set(pt.pattern, had);
    const rep = p.routes.pages.find((x) => x.pattern === pt.pattern)?.path ?? had.representative;
    p.routes.pages = p.routes.pages.filter((x) => x.path === rep || x.pattern || !pt.ids.some((id) => x.path === pt.pattern.replace(":id", id)) || p.routes.pages.indexOf(x) === 0);
  }
  p.routes.crawl = { patterns: [...patterns.values()], skipped: [...skip], limit: p.crawl.limit, notTaken: linkPatterns([...seen]).pages.filter((x) => !done.has(bare(x)) && !skip.has(x)), ...(scope.includes("/") ? {} : { scope, outside: [...outside].filter((x) => !seen.has(x)) }) };
  writeFileSync(p.routesFile, JSON.stringify(p.routes, null, 2) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  if (args.includes("--reconvert")) {
    const name = opt("--name", "");
    const p = reconvertPlan(join(here, "..", ".."), name);
    if (!name || !existsSync(join(p.captureDir, "routes.json"))) { console.error(`usage: node capture/site/capture/capture-site.mjs --reconvert --name <folder>; no sites/${name}/capture/routes.json`); process.exit(2); }
    console.error(`converting sites/${name}/ again from its committed captures`);
    process.exit(convertKeeping(p) ? 0 : 1);
  }
  const url = opt("--url");
  if (!url) { console.error("usage: node capture/site/capture/capture-site.mjs --url <address> --name <folder> [--pages \"/, /docs\"] [--width 1440 --height 900] [--wallet] [--no-agree]"); process.exit(2); }
  const p = plan({
    url, name: opt("--name", ""), pages: opt("--pages", "/"), root: join(here, "..", ".."),
    viewport: [Number(opt("--width", 1440)), Number(opt("--height", 900))],
    wallet: args.includes("--wallet"), agree: !args.includes("--no-agree"), gate: args.includes("--hide-gate") ? "hide" : "agree",
    behaviours: !args.includes("--no-behaviours"), shots: opt("--shots"), states: !args.includes("--no-states"), network: !args.includes("--no-network"),
    crawl: args.includes("--crawl"), skip: String(opt("--skip", "")).split(",").map((x) => x.trim()).filter(Boolean), limit: Number(opt("--limit", 30)),
  });
  console.error(`capturing ${p.routes.pages.length} page(s) of ${p.routes.site} into sites/${p.name}/`);
  process.exit(run(p) ? 1 : 0);
}

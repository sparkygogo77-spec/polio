#!/usr/bin/env node
/**
 * The check for `capture-site.mjs` and the workflow that runs it: any
 * address becomes its own `sites/<name>/`, beside the others, never in
 * the root `site/` that holds SOLCINERATOR, and the workflow needs no
 * secret, commits nothing and hands the capture back as its artifact.
 *
 *   node capture/site/capture/check-capture-site.mjs
 *
 * Nothing is captured here: `plan` is the pure part, the commands it
 * would run, and the check reads them. No browser, no network, no token.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { plan, siteName, pageList } = await import("./capture-site.mjs");

/* The name is a folder name and nothing else. */
check("a name is lowered and kept to letters, digits and dashes", siteName("My Site!") === "my-site");
check("the root site's folder is never a capture's name", siteName("site") === null && siteName("capture") === null);
check("a path can not climb out of sites/", siteName("../x") === null && siteName("a/b") === null && siteName("") === null);

/* The pages. */
const pages = pageList("/, /docs ,/about/team");
check("pages are paths, trimmed, the home page first", JSON.stringify(pages.map((p) => p.path)) === JSON.stringify(["/", "/docs", "/about/team"]));
check("each page gets an id the converter can name a file by", pages.map((p) => p.id).join(",") === "page_home,page_docs,page_about_team");
check("no pages given means the home page", pageList("").length === 1 && pageList("").at(0).path === "/");

/* The plan. */
const p = plan({ url: "https://example.com/", name: "example", pages: "/, /docs", root, viewport: [1440, 900] });
check("the site lands in sites/<name>, beside the others", p.outDir === join(root, "sites", "example"));
check("nothing in the plan touches the root site/", !JSON.stringify(p).includes(`"${join(root, "site")}"`) && !p.routesFile.startsWith(join(root, "site", "capture")));
check("routes.json names the site with no trailing slash", p.routes.site === "https://example.com" && p.routes.viewport[0] === 1440);
check("routes.json holds every page with its route and path", p.routes.pages.length === 2 && p.routes.pages[1].route === "/docs" && p.routes.pages[1].path === "/docs" && p.routes.pages[1].name === "Docs");
check("one capture command per page, into the site's own capture folder", p.captures.length === 2 && p.captures.every((c) => c.args[0].endsWith("capture-route.mjs") && c.args[2].startsWith(join(p.outDir, "capture", "routes"))));
check("the captures' bytes go under the site's own assets", p.captures.every((c) => c.args[c.args.indexOf("--assets") + 1] === join(p.outDir, "assets", "source")));
check("the home page is asked for at the site's address, a page at its route", p.captures[0].args[1] === "https://example.com/" && p.captures[1].args[1] === "https://example.com/docs");
check("the converter writes the document into sites/<name>", p.convert.args[0].endsWith("capture-to-document.mjs") && p.convert.args[2] === p.outDir);
check("the run's record says where it came from", p.record.url === "https://example.com/" && p.record.name === "example" && p.record.pages.length === 2);
check("every page is captured with what its scripts do (--behaviours), unless told not to", p.captures.every((c) => c.args.includes("--behaviours")) && plan({ url: "https://example.com/", name: "example", root, behaviours: false }).captures.every((c) => !c.args.includes("--behaviours")));
check("the whole plan is read with no browser and no token", !JSON.stringify(p).toLowerCase().includes("token"));

/* The workflow: polio's own (`.github/workflows/capture.yml`), at the repository's root, one above this folder's. */
const repoRoot = join(root, "..");
const wf = join(repoRoot, ".github", "workflows", "capture.yml");
check("the workflow exists", existsSync(wf));
const y = existsSync(wf) ? readFileSync(wf, "utf8") : "";
check("it is run by hand, with url, name and pages", /workflow_dispatch:/.test(y) && /^\s+url:/m.test(y) && /^\s+name:/m.test(y) && /^\s+pages:/m.test(y));
const secrets = [...y.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
check("it reads no secret", secrets.length === 0, secrets.join(","));
check("it may read the repository, and nothing more", /permissions:\s*\n\s+contents:\s*read/.test(y) && !/contents:\s*write|actions:\s*write|id-token|packages:|pull-requests:\s*write/.test(y));
check("it runs the capture into capture/sites/<name>", /capture\/site\/capture\/capture-site\.mjs/.test(y) && /capture\/sites\/\$\{\{\s*env\.NAME\s*\}\}/.test(y));
check("it hands the capture back as the run's artifact, capture-<name>", /actions\/upload-artifact@v4/.test(y) && /name:\s*capture-\$\{\{\s*env\.NAME\s*\}\}/.test(y));
check("it commits nothing and pushes nothing", !/git (add|commit|push|checkout -B)/.test(y));
check("observe only: the gate is hidden, never agreed to", /--hide-gate/.test(y) && !/--agree|--wallet/.test(y));
check("its browser is the one the capture script is told about", /CHROMIUM:/.test(y) || /CHROMIUM=/.test(y));

/*
 * Nothing a capture makes is kept in git: capture/sites/ is ignored whole in
 * polio, its document, its capture and its ledger.txt alike. ledger.json,
 * the converter's machine-readable copy of ledger.txt (22.8 MB for
 * share.xyz), which nothing reads and every run writes again, is also left
 * out of the artifact.
 */
const ignored = (path) => spawnSync("git", ["check-ignore", "-q", "--no-index", path], { cwd: repoRoot }).status === 0;
check("capture/sites/<name>/ is ignored, every file in it",
  ["ledger.json", "capture/ledger.txt", "site/document.json", "capture/routes/page_home.json", "assets/pictures/a.png"].every((f) => ignored(`capture/sites/example/${f}`)) && !ignored("capture/site/capture/capture-site.mjs"));
/* One page per template, of the pages given too: the first of each taken, the template kept for the converter to link the rest to it. */
{
  const tp = plan({ url: "https://standin.example/", name: "standin", pages: "/, /burned/STANDIN0MINT0ADDRESS01, /burned/STANDIN0MINT0ADDRESS02, /burned/STANDIN0MINT0ADDRESS03, /devs/STANDIN0DEV0ADDRESS01", root });
  check("pages of one template given are captured once, the template kept", tp.captures.length === 3 && tp.routes.templates?.length === 1 && tp.routes.templates[0].pattern === "/burned/:id" && tp.routes.templates[0].ids.length === 3 && tp.routes.pages.some((x) => x.id === tp.routes.templates[0].representative), JSON.stringify({ pages: tp.routes.pages.map((x) => x.path), templates: tp.routes.templates }));
}
/* A still screen is read once: nothing pressed, no behaviours driven; the pages run a few at a time; Look only, no presses from the workflow's own switch. */
{
  const sp = plan({ url: "https://standin.example/", name: "standin", pages: "/, /preview.html?still=1&screen=lobby", root });
  const [home, screen] = sp.captures;
  check("a still screen (?still=1) is read once: no --states, no --behaviours", !screen.args.includes("--states") && !screen.args.includes("--behaviours") && screen.args.includes("--network") && home.args.includes("--states") && home.args.includes("--behaviours"));
  const lp = plan({ url: "https://standin.example/", name: "standin", pages: "/preview.html?screen=*", root });
  const { expandStars } = await import("./capture-site.mjs");
  expandStars(lp, () => ["lobby", "duel"]);
  check("a screen list's pages are read once too, even without ?still=1", lp.captures.length === 2 && lp.captures.every((c) => !c.args.includes("--states") && !c.args.includes("--behaviours")));
  check("the pages run three at a time unless told otherwise", sp.jobs === 3 && plan({ url: "https://standin.example/", name: "x", root, jobs: 1 }).jobs === 1);
  check("the workflow has Look only, no presses, and passes it as --look-only", /\n\s+look:\s*\n(\s+.*\n)*?\s+type: boolean/.test(y) && /IN_LOOK: \$\{\{ inputs\.look \}\}/.test(y) && /"\$IN_LOOK" = "true" \] && echo --look-only/.test(y));
}
check("ledger.json is left out of the artifact", /rm -f "?capture\/sites\/\$NAME\/ledger\.json/.test(y) && y.indexOf("ledger.json\"") < y.indexOf("upload-artifact"));

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed` : "\nall green");
process.exit(failed ? 1 : 0);

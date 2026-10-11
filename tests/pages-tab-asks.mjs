#!/usr/bin/env node
/**
 * THE PAGES TAB'S SITE NAME, DESCRIPTION, PAGE NAMES AND ROUTES REACH THE CODE.
 *
 * Audit 2026-10-11 (pages-tab-edits-never-published): on PonsStars J typed a
 * Site name and a Description in the Pages tab and watched the link preview
 * change, renamed a page and changed its route, and pressed Publish, which
 * said "Published". The live site kept its titles, its link preview and its
 * addresses: the style layer cannot write a <title>, a meta description or
 * a route, and no polio/NEXT.md line asked a code chat to. Now each is a
 * line: the site's name and description once he types them, a page the
 * code has once its name or route differs from what it was before he first
 * changed it (the store keeps that as `came`). Run on the saved PST board's
 * document (no browser):
 *
 *   node tests/pages-tab-asks.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, src/features/studio/publishAsks.ts, src/features/studio/board/store/board.ts, src/features/studio/board/store/model.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/PagesPanel.tsx
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const read = (f) => readFileSync(join(here, "..", f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const says = (xs) => xs.map((i) => `${i.key}: ${i.says}`).join(" | ");

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const coded = new Set(source.files.map((f) => f.pageId));
const base = { nodes: doc.nodes, pages: doc.pages, format: {}, switches: [], coded, effect: () => null, site: doc.brief };
const profile = doc.pages.find((p) => p.path === "/profile");
const withPage = (patch) => doc.pages.map((p) => (p.id === profile.id ? { ...p, ...patch } : p));

/* 1. What codeAsks makes of them. */
check("The saved PST board, untouched (no name typed, no page changed), asks for nothing", A.codeAsks(base).length === 0, says(A.codeAsks(base)));
const head = A.codeAsks({ ...base, site: { name: "PonsStars", description: "One-on-one trading duels on Solana coins." } });
const nm = head.find((i) => i.key.startsWith("build-head-name~")), ds = head.find((i) => i.key.startsWith("build-head-description~"));
check("A Site name asks the code to use it in every page's <title> and og:site_name", head.length === 2 && nm?.hook === null && nm.page === "every page" && /J named the site "PonsStars"/.test(nm.says) && /`<title>`/.test(nm.says) && /og:site_name/.test(nm.says), says(head));
check("A Description asks for the meta description and the link preview's", ds?.page === "every page" && /"One-on-one trading duels on Solana coins\."/.test(ds.says) && /`<meta name="description">`/.test(ds.says) && /og:description/.test(ds.says), ds?.says);
check("…a name of spaces asks nothing", A.codeAsks({ ...base, site: { name: "   ", description: "" } }).length === 0);

const renamed = A.codeAsks({ ...base, pages: withPage({ name: "My profile", came: { name: "Profile", path: "/profile" } }) });
check("A page the code has, renamed, asks for its new name with the old one", renamed.length === 1 && renamed[0].key.startsWith(`build-rename-${profile.id}~`) && /renamed the page "Profile" to "My profile"/.test(renamed[0].says) && renamed[0].page === "My profile", says(renamed));
const moved = A.codeAsks({ ...base, pages: withPage({ path: "/me", came: { name: "Profile", path: "/profile" } }) });
check("…moved, asks to serve it at the new route and update every link to it", moved.length === 1 && moved[0].key.startsWith(`build-move-${profile.id}~`) && /from \/profile to \/me/.test(moved[0].says) && /update every link to it/.test(moved[0].says), says(moved));
check("…both, asks both", A.codeAsks({ ...base, pages: withPage({ name: "Me", path: "/me", came: { name: "Profile", path: "/profile" } }) }).length === 2);
check("…renamed back to what it was, asks nothing", A.codeAsks({ ...base, pages: withPage({ name: "Profile", path: "/profile", came: { name: "Profile", path: "/profile" } }) }).length === 0);
const added = A.codeAsks({ ...base, pages: [...doc.pages, { id: "page_new", name: "Hall", path: "/hall", scroll: "inherit", came: { name: "Page 7", path: "/page-7" } }] });
check("A page added in the Builder is still asked as a new page, not as a rename", added.length === 1 && added[0].key.startsWith("build-page-page_new~") && /"Hall" at \/hall/.test(added[0].says), says(added));

/* 2. The store keeps what a page was before its first rename or move. */
const { useStudio } = await jiti.import(join(here, "..", "src", "features", "studio", "board", "store.ts"));
useStudio.setState({ pages: doc.pages.map((p) => ({ ...p })), nodes: doc.nodes, look: doc.look, brief: { ...doc.brief }, format: { ...doc.format } });
const page = () => useStudio.getState().pages.find((p) => p.id === profile.id);
useStudio.getState().updatePage(profile.id, { prompt: "Who you are." });
useStudio.getState().updatePage(profile.id, { name: "Profile" });
check("A prompt, or a name typed the same, keeps nothing", !page().came, JSON.stringify(page().came));
useStudio.getState().updatePage(profile.id, { name: "My profile" });
check("The first rename keeps its name and route as they were", page().came?.name === "Profile" && page().came?.path === "/profile" && page().name === "My profile", JSON.stringify(page()));
useStudio.getState().updatePage(profile.id, { path: "/me" });
useStudio.getState().updatePage(profile.id, { name: "Me" });
check("…and later changes keep that first record", page().came?.name === "Profile" && page().came?.path === "/profile" && page().path === "/me", JSON.stringify(page()));

/* 3. Publish's asks (`publishAsks.ts#asksNow`), from the store as the Pages tab leaves it. */
const P = await jiti.import(join(here, "..", "src", "features", "studio", "publishAsks.ts"));
useStudio.getState().setBrief({ name: "PonsStars" });
const now = P.asksNow(source);
check("Publish asks for the site's name and the page's new name and route", ["build-head-name", `build-rename-${profile.id}`, `build-move-${profile.id}`].every((k) => now.some((i) => i.key.startsWith(`${k}~`))) && now.length === 3, says(now));

/* 4. Wiring (source read). */
const panel = read("src/features/studio/PagesPanel.tsx");
const buttons = read("src/features/studio/CodeSiteButtons.tsx");
check("The Pages tab edits through the store (setBrief, updatePage), so every rename is kept", /setBrief\(\{ name: e\.target\.value \}\)/.test(panel) && /updatePage\(page\.id, \{ path: e\.target\.value \}\)/.test(panel));
check("The Publish dialog counts again when the site's name or description changes", /const brief = useStudio\(\(s\) => s\.brief\)/.test(buttons) && /\[loop, source, nodes, pages, format, brief\]/.test(buttons));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);

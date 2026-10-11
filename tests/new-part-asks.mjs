#!/usr/bin/env node
/**
 * A PART MADE IN THE BUILDER REACHES THE CODE: A DATA-HOOK AND A NEXT.md LINE.
 *
 * J (2026-10-10): a star drawn as a PST button, linked to the Leaderboard,
 * with a note for the code chat and Tilt on hover, sent nothing on Publish;
 * the shelf audit found every new shelf part on a PST page dropped the same
 * way (polio/shelf-items-audit.md, fix 1). Run on the saved PST board's
 * document (no browser):
 *
 *   node tests/new-part-asks.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, src/features/studio/designRecord.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/codeSend.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const R = await jiti.import(join(here, "..", "src", "features", "studio", "designRecord.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const coded = new Set(source.files.map((f) => f.pageId));
const taken = source.files.flatMap((f) => f.hooks.map((h) => h.value));
const home = doc.pages[0];
const panel = doc.nodes.find((n) => n.pageId === home.id && n.source?.hook?.value === "queue-panel");
const leaderboard = doc.pages.find((p) => /leader/i.test(p.name));

/* The star: drawn, PST yellow, linked, a note, a tilt; a slideshow from the shelf; a whole-site motion. */
const star = { id: "n_star", pageId: home.id, featureId: "box", label: "", content: "Play now", x: panel.x + 40, y: panel.y + 40, w: 120, h: 120,
  colour: { bg: "#e8ff6a", text: "#141414" }, link: { kind: "page", target: leaderboard.id }, prompt: "Make this a button that opens the leaderboard.",
  work: { id: "tilt", inputs: {} }, outline: { cut: "M0.5 0L0.62 0.38L1 0.38L0.69 0.62L0.81 1L0.5 0.76L0.19 1L0.31 0.62L0 0.38Z", closed: true } };
const slides = { id: "n_slides", pageId: home.id, featureId: "carousel", label: "Slideshow", content: "", x: 120, y: 4000, w: 1200, h: 480 };
const motion = { id: "n_btt", pageId: home.id, featureId: "back-to-top", label: "Back to top", content: "", x: 0, y: 4600, w: 420, h: 64 };
const motion2 = { ...motion, id: "n_btt2", pageId: doc.pages[1].id };
const nodes = [...doc.nodes, star, slides, motion, motion2];
const names = { box: "Box", carousel: "Slideshow", "back-to-top": "Back to top" };
const part = (id) => names[id] ?? null;
const fresh = A.freshHooks(nodes, coded, taken, { part, skip: new Set(["back-to-top"]), pages: doc.pages });

check("The saved board untouched names no new parts", Object.keys(A.freshHooks(doc.nodes, coded, taken, { part })).length === 0);
check("Each part made here gets a data-hook, unique against the code's, a plain box named for its page", fresh.n_star === `${home.name.toLowerCase()}-box` && fresh.n_star && fresh.n_slides && !taken.includes(fresh.n_star) && !taken.includes(fresh.n_slides) && fresh.n_star !== fresh.n_slides, JSON.stringify(fresh));
check("A whole-site motion gets no hook of its own", !fresh.n_btt);
const again = A.freshHooks(nodes.map((n) => (fresh[n.id] ? { ...n, hooks: { "data-hook": fresh[n.id] } } : n)), coded, taken, { part, pages: doc.pages });
check("…and once kept on the part, the next Publish names it the same", again.n_star === fresh.n_star && again.n_slides === fresh.n_slides);

const asks = A.codeAsks({ nodes, pages: doc.pages, format: {}, switches: [], coded, fresh, part, siteMotions: new Set(["back-to-top"]),
  effect: (id) => (id === "tilt" ? { name: "Tilt" } : null), lookCss: (n) => (n.colour?.bg ? [`background-color: ${n.colour.bg}`, `color: ${n.colour.text}`] : []) });
const s = asks.find((i) => i.key.startsWith("build-part-n_star~"));
check("The star asks the code to make it, by its hook", s?.hook === fresh.n_star && s.says.includes(`data-hook="${fresh.n_star}"`), s?.says);
check("…saying where it sits (inside the queue panel)", /inside `queue-panel`/.test(s?.says ?? ""));
check("…its words, where it leads, J's note and its tilt", /"Play now"/.test(s?.says) && new RegExp(`${leaderboard.name} page`).test(s?.says) && /J's note for it: "Make this a button/.test(s?.says) && /effects: Tilt/.test(s?.says));
check("…its drawn outline as a clip in its own pixels, and its PST yellow", /clip-path: path\('M60 0L74\.4 45\.6/.test(s?.says) && /background-color: #e8ff6a/.test(s?.says));
const sl = asks.find((i) => i.key.startsWith("build-part-n_slides~"));
check("A slideshow from the shelf asks for itself too", sl?.hook === fresh.n_slides && /a Slideshow/.test(sl.says), sl?.says);
const site = asks.filter((i) => i.key === "build-site-back-to-top");
check("A whole-site motion on every page is asked once, for the site", site.length === 1 && site[0].page === "every page", site.map((x) => x.says).join(" | "));
check("Nothing else is asked of the untouched parts", asks.length === 3, asks.map((i) => i.key).join(", "));

const rec = R.designRecord(nodes, doc.pages, { site: "PST", width: 1440, fresh });
const flat = []; const walk = (p) => { flat.push(p); (p.kids ?? []).forEach(walk); }; rec.pages.forEach((p) => walk(p.tree));
const rs = flat.find((p) => p.hook === fresh.n_star);
check("design/record.json carries the star under its hook, with link, note, effects and outline", rs?.link === `page:${leaderboard.id}` && /leaderboard/.test(rs.prompt) && rs.effects?.[0] === "tilt" && rs.clip?.startsWith("M0.5"), JSON.stringify(rs)?.slice(0, 200));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);

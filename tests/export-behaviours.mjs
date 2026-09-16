/**
 * Build exports a page's behaviours (inventory B22, second piece).
 *
 * Tier-B parts are behaviours: a reading-progress bar, back to top, reveal
 * on scroll, parallax, smooth scrolling, snapping, an opening wipe, a cursor
 * of the site's own, hover tilt, a burst on success. The live page runs
 * them through one shell. The export dropped them whole: `placeNodes` leaves
 * tier B out and no shell was written, so a built site had none of what its
 * page was given. Now each page carries the switches the live page derives,
 * and the export writes one dependency-free shell the page mounts when it
 * has any, with the stylesheet rules the shell needs.
 *
 *   node tests/export-behaviours.mjs
 */
import { readFileSync } from "node:fs";
import { scaffold } from "../src/features/studio/scaffold.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const part = (id, pageId = "p") => ({ id, pageId, featureId: "cta", label: id, x: 0, y: 0, w: 300, h: 100, html: `<div>${id}</div>` });
const behaviours = { progress: true, backToTop: true, reveal: true, parallax: 0.18, smooth: true, snap: "vertical", intro: true, cursor: "spotlight", tilt: true, confetti: true, described: [{ id: "sticky-story", label: "Sticky story" }], any: true };
const files = scaffold({
  name: "Moving", frameWidth: 1440,
  pages: [{ id: "p", name: "Home", path: "/", behaviours }, { id: "q", name: "Still", path: "/still" }],
  palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" },
  tokens: {},
  parts: [part("n1"), part("n2", "q")],
});
const at = (path) => files.find((f) => f.path === path)?.content ?? "";
const shell = at("components/Shell.tsx");
const home = at("app/page.tsx");
const still = at("app/still/page.tsx");
const css = at("app/globals.css");

check("the export writes a shell", shell.length > 0, shell.length ? `${shell.length} bytes` : "no components/Shell.tsx");
check("with no dependency beyond React", shell.length > 0 && !/from "(?!react")/.test(shell.replace(/from "react"/g, "")), (shell.match(/^import .*$/gm) ?? []).join(" | "));
check("it runs the bar, the button, the reveal, the tilt, the cursor, the wipe, the burst and the note", ["progressbar", "Back to top", "IntersectionObserver", "rotateX", "spotlight", "mo-wipe", "mo-burst", "Described, not simulated"].every((w) => shell.includes(w)), ["progressbar", "Back to top", "IntersectionObserver", "rotateX", "spotlight", "mo-wipe", "mo-burst", "Described, not simulated"].filter((w) => !shell.includes(w)).join(", ") || "all");
check("off the window, since a built site has no pinned scroller", /window\.scrollY|scrollY/.test(shell) && /addEventListener\("scroll"/.test(shell));
check("the home page mounts the shell with its switches", /import \{ Shell \} from "@\/components\/Shell"/.test(home) && /<Shell behaviours=\{\{/.test(home) && /"progress":\s*true/.test(home) && /Sticky story/.test(home), home.match(/<Shell[^>]*>/)?.[0]?.slice(0, 160) ?? "no shell on the page");
check("a page with no behaviours mounts none", !/Shell/.test(still));
check("the stylesheet carries the reveal, the snap, the wipe and the burst", /\[data-reveal="on"\] \[data-part\]/.test(css) && /\.is-in/.test(css) && /scroll-snap-align/.test(css) && /@keyframes mo-wipe/.test(css) && /@keyframes mo-burst/.test(css) && /@keyframes slide-up/.test(css), ["data-reveal", "is-in", "scroll-snap-align", "mo-wipe", "mo-burst", "slide-up"].filter((w) => !css.includes(w)).join(", ") || "all");
check("and respects reduced motion for the reveal", /prefers-reduced-motion/.test(css));
const run = readFileSync("src/features/studio/scaffoldRun.ts", "utf8");
check("the build derives each page's behaviours the way the live page does (source read)", /deriveBehaviours\(/.test(run) && /behaviours/.test(run));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

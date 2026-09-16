/**
 * Every setting in the drawer is read by something.
 *
 * A toggle nobody reads is a promise the app cannot keep: Flash new rows,
 * 24-hour clock, Remember open panels and FPS meter had zero readers
 * outside their own definition, Pause feeds on hover had none and the
 * toast left mid-hover anyway, Streamer mode set an attribute that no
 * element wore, Hover ticks gated a cue nothing played, Feed events gated
 * three cues nothing played, and Sidebar and Route tabs drew a nav that
 * every module leaves empty. This holds every core setting to at least
 * one reader, and the ones that were lying to the thing they now do.
 *
 *   node tests/settings-read.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Every source file under src/, read once. */
const walk = (dir, out = []) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|css)$/.test(f)) out.push(p); } return out; };
const SRC = walk("src").map((p) => [p, readFileSync(p, "utf8")]);

const defs = readFileSync("src/core/settings/defs.ts", "utf8");
const ids = [...defs.matchAll(/\bid: "([a-z]+\.[A-Za-z0-9]+)"/g)].map((m) => m[1]);
check("the core settings are there to read", ids.length >= 40, `${ids.length} settings`);
const readers = (id) => SRC.filter(([p, s]) => !p.endsWith("settings/defs.ts") && s.includes(`"${id}"`)).length;
const unread = ids.filter((id) => readers(id) === 0);
check("every core setting has a reader outside its definition", unread.length === 0, unread.length ? `unread: ${unread.join(", ")}` : `${ids.length} read`);

/* The ones that had a reader and still did nothing. */
const has = (file, re) => re.test(bare(file));
const uses = (re) => SRC.filter(([p, s]) => re.test(s)).map(([p]) => p.replace(/^src\//, ""));
const worn = SRC.filter(([p]) => !p.endsWith("globals.css")).reduce((n, [, s]) => n + (s.match(/\bstreamer-hidden\b/g) ?? []).length, 0);
check("Streamer mode hides something: streamer-hidden is worn by at least two identifiers", worn >= 2, `${worn} worn, in ${uses(/\bstreamer-hidden\b/).join(", ")}`);
check("Hover ticks: the button primitive plays the hover cue", has("src/core/ui/button.tsx", /play\("hover"/));
check("Feed events: a feed cue is played somewhere", uses(/play\([^)]*"(newRow|priceUp|priceDown)"/).length >= 1, uses(/play\([^)]*"(newRow|priceUp|priceDown)"/).join(", ") || "nowhere");
check("Pause feeds on hover: the toaster holds a hovered toast", has("src/core/toasts/Toaster.tsx", /behaviour\.pauseOnHover/) && has("src/core/toasts/store.ts", /hold/));
const core = bare("src/core/core-module.ts");
check("Toggle sidebar, the command and ⌘B, are offered only when a module has a nav entry", (core.match(/when: hasNav\b/g) ?? []).length === 2, `${(core.match(/when: hasNav\b/g) ?? []).length} gates`);
check("and the Sidebar and Route tabs settings hide with them", (defs.match(/when: hasNav\b/g) ?? []).length === 2 && /bindNavCount\(\(\) => reg\.nav\.length\)/.test(bare("src/core/registry.ts")), `${(defs.match(/when: hasNav\b/g) ?? []).length} settings gated`);
check("the drawer and the palette honour a setting's when", has("src/core/settings/SettingsDrawer.tsx", /d\.when/) && has("src/core/commands/CommandPalette.tsx", /d\.when/));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

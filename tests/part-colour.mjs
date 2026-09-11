/**
 * A drawn part answers the palette.
 *
 * What comes back from the renderer or the writer has its colours baked in,
 * so a made real part sat on the board ignoring every colour role: select it,
 * change the accent, and nothing happened.
 *
 *   · every baked colour is handed to the role it plainly stands in for;
 *   · the original stays as the fallback, so nothing is lost by trying;
 *   · the board and the built site both do it, and the judge does not;
 *   · and it repaints when the palette changes, not only at creation.
 *
 *   node tests/part-colour.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { inksOf, paintRoles, readInk, roleVars, rolesFor, unpaint } from "../src/features/studio/bodyPaint.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Reading a colour                                                 */
/* ------------------------------------------------------------------ */

check("white is light and has no colour in it", (() => {
  const r = readInk("#ffffff");
  return r.light > 0.98 && r.colour < 0.01;
})());
check("black is dark and has no colour in it", (() => {
  const r = readInk("#000");
  return r.light < 0.02 && r.colour < 0.01;
})());
check("lime has a lot of colour in it", readInk("#8FE04A").colour > 0.4);
check("rgb() is read the same as hex", (() => {
  const a = readInk("rgb(143, 224, 74)");
  const b = readInk("#8FE04A");
  return Math.abs(a.light - b.light) < 0.01;
})());
check("something that is not a colour is not read", readInk("#zz") === null);

/* ------------------------------------------------------------------ */
/* 2. Which role a baked colour stands in for                          */
/* ------------------------------------------------------------------ */

const BODY = `<svg viewBox="0 0 100 40"><rect width="100" height="40" fill="#ffffff"/>`
  + `<path d="M0 0 L100 40" stroke="#8FE04A" stroke-width="6"/>`
  + `<text fill="#111111">a</text><rect fill="#9aa0a6"/></svg>`;

const inks = inksOf(BODY);
check("every baked colour is found", inks.length === 4, inks.map((i) => i.raw).join(" "));
const roles = rolesFor(inks);
check("near white is the ground", roles.get("#ffffff") === "bg");
check("near black is the ink", roles.get("#111111") === "text");
check("the strongest colour is the accent", roles.get("#8fe04a") === "accent");
check("what is left over is muted", roles.get("#9aa0a6") === "muted");

check("only one colour claims the accent", (() => {
  const two = rolesFor(inksOf(`<i fill="#8FE04A"/><i fill="#4A6FE0"/>`));
  return [...two.values()].filter((r) => r === "accent").length === 1;
})());

/* ------------------------------------------------------------------ */
/* 3. Painting is safe both ways                                       */
/* ------------------------------------------------------------------ */

const painted = paintRoles(BODY);
check("a baked colour becomes a role", /var\(--part-accent, #8FE04A\)/.test(painted));
check("the original stays as the fallback, so nothing is lost",
  /var\(--part-bg, #ffffff\)/.test(painted) && /var\(--part-text, #111111\)/.test(painted));
check("painting twice does not nest a role in its own fallback",
  paintRoles(painted) === painted, "not idempotent");
check("it can be taken back to the colours it was drawn in", unpaint(painted) === BODY);
check("a body with no colours at all comes back untouched",
  paintRoles("<svg><path d='M0 0 L1 1'/></svg>") === "<svg><path d='M0 0 L1 1'/></svg>");
check("nothing at all is nothing", paintRoles("") === "");
check("the roles a frame declares are the four", (() => {
  const v = roleVars({ bg: "#fff", text: "#000", accent: "#0f0", muted: "#888" });
  return ["bg", "text", "accent", "muted"].every((r) => v.includes(`--part-${r}:`));
})());

/* ------------------------------------------------------------------ */
/* 4. …and the board and the built site both use it                    */
/* ------------------------------------------------------------------ */

const blocks = readFileSync("src/features/studio/blocks.tsx", "utf8");
check("the board paints the body it renders", /frameDoc\(paintRoles\(node\.code!\.html\)/.test(blocks));
check("and declares the roles from the theme", /roles: roleVars\(/.test(blocks));
check("so it repaints when the palette changes rather than only at creation",
  /\[node\.code, t\.text, t\.bodyFamily, t\.bg, t\.accent, t\.muted\]/.test(blocks));

const snippet = readFileSync("src/features/studio/snippet.ts", "utf8");
check("the frame has somewhere to put them", /:root \{ \$\{opts\.roles \?\? ""\} \}/.test(snippet));

const scaffold = readFileSync("src/features/studio/scaffold.ts", "utf8");
check("the built site paints its bodies too", /paintRoles\(part\.code\.html\)/.test(scaffold));
check("and carries the site's roles into the frame, which cannot see them",
  /const ROLES = /.test(scaffold) && /:root\{\\\$\{ROLES\}\}/.test(scaffold));

const render = readFileSync("src/app/api/studio/render/route.ts", "utf8");
check("judging a body still looks at what came back, not at a repaint", !/paintRoles/.test(render));

/* ------------------------------------------------------------------ */
/* 6. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);

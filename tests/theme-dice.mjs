/**
 * RANDOMIZE THEME (J, 2026-10-09): "a coherent randomize theme generator that
 * changes the entire color palette of the site while understanding contrast
 * from buttons to background and the panels its on".
 *
 * Over 300 seeded rolls each, on a dark site and a light one:
 *   1. every theme swatch gets a new colour, pictures are never in the roll;
 *   2. buttons read at 3:1 or better on the main fill and every panel;
 *   3. words read at 4.5:1 or better on the main fill and every panel;
 *   4. the ink for words on a button reads at 4.5:1 or better on it;
 *   5. panels stand off the main fill, and dark stays dark, light stays light;
 *   6. two rolls differ (it is random), and the six roles follow the roll.
 *
 *   node tests/theme-dice.mjs
 */
import { rollTheme, contrast, parseColor } from "../src/features/studio/look/index.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const site = (main) => [
  { id: "main|a", role: "main", value: main },
  { id: "panels|a", role: "panels", value: "#2a2a35" },
  { id: "panels|b", role: "panels", value: "#353545" },
  { id: "buttons|a", role: "buttons", value: "#f0a040" },
  { id: "buttons|b", role: "buttons", value: "#e07030" },
  { id: "words|a", role: "words", value: "#f5e0b0" },
  { id: "words|b", role: "words", value: "#c0a080" },
  { id: "accent|a", role: "accent", value: "#ff4040" },
  { id: "outline|a", role: "outline", value: "#806040" },
  { id: "shadow|a", role: "shadow", value: "#201008" },
];
const c = (v) => parseColor(v);

for (const [kind, main] of [["dark", "#141018"], ["light", "#f6f2ea"]]) {
  const sw = site(main);
  const bad = { all: [], buttons: [], words: [], ink: [], panels: [], mode: [], six: [] };
  for (let i = 0; i < 300; i++) {
    const r = rollTheme(sw, seeded(i + 1));
    if (sw.some((s) => !r.to.get(s.id))) bad.all.push(i);
    const grounds = [r.to.get("main|a"), r.to.get("panels|a"), r.to.get("panels|b")].map(c);
    for (const b of ["buttons|a", "buttons|b"]) {
      const btn = c(r.to.get(b));
      const worst = Math.min(...grounds.map((g) => contrast(btn, g)));
      if (worst < 3) bad.buttons.push(`${i}:${worst.toFixed(2)}`);
      if (contrast(c(r.onButtons.get(b)), btn) < 4.5) bad.ink.push(i);
    }
    for (const w of ["words|a", "words|b"]) {
      const worst = Math.min(...grounds.map((g) => contrast(c(r.to.get(w)), g)));
      if (worst < 4.5) bad.words.push(`${i}:${worst.toFixed(2)}`);
    }
    if (grounds.slice(1).some((p) => Math.abs(p.l - grounds[0].l) < 0.05)) bad.panels.push(i);
    if ((kind === "light") !== (grounds[0].l > 0.6) || r.light !== (kind === "light")) bad.mode.push(i);
    if (r.palette.text !== r.to.get("words|a") || r.palette.accent !== r.to.get("buttons|a")) bad.six.push(i);
  }
  check(`${kind}: every theme swatch gets a colour`, bad.all.length === 0, bad.all.slice(0, 5).join(" "));
  check(`${kind}: buttons read at 3:1 on the main fill and every panel`, bad.buttons.length === 0, bad.buttons.slice(0, 5).join(" "));
  check(`${kind}: words read at 4.5:1 on the main fill and every panel`, bad.words.length === 0, bad.words.slice(0, 5).join(" "));
  check(`${kind}: words on a button get ink that reads at 4.5:1 on it`, bad.ink.length === 0, bad.ink.slice(0, 5).join(" "));
  check(`${kind}: panels stand off the main fill`, bad.panels.length === 0, bad.panels.slice(0, 5).join(" "));
  check(`${kind}: stays ${kind}`, bad.mode.length === 0, bad.mode.slice(0, 5).join(" "));
  check(`${kind}: the six roles follow the roll`, bad.six.length === 0);
  const a = rollTheme(sw, seeded(7)), b = rollTheme(sw, seeded(8));
  check(`${kind}: two rolls differ`, a.to.get("buttons|a") !== b.to.get("buttons|a"));
}
check("pictures are never in the roll", !rollTheme([{ id: "pictures|a", role: "pictures", value: "#123456" }], seeded(1)).to.size);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

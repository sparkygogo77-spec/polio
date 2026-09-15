/**
 * Every shortcut fires on the key its own hint prints.
 *
 * The cheat sheet was bound to "shift+/" and printed as ⇧/. The matcher
 * compares the browser's own key name, and for punctuation it does not
 * check shift separately, because the browser has already folded shift
 * into the name: shift and the slash key report "?". So "shift+/" fired
 * on a bare "/" and never on "?", and the hint was wrong in three places.
 * This types, for every single-key binding in the app, the character its
 * hint says to press, and asks the matcher whether it would fire.
 *
 *   node tests/shortcut-keys.mjs
 */
import { readFileSync } from "node:fs";
import { comboMatches, parseShortcut } from "../src/core/lib/keys.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* What a US keyboard reports for shift and a punctuation key. */
const SHIFTED = { "/": "?", ",": "<", ".": ">", ";": ":", "'": '"', "[": "{", "]": "}", "\\": "|", "`": "~", "-": "_", "=": "+", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(", "0": ")" };

/* Every `keys: "…"` in the modules that register shortcuts. */
const files = ["src/core/core-module.ts", "src/features/studio/index.ts", "src/features/tour/index.ts", "src/features/tweets/index.ts", "src/features/keys/index.ts", "src/features/builds/index.ts", "src/features/showcase/index.ts"];
const bindings = [];
for (const f of files) {
  let src = "";
  try { src = readFileSync(f, "utf8"); } catch { continue; }
  for (const m of src.matchAll(/keys: "([^"]+)"/g)) bindings.push({ file: f.split("/").pop(), keys: m[1] });
}
check("there are shortcuts to check", bindings.length >= 20, `${bindings.length} bindings`);

/* What the browser calls the physical key: never the character itself. */
const CODES = { "/": "Slash", ",": "Comma", ".": "Period", ";": "Semicolon", "'": "Quote", "[": "BracketLeft", "]": "BracketRight", "\\": "Backslash", "`": "Backquote", "-": "Minus", "=": "Equal", " ": "Space", enter: "Enter", escape: "Escape", tab: "Tab", backspace: "Backspace", delete: "Delete", arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight" };

/* The event a person makes by pressing what the hint shows. */
const pressOf = (combo) => {
  const shifted = combo.shift && SHIFTED[combo.key];
  const key = shifted ? SHIFTED[combo.key] : combo.key;
  const code = /^[a-z]$/.test(combo.key) ? `Key${combo.key.toUpperCase()}` : /^[0-9]$/.test(combo.key) ? `Digit${combo.key}` : (CODES[combo.key] ?? combo.key);
  return { key, code, shiftKey: !!combo.shift, metaKey: !!combo.meta || (!!combo.mod && process.platform === "darwin"), ctrlKey: !!combo.ctrl || (!!combo.mod && process.platform !== "darwin"), altKey: !!combo.alt };
};

const wrong = [];
let single = 0;
for (const b of bindings) {
  const combos = parseShortcut(b.keys);
  if (combos.length !== 1) continue; // a chord like "g b" is a sequence, matched one key at a time
  single++;
  const c = combos[0];
  if (!comboMatches(c, pressOf(c))) wrong.push(`${b.file} ${JSON.stringify(b.keys)} does not fire on ${JSON.stringify(pressOf(c).key)}`);
}
check("every single-key shortcut fires on the key its hint names", wrong.length === 0, `${single} checked${wrong.length ? `; ${wrong.join("; ")}` : ""}`);

/* And no two bindings claim one key, which is how "?" came to mean two things. */
const byKey = new Map();
for (const b of bindings) {
  const combos = parseShortcut(b.keys);
  if (combos.length !== 1) continue;
  const c = combos[0];
  // Shift is part of the printed key for punctuation and a modifier for letters.
  const k = pressOf(c).key + (c.shift && /^[a-z0-9]$/.test(c.key) ? "+shift" : "") + (c.mod ? "+mod" : "") + (c.alt ? "+alt" : "");
  byKey.set(k, [...(byKey.get(k) ?? []), `${b.file}:${b.keys}`]);
}
const clashes = [...byKey].filter(([, who]) => new Set(who).size > 1);
check("no key is claimed by two modules", clashes.length === 0, clashes.map(([k, who]) => `${k}: ${[...new Set(who)].join(" and ")}`).join("; "));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

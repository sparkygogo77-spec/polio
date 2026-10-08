/**
 * SOUNDS, KEYS, NUMBER FORMATS AND LINES ARE SLOTS TOO (kit/BUILDER-RULES.md, rule 28).
 *
 * The kit's game parts (kit/starter/parts, rule 30) read four new slot kinds
 * when they run: sound, key, format and line. The Builder edits each with its
 * own control in the part's Settings (`SlotKindEditor`), and what it writes
 * must be what the site's `slots.js` reads. Also: the shared state names
 * (rule 29) travel with the rules every export carries.
 *
 * Covers: src/features/studio/slotKinds.ts, src/features/studio/StyleLayerPanel.tsx, src/features/studio/kitRun.ts, kit/starter/parts/slots.js
 *
 *   node tests/slot-kinds.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const b = await import("../src/features/studio/slotKinds.ts");
const site = await import("../kit/starter/parts/slots.js");
const { partSlots } = await import("../src/features/studio/send-out/styleLayer.ts");
const { KIT_RULES } = await import("../src/features/studio/kitFiles.ts");
const kitJson = JSON.parse(readFileSync("kit/builder.json", "utf8"));

const same = (a, c) => JSON.stringify(a) === JSON.stringify(c);
const sounds = ["none", "beep", "beep 660 0.4", '"sounds/tick.mp3" 0.5', "wobble"];
check("the builder reads a sound the way the site does", sounds.every((v) => same(b.parseSound(v), site.parseSound(v))));
check("and writes back what it read", ["beep 660 0.4", '"sounds/tick.mp3" 0.5', "none"].every((v) => b.writeSound(b.parseSound(v)) === v));
check("a key: quoted, none, or not a key", same(["q", "", null].map((x) => x), ['"q"', "none", "q"].map(b.parseKey)) && ['"q"', "none"].every((v) => site.parseKey(v) === b.parseKey(v)) && b.writeKey("ArrowUp") === '"ArrowUp"');
const formats = ['"+0.00"', '"$0,0.00"', '"0.0%"', '"0"'];
check("a number format writes numbers the same in both", formats.every((f) => [12.4, -1234.5, 0.001].every((n) => same(b.formatNumber(n, f), site.formatNumber(n, f)))), formats.map((f) => b.formatNumber(-1234.5, f).text).join(" "));
check("a number format round-trips through the editor", formats.every((f) => b.writeFormat(b.parseFormat(f)) === f));
check("a line: width and style, or none", same(b.parseLine("2px dashed"), site.parseLine("2px dashed")) && b.parseLine("2px wavy") === null && b.writeLine({ width: 3, style: "dotted" }) === "3px dotted" && b.writeLine({ width: 2, style: "none" }) === "none");

/* The kit's slots reach a part's Settings with their kind. */
const source = { files: [{ file: "starter/tokens.css", vars: [{ name: "--key-buy-10", value: '"1"', file: "starter/tokens.css", line: 40, token: true }] }], kit: kitJson };
const key = partSlots("buy-10-button", source);
check("a key slot shows in its button's Settings, as a key", key[0]?.kind === "key" && key[0]?.label === "Shortcut key", JSON.stringify(key));
const panel = readFileSync("src/features/studio/StyleLayerPanel.tsx", "utf8");
check("Settings draws the four kinds with their own control (source read)", /isScriptSlotKind\(v\.kind\) \? \(\s*<SlotKindEditor/.test(panel) && ["sound", "key", "format", "line"].every((k) => panel.includes(`data-slot-kind="${k}"`)));
check("the kinds are slot kinds the builder knows", /"sound" \| "key" \| "format" \| "line"/.test(readFileSync("src/features/studio/kitRun.ts", "utf8")));

/* Rule 27: the shared state names go with every export. */
check("the shared state names travel with the rules", same(KIT_RULES.stateNames?.names, ["idle", "loading", "live", "warning", "done", "error"]));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

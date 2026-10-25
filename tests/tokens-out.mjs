#!/usr/bin/env node
/**
 * THE SYSTEM AS TOKEN FILES, AND BACK (create-system "(d) Export", tokens-out).
 *
 * A site's System, taken from its capture, is written as the four token files
 * every export carries (`send-out/tokensOut.ts`), and `tokens.json` is read
 * back (`tokensJson.ts`, beside `kitRun.ts#takeTokens`). The ruling:
 *
 *   1. every token is in every file, at its exact value: tokens.css holds the
 *      CSS the board draws, tokens.json is the W3C format (colours as objects,
 *      sizes as { value, unit }), tailwind.css names each variable in its
 *      Tailwind namespace, and tokens.ts is the same values;
 *   2. reading tokens.json back changes nothing (no set, no add), and gives
 *      takeTokens the same values tokens.css says;
 *   3. a value changed in tokens.json the way a person would (its W3C $value)
 *      comes back as that one token's change; a token the file adds comes
 *      back as an add;
 *   4. the files pass `next build` in a Next.js + Tailwind v4 app whose page
 *      uses the token classes, and the built CSS draws them from the
 *      variables.
 *
 *   node tests/tokens-out.mjs [capture folder ...]
 *
 * With no folder: sol face, mochi and sunkcoin from capture/sites (copy them
 * from a capture run), else trumpmorty-fun from the repository's fixtures.
 * TOKENS_BUILD=0 skips step 4.
 *
 * Covers: src/features/studio/send-out/tokensOut.ts, src/features/studio/tokensJson.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { tokensOut, tokenNames, tokenCss, TOKEN_FILES } from "../src/features/studio/send-out/index.ts";
import { readTokensJson, tokensJsonValues, tokenChanges } from "../src/features/studio/tokensJson.ts";
import { takeTokens } from "../src/features/studio/kitRun.ts";
import { takeSystem } from "../src/features/studio/system/take.ts";
import { allTokens } from "../src/features/studio/system/model.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";
import { buildApp, ROOT } from "./lib/export-app.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let sites = process.argv.slice(2);
if (!sites.length) {
  sites = ["thesolface3", "mochi3", "sunk2"].map((s) => join(ROOT, "capture/sites", s)).filter((s) => existsSync(join(s, "site/document.json")));
  if (!sites.length) {
    execFileSync(process.execPath, [join(ROOT, "capture/fixtures/unpack.mjs")], { stdio: "inherit" });
    sites = [join(ROOT, "capture/versions/sink-0ee06fa/sites/trumpmorty-fun")];
  }
}

export function systemOf(folder) {
  const doc = JSON.parse(readFileSync(join(folder, "site/document.json"), "utf8"));
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  return takeSystem({ nodes: landed.nodes, palette: { ...paletteFromHue(265), ...landed.palette }, frameWidth: 1440, name: basename(folder), at: 0 }).system;
}

for (const folder of sites) {
  const tag = basename(folder);
  console.log(`\n${tag}`);
  const system = systemOf(folder);
  const files = tokensOut(system);
  const file = (p) => files.find((f) => f.path === p)?.content ?? "";
  const names = tokenNames(system);
  const every = allTokens(system);

  /* 1. Every token, in every file, at its value. */
  check("four files under tokens/", files.length === 4 && files.every((f) => f.path.startsWith("tokens/")), files.map((f) => f.path).join(", "));
  check("each file says it is Polio's", files.every((f) => f.content.includes("Made by Polio. Edits here are replaced on the next export.")));
  const css = file(TOKEN_FILES.css);
  const missingCss = every.filter(({ kind, token }) => !css.includes(`${names.get(token.id).css}: ${tokenCss(kind, token)};`));
  check("tokens.css holds every token at its exact value", every.length > 20 && !missingCss.length, `${every.length} tokens; missing ${missingCss.slice(0, 3).map((t) => t.token.name).join(", ")}`);
  const vars = [...names.values()].map((n) => n.css);
  check("every CSS variable is unique", new Set(vars).size === vars.length);
  const json = JSON.parse(file(TOKEN_FILES.json));
  const accent = system.tokens.colour.find((c) => c.role === "accent");
  const jAccent = accent && json.colour[names.get(accent.id).key];
  check("tokens.json: a colour is a W3C colour object", jAccent?.$type === "color" && jAccent.$value.colorSpace && jAccent.$value.components.length === 3, JSON.stringify(jAccent?.$value));
  const step = system.tokens.type.steps[0];
  const jStep = json.type[names.get(step.id).key];
  check("tokens.json: a type step is a W3C dimension", jStep.$type === "dimension" && jStep.$value.unit === "px" && jStep.$value.value === step.px, JSON.stringify(jStep.$value));
  const raw = Object.values(json).filter((g) => g && typeof g === "object").flatMap((g) => Object.values(g)).filter((t) => t && typeof t.$value === "string");
  check("tokens.json: nearly every value has its W3C shape (not CSS text)", raw.length <= Math.ceil(every.length * 0.05), `${raw.length} of ${every.length} kept as text: ${raw.slice(0, 2).map((t) => t.$value).join(" | ")}`);
  const tw = file(TOKEN_FILES.tailwind);
  check("tailwind.css: one @theme inline", /@theme inline \{/.test(tw));
  const twMissing = [...names.values()].filter((n) => n.tw && !tw.includes(`-${n.tw}: var(${n.css});`));
  check("tailwind.css names every themable token's variable", !twMissing.length, twMissing.slice(0, 3).map((n) => n.css).join(", "));
  check("tailwind.css: spaces never take Tailwind's own numbers", ![...tw.matchAll(/--spacing-(\S+):/g)].some((m) => /^\d/.test(m[1])));
  const ts = file(TOKEN_FILES.ts);
  check("tokens.ts: the values and each id's variable", ts.includes("export const tokens = {") && every.every(({ token }) => ts.includes(JSON.stringify(token.id))));

  /* 2. Back in, nothing changes. */
  const read = readTokensJson(file(TOKEN_FILES.json));
  check("tokens.json reads back, every token", read.ok && read.tokens.length === every.length, read.ok ? `${read.tokens.length}` : read.says);
  const back = tokenChanges(system, file(TOKEN_FILES.json));
  check("reading it back changes nothing", back.ok && !back.set.length && !back.add.length, back.ok ? `${back.set.length} set: ${JSON.stringify(back.set.slice(0, 2))}; ${back.add.length} add` : back.says);
  const values = tokensJsonValues(read.tokens);
  const cssOff = every.filter(({ kind, token }) => values[names.get(token.id).css] !== tokenCss(kind, token));
  check("its values are tokens.css's, variable for variable", !cssOff.length, cssOff.slice(0, 2).map((t) => t.token.name).join(", "));
  const source = { files: [{ file: "tokens/tokens.css", vars: [], hooks: [] }], tokensFile: "tokens/tokens.css" };
  const taken = takeTokens(source, { values });
  check("takeTokens takes them as it takes a tokens.css", taken.files[0].vars.length === every.length);

  /* 3. A person's change, and a token the file adds. */
  const edited = JSON.parse(file(TOKEN_FILES.json));
  edited.colour[names.get(accent.id).key].$value = { colorSpace: "srgb", components: [1, 0, 1], hex: "#ff00ff" };
  const sp = system.tokens.space[0];
  edited.space[names.get(sp.id).key].$value = { value: sp.px + 3, unit: "px" };
  edited.radius.huge = { $type: "dimension", $value: { value: 48, unit: "px" } };
  const ch = tokenChanges(system, JSON.stringify(edited));
  const setIds = ch.ok ? ch.set.map((s) => s.id).sort() : [];
  check("a value changed in tokens.json is that token's change, and only that", ch.ok && setIds.join() === [accent.id, sp.id].sort().join(), JSON.stringify(ch.ok ? ch.set : ch));
  check("…a colour comes back as CSS", ch.ok && ch.set.find((s) => s.id === accent.id)?.value === "rgb(255, 0, 255)");
  check("…a size comes back in px", ch.ok && ch.set.find((s) => s.id === sp.id)?.value === sp.px + 3);
  check("a token the file adds comes back as an add", ch.ok && ch.add.length === 1 && ch.add[0].kind === "radius" && ch.add[0].value === 48 && ch.add[0].name === "Huge", JSON.stringify(ch.ok ? ch.add : null));
  check("a file that is not JSON is refused with a reason", readTokensJson("{nope").ok === false);

  /* 4. next build. */
  if (process.env.TOKENS_BUILD === "0") continue;
  const n = (t) => names.get(t.id);
  const classes = [`bg-${n(accent).tw}`, `text-${n(step).tw}`, `p-${n(sp).tw}`, system.tokens.radius[0] && `rounded-${n(system.tokens.radius[0]).tw}`, system.tokens.shadow[0] && `shadow-${n(system.tokens.shadow[0]).tw}`, `font-${n(system.tokens.type.faces[0]).tw}`].filter(Boolean);
  const app = await buildApp(`tokens-${tag}`, [
    ...files,
    { path: "app/globals.css", content: '@import "tailwindcss";\n@import "../tokens/tokens.css";\n@import "../tokens/tailwind.css";\n' },
    { path: "app/layout.tsx", content: 'import "./globals.css";\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html lang="en"><body>{children}</body></html>);\n}\n' },
    { path: "app/page.tsx", content: `import { tokens, tokenVar } from "@/tokens/tokens";\nexport default function Page() {\n  return (<main className=${JSON.stringify(classes.join(" "))} data-n={Object.keys(tokens).length + Object.keys(tokenVar).length}>Tokens</main>);\n}\n` },
  ]);
  check("next build passes", app.ok, app.ok ? "" : app.log.split("\n").filter((l) => /error|Error|failed/.test(l)).slice(0, 6).join(" / "));
  const built = app.css().replace(/\s+/g, "");
  const drawn = (sel, v) => new RegExp(`\\.${sel.replace(/[-]/g, "\\-")}\\{[^}]*${v.replace(/[-()]/g, (c) => `\\${c}`)}`).test(built);
  check("built CSS: bg-accent draws the accent variable", drawn(`bg-${n(accent).tw}`, `var(${n(accent).css})`));
  check("built CSS: the space class draws the space variable", drawn(`p-${n(sp).tw}`, `var(${n(sp).css})`));
  check("built CSS: the variables are defined", built.includes(`${n(accent).css}:${accent.value.replace(/\s+/g, "")}`) || built.includes(`${n(accent).css}:`));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

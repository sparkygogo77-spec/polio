#!/usr/bin/env node
// Adds one of the kit's game parts (starter/parts.json, BUILDER-RULES.md rule 28) to a site:
// copies its stylesheet and scripts into the site's parts/ folder (next to its tokens file), adds
// its token blocks and slots, and prints the markup to paste and the call to make. No dependencies.
//
//   node tools/add-part.mjs <part> <site folder>     (the folder holds the site's builder.json)
//   npm run kit:part -- scoreboard ../my-site
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const writeJson = (f, v) => writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

export function addPart(name, site) {
  const kit = readJson(join(KIT, 'builder.json'));
  const partsFile = join(KIT, kit.parts);
  const partsBase = dirname(partsFile);
  const parts = readJson(partsFile);
  const part = parts.parts.find((p) => p.name === name);
  if (!part) throw new Error(`no part "${name}" (there are: ${parts.parts.map((p) => p.name).join(', ')})`);
  const siteManifestFile = join(resolve(site), 'builder.json');
  if (!existsSync(siteManifestFile)) throw new Error(`${site} has no builder.json`);
  const manifest = readJson(siteManifestFile);
  const tokensFile = join(resolve(site), manifest.tokens);
  const web = dirname(tokensFile);
  const done = [];

  // Files: the part's own, the shared slot readers, and the hook helpers if the site has none there.
  for (const f of [...part.css, ...part.js, ...parts.shared.js]) {
    const to = join(web, f);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(partsBase, f), to);
    done.push(`copied ${relative(resolve(site), to)}`);
  }
  const helpers = join(web, 'js/hooks.js');
  if (!existsSync(helpers)) {
    mkdirSync(dirname(helpers), { recursive: true });
    copyFileSync(join(partsBase, 'js/hooks.js'), helpers);
    manifest.scripts ??= {};
    manifest.scripts.helperFiles = [...new Set([...(manifest.scripts.helperFiles ?? []), relative(resolve(site), helpers).split('\\').join('/')])];
    done.push(`copied ${relative(resolve(site), helpers)} (the parts import their hook helpers from there)`);
  }

  // Tokens: the part's block (and the shared one), once.
  const kitTokens = readFileSync(join(KIT, kit.tokens), 'utf8');
  let siteTokens = readFileSync(tokensFile, 'utf8');
  const blocks = [];
  for (const t of [...parts.shared.tokens, name]) {
    const m = new RegExp(`/\\* part: ${t} \\*/[\\s\\S]*?/\\* part end \\*/`).exec(kitTokens);
    if (m && !siteTokens.includes(`/* part: ${t} */`)) blocks.push(`  ${m[0]}`);
  }
  if (blocks.length) {
    siteTokens = `${siteTokens.trimEnd()}\n\n/* Kit part tokens (npm run kit:part). */\n:root {\n${blocks.join('\n')}\n}\n`;
    writeFileSync(tokensFile, siteTokens);
    done.push(`added ${blocks.length} token block(s) to ${manifest.tokens}`);
  }

  // Slots and positions: those whose hook is in the part's markup.
  const page = readFileSync(join(partsBase, parts.page), 'utf8');
  const snippet = new RegExp(`<!-- part: ${name} -->\\n([\\s\\S]*?)<!-- part end -->`).exec(page)?.[1] ?? '';
  const hooks = new Set([...snippet.matchAll(/data-hook="([a-z0-9-]+)"/g)].map((m) => m[1]));
  manifest.rules ??= {};
  const have = new Set((manifest.rules.slots ?? []).map((s) => s.token));
  const slots = (kit.rules.slots ?? []).filter((s) => hooks.has(s.hook) && !have.has(s.token));
  if (slots.length) { manifest.rules.slots = [...(manifest.rules.slots ?? []), ...slots]; done.push(`added ${slots.length} slot(s) to builder.json`); }
  if (part.positions?.length) {
    manifest.rules.scriptPositions ??= { properties: ['left', 'top'], values: [] };
    manifest.rules.scriptPositions.values = [...new Set([...(manifest.rules.scriptPositions.values ?? []), ...part.positions])];
  }
  writeJson(siteManifestFile, manifest);

  const links = part.css.map((f) => `<link rel="stylesheet" href="${f}">`).join('\n');
  return { done, snippet, links, use: part.use, states: part.states, js: part.js };
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const [name, site] = process.argv.slice(2);
  if (!name || !site) {
    console.log('usage: npm run kit:part -- <part> <site folder>');
    process.exit(2);
  }
  try {
    const r = addPart(name, site);
    for (const d of r.done) console.log(`  ✓ ${d}`);
    console.log(`\nNext, by hand:\n1. In the page's <head>, before the style layer:\n${r.links}\n2. Paste this where the part goes:\n${r.snippet}`);
    console.log(`3. In the page's script: import from './${r.js[0]}' (path from the page) and call ${r.use}.`);
    console.log(`4. Give the "${name}" panel a state (${r.states.join(', ')}) in every scene of that page, then npm run kit:hooks and npm run kit:check.`);
  } catch (e) {
    console.log(`kit:part failed: ${e.message}`);
    process.exit(1);
  }
}

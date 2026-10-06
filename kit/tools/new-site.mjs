#!/usr/bin/env node
// Starts a new builder-ready site: copies this kit into an empty folder that becomes the new repo's
// root, names it, and runs the contract check there. No dependencies.
//
//   node tools/new-site.mjs <folder> [--name "Site name"]
//   npm run kit:new -- ../my-site --name "My site"
//
// The copy holds everything a code chat and the builder need on day one: the contract and the
// instructions a code chat reads (CLAUDE.md, AGENTS.md, BUILDER-CONTRACT.md, PIPELINE.md),
// builder.json, the checker, the starter site, the tests and the GitHub workflow.
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './kit-check.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Kit files a new site does not need: PST's own retrofit notes and anything installed or made locally.
// samples.json and scenes.json here are PonsStars' own (its root builder.json points at them); the
// starter's are starter/samples.json and starter/scenes.json.
const SKIP = new Set(['RETROFIT.md', 'node_modules', '.git', 'samples.json', 'scenes.json']);

export function newSite(target, { name } = {}) {
  const to = resolve(target);
  if (existsSync(to) && readdirSync(to).length) throw new Error(`${target} is not empty`);
  for (const entry of readdirSync(KIT)) if (!SKIP.has(entry)) cpSync(join(KIT, entry), join(to, entry), { recursive: true });
  const siteName = name ?? 'New site';
  const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-site';
  const edit = (file, fn) => writeFileSync(join(to, file), fn(readFileSync(join(to, file), 'utf8')));
  edit('builder.json', (s) => `${JSON.stringify({ ...JSON.parse(s), name: siteName }, null, 2)}\n`);
  edit('package.json', (s) => `${JSON.stringify({ ...JSON.parse(s), name: slug, description: `${siteName}: a builder-ready site (see PIPELINE.md).` }, null, 2)}\n`);
  edit('README.md', (s) => s.replace(/, see `RETROFIT.md`\)/, ')').replace(/^\| `RETROFIT.md` .*\n/m, '').replace(/^# .*/, `# ${siteName}\n\nBuilt on the builder-ready starter kit.`));
  return check(join(to, 'builder.json'));
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--name');
  const name = at >= 0 ? args[at + 1] : undefined;
  const target = args.find((a, i) => !a.startsWith('--') && i !== at + 1);
  if (!target) {
    console.log('usage: npm run kit:new -- <empty folder> [--name "Site name"]');
    process.exit(2);
  }
  try {
    const { problems, map } = newSite(target, { name });
    for (const p of problems) console.log(`  ✗ ${p}`);
    if (problems.length) throw new Error(`the copy fails kit:check (${problems.length} problem(s))`);
    console.log(`kit:new made ${target}: ${Object.keys(map.pages).length} pages, ${Object.keys(map.hooks).length} hooks, kit:check passed.`);
    console.log(`Next: cd ${target} && git init && git add -A && git commit -m "Start from the builder kit", then push it as a new repo.`);
  } catch (e) {
    console.log(`kit:new failed: ${e.message}`);
    process.exit(1);
  }
}

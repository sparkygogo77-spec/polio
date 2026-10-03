#!/usr/bin/env node
// Compares this branch with the branch it will merge into, for the two kinds of change a
// builder-ready repo gets. No dependencies besides git.
//
//   node tools/kit-diff.mjs [builder.json] --base <ref> [--style-only] [--allow-removed] [--changes <file>]
//   npm run kit:diff -- --base origin/main
//   npm run kit:diff -- --base origin/main --style-only
//
// A code change (the default): no hook the base branch had may disappear, because the design's
// rules for it would silently stop applying. Lists added and removed hooks, and hooks whose element
// kind changed. --allow-removed accepts removals the pull request explains (say which, so J can move
// their style).
// A hook J deleted in the builder is listed as removed in design/HOOK-CHANGES.json, which the
// builder's design branch carries (at the repository's root, or next to builder.json). A code
// change that drops a hook listed there passes; dropping any other hook still fails. --changes
// names that file when it lives elsewhere.
// A style change from the builder (--style-only): only the design's files may change (the style
// layer, the tokens, the files made from them, builder.json's "styleAssets" folder if it has
// one, and the design record under design/), no token may disappear, and no hook may change at all.
// Both also run the full contract check.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { check } from './kit-check.mjs';
import { sayFrame, stateFrames } from './state-frames.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// The hooks the builder's design deleted on purpose, from design/HOOK-CHANGES.json.
export function designRemoved(dir, changesPath) {
  let root = dir;
  try { root = git(dir, 'rev-parse', '--show-toplevel').trim(); } catch { /* not a repository */ }
  const at = changesPath ? [resolve(changesPath)] : [resolve(root, 'design/HOOK-CHANGES.json'), resolve(dir, 'design/HOOK-CHANGES.json')];
  const file = at.find((f) => existsSync(f));
  if (!file) return { file: null, hooks: [] };
  const json = JSON.parse(readFileSync(file, 'utf8'));
  return { file, hooks: (json.removed ?? []).map((r) => (typeof r === 'string' ? r : r?.hook)).filter(Boolean) };
}

export function diff(manifestPath, { base, styleOnly = false, allowRemoved = false, changes = null }) {
  const dir = dirname(resolve(manifestPath));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const problems = [];
  let from = base;
  try { from = git(dir, 'merge-base', base, 'HEAD').trim(); } catch { /* not a branch of HEAD; compare with the ref itself */ }

  const { problems: contract, map } = check(manifestPath);
  problems.push(...contract);
  let before = { hooks: {}, tokens: {} };
  try { before = JSON.parse(git(dir, 'show', `${from}:./${manifest.hooks}`)); } catch { /* new site: nothing to lose */ }
  const now = map ?? JSON.parse(readFileSync(resolve(dir, manifest.hooks), 'utf8'));

  const removed = Object.keys(before.hooks).filter((h) => !now.hooks[h]);
  const added = Object.keys(now.hooks).filter((h) => !before.hooks[h]);
  const changed = Object.keys(now.hooks).filter((h) => before.hooks[h] && before.hooks[h].element !== now.hooks[h].element);
  const lostTokens = Object.keys(before.tokens ?? {}).filter((t) => !(now.tokens ?? {})[t]);

  const listed = new Set(styleOnly ? [] : designRemoved(dir, changes).hooks);
  if (styleOnly) {
    const owned = [manifest.styleLayer, manifest.tokens, manifest.tokensModule, manifest.hooks].filter(Boolean);
    const assets = manifest.styleAssets ? `${manifest.styleAssets.replace(/\/$/, '')}/` : null;
    const files = git(dir, 'diff', '--relative', '--name-only', from).split('\n').filter(Boolean);
    files.push(...git(dir, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean));
    /* The builder's design record (design/record.json, DESIGN-RECORD.md) and the rest of design/ ride with a style change. */
    const design = (f) => f.startsWith('design/') || f.includes('/design/');
    for (const f of files) if (!owned.includes(f) && !(assets && f.startsWith(assets)) && !design(f)) problems.push(`${f} changed, but a style change may only touch ${[...owned, ...(assets ? [assets] : [])].join(', ')}`);
    for (const h of [...removed, ...added]) problems.push(`hook "${h}" was ${removed.includes(h) ? 'removed' : 'added'} (a style change never changes hooks)`);
    for (const t of lostTokens) problems.push(`token ${t} was removed (a style change may change a token's value, not drop it)`);
  } else {
    if (!allowRemoved) for (const h of removed.filter((x) => !listed.has(x))) problems.push(`hook "${h}" was removed; the design's rules for it would stop applying (keep it, or pass --allow-removed and say so in the pull request)`);
  }
  // A new design record (design/record.json changed): every state stays in its frame (BUILDER-RULES.md).
  let root = dir;
  try { root = git(dir, 'rev-parse', '--show-toplevel').trim(); } catch { /* not a repository */ }
  const recordFile = [resolve(root, 'design/record.json'), resolve(dir, 'design/record.json')].find((f) => existsSync(f));
  if (recordFile) {
    let fresh = true;
    try { fresh = git(root, 'diff', '--name-only', from, '--', recordFile).trim() !== '' || git(root, 'ls-files', '--others', '--exclude-standard', '--', recordFile).trim() !== ''; } catch { /* no history: check it */ }
    if (fresh) for (const x of stateFrames(JSON.parse(readFileSync(recordFile, 'utf8')))) problems.push(`design/record.json: ${sayFrame(x)}`);
  }
  const deleted = removed.filter((h) => listed.has(h));
  return { problems, removed, added, changed, lostTokens, from, deleted };
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : undefined;
  const manifestPath = args.find((a, i) => !a.startsWith('--') && i !== at + 1 && args[i - 1] !== '--changes') ?? 'builder.json';
  if (!base) {
    console.log('usage: npm run kit:diff -- --base <branch or commit> [--style-only] [--allow-removed]');
    process.exit(2);
  }
  const styleOnly = args.includes('--style-only');
  const ci = args.indexOf('--changes');
  const r = diff(manifestPath, { base, styleOnly, allowRemoved: args.includes('--allow-removed'), changes: ci >= 0 ? args[ci + 1] : null });
  const list = (xs) => (xs.length ? xs.join(', ') : 'none');
  console.log(`Compared with ${base}: hooks added: ${list(r.added)}; removed: ${list(r.removed)}; element changed: ${list(r.changed)}; tokens removed: ${list(r.lostTokens)}.`);
  if (r.deleted.length) console.log(`Removed as the design asked (design/HOOK-CHANGES.json): ${list(r.deleted)}.`);
  for (const p of r.problems) console.log(`  ✗ ${p}`);
  const kind = styleOnly ? 'style change' : 'code change';
  console.log(r.problems.length ? `kit:diff failed: ${r.problems.length} problem(s) in this ${kind}` : `kit:diff passed: this ${kind} keeps every hook the design uses`);
  process.exit(r.problems.length ? 1 : 0);
}

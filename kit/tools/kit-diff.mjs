#!/usr/bin/env node
// Compares this branch with the branch it will merge into, for the two kinds of change a
// builder-ready repo gets. No dependencies besides git.
//
//   node tools/kit-diff.mjs [builder.json] --base <ref> [--style-only] [--allow-removed]
//   npm run kit:diff -- --base origin/main
//   npm run kit:diff -- --base origin/main --style-only
//
// A code change (the default): no hook the base branch had may disappear, because the design's
// rules for it would silently stop applying. Lists added and removed hooks, and hooks whose element
// kind changed. --allow-removed accepts removals the pull request explains (say which, so J can move
// their style).
// A style change from the builder (--style-only): only the design's files may change (the style
// layer, the tokens, the files made from them, and builder.json's "styleAssets" folder if it has
// one), no token may disappear, and no hook may change at all.
// Both also run the full contract check.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { check } from './kit-check.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function diff(manifestPath, { base, styleOnly = false, allowRemoved = false }) {
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

  if (styleOnly) {
    const owned = [manifest.styleLayer, manifest.tokens, manifest.tokensModule, manifest.hooks].filter(Boolean);
    const assets = manifest.styleAssets ? `${manifest.styleAssets.replace(/\/$/, '')}/` : null;
    const files = git(dir, 'diff', '--relative', '--name-only', from).split('\n').filter(Boolean);
    files.push(...git(dir, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean));
    for (const f of files) if (!owned.includes(f) && !(assets && f.startsWith(assets))) problems.push(`${f} changed, but a style change may only touch ${[...owned, ...(assets ? [assets] : [])].join(', ')}`);
    for (const h of [...removed, ...added]) problems.push(`hook "${h}" was ${removed.includes(h) ? 'removed' : 'added'} (a style change never changes hooks)`);
    for (const t of lostTokens) problems.push(`token ${t} was removed (a style change may change a token's value, not drop it)`);
  } else {
    if (!allowRemoved) for (const h of removed) problems.push(`hook "${h}" was removed; the design's rules for it would stop applying (keep it, or pass --allow-removed and say so in the pull request)`);
  }
  return { problems, removed, added, changed, lostTokens, from };
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : undefined;
  const manifestPath = args.find((a, i) => !a.startsWith('--') && i !== at + 1) ?? 'builder.json';
  if (!base) {
    console.log('usage: npm run kit:diff -- --base <branch or commit> [--style-only] [--allow-removed]');
    process.exit(2);
  }
  const styleOnly = args.includes('--style-only');
  const r = diff(manifestPath, { base, styleOnly, allowRemoved: args.includes('--allow-removed') });
  const list = (xs) => (xs.length ? xs.join(', ') : 'none');
  console.log(`Compared with ${base}: hooks added: ${list(r.added)}; removed: ${list(r.removed)}; element changed: ${list(r.changed)}; tokens removed: ${list(r.lostTokens)}.`);
  for (const p of r.problems) console.log(`  ✗ ${p}`);
  const kind = styleOnly ? 'style change' : 'code change';
  console.log(r.problems.length ? `kit:diff failed: ${r.problems.length} problem(s) in this ${kind}` : `kit:diff passed: this ${kind} keeps every hook the design uses`);
  process.exit(r.problems.length ? 1 : 0);
}

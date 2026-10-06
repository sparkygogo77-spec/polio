#!/usr/bin/env node
// The change note a code chat leaves for the builder (BUILDER-RULES.md rules 26 and 27).
//
//   node tools/code-notes.mjs [builder.json] --base <ref> --why "<what this change is for>" [--branch <name>]
//   npm run kit:notes -- --base origin/main --why "Keyboard trading on the Play page"
//
// Compares this branch with the branch it merges into and writes design/CODE-CHANGES.json (one
// entry per branch, newest first; running it again on the same branch replaces that entry) and
// design/CODE-CHANGES.md, its readable copy. Each entry lists the new parts with their plain
// names, parts gone, panel states added or gone, new slots and tokens, and the builder requests
// (builder.json rules.requests) with a prompt to paste into a Polio chat. The builder's
// "Check the code again" reads the JSON and shows it as "New from code".
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { parsePage } from './kit-check.mjs';
import { diff } from './kit-diff.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const MOST = 30;
export const POLIO = { repo: 'sparkygogo77-spec/polio', trunk: 'claude/template-ui-website-builder-11bfgl' };
const SLOT_KINDS = ['colour', 'length', 'number', 'text', 'choice', 'shadow', 'filter', 'time', 'any'];

/** Every hooked element of the site's pages: hook to { page, label, parent, panel states }. */
function partsOf(manifest, read) {
  const out = new Map();
  for (const { file } of manifest.pages) {
    const text = read(file);
    if (text === null) continue;
    for (const el of parsePage(file, text).elements) {
      const hook = el.attrs['data-hook'];
      if (!hook || out.has(hook) || !el.inBody) continue;
      let parent = null;
      for (let e = el.parent; e && !parent; e = e.parent) parent = e.attrs['data-hook'] ?? null;
      const states = el.attrs['data-states'] !== undefined ? el.attrs['data-states'].split(/[\s,]+/).filter(Boolean) : null;
      out.set(hook, { page: file, label: el.attrs['data-label'] ?? null, parent, states });
    }
  }
  return out;
}

/** The site's own repository as owner/name, from git's origin; null when there is none. */
function repoOf(dir) {
  try {
    const url = git(dir, 'remote', 'get-url', 'origin').trim();
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/) ?? url.match(/\/git\/([^/]+\/[^/]+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch { return null; }
}

/** The prompt J pastes into a Polio chat so the builder learns what one request asks for. */
export function requestPrompt(req, { site, repo, part }) {
  const where = [part?.page ? `page ${part.page}` : null, `the part "${part?.label ?? req.hook}" (data-hook="${req.hook}")`].filter(Boolean).join(', ');
  return [
    `In ${POLIO.repo} (branch from trunk ${POLIO.trunk}), teach the builder something a site's code needs.`,
    `Site: ${site}${repo ? ` (${repo})` : ''}, ${where}.`,
    `What the code needs the builder to edit: ${req.need}.`,
    req.why ? `Why: ${req.why}.` : null,
    `Suggested slot kind: ${req.kind ?? 'a new one'} (the kinds today: ${SLOT_KINDS.join(', ')}).`,
    'How to add it:',
    '1. If it is a new kind, add it to KitSlot in src/features/studio/kitRun.ts, to SLOT_KINDS in kit/tools/kit-check.mjs and to rule 4 of kit/BUILDER-RULES.md, then npm run kit:files.',
    '2. Show it in the part\'s Settings (partSlots in src/features/studio/styleLayer.ts) with a control that fits the kind.',
    '3. Make sure Send the design back carries the change as a token value.',
    '4. Add one test next to the closest slot test, run it and that test, open a pull request into trunk and merge it once they pass.',
    `When it is merged, a code chat on ${site} moves this request from builder.json rules.requests into rules.slots (a token, hook, label and kind), and the builder shows it.`,
  ].filter(Boolean).join('\n');
}

export function notes(manifestPath, { base, why, branch = null, today = new Date().toISOString().slice(0, 10) }) {
  const dir = dirname(resolve(manifestPath));
  let root = dir;
  try { root = git(dir, 'rev-parse', '--show-toplevel').trim(); } catch { /* not a repository */ }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const r = diff(manifestPath, { base, allowRemoved: true });
  const atBase = (file) => { try { return git(dir, 'show', `${r.from}:./${file}`); } catch { return null; } };
  let was = { pages: [], rules: {} };
  try { was = JSON.parse(atBase(relative(dir, resolve(manifestPath)).split(sep).join('/'))); } catch { /* new site */ }
  const now = partsOf(manifest, (f) => (existsSync(resolve(dir, f)) ? readFileSync(resolve(dir, f), 'utf8') : null));
  const before = partsOf({ pages: was.pages ?? [] }, atBase);

  const pagesNow = manifest.pages.map((p) => p.file);
  const pagesWas = (was.pages ?? []).map((p) => p.file);
  const states = [];
  for (const [hook, p] of now) {
    if (!p.states) continue;
    const old = before.get(hook)?.states ?? [];
    const added = p.states.filter((s) => !old.includes(s));
    const gone = old.filter((s) => !p.states.includes(s));
    if (added.length || gone.length) states.push({ panel: hook, label: p.label, added, removed: gone });
  }
  const slotKey = (s) => `${s.token} ${s.hook}`;
  const oldSlots = new Set((was.rules?.slots ?? []).map(slotKey));
  const site = manifest.name ?? 'the site';
  const repo = repoOf(root);
  const entry = {
    branch: branch ?? (() => { try { return git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim(); } catch { return 'unknown'; } })(),
    date: today,
    why: why ?? '',
    pages: { added: pagesNow.filter((p) => !pagesWas.includes(p)), removed: pagesWas.filter((p) => !pagesNow.includes(p)) },
    parts: r.added.map((hook) => ({ hook, label: now.get(hook)?.label ?? null, page: now.get(hook)?.page ?? null, parent: now.get(hook)?.parent ?? null })),
    removed: r.removed,
    states,
    slots: (manifest.rules?.slots ?? []).filter((s) => !oldSlots.has(slotKey(s))).map(({ token, hook, label, kind, why: w }) => ({ token, hook, label, kind: kind ?? 'any', why: w ?? '' })),
    tokens: (() => {
      let old = {};
      try { old = JSON.parse(atBase(manifest.hooks)).tokens ?? {}; } catch { /* none */ }
      try { return Object.keys(JSON.parse(readFileSync(resolve(dir, manifest.hooks), 'utf8')).tokens ?? {}).filter((t) => !old[t]); } catch { return []; }
    })(),
  };
  /* Open requests ride on every note: until the builder learns them, J needs their prompts. */
  const requests = (manifest.rules?.requests ?? []).map((q) => ({ ...q, prompt: requestPrompt(q, { site, repo, part: now.get(q.hook) }) }));

  const file = resolve(root, 'design/CODE-CHANGES.json');
  let log = { entries: [] };
  try { log = JSON.parse(readFileSync(file, 'utf8')); } catch { /* first note */ }
  const entries = [entry, ...(log.entries ?? []).filter((e) => e.branch !== entry.branch)].slice(0, MOST);
  const out = {
    about: 'What code chats changed, newest first, for the builder\'s "Check the code again" (BUILDER-RULES.md rules 26 and 27). Written by npm run kit:notes; one entry per branch.',
    site,
    repo,
    requests,
    entries,
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  writeFileSync(resolve(root, 'design/CODE-CHANGES.md'), markdown(out));
  return { entry, requests, file };
}

const named = (p) => (p.label ? `${p.label} (\`${p.hook}\`)` : `\`${p.hook}\``);

export function markdown(log) {
  const lines = [`# What the code changed, for the builder`, '', `${log.site}. Made by \`npm run kit:notes\`; the builder reads \`CODE-CHANGES.json\` next to this file.`, ''];
  if (log.requests.length) {
    lines.push('## Builder requests', '', 'Things the code needs the builder to learn. Paste a prompt into a new Polio chat.', '');
    for (const q of log.requests) lines.push(`### ${q.need} (\`${q.hook}\`)`, '', '```', q.prompt, '```', '');
  }
  lines.push('## Changes, newest first', '');
  for (const e of log.entries) {
    lines.push(`### ${e.date}: ${e.why || e.branch}`, '', `Branch \`${e.branch}\`.`, '');
    const say = (title, xs) => { if (xs.length) lines.push(`- ${title}: ${xs.join(', ')}`); };
    say('New pages', e.pages.added);
    say('Pages gone', e.pages.removed);
    say('New parts', e.parts.map(named));
    say('Parts gone', e.removed.map((h) => `\`${h}\``));
    say('Panel states', e.states.map((s) => `${s.label ?? s.panel}: ${[...s.added.map((x) => `+${x}`), ...s.removed.map((x) => `-${x}`)].join(' ')}`));
    say('New settings (slots)', e.slots.map((s) => `${s.label} on \`${s.hook}\` (${s.kind})`));
    say('New tokens', e.tokens.map((t) => `\`${t}\``));
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const val = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const base = val('--base');
  const why = val('--why');
  if (!base || !why) {
    console.log('usage: npm run kit:notes -- --base <branch or commit> --why "<what this change is for>" [--branch <name>]');
    process.exit(2);
  }
  const flags = new Set(['--base', '--why', '--branch']);
  const manifestPath = args.find((a, i) => !a.startsWith('--') && !flags.has(args[i - 1])) ?? 'builder.json';
  const { entry, requests, file } = notes(manifestPath, { base, why, branch: val('--branch') ?? null });
  console.log(`kit:notes wrote ${relative(process.cwd(), file)}: ${entry.parts.length} new part(s), ${entry.removed.length} gone, ${entry.states.length} panel(s) with new states, ${entry.slots.length} new slot(s), ${entry.tokens.length} new token(s), ${requests.length} builder request(s).`);
}

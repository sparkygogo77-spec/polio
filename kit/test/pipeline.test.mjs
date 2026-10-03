// The pipeline tools: kit:new makes a site that passes the check; kit:diff catches a code change
// that drops a hook and a style change that touches more than the design's files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { check } from '../tools/kit-check.mjs';
import { newSite } from '../tools/new-site.mjs';
import { diff } from '../tools/kit-diff.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=kit test', '-c', 'user.email=kit@test.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
const edit = (dir, file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), 'utf8')));

/** A new site from the kit, as a git repo with one commit on "main". */
function siteRepo() {
  const dir = join(mkdtempSync(join(tmpdir(), 'kit-site-')), 'site');
  const { problems } = newSite(dir, { name: 'Test shop' });
  assert.deepEqual(problems, []);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'Start');
  return dir;
}

test('kit:new makes a named site that passes the check, with everything a code chat reads', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'kit-new-')), 'shop');
  try {
    const { problems, map } = newSite(dir, { name: 'Test shop' });
    assert.deepEqual(problems, []);
    assert.ok(Object.keys(map.hooks).length > 50);
    for (const f of ['CLAUDE.md', 'AGENTS.md', 'BUILDER-CONTRACT.md', 'PIPELINE.md', 'builder.json', 'tools/kit-check.mjs', 'tools/kit-diff.mjs', '.github/workflows/kit-check.yml', 'starter/style-layer.css']) assert.ok(existsSync(join(dir, f)), f);
    assert.ok(!existsSync(join(dir, 'RETROFIT.md')));
    assert.equal(JSON.parse(readFileSync(join(dir, 'builder.json'), 'utf8')).name, 'Test shop');
    assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name, 'test-shop');
    assert.match(readFileSync(join(dir, 'README.md'), 'utf8'), /^# Test shop/);
    assert.throws(() => newSite(dir), /not empty/);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

test('kit:diff: a code change may add hooks but not drop one, unless told to', () => {
  const dir = siteRepo();
  try {
    git(dir, 'checkout', '-q', '-b', 'logic');
    edit(dir, 'starter/about.html', (s) => s.replace('</main>', '<p data-hook="about-note">New.</p>\n</main>'));
    check(join(dir, 'builder.json'), { write: true });
    let r = diff(join(dir, 'builder.json'), { base: 'main' });
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.added, ['about-note']);
    git(dir, 'commit', '-q', '-am', 'Add a note');
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'merge', '-q', 'logic');

    git(dir, 'checkout', '-q', '-b', 'drop');
    edit(dir, 'starter/about.html', (s) => s.replace('<p data-hook="about-note">New.</p>\n', ''));
    check(join(dir, 'builder.json'), { write: true });
    r = diff(join(dir, 'builder.json'), { base: 'main' });
    assert.deepEqual(r.removed, ['about-note']);
    assert.match(r.problems.join('\n'), /hook "about-note" was removed/);
    assert.deepEqual(diff(join(dir, 'builder.json'), { base: 'main', allowRemoved: true }).problems, []);

    // Deleted in the builder: the design branch lists it in design/HOOK-CHANGES.json, so it passes.
    mkdirSync(join(dir, 'design'), { recursive: true });
    writeFileSync(join(dir, 'design/HOOK-CHANGES.json'), JSON.stringify({ removed: [{ hook: 'about-note', page: 'starter/about.html', refs: [] }] }));
    r = diff(join(dir, 'builder.json'), { base: 'main' });
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.deleted, ['about-note']);
    // A hook the design did not list still fails.
    writeFileSync(join(dir, 'design/HOOK-CHANGES.json'), JSON.stringify({ removed: [{ hook: 'other-hook' }] }));
    assert.match(diff(join(dir, 'builder.json'), { base: 'main' }).problems.join('\n'), /hook "about-note" was removed/);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

test('kit:diff --style-only: the design may change only the style layer and token values', () => {
  const dir = siteRepo();
  try {
    git(dir, 'checkout', '-q', '-b', 'style');
    edit(dir, 'starter/style-layer.css', (s) => `${s}[data-hook="page-about"] { letter-spacing: 0.02em; }\n`);
    edit(dir, 'starter/tokens.css', (s) => s.replace(/(--[a-z-]+:\s*)#[0-9a-fA-F]{3,8}/, '$1#123456'));
    check(join(dir, 'builder.json'), { write: true });
    assert.deepEqual(diff(join(dir, 'builder.json'), { base: 'main', styleOnly: true }).problems, []);
    // The builder's design record rides with a style change.
    mkdirSync(join(dir, 'design'), { recursive: true });
    writeFileSync(join(dir, 'design/record.json'), JSON.stringify({ record: 1, source: 'builder', pages: [] }));
    assert.deepEqual(diff(join(dir, 'builder.json'), { base: 'main', styleOnly: true }).problems, []);

    edit(dir, 'starter/about.html', (s) => s.replace('</main>', '<p data-hook="about-note">New.</p>\n</main>'));
    check(join(dir, 'builder.json'), { write: true });
    const r = diff(join(dir, 'builder.json'), { base: 'main', styleOnly: true });
    assert.match(r.problems.join('\n'), /starter\/about\.html changed, but a style change may only touch/);
    assert.match(r.problems.join('\n'), /hook "about-note" was added/);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

test('kit:diff: a design record fails only on states that newly leave their frame; old ones are warnings', () => {
  const dir = siteRepo();
  const record = (findY) => JSON.stringify({ record: 1, source: 'builder', pages: [{ file: 'web/index.html', tree: { t: 'body', hook: 'page', x: 0, y: 0, w: 1440, h: 900, kids: [
    { t: 'section', hook: 'queue-box', x: 100, y: 100, w: 300, h: 120, kids: [
      { t: 'button', hook: 'queue-find-button', states: { hidden: { hidden: true } }, x: 110, y: findY, w: 280, h: 50 },
      { t: 'p', hook: 'queue-old', states: { hidden: { hidden: true } }, x: 110, y: 400, w: 280, h: 40 },
    ] },
  ] } }] });
  try {
    mkdirSync(join(dir, 'design'), { recursive: true });
    writeFileSync(join(dir, 'design/record.json'), record(160));
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'A record with old debt');
    git(dir, 'checkout', '-q', '-b', 'style');
    // The record changes, and its old debt is still there: a warning, never a failure.
    writeFileSync(join(dir, 'design/record.json'), record(161));
    let r = diff(join(dir, 'builder.json'), { base: 'main', styleOnly: true });
    assert.deepEqual(r.problems, []);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /"queue-old"|state "queue-old"/);
    // A state this change pushes out of its frame fails.
    writeFileSync(join(dir, 'design/record.json'), record(200));
    r = diff(join(dir, 'builder.json'), { base: 'main', styleOnly: true });
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /queue-find-button/);
    assert.equal(r.warnings.length, 1);
    // A part recorded for the first time inside old debt (the icon in an old title) is old debt too.
    writeFileSync(join(dir, 'design/record.json'), record(161).replace('"h":40}', '"h":40,"kids":[{"t":"span","hook":"queue-old-icon","x":120,"y":402,"w":18,"h":18}]}'));
    r = diff(join(dir, 'builder.json'), { base: 'main', styleOnly: true });
    assert.deepEqual(r.problems, []);
    assert.equal(r.warnings.length, 2);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

// kit:check passes on the starter and fails, with the right message, on each purpose-broken fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, insertions } from '../tools/kit-check.mjs';
import { FIXTURES } from './fixtures.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A throwaway copy of builder.json and starter/, so a fixture can break it. */
function copyOfStarter() {
  const dir = mkdtempSync(join(tmpdir(), 'kit-'));
  cpSync(join(KIT, 'starter'), join(dir, 'starter'), { recursive: true });
  cpSync(join(KIT, 'builder.json'), join(dir, 'builder.json'));
  cpSync(join(KIT, 'BUILDER-RULES.md'), join(dir, 'BUILDER-RULES.md'));
  return dir;
}

test('kit:check passes on the starter', () => {
  const { problems, map } = check(join(KIT, 'builder.json'));
  assert.deepEqual(problems, []);
  assert.ok(Object.keys(map.hooks).length > 50);
  // Every hook a script touches carries file, line and function.
  const ref = map.hooks['hero-button'].references[0];
  assert.deepEqual(ref, { file: 'starter/js/home.js', line: ref.line, function: 'setUp', uses: 'listens' });
  assert.equal(map.hooks['list-item-name'].scriptBuilt, true);
  assert.equal(map.hooks['list-item-name'].template, 'template-list-item');
});

for (const f of FIXTURES) {
  test(`kit:check fails on a broken fixture: ${f.name}`, () => {
    const dir = copyOfStarter();
    try {
      const path = join(dir, f.file);
      const text = readFileSync(path, 'utf8');
      assert.ok(text.includes(f.find), `fixture "${f.name}" no longer matches ${f.file}`);
      writeFileSync(path, text.replace(f.find, f.replace));
      // Rewrite the map first unless the fixture is about a stale map, so only the broken rule shows.
      if (f.file !== 'starter/hooks.json') check(join(dir, 'builder.json'), { write: true });
      const { problems } = check(join(dir, 'builder.json'));
      assert.ok(problems.some((p) => f.expect.test(p)), `expected ${f.expect}, got:\n${problems.join('\n')}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('rule 1: what a script shows later is a state inside a part, never an element outside one', () => {
  const helpers = { hook: 0, fromTemplate: 0, part: 1 };
  const run = (code) => insertions(code, { helpers, hookExists: (h) => h !== 'nowhere' }).map((x) => x.problem);
  // The "Connecting to the game server" box later becomes "Find a match": wrong as a new element on the page...
  assert.match(run("function ready() {\n  document.body.append(fromTemplate('template-find-match'));\n}")[0], /outside every part/);
  // ...wrong beside the box...
  assert.match(run("hook('queue-connecting').replaceWith(fromTemplate('template-find-match'));")[0], /beside "queue-connecting"/);
  // ...right inside the part that shows it, and right through a variable, a field or a note.
  assert.deepEqual(run("hook('queue-box').replaceChildren(fromTemplate('template-find-match'));"), [null]);
  assert.deepEqual(run("const box = hook('queue-box');\nbox.append(fromTemplate('template-row'));"), [null]);
  assert.deepEqual(run("const ui = { box: null };\nui.box = hook('queue-box');\nui.box.append(fromTemplate('template-row'));"), [null]);
  assert.deepEqual(run("const row = fromTemplate('template-row');\nrow.append(fromTemplate('template-cell'));"), [null]);
  assert.deepEqual(run("findBox().append(fromTemplate('template-row')); // part: queue-box"), [null]);
  // Emptying a part, adding text, or moving a part within its own parent adds nothing.
  assert.deepEqual(run("hook('queue-box').replaceChildren();\nhook('queue-box').append('waiting');\nconst a = hook('a');\na.parentNode.insertBefore(a, a.parentNode.firstElementChild);"), []);
  // A part no page declares, and a template itself, are not places to add to.
  assert.match(run("hook('nowhere').append(fromTemplate('template-row'));")[0], /no page declares/);
  assert.match(run("hook('template-row').append(fromTemplate('template-cell'));")[0], /template "template-row" itself/);
});

test('builder.json "rules" and BUILDER-RULES.md list the same rules, in order', () => {
  const doc = readFileSync(join(KIT, 'BUILDER-RULES.md'), 'utf8');
  const headings = [...doc.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1]);
  const { rules } = JSON.parse(readFileSync(join(KIT, 'builder.json'), 'utf8'));
  assert.equal(rules.doc, 'BUILDER-RULES.md');
  assert.deepEqual(rules.list.map((r) => r.title), headings);
  for (const r of rules.list) assert.match(r.id, /^[a-z]+(-[a-z]+)*$/);
});

test('rules 8 and 9: the DexScreener embed and script-set positions pass; a position used for anything else fails', () => {
  const dir = copyOfStarter();
  try {
    const edit = (f, find, replace) => { const t = readFileSync(join(dir, f), 'utf8'); assert.ok(t.includes(find), find); writeFileSync(join(dir, f), t.replace(find, replace)); };
    edit('starter/about.html', '<section data-hook="about-story">', '<iframe data-hook="about-chart" src="https://dexscreener.com/solana?embed=1" title="Chart"></iframe>\n<section data-hook="about-story">');
    edit('starter/js/list.js', "  hook('list-empty').hidden = items.length > 0;", "  hook('list-empty').hidden = items.length > 0;\n  hook('list-items').style.setProperty('--list-top', '4px');");
    edit('starter/base.css', '[data-hook="list-item"] {', '[data-hook="list-items"] { --list-top: 0; top: var(--list-top); }\n[data-hook="list-item"] {');
    const m = JSON.parse(readFileSync(join(dir, 'builder.json'), 'utf8'));
    m.rules.scriptPositions.values = ['--list-top'];
    writeFileSync(join(dir, 'builder.json'), JSON.stringify(m, null, 2));
    check(join(dir, 'builder.json'), { write: true });
    assert.deepEqual(check(join(dir, 'builder.json')).problems, []);
    edit('starter/base.css', 'top: var(--list-top);', 'top: var(--list-top); margin-top: var(--list-top);');
    check(join(dir, 'builder.json'), { write: true });
    assert.ok(check(join(dir, 'builder.json')).problems.some((p) => /"margin-top" uses --list-top, a position a script sets/.test(p)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

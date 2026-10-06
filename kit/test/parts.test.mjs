// The game parts (BUILDER-RULES.md rules 28 to 30): the slot readers, kit:check on slot values and
// state names, and kit:part adding a part to a site that has none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../tools/kit-check.mjs';
import { addPart } from '../tools/add-part.mjs';
import { formatNumber, parseKey, parseLine, parseSound } from '../starter/parts/slots.js';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');

function copyOfStarter() {
  const dir = mkdtempSync(join(tmpdir(), 'kit-parts-'));
  cpSync(join(KIT, 'starter'), join(dir, 'starter'), { recursive: true });
  cpSync(join(KIT, 'builder.json'), join(dir, 'builder.json'));
  return dir;
}
const edit = (dir, file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), 'utf8')));

test('slot readers: sound, key, format, line', () => {
  assert.deepEqual(parseSound('beep 880 0.3'), { kind: 'beep', hz: 880, volume: 0.3 });
  assert.deepEqual(parseSound('"sounds/tick.mp3" 0.5'), { kind: 'file', src: 'sounds/tick.mp3', volume: 0.5 });
  assert.deepEqual(parseSound('none'), { kind: 'none' });
  assert.equal(parseKey('"q"'), 'q');
  assert.equal(parseKey('none'), '');
  assert.deepEqual(formatNumber(12.4, '"+0.00"'), { text: '+12.40', sign: 'up' });
  assert.deepEqual(formatNumber(-1234.5, '"$0,0.00"'), { text: '-$1,234.50', sign: 'down' });
  assert.deepEqual(formatNumber(0.001, '"0.0%"'), { text: '0.0%', sign: 'flat' });
  assert.deepEqual(parseLine('2px dashed'), { width: 2, style: 'dashed' });
  assert.equal(parseLine('2px wavy'), null);
});

test('kit:check fails on a slot value the builder could not edit, and notes a state twin', () => {
  const dir = copyOfStarter();
  try {
    edit(dir, 'starter/tokens.css', (s) => s.replace('--markers-level-line: 2px dashed;', '--markers-level-line: wavy;'));
    edit(dir, 'starter/game.html', (s) => s.replace('data-states="idle loading live error"', 'data-states="idle connecting live error"').replace('data-show="idle loading error"', 'data-show="idle connecting error"').replace('data-show="loading"', 'data-show="connecting"'));
    const { problems, notes } = check(join(dir, 'builder.json'));
    assert.ok(problems.some((p) => /--markers-level-line\): a line slot's value is none or a width/.test(p)), problems.join('\n'));
    assert.ok(notes.some((n) => /panel "screen": state "connecting" could use the shared name "loading"/.test(n)), notes.join('\n'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('kit:part adds a part to a site without parts: files, tokens and slots, once', () => {
  const dir = copyOfStarter();
  try {
    rmSync(join(dir, 'starter/parts'), { recursive: true });
    edit(dir, 'starter/tokens.css', (s) => s.replace(/\s*\/\* part: [\s\S]*?\/\* part end \*\//g, ''));
    edit(dir, 'builder.json', (s) => {
      const m = JSON.parse(s);
      m.rules.slots = m.rules.slots.filter((x) => x.token === '--shadow');
      return JSON.stringify(m);
    });
    const r = addPart('scoreboard', dir);
    assert.ok(existsSync(join(dir, 'starter/parts/scoreboard.js')) && existsSync(join(dir, 'starter/parts/slots.js')));
    assert.match(r.snippet, /data-panel="scoreboard"/);
    addPart('scoreboard', dir);
    const tokens = readFileSync(join(dir, 'starter/tokens.css'), 'utf8');
    assert.equal(tokens.split('/* part: scoreboard */').length, 2);
    assert.equal(tokens.split('/* part: shared */').length, 2);
    const slots = JSON.parse(readFileSync(join(dir, 'builder.json'), 'utf8')).rules.slots.map((x) => x.token);
    assert.deepEqual(slots, ['--shadow', '--scoreboard-format']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

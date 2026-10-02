// kit:check passes on the starter and fails, with the right message, on each purpose-broken fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../tools/kit-check.mjs';
import { FIXTURES } from './fixtures.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A throwaway copy of builder.json and starter/, so a fixture can break it. */
function copyOfStarter() {
  const dir = mkdtempSync(join(tmpdir(), 'kit-'));
  cpSync(join(KIT, 'starter'), join(dir, 'starter'), { recursive: true });
  cpSync(join(KIT, 'builder.json'), join(dir, 'builder.json'));
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

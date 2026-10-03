// The design record: a bare capture reads as a record, and record-diff matches parts by hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRecord, recordDiff } from '../tools/record-diff.mjs';

const page = (kids, at = { x: 0, y: 0 }) => ({ tree: { t: 'body', x: at.x, y: at.y, w: 800, h: 600, hook: 'app', kids } });
const part = (hook, x, y, w, h, more = {}) => ({ t: 'div', hook, x, y, w, h, ...more });

test('a capture route file is a record of one page', () => {
  const cap = page([]);
  assert.deepEqual(readRecord(cap).pages, [cap]);
  const rec = { record: 1, source: 'builder', pages: [cap] };
  assert.equal(readRecord(rec), rec);
});

test('the schema names every field the spec adds to a part', () => {
  const s = JSON.parse(readFileSync(new URL('../design-record.schema.json', import.meta.url), 'utf8'));
  for (const k of ['hook', 'label', 'parent', 'states', 'at', 'tokens', 'assets']) assert.ok(s.$defs.part.properties[k], k);
});

test('record-diff: the same parts, offset by the frame, pass; a moved, resized, recoloured or missing part is listed', () => {
  const design = { record: 1, source: 'builder', pages: [{ file: 'web/index.html', ...page([part('tv', 10, 10, 400, 300, { bg: '#112233' }), part('tv-led', 20, 20, 8, 8), part('result', 0, 0, 100, 40, { states: { hidden: { hidden: true } } })]) }] };
  const same = page([part('tv', 18, 18, 401, 299, { bg: 'rgb(17, 34, 51)' }), part('tv-led', 28, 28, 8, 8)], { x: 8, y: 8 });
  let r = recordDiff(design, same);
  assert.deepEqual(r.differ, []);
  assert.equal(r.same, 3);
  const off = page([part('tv', 8, 8, 400, 320, { bg: 'rgb(0, 0, 0)' })]);
  r = recordDiff(design, off);
  assert.deepEqual(r.differ.map((d) => d.hook), ['tv', 'tv-led']);
  assert.match(r.differ[0].why, /size 400×300 in the record, 400×320 built/);
  assert.match(r.differ[0].why, /background/);
  assert.match(r.differ[1].why, /not drawn/);
});

test('record-diff reads a captured part as drawn: its page matrix applied', () => {
  const turned = { t: 'div', hook: 'antenna', x: 100, y: 100, w: 6, h: 90, ptf: [0, 1, -1, 0, 290, 0] };
  const design = { record: 1, pages: [page([part('antenna', 100, 100, 90, 6)])] };
  const r = recordDiff(design, page([turned]));
  assert.deepEqual(r.differ, [], JSON.stringify(r.differ));
});

test('kit:states: a state stays inside its frame; one that leaves it is named, by how far', async () => {
  const { stateFrames } = await import('../tools/state-frames.mjs');
  const page = (findBox) => ({ record: 1, source: 'builder', pages: [{ file: 'web/index.html', tree: { t: 'body', hook: 'page', x: 0, y: 0, w: 1440, h: 900, kids: [
    { t: 'section', hook: 'queue-box', x: 100, y: 100, w: 300, h: 120, kids: [
      { t: 'p', hook: 'queue-connecting', x: 110, y: 110, w: 280, h: 40 },
      { t: 'button', hook: 'queue-find-button', states: { hidden: { hidden: true } }, ...findBox, kids: [{ t: 'span', hook: 'queue-find-label', x: findBox.x + 10, y: findBox.y + 5, w: 60, h: 20 }] },
    ] },
    { t: 'template', hook: 'template-row', states: { hidden: { hidden: true } }, x: 0, y: 2000, w: 50, h: 50 },
  ] } }] });
  assert.deepEqual(stateFrames(page({ x: 110, y: 160, w: 280, h: 50 })), []);
  const bad = stateFrames(page({ x: 110, y: 200, w: 280, h: 50 }));
  assert.deepEqual(bad.map((b) => [b.hook, b.state, b.frame, b.over]), [['queue-find-button', 'queue-find-button', 'queue-box', 30], ['queue-find-label', 'queue-find-button', 'queue-box', 5]]);
});

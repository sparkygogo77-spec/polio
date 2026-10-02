import { $, drop, fill, fromTemplate, serverUrl, setText, short, showOffline } from './common.js';
import { cssVar } from './dom.js';
import { keepDrawingInBackground, remeasure } from './background-frames.js';
import { TOKENS } from './tokens.js';
import { createPonsChart } from './pons-chart.js';

const KEY = 'ponsstars.adminKey';
// Design preview (web/preview.html): ?preview=1 shows made-up sample recordings; nothing is sent or stored.
const PREVIEW = new URLSearchParams(location.search).get('preview');
if (PREVIEW) keepDrawingInBackground(); // the preview may build this page in a background tab
let key = PREVIEW ? 'sample' : (() => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } })();
let view = null; // { rec, chart, line, win }

/** A request to the game server's admin API with the key. */
async function api(method, path, body) {
  if (PREVIEW) {
    const { sampleLibrary } = await import('./preview-data.js');
    const d = sampleLibrary();
    if (method === 'GET' && path === '/library') return d.library;
    if (method === 'GET' && path === `/recordings/${d.recording.id}`) return d.recording;
    throw new Error('not in the preview');
  }
  let res;
  try {
    res = await fetch(serverUrl(`/api/admin${path}`), {
      method,
      headers: { authorization: `Bearer ${key}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    showOffline();
    throw new Error('game server offline');
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    showOffline();
    throw new Error('game server offline');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `${res.status}`);
  return data;
}

const when = (ms) => new Date(ms).toLocaleString();
async function refresh() {
  if (!key) return;
  let lib;
  try {
    lib = await api('GET', '/library');
  } catch (err) {
    return setText('lib-status', `Not allowed: ${err.message}.`);
  }
  setText('lib-status', `Key accepted. ${lib.windows.length} saved window(s), ${lib.recordings.length} recording(s) since the server started.`);
  const recs = $('lib-recordings-rows');
  recs.replaceChildren();
  for (const r of lib.recordings) {
    const tr = fill(fromTemplate('template-lib-recording'), {
      'lib-rec-label': r.label,
      'lib-rec-mint': short(r.mint),
      'lib-rec-status': r.status === 'recording' ? `recording until ${new Date(r.endsAt).toLocaleTimeString()}` : r.status,
      'lib-rec-count': String(r.sampleCount),
    });
    tr.dataset.id = r.id;
    const viewButton = $('lib-rec-view', tr);
    if (viewButton) viewButton.onclick = () => openRecording(r.id);
    const stop = $('lib-rec-stop', tr);
    if (r.status !== 'recording') drop(tr, 'lib-rec-stop');
    else if (stop) stop.onclick = async () => { await api('POST', `/recordings/${r.id}/stop`); refresh(); };
    recs.append(tr);
  }
  const wins = $('lib-windows-rows');
  wins.replaceChildren();
  for (const w of lib.windows) {
    const first = Number(w.prices[0]);
    const last = Number(w.prices[w.prices.length - 1]);
    const tr = fill(fromTemplate('template-lib-window'), {
      'lib-win-label': w.label,
      'lib-win-length': `${w.lengthMs / 60_000} min`,
      'lib-win-start': when(w.startMs),
      'lib-win-mint': short(w.mint),
      'lib-win-move': `${(((last / first) - 1) * 100).toFixed(2)}%`,
    });
    tr.dataset.id = w.id;
    const del = $('lib-win-delete', tr);
    if (del) del.onclick = async () => { await api('DELETE', `/windows/${w.id}`); refresh(); };
    wins.append(tr);
  }
  if (view) {
    const r = lib.recordings.find((x) => x.id === view.rec.id);
    if (r && r.sampleCount !== view.rec.samples.length) openRecording(r.id, true);
  }
  if (lib.recordings.some((r) => r.status === 'recording') && !PREVIEW) setTimeout(refresh, 3_000);
}

async function openRecording(id, keep = false) {
  const rec = await api('GET', `/recordings/${id}`);
  if (!view) {
    // PonsStars' own chart (web/pons-chart.js) on the canvas in the markup, following its size.
    const chart = createPonsChart($('lib-chart-canvas'), { autoSize: true, maxBarSpacing: 14, rightOffset: 2 });
    // Colours from the page's CSS variables (web/base.css), so the design can change them.
    view = {
      chart,
      line: chart.addLine({ color: cssVar('--pons-library-line') || TOKENS['--pons-library-line'], lineWidth: 1 }),
      win: chart.addLine({
        color: cssVar('--pons-library-window') || TOKENS['--pons-library-window'],
        topColor: cssVar('--pons-library-window-fill') || TOKENS['--pons-library-window-fill'],
        bottomColor: cssVar('--pons-library-window-fill-end') || TOKENS['--pons-library-window-fill-end'],
        lineWidth: 2,
      }),
    };
  }
  const startIdx = keep && view.rec?.id === id ? Number($('lib-start').value) : 0;
  view.rec = rec;
  $('lib-view').hidden = false;
  setText('lib-view-title', `${rec.label} (${rec.mint})`);
  view.line.setData(rec.samples.map(([t, p]) => ({ time: t / 1000, value: Number(p) })));
  $('lib-start').max = String(Math.max(0, rec.samples.length - 1));
  $('lib-start').value = String(Math.min(startIdx, rec.samples.length - 1));
  if (!keep) view.chart.timeScale().fitContent();
  drawWindow();
}

function drawWindow() {
  if (!view?.rec) return;
  const s = view.rec.samples;
  const len = Number($('lib-length').value);
  const start = s[Number($('lib-start').value)]?.[0];
  if (start === undefined) {
    view.win.setData([]);
    return setText('lib-window-summary', 'Nothing recorded yet.');
  }
  const inside = s.filter(([t]) => t >= start && t <= start + len);
  view.win.setData(inside.map(([t, p]) => ({ time: t / 1000, value: Number(p) })));
  setText('lib-start-time', new Date(start).toLocaleTimeString());
  const fits = start + len <= s[s.length - 1][0];
  const move = inside.length > 1 ? ((Number(inside[inside.length - 1][1]) / Number(inside[0][1]) - 1) * 100).toFixed(2) : '0.00';
  setText('lib-window-summary', fits
    ? `${len / 60_000} minute window: ${inside.length} of ${len / 1000 + 1} seconds recorded, price moved ${move}%.`
    : 'The window runs past the end of the recording: pick an earlier start (or wait for more seconds).');
  $('lib-save-window').disabled = !fits;
}

$('lib-key').value = key;
$('lib-key-save').onclick = () => {
  key = $('lib-key').value.trim();
  try { sessionStorage.setItem(KEY, key); } catch { /* blocked: this page view only */ }
  refresh();
};
$('lib-record').onclick = async () => {
  try {
    const r = await api('POST', '/recordings', { mint: $('lib-mint').value, poolAddress: $('lib-pool').value || undefined, label: $('lib-label').value, minutes: Number($('lib-minutes').value) });
    setText('lib-record-message', `Recording ${r.label} until ${new Date(r.endsAt).toLocaleTimeString()}.`);
    refresh();
  } catch (err) {
    setText('lib-record-message', `Not started: ${err.message}.`);
  }
};
$('lib-length').onchange = drawWindow;
$('lib-start').oninput = drawWindow;
$('lib-save-window').onclick = async () => {
  try {
    const s = view.rec.samples;
    const w = await api('POST', '/windows', { recordingId: view.rec.id, startMs: s[Number($('lib-start').value)][0], lengthMs: Number($('lib-length').value), label: $('lib-window-label').value });
    setText('lib-window-message', `Saved "${w.label}" (${w.lengthMs / 60_000} min). Export the windows to keep them after a restart.`);
    refresh();
  } catch (err) {
    setText('lib-window-message', `Not saved: ${err.message}.`);
  }
};
$('lib-export').onclick = async () => {
  try {
    const file = await api('GET', '/charts/export');
    const a = $('lib-export-link');
    URL.revokeObjectURL(a.href);
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
    a.download = `ponsstars-charts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setText('lib-file-message', `Exported ${file.windows.length} window(s). Commit the file to data/charts/ to keep them.`);
  } catch (err) {
    setText('lib-file-message', `Not exported: ${err.message}.`);
  }
};
$('lib-import').onclick = async () => {
  const f = $('lib-import-file').files[0];
  if (!f) return setText('lib-file-message', 'Choose an exported file first.');
  try {
    const r = await api('POST', '/charts/import', JSON.parse(await f.text()));
    setText('lib-file-message', `Imported ${r.added} window(s); ${r.skipped} were already here.`);
    refresh();
  } catch (err) {
    setText('lib-file-message', `Not imported: ${err.message}.`);
  }
};
if (PREVIEW) {
  // The preview's screen: the list, then the first recording open with a window chosen.
  await refresh();
  await openRecording('rec-sample-1');
  $('lib-start').value = '120';
  drawWindow();
  // Let the chart size itself and draw (by timers in a background tab, see background-frames.js).
  remeasure();
  await new Promise((r) => setTimeout(r, 300));
  window.__ponsPreviewReady = true;
} else refresh();

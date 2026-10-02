// Builds web/gallery.html: one row per preview screen, each with the screen as a desktop window and a
// phone, scrolled to the parts that change. Each picture is
// web/preview.html?embed=1&still=1&screen=<name>&width=<pixels> in a frame the window's size, scaled
// down. A few build at a time.
import { PREVIEW_SCREENS } from './preview-data.js';
import { $, fill, fromTemplate, setText } from './dom.js';

const params = new URLSearchParams(location.search);
const wanted = params.get('screens')?.split(',').filter(Boolean);
const scale = Math.min(1, Math.max(0.2, Number(params.get('scale')) || 0.5));
const VIEWS = { desktop: { width: 1440, height: 900 }, phone: { width: 375, height: 812 } };
const AT_ONCE = 4;

const list = PREVIEW_SCREENS.filter((s) => !wanted || wanted.includes(s.name));
const jobs = [];
for (const s of list) {
  const row = fill(fromTemplate('template-gallery-row'), {
    'gallery-row-label': s.label,
    'gallery-row-changed': s.focus.join(', '),
    'gallery-desktop-width': String(VIEWS.desktop.width),
    'gallery-phone-width': String(VIEWS.phone.width),
  });
  row.dataset.screen = s.name;
  $('gallery-row-full', row).href = `preview.html?screen=${encodeURIComponent(s.name)}&full=1`;
  for (const kind of ['desktop', 'phone']) {
    const { width, height } = VIEWS[kind];
    const alone = `preview.html?still=1&screen=${encodeURIComponent(s.name)}&width=${width}`;
    $(`gallery-${kind}-open`, row).href = alone; // hooks: gallery-{desktop,phone}-open
    jobs.push({ frame: $(`gallery-${kind}-preview`, row), box: $(`gallery-${kind}-frame`, row), src: `${alone}&embed=1`, width, height }); // hooks: gallery-{desktop,phone}-{preview,frame}
  }
  $('gallery-rows').append(row);
}

/** Load one picture: the preview's window for one screen, in a frame that window's size. */
function load({ frame, box, src, width, height }) {
  return new Promise((resolve) => {
    frame.style.setProperty('--gallery-width', `${width}px`);
    frame.style.setProperty('--gallery-height', `${height}px`);
    frame.style.setProperty('--gallery-scale', String(scale));
    box.style.setProperty('--gallery-box-width', `${Math.round(width * scale)}px`);
    box.style.setProperty('--gallery-box-height', `${Math.round(height * scale)}px`);
    frame.src = src;
    const started = Date.now();
    const check = () => {
      let state = null;
      try { state = frame.contentDocument?.body?.dataset.preview; } catch { /* not loaded yet */ }
      if (state === 'ready' || state === 'failed' || Date.now() - started > 60_000) return resolve(state === 'ready');
      setTimeout(check, 150);
    };
    check();
  });
}

let done = 0;
let failed = 0;
async function worker() {
  while (jobs.length) {
    const ok = await load(jobs.shift());
    done += 1;
    if (!ok) failed += 1;
    setText('gallery-status', `${done} of ${list.length * 2} pictures built${failed ? `, ${failed} did not build` : ''}.`);
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker));
setText('gallery-status', `${list.length} screens, as a desktop window and a phone${failed ? `; ${failed} pictures did not build` : ''}.`);
document.body.dataset.gallery = failed ? 'failed' : 'ready';

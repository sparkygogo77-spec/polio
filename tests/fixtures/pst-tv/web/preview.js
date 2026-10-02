// Builds web/preview.html: each screen is the real page run in a hidden frame with sample data
// (?preview=<screen>), then its finished content is copied into this page under a label. Each
// screen shows what a player sees: a desktop window (1440 by 900) and a phone (375 by 812), each
// scrolled to the parts that change in that state, which are outlined and named under the label
// ("Full page" shows the whole page instead). The copies keep the real markup, styles and
// data-hook names; chart drawings are copied as pictures. Building never waits for an animation
// frame, so it finishes in a background tab too.
// Nothing here talks to a game server or writes anything (no storage, no requests but static files).
import { PAGE_SCREENS, PLAY_SCREENS, sample } from './preview-data.js';
import { $, fill, fromTemplate } from './dom.js';

const params = new URLSearchParams(location.search);
const only = params.get('screen');
const still = params.get('still') === '1';
// ?full=1 shows each whole page instead of the window a player sees.
const full = params.get('full') === '1';
const viewOf = (width) => ({ kind: width < 600 ? 'phone' : 'desktop', width, height: width < 600 ? 812 : 900 });
// ?width=<pixels> builds only that width (web/gallery.html shows desktop and phone apart).
const VIEWS = params.get('width') ? [viewOf(Math.min(1920, Math.max(320, Number(params.get('width')) || 1440)))] : [viewOf(1440)];
// Without ?width=, each screen also gets a phone view: this page at phone width in a frame of its
// own (?embed=1 shows only the window), so the pages' phone-width rules apply as on a phone.
const PHONE = !params.get('width');
if (params.get('embed') === '1') document.documentElement.dataset.previewEmbed = '';
/** Wait without animation frames (a background tab has none). */
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Every screen: { name, label, focus (the hooks of the parts that change), page address, how to tell it is ready }. */
async function screens() {
  const d = await sample();
  const play = PLAY_SCREENS.map(([name, label, focus]) => ({
    name,
    label,
    focus,
    src: `index.html?preview=${name}`,
    ready: (w) => w.__ponsPreviewReady === true,
  }));
  const text = (doc, hook) => $(hook, doc)?.textContent ?? ''; // hooks: mr-verdict, mr-error, leaderboard-error
  const shown = (doc, hook) => { const el = $(hook, doc); return !!el && !el.hidden; }; // hooks: leaderboard-empty, server-offline, profile-card, history-empty
  const rows = (doc, hook) => doc.querySelectorAll(`[data-hook="${hook}"]`).length; // hooks: leaderboard-row, history-row
  const ready = {
    leaderboard: (doc) => rows(doc, 'leaderboard-row') > 0,
    'leaderboard-empty': (doc) => shown(doc, 'leaderboard-empty'),
    'leaderboard-error': (doc) => shown(doc, 'server-offline') && text(doc, 'leaderboard-error') !== '',
    profile: (doc) => shown(doc, 'profile-card') && rows(doc, 'history-row') > 0,
    'profile-empty': (doc) => shown(doc, 'profile-card') && shown(doc, 'history-empty'),
    'public-result': (doc) => /check/.test(text(doc, 'mr-verdict')) && !/checking/.test(text(doc, 'mr-verdict')),
    'public-result-error': (doc) => text(doc, 'mr-error') !== '',
  };
  const pages = PAGE_SCREENS.map(([name, label, src, focus]) => ({
    name,
    label,
    focus,
    src: src.replace('address=you', `address=${d.players.you}`).replace('id=match', `id=${d.matchId}`),
    ready: (w) => (ready[name] ? ready[name](w.document) : w.__ponsPreviewReady === true),
  }));
  return [...play, ...pages].filter((s) => !only || s.name === only);
}

/** Load one page in a hidden frame the size of the view and wait until its screen is built. */
function load(screen, view) {
  return new Promise((resolve, reject) => {
    const frame = fromTemplate('template-preview-frame'); // placed in preview.css, sized here
    frame.style.setProperty('--preview-width', `${view.width}px`);
    frame.style.setProperty('--preview-height', `${view.height}px`);
    frame.src = screen.src;
    document.body.append(frame);
    const started = Date.now();
    const check = () => {
      try {
        if (frame.contentWindow && frame.contentDocument?.readyState === 'complete' && screen.ready(frame.contentWindow)) return resolve(frame);
      } catch {
        /* not loaded yet */
      }
      if (Date.now() - started > 30_000) return reject(new Error(`${screen.name} did not finish building`));
      setTimeout(check, 100);
    };
    check();
  });
}

// This page's own style layer (web/style-layer.css, linked in preview.html) counts as copied already.
const copiedStyles = new Set([...document.querySelectorAll('head link[rel~="stylesheet"]')].map((l) => `link ${l.href}`));
const loadingSheets = [];

/**
 * Copy a page's styles into this page, once each, in the page's own order: linked stylesheets
 * (web/base.css, web/style-layer.css, any the design adds) and <style> elements.
 */
function copyStyles(doc) {
  for (const el of doc.querySelectorAll('head link[rel~="stylesheet"], head style')) {
    const key = el.tagName === 'LINK' ? `link ${new URL(el.getAttribute('href'), doc.baseURI).href}` : `style ${el.textContent}`;
    if (copiedStyles.has(key)) continue;
    copiedStyles.add(key);
    const copy = el.cloneNode(true);
    copy.dataset.previewCopied = '';
    if (el.tagName === 'LINK') {
      copy.href = new URL(el.getAttribute('href'), doc.baseURI).href;
      loadingSheets.push(new Promise((ok) => { copy.onload = ok; copy.onerror = ok; }));
    }
    document.head.append(copy);
  }
}

/**
 * Finish the copied styles: the style layer goes last (so it wins, as on the real pages), and every
 * rule written for the page's <html> or <body> also applies to each copied page here, where the
 * page's body became a div (data-preview-page-root) inside the screen's box (data-preview-body).
 * Such a rule still also reaches this preview page's own <html> and <body>.
 */
async function finishStyles() {
  // The style layer goes last, after every page's styles, as on the real pages: a fresh copy of the
  // link is added at the end, then the first one removed.
  for (const old of [...document.head.querySelectorAll('link[rel~="stylesheet"]')].filter((l) => /(^|\/)style-layer\.css$/.test(new URL(l.href).pathname))) {
    const copy = old.cloneNode(true);
    copy.dataset.previewCopied = '';
    loadingSheets.push(new Promise((ok) => { copy.onload = ok; copy.onerror = ok; }));
    document.head.append(copy);
    old.remove();
  }
  await Promise.all(loadingSheets);
  const rewrite = (selector) => selector.split(',').map((part) => part
    .replace(/(^|[\s>+~(])(html|body)(?=$|[\s>+~:.[#)])/g, (_, before, tag) => `${before}${tag === 'html' ? '[data-preview-body]' : '[data-preview-page-root]'}`)
  ).join(',');
  for (const el of document.head.querySelectorAll('[data-preview-copied]')) {
    const sheet = el.sheet;
    if (!sheet) continue;
    let rules;
    try { rules = [...sheet.cssRules]; } catch { continue; }
    for (const rule of rules) {
      // (Not instanceof CSSStyleRule: a sheet copied from a frame may keep that frame's classes.)
      if (typeof rule.selectorText !== 'string' || !/(^|[\s,>+~(])(html|body)(?=$|[\s,>+~:.[#)])/.test(rule.selectorText)) continue;
      const block = rule.cssText.slice(rule.cssText.indexOf('{'));
      try { sheet.insertRule(`${rewrite(rule.selectorText)} ${block}`, sheet.cssRules.length); } catch { /* a selector this browser refuses */ }
    }
  }
}

/** The canvas properties a copied picture keeps: [variable name, CSS property]. */
const PICTURE_PLACE = [['display', 'display'], ['position', 'position'], ['z', 'z-index'], ['left', 'left'], ['top', 'top'], ['right', 'right'], ['bottom', 'bottom']];

/** An element's inline style attribute as { property: value } (the chart library sets its canvases' places this way). */
function inlineStyle(el) {
  const out = {};
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const at = part.indexOf(':');
    if (at > 0) out[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).trim();
  }
  return out;
}

/** The parts that change in this state, as found in the frame: visible ones only. */
function focusParts(doc, screen) {
  return screen.focus.map((hook) => [...doc.querySelectorAll(`[data-hook="${hook}"]`)].find((e) => e.getClientRects().length > 0)).filter(Boolean);
}

/** How far down the window is scrolled to show the changed parts (fixed ones show wherever it is). */
function scrollFor(win, parts, view) {
  const fixed = (e) => { for (let a = e; a; a = a.parentElement) if (win.getComputedStyle(a).position === 'fixed') return true; return false; };
  const max = Math.max(0, win.document.documentElement.scrollHeight - view.height);
  const target = parts.find((e) => !fixed(e));
  if (!target) return Math.min(win.scrollY, max);
  const top = target.getBoundingClientRect().top + win.scrollY;
  return Math.max(0, Math.min(Math.round(top - 24), max));
}

/** Copy the frame's page into one view of the screen: its styles once, then its body, with canvases as pictures. */
function capture(screen, frame, view, section) {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  copyStyles(doc);
  // The changed parts, marked in the frame so the copy carries the mark.
  const parts = focusParts(doc, screen);
  const scroll = full ? 0 : scrollFor(win, parts, view);
  for (const e of parts) e.dataset.previewFocus = '';
  // Chart drawings: the copy of a canvas is blank, so each becomes a picture of what it shows.
  const pictures = [...doc.querySelectorAll('canvas')].map((c) => ({ src: c.toDataURL('image/png'), place: inlineStyle(c), w: c.clientWidth, h: c.clientHeight }));
  const body = doc.body.cloneNode(true);
  body.querySelectorAll('canvas').forEach((c, i) => {
    const img = fromTemplate('template-preview-picture');
    img.src = pictures[i].src;
    if (c.dataset.hook) img.dataset.hook = c.dataset.hook; // a page's own canvas keeps its hook
    img.hidden = c.hidden;
    // Where the canvas sat (the chart library positions its canvases inline), as variables preview.css uses.
    for (const [name, prop] of PICTURE_PLACE) if (pictures[i].place[prop]) img.style.setProperty(`--preview-picture-${name}`, pictures[i].place[prop]);
    img.style.setProperty('--preview-picture-width', `${pictures[i].w}px`);
    img.style.setProperty('--preview-picture-height', `${pictures[i].h}px`);
    c.replaceWith(img);
  });
  body.querySelectorAll('script').forEach((s) => s.remove());
  // The page's body becomes a div with the same attributes (data-hook="app", data-state, ...).
  const page = fromTemplate('template-preview-page-root');
  for (const a of body.attributes) page.setAttribute(a.name, a.value);
  page.dataset.previewPageRoot = '';
  page.append(...body.childNodes);
  // As the player sees it: the window (this box; fixed parts such as the tour sit in it), scrolled.
  page.style.setProperty('--preview-scroll', `${scroll}px`);

  const shown = fill(fromTemplate('template-preview-view'), { 'preview-view-caption': `${view.kind === 'phone' ? 'Phone' : 'Desktop'}, ${view.width} by ${view.height}${full ? ', whole page' : ''}` });
  shown.dataset.previewView = view.kind;
  const box = $('preview-screen-body', shown);
  box.style.setProperty('--preview-view-width', `${view.width}px`);
  if (!full) box.style.setProperty('--preview-view-height', `${view.height}px`);
  box.append(page);
  $('preview-screen-views', section).append(shown);
  frame.remove();
  if (!still) {
    // The duel circles grow from their starting size to where the match left them.
    for (const c of shown.querySelectorAll('[data-hook="duel-circle-me"], [data-hook="duel-circle-opponent"]')) {
      const end = c.style.getPropertyValue('--pons-duel-r');
      if (!end) continue;
      c.style.setProperty('--pons-duel-r', '50px');
      getComputedStyle(c).r; // the start size takes effect before the end size is set, so it animates
      setTimeout(() => c.style.setProperty('--pons-duel-r', end), 0);
    }
  }
}

/** The phone view of a screen: this page at phone width, showing only that screen's window. */
function phoneView(screen, sec) {
  return new Promise((resolve, reject) => {
    const view = viewOf(375);
    const shown = fill(fromTemplate('template-preview-phone'), { 'preview-phone-caption': `Phone, ${view.width} by ${view.height}${full ? ', whole page' : ''}` });
    shown.dataset.previewView = view.kind;
    const frame = $('preview-phone-frame', shown);
    frame.src = `preview.html?embed=1&screen=${encodeURIComponent(screen.name)}&width=${view.width}${still ? '&still=1' : ''}${full ? '&full=1' : ''}`;
    $('preview-screen-views', sec).append(shown);
    const started = Date.now();
    const check = () => {
      let state = null;
      try { state = frame.contentDocument?.body?.dataset.preview; } catch { /* not loaded yet */ }
      if (state === 'ready') {
        if (full) frame.style.setProperty('--preview-phone-height', `${frame.contentDocument.documentElement.scrollHeight}px`);
        return resolve();
      }
      if (state === 'failed' || Date.now() - started > 90_000) return reject(new Error(`${screen.name} did not finish building`));
      setTimeout(check, 100);
    };
    check();
  });
}

/** The screen's section: its label, the parts that change, a link to the whole page, then its views. */
function section(screen) {
  const width = params.get('width') ? `&width=${encodeURIComponent(params.get('width'))}` : '';
  const sec = fill(fromTemplate('template-preview-screen'), {
    'preview-screen-label': screen.label,
    'preview-screen-changed': screen.focus.join(', '),
    'preview-screen-full': { href: `preview.html?screen=${encodeURIComponent(screen.name)}${full ? '' : '&full=1'}${width}`, text: full ? 'The window only' : 'Full page' },
  });
  sec.dataset.previewScreen = screen.name;
  return sec;
}

async function build() {
  if (still) document.documentElement.dataset.previewStill = ''; // preview.css stops all motion
  const list = await screens();
  const status = $('preview-status');
  if (list.length === 0) {
    status.textContent = `No screen called "${only}".`;
    document.body.dataset.preview = 'ready';
    return;
  }
  const problems = [];
  if (full) document.documentElement.dataset.previewFull = '';
  for (const screen of list) {
    status.textContent = `Building ${screen.label}...`;
    const sec = section(screen);
    $('preview-screens').append(sec);
    for (const view of VIEWS) {
      try {
        capture(screen, await load(screen, view), view, sec);
      } catch (err) {
        problems.push(`${err.message} (${view.kind})`);
      }
    }
    if (PHONE) await phoneView(screen, sec).catch((err) => problems.push(`${err.message} (phone)`));
  }
  await finishStyles();
  status.textContent = problems.length ? `Some screens did not build: ${problems.join('; ')}` : `${list.length} screen${list.length === 1 ? '' : 's'}.`;
  document.body.dataset.preview = problems.length ? 'failed' : 'ready';
}

build();

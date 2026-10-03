// PonsStars' own price chart: candlesticks (or a line and a shaded window), a price scale on the
// right, a time scale along the bottom, grid lines, the last price, and buy and sell arrows. It
// draws on one <canvas> that is already in the page's markup (index.html `chart-canvas`,
// library.html `lib-chart-canvas`), with no outside library and no requests.
//
// Bars are placed by their order (bar i at a fixed spacing), as before: the newest bar sits near the
// right edge, `rightOffset` bars in. Times are in seconds (UTC), prices are plain numbers.
// Drawing happens at the end of the current task (a microtask), so it needs no animation frames
// and works in a background tab (the design preview builds screens there).
import { TOKENS } from './tokens.js';

const SCALE_WIDTH = 64; // the price scale on the right, in CSS pixels
const TIME_HEIGHT = 26; // the time scale along the bottom
const FONT_SIZE = 11;
const MIN_LABEL_GAP = 72; // pixels between time labels at least
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600, 43200, 86400];

/** A step for price grid lines: 1, 2, 2.5 or 5 times a power of ten, about `target` per range. */
export function niceStep(range, target) {
  if (!(range > 0) || !(target > 0)) return 1;
  const raw = range / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/** Decimals that show a price step exactly (at most 8). */
export function decimalsFor(step) {
  for (let d = 0; d <= 8; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  return 8;
}

/** "14:05:30" (UTC) for a time in seconds; without seconds when `seconds` is false. */
export function timeLabel(t, seconds = true) {
  const d = new Date(t * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${seconds ? `:${p(d.getUTCSeconds())}` : ''}`;
}

/** The first index whose time is >= t in a list sorted by time (binary search). */
function lowerBound(list, t) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Make a chart on `canvas`. Options: precision (decimals of the price scale; worked out from the
 * scale when not given), barSpacing, maxBarSpacing, rightOffset (in bars), autoSize (follow the
 * canvas's own size), seconds (show seconds on the time scale).
 */
export function createPonsChart(canvas, options = {}) {
  const o = { barSpacing: 8, maxBarSpacing: 14, rightOffset: 4, precision: null, seconds: true, ...options };
  const look = {
    background: TOKENS['--pons-chart-background'], text: TOKENS['--pons-chart-text'],
    grid: TOKENS['--pons-chart-grid'], border: TOKENS['--pons-chart-border'], font: '',
  };
  const series = [];
  const listeners = [];
  let size = { width: 0, height: 0 };
  let fit = false; // true: every bar fits the width; false: the newest bars at the right edge
  let queued = false;

  const pane = () => ({ width: Math.max(0, size.width - SCALE_WIDTH), height: Math.max(0, size.height - TIME_HEIGHT) });
  /** The series that sets the bar positions: the one with the most points. */
  const main = () => series.reduce((a, s) => (!a || s.points.length > a.points.length ? s : a), null);
  const spacing = () => {
    const n = main()?.points.length ?? 0;
    if (!fit || !n) return o.barSpacing;
    return Math.min(o.maxBarSpacing, Math.max(0.5, pane().width / (n + o.rightOffset)));
  };
  /** x of bar `i` (its centre) in the main series. */
  const xOf = (i) => {
    const n = main()?.points.length ?? 0;
    return pane().width - (o.rightOffset + (n - 1 - i) + 0.5) * spacing();
  };
  /** The prices on screen: min and max over the visible bars of every series, with a margin. */
  const priceRange = () => {
    const m = main();
    if (!m) return null;
    const first = Math.max(0, Math.floor(m.points.length - 1 - (pane().width / spacing() - o.rightOffset)) - 1);
    const from = m.points[first]?.time ?? -Infinity;
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      for (let i = lowerBound(s.points, from); i < s.points.length; i++) {
        const p = s.points[i];
        lo = Math.min(lo, p.low ?? p.value);
        hi = Math.max(hi, p.high ?? p.value);
      }
    }
    if (!Number.isFinite(lo)) return null;
    const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.1;
    return { lo: lo - pad, hi: hi + pad };
  };
  const yOf = (price, r = priceRange()) => {
    if (!r) return null;
    return ((r.hi - price) / (r.hi - r.lo)) * pane().height;
  };

  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      draw();
      for (const fn of listeners) fn();
    });
  }

  function draw() {
    const ratio = globalThis.devicePixelRatio || 1;
    const w = Math.round(size.width * ratio);
    const h = Math.round(size.height * ratio);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g || !w || !h) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    const { width: pw, height: ph } = pane();
    g.fillStyle = look.background;
    g.fillRect(0, 0, size.width, size.height);
    g.font = `${FONT_SIZE}px ${look.font || getComputedStyle(canvas).fontFamily || 'sans-serif'}`;
    g.textBaseline = 'middle';
    const r = priceRange();
    const m = main();
    const sp = spacing();

    // Grid and price scale.
    const lastPoint = main()?.points.at(-1);
    const lastY = r && lastPoint ? yOf(lastPoint.close ?? lastPoint.value, r) : null;
    if (r) {
      const step = niceStep(r.hi - r.lo, Math.max(2, ph / 40));
      const dec = o.precision ?? decimalsFor(step);
      g.strokeStyle = look.grid;
      g.lineWidth = 1;
      g.fillStyle = look.text;
      g.textAlign = 'left';
      for (let p = Math.ceil(r.lo / step) * step; p <= r.hi; p += step) {
        const y = Math.round(yOf(p, r)) + 0.5;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(pw, y);
        g.stroke();
        // Not under the last-price label.
        if (y > FONT_SIZE / 2 && y < ph - FONT_SIZE / 2 && (lastY == null || Math.abs(y - lastY) > 14)) g.fillText(p.toFixed(dec), pw + 6, y);
      }
    }
    // Time scale: labels on round times, at least MIN_LABEL_GAP apart, with grid lines.
    if (m && m.points.length) {
      const pts = m.points;
      const perBar = pts.length > 1 ? Math.max(1, (pts.at(-1).time - pts[0].time) / (pts.length - 1)) : 1;
      const stepSecs = TIME_STEPS.find((s) => (s / perBar) * sp >= MIN_LABEL_GAP) ?? TIME_STEPS.at(-1);
      g.textAlign = 'center';
      let lastX = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const x = xOf(i);
        if (x < 0 || x > pw) continue;
        if (pts[i].time % stepSecs !== 0 || x - lastX < MIN_LABEL_GAP) continue;
        lastX = x;
        g.strokeStyle = look.grid;
        g.beginPath();
        g.moveTo(Math.round(x) + 0.5, 0);
        g.lineTo(Math.round(x) + 0.5, ph);
        g.stroke();
        g.fillStyle = look.text;
        g.fillText(timeLabel(pts[i].time, o.seconds), x, ph + TIME_HEIGHT / 2);
      }
    }
    // Scale borders.
    g.strokeStyle = look.border;
    g.beginPath();
    g.moveTo(pw + 0.5, 0);
    g.lineTo(pw + 0.5, ph);
    g.moveTo(0, ph + 0.5);
    g.lineTo(size.width, ph + 0.5);
    g.stroke();

    // The series, clipped to the pane.
    g.save();
    g.beginPath();
    g.rect(0, 0, pw, ph);
    g.clip();
    for (const s of series) if (r) s.draw(g, r, sp);
    g.restore();

    // The last price: a dotted line and a label on the scale.
    const last = m?.points.at(-1);
    if (r && last) {
      const value = last.close ?? last.value;
      const y = Math.round(yOf(value, r)) + 0.5;
      const color = m.lastColor(last);
      g.strokeStyle = color;
      g.setLineDash([1, 2]);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(pw, y);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = color;
      g.fillRect(pw + 1, y - 9, SCALE_WIDTH - 1, 18);
      g.fillStyle = look.background;
      g.textAlign = 'left';
      const step = niceStep(r.hi - r.lo, Math.max(2, ph / 40));
      g.fillText(value.toFixed(o.precision ?? decimalsFor(step)), pw + 6, y);
    }
  }

  /** What every series shares: its points (sorted by time), and finding a point. */
  function baseSeries(kind) {
    const s = {
      kind,
      points: [],
      setData(points) {
        s.points = [...points].sort((a, b) => a.time - b.time);
        schedule();
      },
      /** Add a new point, or replace the last one when it has the same time (as live candles do). */
      update(point) {
        const last = s.points.at(-1);
        if (last && last.time === point.time) s.points[s.points.length - 1] = point;
        else if (!last || point.time > last.time) s.points.push(point);
        schedule();
      },
      data: () => s.points,
      priceToCoordinate: (price) => yOf(price),
      applyOptions(opts) {
        Object.assign(s.opts, opts);
        schedule();
      },
    };
    return s;
  }

  const api = {
    /** Candlesticks, up and down colours from the options (upColor, downColor). */
    addCandles(given = {}) {
      const s = baseSeries('candles');
      s.opts = { upColor: TOKENS['--pons-candle-up'], downColor: TOKENS['--pons-candle-down'], ...given };
      s.markers = [];
      s.lastColor = (b) => (b.close >= b.open ? s.opts.upColor : s.opts.downColor);
      /** Buy and sell arrows: { time, position: 'belowBar' | 'aboveBar', color }. */
      s.setMarkers = (markers) => {
        s.markers = markers ?? [];
        schedule();
      };
      s.draw = (g, r, sp) => {
        const body = Math.max(1, Math.floor(sp * 0.8));
        const { width: pw } = pane();
        for (let i = 0; i < s.points.length; i++) {
          const x = xOf(i);
          if (x < -sp || x > pw + sp) continue;
          const b = s.points[i];
          g.fillStyle = s.lastColor(b);
          const yo = yOf(b.open, r);
          const yc = yOf(b.close, r);
          const xi = Math.round(x);
          g.fillRect(xi, Math.round(yOf(b.high, r)), 1, Math.max(1, Math.round(yOf(b.low, r) - yOf(b.high, r))));
          g.fillRect(xi - Math.floor(body / 2), Math.round(Math.min(yo, yc)), body, Math.max(1, Math.round(Math.abs(yc - yo))));
        }
        for (const mk of s.markers) {
          const i = lowerBound(s.points, mk.time);
          const b = s.points[i];
          if (!b || b.time !== mk.time) continue;
          const x = Math.round(xOf(i));
          const below = mk.position === 'belowBar';
          const y = below ? yOf(b.low, r) + 6 : yOf(b.high, r) - 6;
          const dir = below ? 1 : -1; // the arrow points at the candle
          g.fillStyle = mk.color;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - 4, y + dir * 5);
          g.lineTo(x + 4, y + dir * 5);
          g.closePath();
          g.fill();
          g.fillRect(x - 1, below ? y + 5 : y - 9, 2, 4);
        }
      };
      series.push(s);
      return s;
    },
    /** A line (points { time, value }); with topColor and bottomColor, shaded down to the bottom. */
    addLine(given = {}) {
      const s = baseSeries('line');
      s.opts = { color: TOKENS['--pons-library-line'], lineWidth: 1, ...given };
      s.lastColor = () => s.opts.color;
      s.draw = (g, r) => {
        const m = main();
        if (!s.points.length || !m) return;
        // Placed by time against the main series, so a window lines up with the recording.
        const xs = s.points.map((p) => {
          const i = lowerBound(m.points, p.time);
          return xOf(Math.min(i, m.points.length - 1));
        });
        const ys = s.points.map((p) => yOf(p.value, r));
        if (s.opts.topColor) {
          const grad = g.createLinearGradient(0, 0, 0, pane().height);
          grad.addColorStop(0, s.opts.topColor);
          grad.addColorStop(1, s.opts.bottomColor ?? s.opts.topColor);
          g.fillStyle = grad;
          g.beginPath();
          g.moveTo(xs[0], pane().height);
          xs.forEach((x, i) => g.lineTo(x, ys[i]));
          g.lineTo(xs.at(-1), pane().height);
          g.closePath();
          g.fill();
        }
        g.strokeStyle = s.opts.color;
        g.lineWidth = s.opts.lineWidth;
        g.beginPath();
        xs.forEach((x, i) => (i ? g.lineTo(x, ys[i]) : g.moveTo(x, ys[i])));
        g.stroke();
      };
      series.push(s);
      return s;
    },
    /** The chart's look: { layout: { background: { color }, textColor, fontFamily }, grid, rightPriceScale: { borderColor } }. */
    applyOptions(opts = {}) {
      if (opts.layout?.background?.color) look.background = opts.layout.background.color;
      if (opts.layout?.textColor) look.text = opts.layout.textColor;
      if (opts.layout?.fontFamily) look.font = opts.layout.fontFamily;
      if (opts.grid?.horzLines?.color) look.grid = opts.grid.horzLines.color;
      if (opts.rightPriceScale?.borderColor) look.border = opts.rightPriceScale.borderColor;
      schedule();
    },
    resize(width, height) {
      if (width === size.width && height === size.height) return;
      size = { width, height };
      schedule();
    },
    paneSize: pane,
    timeScale: () => ({
      timeToCoordinate(t) {
        const m = main();
        if (!m) return null;
        const i = lowerBound(m.points, t);
        return m.points[i]?.time === t ? xOf(i) : null;
      },
      subscribeVisibleLogicalRangeChange(fn) {
        listeners.push(fn);
      },
      applyOptions(opts = {}) {
        if (opts.barSpacing) {
          o.barSpacing = opts.barSpacing;
          fit = false;
        }
        schedule();
      },
      fitContent() {
        fit = true;
        schedule();
      },
      scrollToRealTime() {
        fit = false;
        schedule();
      },
    }),
  };
  if (o.autoSize) {
    const measure = () => api.resize(Math.floor(canvas.clientWidth), Math.floor(canvas.clientHeight));
    measure();
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(canvas);
    else addEventListener('resize', measure);
  }
  return api;
}

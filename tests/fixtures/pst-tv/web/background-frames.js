// For a page the design preview builds while its browser tab is in the background (web/preview.js):
// a background tab runs no animation frames and delivers no resize observations, and the chart
// library waits for both before it draws. In that case only, frames come from timers and sizes
// are measured directly, so the screen still builds and its chart is still drawn.
const observers = new Set();

export function keepDrawingInBackground() {
  if (document.visibilityState !== 'hidden') return;
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      observers.add(this);
    }
    observe(target) {
      this.targets.add(target);
      setTimeout(() => this.report(), 0);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
      observers.delete(this);
    }
    report() {
      const ratio = window.devicePixelRatio || 1;
      const entries = [...this.targets].map((target) => {
        const r = target.getBoundingClientRect();
        const size = { inlineSize: r.width, blockSize: r.height };
        return { target, contentRect: r, contentBoxSize: [size], borderBoxSize: [size], devicePixelContentBoxSize: [{ inlineSize: Math.round(r.width * ratio), blockSize: Math.round(r.height * ratio) }] };
      });
      if (entries.length) this.callback(entries, this);
    }
  };
}

/** Measure every observed element again (after the page has settled), as the browser would. */
export function remeasure() {
  for (const o of observers) o.report();
}

/**
 * SMOOTH SCROLLING THAT A PERSON CAN FEEL (J, 2026-10-10: "on the preview
 * scroll is as normal").
 *
 * The switch wrote `scroll-behavior: smooth` and nothing else. That eases a
 * jump made by a link or a script; a wheel or a trackpad still moves the
 * page in steps, so the Preview and the published page scrolled exactly as
 * before. This takes the wheel: each notch moves a target, and the page
 * glides toward it a little every frame, so scrolling eases to a stop.
 * "light" settles in about a third of a second, "heavy" takes longer.
 *
 * A script, so the Preview (`LiveShell`, on its scroller), the published
 * page (`siteMotion.ts`) and the kit's `vendor/builder-motion.js` run the
 * same lines. It defines `smoothWheel(box, strength)`: `box` is the element
 * that scrolls, or null for the window; it returns what turns it off.
 *
 * Left to the browser: a pinch (ctrl + wheel), a sideways scroll, a wheel
 * over a part that scrolls on its own and still can, and anyone who asks
 * for less motion (the caller checks). A scrollbar drag or a key press
 * stops the glide where the page is.
 */
export const SMOOTH_WHEEL_JS = `function smoothWheel(box, strength) {
  var win = !box, el = box || document.scrollingElement || document.documentElement;
  /* How much of the way is covered each frame (at 60 a second). */
  var ease = strength === "heavy" ? 0.055 : 0.11;
  var target = null, cur = 0, raf = 0, last = 0, mine = -1;
  function top() { return win ? (window.scrollY || el.scrollTop || 0) : el.scrollTop; }
  function room() { return Math.max(0, el.scrollHeight - (win ? window.innerHeight : el.clientHeight)); }
  function set(y) { mine = y; (win ? window : el).scrollTo({ top: y, behavior: "instant" }); }
  function own(t, dy) {
    for (var n = t; n && n.nodeType === 1 && n !== el && n !== document.body; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      if (!/(auto|scroll|overlay)/.test(getComputedStyle(n).overflowY)) continue;
      if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
    }
    return false;
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; target = null; last = 0; }
  function step(now) {
    var dt = last ? Math.min(64, now - last) : 16.67;
    last = now;
    cur += (target - cur) * (1 - Math.pow(1 - ease, dt / 16.67));
    if (Math.abs(target - cur) < 0.5) { set(target); stop(); return; }
    set(cur);
    raf = requestAnimationFrame(step);
  }
  function wheel(e) {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
    if (own(e.target, e.deltaY)) return;
    var dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? (win ? window.innerHeight : el.clientHeight) : 1);
    e.preventDefault();
    if (target === null) { cur = top(); target = cur; }
    target = Math.max(0, Math.min(room(), target + dy));
    if (!raf) { last = 0; raf = requestAnimationFrame(step); }
  }
  /* Something else moved the page (a scrollbar, a key, a link): the glide lets go. */
  function scrolled() { if (raf && Math.abs(top() - mine) > 2) stop(); }
  var on = win ? window : el;
  on.addEventListener("wheel", wheel, { passive: false });
  on.addEventListener("scroll", scrolled, { passive: true });
  return function () { stop(); on.removeEventListener("wheel", wheel); on.removeEventListener("scroll", scrolled); };
}`;

/**
 * A TILTED PART COMES UP OVER ITS NEIGHBOURS (J, 2026-10-10: "the effect
 * would be a lot more 3d if it didnt stay under the other pieces").
 *
 * A part that tilts toward the pointer is drawn where the page puts it: a
 * panel drawn before the one beside it stayed under it while it leaned out,
 * so its corner went behind the next panel. While it tilts, this lifts it
 * (and any box around it that is a layer of its own, which would keep it
 * underneath otherwise) above the parts around it, and gives the page back
 * its own order once it has settled.
 *
 * A script, so the Preview (`behaviourScripts/motion.ts` Tilt, `LiveShell`),
 * the published page (`siteMotion.ts`) and the kit's `vendor/builder-motion.js`
 * run the same lines. It defines `raiseOver(nodes)`, which raises them and
 * returns the function that puts them back.
 */
export const RAISE_JS = `function raiseOver(nodes) {
  /* Each box keeps what it had and how many tilts hold it up, so one settling late never leaves another down, or up. */
  /* The newest tilt is drawn over one still settling: a panel just left goes under the one the pointer moved to. */
  var R = window.__builderRaise || (window.__builderRaise = { on: 0, top: 0 }), top = ++R.top;
  R.on++;
  var kept = [], seen = [];
  function layer(c) { return c.zIndex !== "auto" || c.transform !== "none" || Number(c.opacity) < 1 || c.filter !== "none" || c.isolation === "isolate" || /transform|opacity|filter/.test(c.willChange || ""); }
  nodes.forEach(function (p) {
    for (var n = p; n && n.nodeType === 1 && n !== n.ownerDocument.body && n !== n.ownerDocument.documentElement; n = n.parentElement) {
      if (seen.indexOf(n) >= 0) break;
      seen.push(n);
      var h = n.__raised;
      if (h) { h.n++; kept.push(n); n.style.zIndex = String(h.base + top); continue; }
      var c = getComputedStyle(n);
      if (n !== p && !layer(c)) continue;
      n.__raised = { n: 1, z: n.style.zIndex, pos: n.style.position, base: 1000 + (parseInt(c.zIndex, 10) || 0) };
      kept.push(n);
      var up = n.parentElement ? getComputedStyle(n.parentElement).display : "";
      if (c.position === "static" && !/flex|grid/.test(up)) n.style.position = "relative";
      n.style.zIndex = String(n.__raised.base + top);
    }
  });
  var done = false;
  return function () {
    if (done) return;
    done = true;
    kept.forEach(function (n) { var h = n.__raised; if (h && --h.n <= 0) { n.style.zIndex = h.z; n.style.position = h.pos; n.__raised = null; } });
    if (--R.on <= 0) { R.on = 0; R.top = 0; }
    kept = [];
  };
}`;

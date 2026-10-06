/**
 * A spotlight on one part: everything else on the board dimmed, other
 * panels too, and a pulsing outline round it. One layer with a hole where
 * the part is, fixed over the board's visible area beside the rail and
 * above everything on it, so no part drawn after or above the hovered one
 * stays bright (J, 2026-10-06). Follows the
 * part while the board scrolls; the returned function takes it away.
 */
export function spotlight(id: string): () => void {
  const rail = document.querySelector("[data-panels-page]");
  const host = rail?.parentElement;
  if (!(host instanceof HTMLElement)) return () => {};
  const layer = document.createElement("div");
  layer.setAttribute("data-panel-spotlight", id);
  Object.assign(layer.style, { position: "fixed", overflow: "hidden", pointerEvents: "none", zIndex: "9000" });
  const hole = document.createElement("div");
  Object.assign(hole.style, { position: "absolute", borderRadius: "6px", boxShadow: "0 0 0 9999px oklch(0 0 0 / 0.55)", outline: "3px solid oklch(0.8 0.17 150)", outlineOffset: "3px" });
  layer.appendChild(hole);
  document.body.appendChild(layer);
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const pulse = still || !hole.animate ? null : hole.animate([{ outlineOffset: "3px", outlineColor: "oklch(0.8 0.17 150)" }, { outlineOffset: "7px", outlineColor: "oklch(0.8 0.17 150 / 0.55)" }], { duration: 700, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
  let frame = 0;
  const follow = () => {
    const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    const b = host.getBoundingClientRect(), rl = rail!.getBoundingClientRect();
    const h = { left: b.left, top: b.top, width: (rl.left > b.left ? Math.min(b.right, rl.left) : b.right) - b.left, height: b.height };
    Object.assign(layer.style, { left: `${h.left}px`, top: `${h.top}px`, width: `${h.width}px`, height: `${h.height}px` });
    const r = el instanceof HTMLElement ? el.getBoundingClientRect() : null;
    if (r) Object.assign(hole.style, { left: `${r.left - h.left}px`, top: `${r.top - h.top}px`, width: `${r.width}px`, height: `${r.height}px`, display: "" });
    else hole.style.display = "none";
    frame = requestAnimationFrame(follow);
  };
  follow();
  return () => { cancelAnimationFrame(frame); pulse?.cancel(); layer.remove(); };
}

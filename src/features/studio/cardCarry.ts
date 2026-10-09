/**
 * A SHELF CARD PICKED UP AND CARRIED TO A PART.
 *
 * J (2026-10-09): "I drag and the card comes out and carries over instead
 * of the transparent version of the card ... a physical drag and drop
 * motion of it so I can drop it onto whatever element and it takes that
 * motion, instead of creating a new text box." The browser's own drag
 * draws a faint ghost and cannot say what is under it. So a card is lifted
 * by the pointer instead: a solid copy of the card follows the hand, tipped
 * and shadowed, the part under it is ringed with what it will take, and on
 * let go the card's `drop` decides what happens there. Dropped where it
 * cannot go, the card flies back to its place on the shelf.
 *
 * The same lift serves "Put it on" with no part picked (`armPutOn`): the
 * next part pressed on the board takes it, rather than a new text box.
 */

/** Where a carried card was let go. */
export interface CarryDrop {
  /** The board part under the hand, if any. */
  node: string | null;
  /** Over the board (the page being designed), part or not. */
  overBoard: boolean;
  clientX: number;
  clientY: number;
}

export interface CarryOptions {
  /** What the ring under the hand says the part will take ("Push on press"). */
  what: string;
  /** Whether this card can land on a part (an effect), or only on the board (a new part). */
  ontoPart: boolean;
  /** Called on let go. True when it landed; false sends the card back. */
  drop: (d: CarryDrop) => boolean;
}

const MOVE_PX = 6;

/** The board part under a point, skipping anything carried or ringed. */
export function partAt(x: number, y: number): { node: HTMLElement | null; overBoard: boolean } {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const el of els) {
    if (el.closest("[data-card-carried],[data-carry-ring]")) continue;
    const board = el.closest("[data-board-tool]");
    if (!board) return { node: null, overBoard: false };
    return { node: el.closest<HTMLElement>("[data-node-id]"), overBoard: true };
  }
  return { node: null, overBoard: false };
}

function ring(): HTMLDivElement {
  const r = document.createElement("div");
  r.setAttribute("data-carry-ring", "");
  r.style.cssText = "position:fixed;z-index:2147483600;pointer-events:none;display:none;border-radius:6px;" +
    "box-shadow:0 0 0 2px rgb(125 211 252),0 0 18px 4px rgb(125 211 252 / .55);transition:left 80ms,top 80ms,width 80ms,height 80ms";
  const say = document.createElement("span");
  say.style.cssText = "position:absolute;left:0;top:-24px;white-space:nowrap;font:600 11px/1 system-ui,sans-serif;padding:5px 7px;border-radius:5px;background:rgb(125 211 252);color:#06121c";
  r.appendChild(say);
  document.body.appendChild(r);
  return r;
}

function showRing(r: HTMLDivElement, node: HTMLElement | null, text: string) {
  if (!node) { r.style.display = "none"; return; }
  const b = node.getBoundingClientRect();
  Object.assign(r.style, { display: "block", left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  (r.firstChild as HTMLElement).textContent = text;
}

/**
 * Lift a card on pointer down. Nothing happens until the hand moves a few
 * pixels, so a press is still a press (it opens the card).
 */
export function liftCard(e: PointerEvent | { button: number; clientX: number; clientY: number; target: EventTarget | null; pointerId?: number }, card: HTMLElement, opts: CarryOptions) {
  if (e.button !== 0) return;
  const t = e.target as HTMLElement | null;
  /* The card's own controls (its switch, its links) stay controls. */
  if (t?.closest("button:not([data-tile]):not([data-carry-ok]),a,input,label,[role=switch]")) return;
  const x0 = e.clientX, y0 = e.clientY;
  let carried: HTMLElement | null = null;
  let r: HTMLDivElement | null = null;
  let dx = 0, dy = 0;

  const begin = () => {
    const box = card.getBoundingClientRect();
    dx = x0 - box.left; dy = y0 - box.top;
    carried = card.cloneNode(true) as HTMLElement;
    carried.setAttribute("data-card-carried", card.getAttribute("data-shelf-card") ?? "");
    carried.removeAttribute("data-shelf-card");
    carried.removeAttribute("data-work-card");
    carried.style.cssText += `;position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;margin:0;z-index:2147483601;` +
      "pointer-events:none;opacity:1;transform-origin:var(--carry-ox) var(--carry-oy);transform:scale(.92) rotate(-3deg);" +
      "box-shadow:0 22px 48px rgb(0 0 0 / .55),0 0 0 1px rgb(125 211 252 / .7);transition:transform 140ms ease-out;cursor:grabbing";
    carried.style.setProperty("--carry-ox", `${dx}px`);
    carried.style.setProperty("--carry-oy", `${dy}px`);
    document.body.appendChild(carried);
    card.style.opacity = "0.3";
    document.documentElement.style.cursor = "grabbing";
    if (opts.ontoPart) r = ring();
  };

  const move = (ev: PointerEvent) => {
    if (!carried) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < MOVE_PX) return;
      begin();
    }
    ev.preventDefault();
    carried!.style.left = `${ev.clientX - dx}px`;
    carried!.style.top = `${ev.clientY - dy}px`;
    if (r) {
      const at = partAt(ev.clientX, ev.clientY);
      showRing(r, at.node, `Drop to give it ${opts.what}`);
    }
  };

  const end = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
    if (!carried) return;
    /* The press that ends a carry is not a press on the card. */
    const swallow = (c: Event) => { c.stopPropagation(); c.preventDefault(); };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, true), 50);
    const at = partAt(ev.clientX, ev.clientY);
    const landed = ev.type === "pointerup" && opts.drop({ node: at.node?.getAttribute("data-node-id") ?? null, overBoard: at.overBoard, clientX: ev.clientX, clientY: ev.clientY });
    const c = carried;
    r?.remove();
    document.documentElement.style.cursor = "";
    const back = card.getBoundingClientRect();
    if (landed) {
      c.style.transition = "transform 180ms ease-in, opacity 180ms ease-in";
      c.style.transform = "scale(.4)";
      c.style.opacity = "0";
    } else {
      c.style.transition = "left 260ms cubic-bezier(.2,.8,.2,1), top 260ms cubic-bezier(.2,.8,.2,1), transform 260ms";
      c.style.left = `${back.left}px`;
      c.style.top = `${back.top}px`;
      c.style.transform = "none";
    }
    window.setTimeout(() => { c.remove(); card.style.opacity = ""; }, landed ? 190 : 270);
  };

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
  window.addEventListener("pointercancel", end, true);
}

let armed: (() => void) | null = null;

/**
 * "Put it on" with nothing picked: the next part pressed on the board takes
 * it. A chip by the hand says so; Escape, or a press off the board, stops.
 */
export function armPutOn(what: string, apply: (nodeId: string) => void): () => void {
  armed?.();
  const chip = document.createElement("div");
  chip.setAttribute("data-put-on-armed", what);
  chip.style.cssText = "position:fixed;z-index:2147483602;pointer-events:none;left:0;top:0;transform:translate(14px,14px);white-space:nowrap;" +
    "font:600 12px/1 system-ui,sans-serif;padding:7px 9px;border-radius:6px;background:rgb(125 211 252);color:#06121c;box-shadow:0 8px 20px rgb(0 0 0 / .4)";
  chip.textContent = `Press the part that should take ${what} · Esc to stop`;
  document.body.appendChild(chip);
  const r = ring();
  const move = (e: PointerEvent) => {
    chip.style.left = `${e.clientX}px`;
    chip.style.top = `${e.clientY}px`;
    showRing(r, partAt(e.clientX, e.clientY).node, `Give it ${what}`);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const at = partAt(e.clientX, e.clientY);
    if (!at.overBoard) { stop(); return; }
    if (!at.node) return;
    e.preventDefault();
    e.stopPropagation();
    const id = at.node.getAttribute("data-node-id");
    stop();
    if (id) apply(id);
  };
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); stop(); } };
  const stop = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("keydown", key, true);
    chip.remove();
    r.remove();
    if (armed === stop) armed = null;
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("keydown", key, true);
  armed = stop;
  return stop;
}

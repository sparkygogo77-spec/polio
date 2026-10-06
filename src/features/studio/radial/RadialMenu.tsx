"use client";
/**
 * The part menu: four quadrants round the pointer.
 *
 * Right-click a part and a ring of glass opens around the point you clicked,
 * cut into quadrants. The quadrant facing the middle of the screen is left
 * **empty** — that is where your eye and your next move already are, and it is
 * where the second level will open. The pointer keeps a small circle of clear
 * space, with the lock sitting in it as a tiny toggle: the one control that is
 * neither a menu nor a page away.
 *
 * Each working quadrant is cut once more, at a middle radius: an inner band
 * near the pointer and an outer block beyond it. That is what gives six
 * buttons out of three quadrants without any of them being a sliver.
 *
 *          empty  │  Animation · pencil · More (inner) · Draw (outer)
 *        ─────────●─────────
 *         Delete  │  Duplicate · Edit (inner) · Looks (outer)
 *
 * Delete is the whole quadrant under the empty one, undivided — the same
 * outline as the quadrant opposite it, mirrored, so it reads as one slab and
 * never as a sliver you could hit by accident. The two working quadrants
 * are cut the same way: icons on the inner band, one word on the outer
 * block, so a hand that has learned one has learned the other. More is the
 * few things that are about the part but not about editing it — seeing it
 * live, its place among the others, carrying its looks — as a piece of the
 * wheel: they hung under it on a tab once, and a tab outside the wheel was
 * a bar sticking out of an object.
 *
 * Levels:
 *   1  blue     the seven above, plus the lock in the middle
 *   2  green    replaces the blue entirely, in the quadrant that was empty
 *   3  crimson  the editor the green choice needs, on the three quadrants
 *               the green is not using — three more slabs like Delete
 *   —  board    Draw skips the levels: the whole wheel becomes one dark disc
 *               to draw on (`DrawBoard.tsx`), with no hole in the middle
 *
 * Every piece is one SVG path — arc in, out along a seam, round the outside,
 * back down the next seam — so the geometry is the hit area. The outer edge is
 * cut square by default and can be swept round instead (the ◻/◯ chip on the
 * menu itself), which is the draft option to compare against.
 */
/* Alphabetical by imported name, so a merge from any branch resolves the
   same way: this line conflicted three times in one night otherwise.
   Sorted is not the same as union — an icon dropped on purpose stays
   dropped, and the wheel's Edit slot is why. */
import { canRemake, openRemake } from "../RemakePicture";
import { canClearBackground, openClearBackground } from "../ClearBackground";
import * as React from "react";
import { ChevronsDown, ChevronsUp, ClipboardPaste, CopyPlus, Shuffle, Paintbrush, Ellipsis, Eraser, Eye, History, Lock, Maximize2, Pipette, Plus, Sparkles, Type, Undo2, Unlock } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { AddDisc } from "../AddDisc";
import { BACKGROUND_ID, heldBackground, livePath, useStudio } from "../store";
import { createSpaceAt } from "../createSpace";
import { PREVIEW } from "../colourMenu";
import { BackgroundEditor } from "../BackgroundEditors";
import { openImport } from "../ImportFlow";
import {
BLUE_RINGS, GREEN_RINGS, middleOf, piece, Q_BOTTOM, Q_DELETE, Q_EMPTY, Q_TOP, QUADS, ROUND, type Pt
} from "../menuGeometry";
import { QuadrantConsole, type ConsoleSpan } from "../RingEditors";
import { movedColours, movedFont, type Worn } from "../siteColours";
import { DrawBoard } from "../DrawBoard";
import { CONSOLE, HoverTray, type TrayItem } from "../RingConsole";
import { overrideTheme, resolvePalette, themeFrom } from "../parts/theme";
import { auraColour, lands, textureCss } from "../look";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { makeSolid } from "../solidRun";
import { lookOf } from "../partLook";
import { makeAllLike, pasteLook, pasteTargets, useLookClip, useMakeAll } from "../partLookApply";
import { openRemix } from "../RemixCard";
import { hasStates } from "../StatesTimeline";
import { openPanelsPage, panelOf } from "../PanelsPage";
import { pagePanels, type PanelNode } from "../panels";
import type { StudioNode } from "../store";
import type { ScreenRead } from "../boardStates";
import { openPartFocus } from "../PartFocus";
import { frameFor } from "../stateFrames";
import { current, openedAt, pageSpot, openRadial, openBoard, closeRadial, moveRadial, useRadial } from "./open";
import { PULL_FROM, PULL_LOCK, TRAY_DROP, PullStage, Pull, SlotId, Slot, SLOTS, GREEN, GREEN_SHRINK, ANIM_SLAB, Choice, choicesFor, SLOTS_BG, bgChoicesFor } from "./choices";
import { PullLine, PullEnds, RingPiece, inkOn, Ring, HueSwatch, textureWear, AuraSwatch, Editor } from "./ring";

/* ------------------------------------------------------------------ */
/* Opening it                                                          */
/* ------------------------------------------------------------------ */

export function RadialMenu() {
  const open = useRadial();
  const ctx = useActions();
  const [picked, setPicked] = React.useState<SlotId | null>(null);
  const [subPick, setSubPick] = React.useState<string | null>(null);
  // The pencil's old five, shown under "more" instead of the one box's pair.
  const [writeMore, setWriteMore] = React.useState(false);
  // The page's wheel turned into the add disc: pressed from its middle.
  const [adding, setAdding] = React.useState(false);
  // Re-renders the tray when looks are copied, so Paste lights up.
  const [, setCarried] = React.useState(0);
  /* The look Copy look holds (partLookApply.ts), here or on another board. */
  const heldLook = useLookClip((st) => st.look);
  const nodes = useStudio((s) => s.nodes);
  const shape = useStudio((s) => s.menuShape);
  const spin = useStudio((s) => s.menuSpin);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const layers = look.texture ?? [];
  // The subject: a part, or the page's background.
  const bg = open?.nodeId === BACKGROUND_ID;
  const node = open?.nodeId && !bg ? nodes.find((n) => n.id === open.nodeId) : undefined;

  /*
   * What Looks is wearing: the part's own surface, or the texture on it.
   *
   * The button that opens a part's looks may as well *be* the part's looks. It
   * is cut a shade larger than the face it sits on — negative shrink, the same
   * cutter — so the fill reaches almost the whole way out and what is left is a
   * line of the piece's own colour round it, which is what keeps it a button.
   *
   * Only for a part. The page's own menu has the whole page behind it already.
   */
  const worn = React.useMemo(() => {
    // The page wears its own ground and whatever texture lands on it; a part
    // wears its surface and whatever it has been given.
    const base = node ? overrideTheme(themeFrom(format), node.colour ?? {}, palette).surface : palette.bg;
    const own = node?.texture && node.texture !== "none" ? layers.find((l) => l.id === node.texture) : null;
    const site = node
      ? (!node.texture ? layers.filter((l) => l.on && lands(l, "surfaces")) : [])
      : layers.filter((l) => l.on && lands(l, "page"));
    const tile = own ? [{ ...own, on: true }] : site;
    return {
      // Cut out to the face's own edge — negative shrink, the same cutter — so
      // what is left round it is the piece's thin dark rim and no band of the
      // menu's colour. A button that shows you a look should not be showing you
      // a frame as well.
      d: piece(QUADS[Q_BOTTOM]![0], QUADS[Q_BOTTOM]![1], BLUE_RINGS.mid, "edge", shape, BLUE_RINGS, -ROUND),
      css: tile.length
        ? { ...textureCss(tile, palette, base), backgroundSize: "26px 26px" }
        : { background: base },
      ink: inkOn(base),
    };
  }, [node, format, palette, layers, shape]);

  const activePageId = useStudio((s) => s.activePageId);
  const pages = useStudio((s) => s.pages);
  const page = pages.find((p) => p.id === activePageId) ?? pages[0]!;
  // The background's Import piece: a picture or a video, handed to `ImportFlow`.
  const picture = React.useRef<HTMLInputElement>(null);

  const seq = open?.seq ?? 0;
  /*
   * The part's looks as the wheel found it, so the tray can offer "every part
   * with this colour / in this font": what this part moved from and to since
   * the wheel opened is what gets swapped across the site (`siteColours.ts`,
   * the same swap-all the Look panel's list uses).
   */
  const opened = React.useRef<(Worn & { at: number }) | null>(null);
  const openedId = node?.id ?? null;
  React.useEffect(() => {
    const n = openedId ? useStudio.getState().nodes.find((x) => x.id === openedId) : null;
    opened.current = n ? { id: n.id, colour: n.colour, edge: n.edge ?? null, art: n.art ?? null, content: n.content, font: n.font, aura: n.aura, at: seq } : null;
  }, [seq, openedId]);
  React.useEffect(() => {
    // …unless it was opened straight onto a slot, which is what "change this
    // part" does: the choice the wheel exists to offer has been made already.
    setPicked(open?.slot ?? null);
    // The pencil opens on the one box: that is what "write on this" means.
    setSubPick(open?.slot === "write" ? "say" : null);
    setWriteMore(false);
    setAdding(false);
  }, [seq, open?.slot]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (subPick) setSubPick(null);
      else if (picked) setPicked(null);
      else if (adding) setAdding(false);
      else closeRadial();
    };
    const onDown = (e: PointerEvent) => {
      // The right button is the turning handle, not a way out.
      if (e.button === 2) return;
      const el = e.target as HTMLElement;
      // Three things outside the menu still belong to it: a select's list,
      // which opens in a portal rather than inside the menu; the toolbar's
      // shape chip, which is only worth having where it is if you can flip it
      // and watch the open menu change; and the part the menu is *about* —
      // carry on clicking your own element and the menu stays, so it can be
      // parked aside and worked against. Anything else puts it away.
      //
      // The tour is a fourth: it opens this menu on purpose and stands over
      // it to point at it, so its own presses must not be the click that
      // takes away the thing it is pointing at.
      if (document.documentElement.dataset.tourOn) return;
      if (el.closest?.("[data-radial], [data-menu-shape], [data-radix-popper-content-wrapper], [role='listbox'], [role='option']")) return;
      // A part's own element is the exception, and only a part's: carry on
      // clicking the thing you are editing and the menu stays. The page's
      // background is not that — the frame is most of the screen, so keeping
      // the wheel up over it means a click anywhere useful does nothing, and
      // the only way out is the grid at the edge. Click off it and it goes.
      if (open.nodeId !== BACKGROUND_ID && el.closest?.(`[data-node-id="${open.nodeId}"]`)) return;
      closeRadial();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, picked, subPick, adding]);

  /*
   * The line: one line, two ends, two things.
   *
   * Hold the right button and move, and the first real movement fixes a line
   * through the pointer. From there the handle is *on* that line whatever your
   * hand does — sliding, never steering. Both ends are drawn: a red ring at
   * the end you pulled toward, a green ring at the other. Reach the **red**
   * one and the whole menu comes loose and follows your hand. Run back along
   * the line to the **green** one and the wheel turns under your hand instead.
   * Either way the line goes the moment it has done its job; the green ring
   * stays while you turn, so you can see what you are turning about.
   *
   * The menu opens on the press, so the hold that opened it is the hold that
   * pulls. The angle is chased a fifth of the way per frame rather than
   * pinned, which is the difference between a dial and a twitch; nothing snaps.
   */
  const anchor = React.useRef({ x: 0, y: 0 });
  if (open) anchor.current = { x: open.x, y: open.y };
  const [pull, setPull] = React.useState<Pull | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let stage: PullStage = "pull";
    let axis: Pt | null = null;
    // Set once the line has been used, cleared by the context menu it swallows
    // — or by the next press, on a Mac, where that event comes on the press
    // and there is none on the release to swallow.
    let used = false;
    // Whether the right button is down, kept by hand as well as read off
    // `buttons`: a pen or a trackpad does not always report it.
    let held = false;
    let grabbed = 0;
    let was = 0;
    let want = useStudio.getState().menuSpin;
    let frame = 0;
    let hold = { x: 0, y: 0 };
    // Where the pull is measured from: the hand's press. For the hold that
    // opened the menu that is where the menu was asked to open, which near
    // an edge is not where it was put; a later press is wherever it lands.
    let origin = open.hand ?? { x: open.x, y: open.y };
    let showing = false;
    const show = (v: Pull | null) => {
      if (!v && !showing) return;
      showing = !!v;
      setPull(v);
    };
    const step = () => {
      const now = useStudio.getState().menuSpin;
      let d = want - now;
      while (d > 0.5) d -= 1;
      while (d < -0.5) d += 1;
      if (Math.abs(d) < 0.0006) { useStudio.getState().setMenuSpin(want); frame = 0; return; }
      useStudio.getState().setMenuSpin(now + d * 0.2);
      frame = requestAnimationFrame(step);
    };
    const reset = () => { stage = "pull"; axis = null; held = false; show(null); };
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) { held = true; origin = { x: e.clientX, y: e.clientY }; }
      // Whatever the last gesture was, this press is not its release.
      used = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 2) && !held) return reset();

      if (stage === "moving") {
        // Loose: the menu is under your hand, holding the offset it had when
        // it came loose so it does not jump.
        moveRadial(e.clientX - hold.x, e.clientY - hold.y);
        return;
      }

      // Turning is about the wheel's own centre; the pull is from the hand.
      const arx = e.clientX - anchor.current.x;
      const ary = e.clientY - anchor.current.y;
      const rx = e.clientX - origin.x;
      const ry = e.clientY - origin.y;
      const ox = origin.x - anchor.current.x;
      const oy = origin.y - anchor.current.y;

      if (stage === "turning") {
        const a = Math.atan2(ary, arx) / (Math.PI * 2);
        show({ dx: arx, dy: ary, grip: 1, stage, axis, ox: 0, oy: 0 });
        want = was + (a - grabbed);
        if (!frame) frame = requestAnimationFrame(step);
        return;
      }

      // The first real movement sets the line; after that the handle is on it.
      const raw = Math.hypot(rx, ry);
      if (!axis) {
        if (raw < PULL_FROM) return;
        axis = [rx / raw, ry / raw];
      }
      const along = rx * axis[0] + ry * axis[1];
      const dx = axis[0] * along;
      const dy = axis[1] * along;
      // 0 in the hole, 1 at either end. That number is the line's opacity.
      const grip = Math.max(0, Math.min(1, (Math.abs(along) - PULL_FROM) / (PULL_LOCK - PULL_FROM)));

      if (along >= PULL_LOCK) {
        // The red end: the menu comes loose.
        stage = "moving";
        used = true;
        hold = { x: arx, y: ary };
        play("confirm");
        show(null);
        return;
      }
      if (along <= -PULL_LOCK) {
        // The green end: the wheel comes loose.
        stage = "turning";
        used = true;
        grabbed = Math.atan2(ary, arx) / (Math.PI * 2);
        was = useStudio.getState().menuSpin;
        play("confirm");
      }
      show({ dx, dy, grip, stage, axis, ox, oy });
    };
    const onUp = (e: PointerEvent) => {
      if (e.type === "pointercancel" || e.button === 2 || !(e.buttons & 2)) reset();
    };
    /*
     * While the menu is open, the right button belongs to it.
     *
     * Swallowing the event in the capture phase is the only place that works —
     * the app's own context menu listens further down and `preventDefault`
     * alone does not stop it — and once it is swallowed, this decides. After a
     * pull that was used, nothing: that release is the end of a move or a
     * turn. On the menu itself, nothing: that press is the start of a pull. On
     * any part, including a different corner of the same one, the menu
     * **moves there** and starts again at its first level. On anything that is
     * not a part, it closes. Those are the only things a right-click can mean.
     */
    const onMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      e.preventDefault();
      e.stopPropagation();
      if (used) { used = false; return; }
      if (document.documentElement.dataset.tourOn) return;
      if (el.closest?.("[data-radial]")) return;
      // The context-menu event that trails the press that opened the menu
      // is that press, not a new one: opening again from here would throw
      // away what the press knew — where on the page it landed.
      if (current && performance.now() - openedAt < 500 && Math.hypot(e.clientX - current.hand.x, e.clientY - current.hand.y) < 6) return;
      const onNode = el.closest?.("[data-node-id]") as HTMLElement | null;
      const id = onNode?.getAttribute("data-node-id");
      const frame = el.closest?.("[data-frame]");
      if (id) openRadial(id, e.clientX, e.clientY);
      // The bare frame is the page's background: the wheel moves there, about the page, and Add lands a part on that spot.
      else if (frame) { useStudio.getState().selectBackground(); openRadial(BACKGROUND_ID, e.clientX, e.clientY, pageSpot(frame, e.clientX, e.clientY)); }
      else closeRadial();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("contextmenu", onMenu, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("contextmenu", onMenu, true);
      if (frame) cancelAnimationFrame(frame);
    };
    // A fresh opening starts the gesture over; the menu being carried does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.seq]);

  /*
   * Push the menu aside without closing it.
   *
   * A menu that sits over the part you are editing is a menu you have to shut
   * to see your own work. Press the middle and drag and it moves, so it can be
   * parked wherever there is room while you keep working on the same element.
   */
  const dragged = React.useRef(false);
  const carry = (e: React.PointerEvent) => {
    if (e.button !== 0 || !open) return;
    const from = { x: e.clientX, y: e.clientY, ox: open.x, oy: open.y };
    dragged.current = false;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - from.x;
      const dy = m.clientY - from.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      dragged.current = true;
      moveRadial(from.ox + dx, from.oy + dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!open) return null;

  const s = () => useStudio.getState();
  // Already kept on screen by `openRadial` and `moveRadial`.
  const px = open.x;
  const py = open.y;

  // Opened for a part that does not exist yet: the disc alone, with no wheel
  // under it to go back to. Back and done both put it away.
  if (open.nodeId === null) {
    return (
      <div data-radial className="pointer-events-none fixed inset-0 z-[68]" onContextMenu={(e) => e.preventDefault()}>
        <div className="absolute" style={{ left: px, top: py }}>
          <div data-radial-board="" className="pointer-events-none absolute left-0 top-0">
            <DrawBoard node={null} at={open.at} onBack={closeRadial} onDone={closeRadial} />
          </div>
        </div>
      </div>
    );
  }
  if (!node && !bg) return null;
  const slots = bg ? SLOTS_BG : SLOTS;

  const fire = (id: SlotId) => {
    if (bg) {
      /* Draw makes one element, on the spot the press landed: the same board
         a part's own Draw opens, with nothing to reshape yet. */
      if (id === "draw") {
        if (!open.at) { play("deny"); return; }
        openBoard(open.x, open.y, open.at);
        return;
      }
      /* Create sets an area aside for several (`createSpace.ts`). */
      if (id === "create") {
        if (!open.at) { play("deny"); return; }
        createSpaceAt(open.at.x, open.at.y);
        closeRadial();
        return;
      }
      // Import moved here when Cut went; Cut and Strip were one thing twice.
      if (id === "duplicate") { picture.current?.click(); return; }
      if (id === "delete") {
        const took = s().cutBackground();
        ctx.publish({
          key: "studio:background",
          // Only Strip reaches here now, so the branch that named the other one has gone with it.
          title: took ? "The background is stripped bare" : "The background is already bare",
          body: took ? "⌘V puts it back." : undefined,
          level: took ? "success" : "info",
          source: "studio",
          toast: true,
        });
        play(took ? "deny" : "tap");
        closeRadial();
      }
      return;
    }
    if (id === "duplicate") { s().duplicateNodes([node!.id]); play("confirm"); closeRadial(); }
    if (id === "delete") { s().removeNodes([node!.id]); play("deny"); closeRadial(); }
  };
  const take = (slot: Slot) => {
    if (slot.kind === "action") return fire(slot.id);
    play(slot.kind === "board" ? "open" : "select");
    setSubPick(slot.id === "write" && !bg ? "say" : null);
    setWriteMore(false);
    setPicked(slot.id);
  };

  /* ---------------------------------------------------------- level 1 */
  const [topA, topB] = QUADS[Q_TOP]!;
  const [botA, botB] = QUADS[Q_BOTTOM]!;
  const [delA, delB] = QUADS[Q_DELETE]!;
  const botMid = (botA + botB) / 2;
  const topMid = (topA + topB) / 2;

  const B = BLUE_RINGS;
  // The top quadrant's inner band carries three icons — Animation, the
  // pencil, and More — where the bottom one carries two; the outer block is
  // still one word, Draw.
  const t1 = topA + (topB - topA) / 3;
  const t2 = topA + (2 * (topB - topA)) / 3;
  void topMid;
  const level1: { slot: Slot; d: string; at: Pt; wear?: RingPiece["wear"]; glow?: string | null }[] = [
    /*
     * The inner top: two, on a part and on the page alike.
     *
     * The three-dot More has gone from both. It was never a menu of its own:
     * `choicesOf` returned `tray.map(...)` — the tray's own items, verbatim,
     * with the same handlers — and the tray is drawn under the wheel already.
     * A slab that opens a second copy of what is already on screen costs a
     * third of a band and saves nothing. The page lost it first; the part
     * kept it a while longer for no reason anybody could name.
     *
     * So Motion and the pencil take a half of the band each, and neither of
     * them is a sliver.
     */
    ...(bg
      ? [
        { slot: slots.anim, d: piece(topA, topMid, B.hole, B.mid, shape, B), at: middleOf(topA, topMid, B.hole, B.mid, shape, B) },
        { slot: slots.write, d: piece(topMid, topB, B.hole, B.mid, shape, B), at: middleOf(topMid, topB, B.hole, B.mid, shape, B) },
      ]
      : [
        { slot: slots.anim, d: piece(topA, topMid, B.hole, B.mid, shape, B), at: middleOf(topA, topMid, B.hole, B.mid, shape, B) },
        { slot: slots.write, d: piece(topMid, topB, B.hole, B.mid, shape, B), at: middleOf(topMid, topB, B.hole, B.mid, shape, B) },
      ]),
    /* One slab on a part, two on the page: Draw and Create, visible together
       so the choice between one element and several is a choice you can see
       rather than a mode you are in. */
    ...(bg
      ? [
        { slot: slots.draw, d: piece(topA, topMid, B.mid, "edge", shape, B), at: middleOf(topA, topMid, B.mid, "edge", shape, B) },
        { slot: slots.create, d: piece(topMid, topB, B.mid, "edge", shape, B), at: middleOf(topMid, topB, B.mid, "edge", shape, B) },
      ]
      : [{ slot: slots.draw, d: piece(topA, topB, B.mid, "edge", shape, B), at: middleOf(topA, topB, B.mid, "edge", shape, B) }]),
    /*
     * The inner bottom: two on a part, one on the page.
     *
     * The page's Edit has gone with the width it held — the bar and the
     * canvas menu both set that already — so Picture takes the whole band
     * rather than half of it, which is the room a thing that opens a file
     * wants anyway.
     */
    ...(bg
      ? [{ slot: slots.duplicate, d: piece(botA, botB, B.hole, B.mid, shape, B), at: middleOf(botA, botB, B.hole, B.mid, shape, B) }]
      : [
        { slot: slots.duplicate, d: piece(botA, botMid, B.hole, B.mid, shape, B), at: middleOf(botA, botMid, B.hole, B.mid, shape, B) },
        { slot: SLOTS.edit, d: piece(botMid, botB, B.hole, B.mid, shape, B), at: middleOf(botMid, botB, B.hole, B.mid, shape, B) },
      ]),
    // Looks wears the whole of what it opens: the colour or texture on its
    // face, and the aura round it, which is the one part of a look that is not
    // *on* the thing but around it.
    { slot: slots.look, d: piece(botA, botB, B.mid, "edge", shape, B), at: middleOf(botA, botB, B.mid, "edge", shape, B), wear: worn, glow: node ? auraColour(node.aura, palette) : null },
    // Delete is the whole quadrant, mirrored from the one opposite it and not
    // cut up: one slab, so it can never be hit as a sliver.
    { slot: slots.delete, d: piece(delA, delB, B.hole, "edge", shape, B), at: middleOf(delA, delB, B.hole, "edge", shape, B) },
  ];

  /* ---------------------------------------------------------- the board */
  // Draw is not a level: the wheel is gone and the disc is in its place.
  const onBoard = picked === "draw";

  /* ---------------------------------------------------------- the tray */
  // Under the wheel, whatever level it is on: the things a part's menu needs
  // that are not worth a piece of the wheel. Not while the board is up — the
  // board has a tray of its own.
  const nodeIndex = node ? nodes.indexOf(node) : -1;
  const was = node && opened.current?.id === node.id ? opened.current : null;
  const colourMoves = was && node ? movedColours(was, node, palette) : [];
  const fontMove = was && node ? movedFont(was, node) : null;
  /* Once swapped, what the part wears now is the new starting point: pressing again does nothing twice. */
  const reopen = () => {
    const n = node ? useStudio.getState().nodes.find((x) => x.id === node.id) : null;
    opened.current = n ? { id: n.id, colour: n.colour, edge: n.edge ?? null, art: n.art ?? null, content: n.content, font: n.font, aura: n.aura, at: seq } : null;
    setCarried((k) => k + 1);
  };
  const tray: TrayItem[] = bg
    ? [
        // "Here" means here: the board's own Preview, the same as `p`, not the full address the part's tray goes to.
        { id: "preview", label: "Preview here", icon: <Eye className="size-3" />, primary: true, onClick: () => { closeRadial(); s().setMode("preview"); } },
        { id: "paste", label: "Put the background back", icon: <ClipboardPaste className="size-3" />, disabled: !heldBackground(), onClick: () => { s().pasteBackground(); } },
        /* A part from one of your other sites, placed here in this site's look (RemixCard.tsx). */
        { id: "remix", label: "Bring from another site…", icon: <Shuffle className="size-3" />, onClick: () => { closeRadial(); openRemix(); } },
      ]
    : [
        { id: "preview", label: "Preview here", icon: <Eye className="size-3" />, primary: true, onClick: () => { closeRadial(); ctx.navigate(`${livePath(node!.pageId)}#${node!.id}`); } },
        { id: "forward", label: "Forward", icon: <ChevronsUp className="size-3" />, disabled: nodeIndex >= nodes.length - 1, onClick: () => s().raiseNode(node!.id) },
        { id: "back", label: "Backward", icon: <ChevronsDown className="size-3" />, disabled: nodeIndex <= 0, onClick: () => s().lowerNode(node!.id) },
        /* A data panel, or any part inside one: its states on the Panels page (PanelsPage.tsx, J 2026-10-06). */
        ...(inPanel(nodes, node!) ? [{ id: "states", label: "See states", icon: <History className="size-3" />, onClick: () => { closeRadial(); openPanelsPage(node!.id); } }] : []),
        /* …and the part alone, at real size, every state side by side (PartFocus.tsx). */
        ...(hasStates(nodes, node!.id) ? [{ id: "focus", label: "Focus: every state", icon: <Maximize2 className="size-3" />, onClick: () => { closeRadial(); openPartFocus(frameFor(nodes, node!.id)?.frame ?? node!.id); } }] : []),
        /* A part that holds a picture can have it remade from one prompt (RemakePicture.tsx). */
        ...(canRemake(node) ? [{ id: "remake", label: "Remake this picture…", icon: <Sparkles className="size-3" />, onClick: () => { closeRadial(); openRemake(node!.id); } }] : []),
        /* …or its background pointed at and made see-through (ClearBackground.tsx). */
        ...(canClearBackground(node) ? [{ id: "clear-bg", label: "Transparent background…", icon: <Eraser className="size-3" />, onClick: () => { closeRadial(); openClearBackground(node!.id); } }] : []),
        /* The look in full (fill, outline, shadow, light, corners, font, hover and press, motion), held across boards; Paste puts the facets chosen in the panel on this part, or every picked part it is one of, in one step (partLookApply.ts). */
        {
          id: "copy", label: "Copy look", icon: <Pipette className="size-3" />,
          onClick: () => { useLookClip.getState().copy(lookOf(node! as never)); play("copy"); setCarried((k) => k + 1); },
        },
        {
          id: "paste", label: "Paste look", icon: <ClipboardPaste className="size-3" />, disabled: !heldLook,
          onClick: () => { if (!heldLook) return; const n = pasteLook(pasteTargets(node!, heldLook), heldLook, useLookClip.getState().chosen); play(n ? "confirm" : "deny"); },
        },
        /* On a captured page there may be no bare page left to right-click: every part's tray can bring one too, landing where the person is looking. */
        { id: "remix", label: "Bring from another site…", icon: <Shuffle className="size-3" />, onClick: () => { closeRadial(); openRemix(); } },
        /* Make all like this: every part of this kind on the site wears its look, with the facets and the keep-colour choice the panel holds (MakeAllLike.tsx). */
        {
          id: "make-all", label: "All like this", icon: <CopyPlus className="size-3" />,
          onClick: () => { const p = useMakeAll.getState(); const n = makeAllLike(node!, p.chosen, { keepColour: p.keepColour }); play(n ? "confirm" : "deny"); ctx.publish({ key: `studio:make-all:${node!.id}`, title: n ? `Restyled ${n} more part${n === 1 ? "" : "s"} like this` : "Every part of this kind already looks like this", level: "info", source: "studio", toast: true }); },
        },
        {
          id: "same-colour", label: "All with this colour", icon: <Paintbrush className="size-3" />,
          disabled: !colourMoves.length,
          onClick: () => {
            let n = 0;
            for (const m of colourMoves) n += s().swapColourAll(m.from, m.to, palette, { use: m.use }).length;
            reopen();
            play(n ? "confirm" : "deny");
            ctx.publish({ key: `studio:same-colour:${node!.id}`, title: n ? `Recoloured ${n} more part${n === 1 ? "" : "s"}` : "No other part wore that colour", body: colourMoves.map((m) => `${m.from} → ${m.to}`).join(", "), level: "info", source: "studio", toast: true });
          },
        },
        {
          id: "same-font", label: "All in this font", icon: <Type className="size-3" />,
          disabled: !fontMove,
          onClick: () => {
            if (!fontMove) return;
            const n = s().swapFontAll(fontMove.from, fontMove.to, undefined, fontMove.patch).length;
            reopen();
            play(n ? "confirm" : "deny");
            ctx.publish({ key: `studio:same-font:${node!.id}`, title: n ? `Set ${n} more part${n === 1 ? "" : "s"} the same` : "No other part was in that font", body: fontMove.from || "the site's type", level: "info", source: "studio", toast: true });
          },
        },
      ];

  /*
   * The solid road from the wheel: the same call the panel's button makes,
   * with what came of it said as a toast, because the wheel is gone by the
   * time the model answers.
   */
  const solidFromWheel = (nodeId: string) => {
    play("confirm");
    closeRadial();
    void makeSolid(nodeId, palette).then((r) => {
      ctx.publish({ key: `studio:solid:${nodeId}`, title: r.ok ? "Made a solid" : "Still a cube", body: r.message, level: r.ok ? "success" : "info", source: "studio", toast: true });
      play(r.ok ? "confirm" : "deny");
    });
  };
  const showMore = () => { play("select"); setWriteMore(true); setSubPick(null); };
  const choicesOf = (g: SlotId): Choice[] =>
    bg ? bgChoicesFor(g, open.at) : choicesFor(g, node!, { solid: solidFromWheel, writeMore, more: showMore });

  /* ---------------------------------------------------------- level 2 */
  const group = picked && !onBoard ? (slots as Partial<Record<SlotId, Slot>>)[picked] ?? null : null;
  const choices = picked ? choicesOf(picked) : [];
  // Green fills the quadrant that was empty, cut the same way the blue ones
  // are. More than four choices will not fit there without becoming slivers,
  // so it takes the quadrant below as well — the blue level is gone by then,
  // so there is nothing down there for it to cover.
  const wide = choices.length > 4;
  const greenFrom = QUADS[Q_EMPTY]![0] - (wide ? 0.25 : 0);
  const greenTo = QUADS[Q_EMPTY]![1];
  // The outer ring is longer than the inner band at every angle — twice over
  // on a square, where it runs out to a corner — so it carries more of them.
  // Splitting down the middle made the inner pieces slivers as soon as a group
  // had more than four things in it.
  const outerCount = Math.ceil(choices.length * 0.55);
  const innerCount = choices.length - outerCount;
  const span = greenTo - greenFrom;
  const G = GREEN_RINGS;
  const greenPieces = choices.map((c, i) => {
    const outer = i >= innerCount;
    const n = outer ? outerCount : innerCount;
    const k = outer ? i - innerCount : i;
    const a = greenFrom + (span * k) / n;
    const b = greenFrom + (span * (k + 1)) / n;
    const rIn = outer ? G.mid : G.hole;
    const rOut = outer ? ("edge" as const) : G.mid;
    return {
      choice: c,
      // Cut a shade smaller than the level it sits on. It used to reach five
      // pixels past the console's slabs and that is enough to read as a
      // mistake — the two levels are the same object, one on top of the other.
      d: piece(a, b, rIn, rOut, shape, G, GREEN_SHRINK),
      at: middleOf(a, b, rIn, rOut, shape, G),
      // The same piece cut out to just inside its own face, for a choice that
      // shows what it would set rather than a picture of it.
      fill: piece(a, b, rIn, rOut, shape, G, GREEN_SHRINK - ROUND + 2),
    };
  });

  /* ---------------------------------------------------------- level 3 */
  // The editor is the three quadrants the green level is not using — two,
  // when the group is wide enough to need a second — each a slab like Delete,
  // on the green level's own rings, in the console's own red. The green stays
  // up, so you can see which choice you are inside and step sideways.
  const editing = subPick && !choicesOf(group?.id ?? "edit").find((c) => c.id === subPick)?.act ? subPick : null;
  const freeQuads: [number, number][] = [];
  for (let t = greenTo; t < greenFrom + 1 - 0.001; t += 0.25) freeQuads.push([t, t + 0.25]);
  // The plate editors want a square to sit in: the slab opposite the green
  // is cut square for them whatever the wheel's shape is. The animation
  // editor lights the slab its green choice is about.
  const onPlate = !!editing && !["hue", "texture", "aura", "font", "behaviour", "bg-color", "bg-texture", "bg-light", "bg-glide"].includes(editing) && !(editing in ANIM_SLAB);
  const consoleSpan: ConsoleSpan = {
    quads: freeQuads,
    rings: GREEN_RINGS,
    shape,
    spin,
    shapes: freeQuads.map(([f]) => (onPlate && Math.abs(((f % 1) + 1) % 1 - 0.25) < 0.001 ? "square" : shape)),
    lit: editing && editing in ANIM_SLAB ? ANIM_SLAB[editing as keyof typeof ANIM_SLAB] : undefined,
  };

  return (
    // Above the top bar and the status bar, or a menu opened near an edge has
    // pieces behind the chrome, unreachable.
    <div
      data-radial
      className="pointer-events-none fixed inset-0 z-[68]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute" style={{ left: px, top: py }}>
        {pull ? <PullLine pull={pull} /> : null}

        {!picked && !adding ? (
          <Ring spin={spin} shape={shape} pieces={level1.map((p) => ({
            id: p.slot.id,
            label: p.slot.label,
            icon: p.slot.icon,
            hue: p.slot.hue,
            d: p.d,
            at: p.at,
            wear: p.wear,
            glow: p.glow,
            // The inner band is too narrow for a word without it hanging over
            // the neighbours; an icon says it, and the word is on the tooltip.
            compact: p.slot.id !== "look" && p.slot.id !== "delete" && p.slot.id !== "draw",
            onPick: () => take(p.slot),
          }))} />
        ) : null}

        {/*
          The middle: the lock on the first level, and past it the one way
          back. There used to be a green X for leaving the green level and a
          red one for leaving an editor, each somewhere on the rim; one button
          where the pointer already is, that takes you to the start, is the
          same thing with nothing to find. Escape still steps back one level.
          Either way the middle is also the handle the menu is carried by.
        */}
        {adding ? null : !picked && bg ? (
          // The page has nothing to lock: its middle is Add. Press it and the
          // wheel becomes the add disc, with the parts rolling down its hole.
          // It is still the handle the wheel is carried by.
          <button
            type="button"
            aria-label="Add a part here"
            title="Add a part here · drag to move the wheel"
            data-menu-handle=""
            data-menu-add=""
            onPointerDown={carry}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              play("open");
              setAdding(true);
            }}
            className={cn("pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full transition-[filter] hover:brightness-110 active:cursor-grabbing")}
            style={{ background: "oklch(0.66 0.155 205)", border: "1px solid oklch(0.44 0.14 205)", color: "oklch(0.99 0 0)", boxShadow: "0 0 10px oklch(0.7 0.16 205 / 0.45), 0 2px 6px oklch(0 0 0 / 0.5)" }}
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
          </button>
        ) : !picked ? (
          <button
            type="button"
            aria-label={node!.locked ? "Unlock" : "Lock in place"}
            aria-pressed={node!.locked}
            data-menu-lock=""
            onPointerDown={carry}
            onClick={() => {
              // A drag moved the menu; it was not a press on the lock.
              if (dragged.current) { dragged.current = false; return; }
              play(node!.locked ? "confirm" : "close");
              s().updateNode(node!.id, { locked: !node!.locked });
            }}
            className={cn("pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full transition-colors active:cursor-grabbing")}
            style={{
              background: node!.locked ? `oklch(0.72 0.16 60)` : CONSOLE.face,
              border: `1px solid ${node!.locked ? "oklch(0.52 0.14 60)" : CONSOLE.rim}`,
              color: node!.locked ? "oklch(0.2 0.06 60)" : CONSOLE.text,
              boxShadow: "0 2px 6px oklch(0 0 0 / 0.5)",
            }}
          >
            {node!.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
          </button>
        ) : onBoard ? null : (
          <button
            type="button"
            aria-label="Back to the start"
            data-menu-home=""
            onPointerDown={carry}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              play("close");
              setPicked(null);
              setSubPick(null);
            }}
            className={cn("pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing")}
            style={{
              background: editing ? CONSOLE.well : `oklch(0.32 0.06 ${GREEN})`,
              border: `1px solid ${editing ? CONSOLE.rim : `oklch(0.5 0.12 ${GREEN})`}`,
              color: editing ? CONSOLE.text : "oklch(0.9 0.05 148)",
              boxShadow: "0 2px 6px oklch(0 0 0 / 0.5)",
            }}
          >
            <Undo2 className="size-3.5" />
          </button>
        )}

        {group ? (
          <div data-radial-panel={group.id} className="pointer-events-auto absolute left-0 top-0">
            <Ring
              spin={spin}
              shape={shape}
              green
              pieces={greenPieces.map((p) => ({
                id: p.choice.id,
                label: p.choice.label,
                icon: p.choice.icon,
                hue: GREEN,
                d: p.d,
                at: p.at,
                on: p.choice.id === subPick,
                dim: p.choice.dim,
                preview:
                  bg
                    ? p.choice.id === "bg-color"
                      ? <span data-preview-badge="" className="block" style={{ width: PREVIEW.size, height: PREVIEW.size, borderRadius: PREVIEW.radius, background: palette.bg, outline: "1px solid oklch(0 0 0 / 0.45)" }} />
                      : undefined
                    : p.choice.id === "hue" ? <HueSwatch node={node!} palette={palette} />
                      // Aura shows the aura this part has, worn the way it wears
                      // it — the glow, the ring, the pulse — not a word for it.
                      : p.choice.id === "aura" ? <AuraSwatch node={node!} palette={palette} />
                        : undefined,
                // Texture wears its texture over almost the whole tile, with a
                // line of green left round it. A fingernail swatch in the middle
                // of a green square was a picture of the answer; this is it.
                wear: !bg && p.choice.id === "texture" ? textureWear(p.fill, node!, palette, layers) : null,
                glow: !bg && p.choice.id === "aura" ? auraColour(node!.aura, palette) : null,
                onPick: () => {
                  play("select");
                  // A choice that fires on the spot is not somewhere you are:
                  // nothing opens, so nothing is left to step back out of.
                  if (p.choice.act) { p.choice.act(); return; }
                  setSubPick(p.choice.id);
                },
              }))}
            />
          </div>
        ) : null}

        {/*
          The board: the whole menu, as one disc with no hole. There is no
          middle button while it is up, the middle is drawing space, so its
          way back is on its own rim. Escape steps back to the wheel as well.
        */}
        {onBoard ? (
          <div data-radial-board="" className="pointer-events-none absolute left-0 top-0">
            <DrawBoard node={node!} at={null} onBack={() => setPicked(null)} onDone={closeRadial} />
          </div>
        ) : null}

        {/* The add disc: the page's wheel as a hole the parts roll through. Back is on its rim; Escape steps back too. */}
        {adding ? (
          <div data-radial-board="add" className="pointer-events-none absolute left-0 top-0">
            <AddDisc at={open.at} onBack={() => setAdding(false)} onDone={closeRadial} />
          </div>
        ) : null}

        {group && editing ? (
          <div data-radial-editor={editing} className="pointer-events-none absolute left-0 top-0">
            <QuadrantConsole span={consoleSpan} onGrip={carry}>
              {(slabs) => (bg ? <BackgroundEditor which={editing} slabs={slabs} page={page} /> : <Editor which={editing} node={node!} slabs={slabs} onMore={showMore} />)}
            </QuadrantConsole>
          </div>
        ) : null}

        {/*
          The tray, under the wheel: a tab that opens on hover into the few
          actions that are about the part but not about editing it, seeing
          it live, its place among the others, carrying its looks. It hangs
          under whichever level is up, and steps aside for the board and the
          add disc. It was built and never drawn for a while: this comment
          stood over nothing, and the seven actions on it (Preview here,
          Forward, Backward, Copy looks, Paste looks, Put the background back)
          could not be reached from the wheel at all.
        */}
        {!onBoard && !adding ? (
          <HoverTray
            testId={bg ? "page" : "part"}
            at={[0, (picked ? GREEN_RINGS.reach : BLUE_RINGS.reach) * (shape === "square" ? Math.SQRT2 : 1) + TRAY_DROP]}
            icon={<Ellipsis className="size-3.5" />}
            label="More"
            items={tray}
          />
        ) : null}
        {/*
          The background's Import piece.

          It opened an `image/*` chooser and turned whatever it got into a
          tiled texture layer on the spot — one destination, no choice, and
          no video. It hands the file to `ImportFlow` now, which scrubs a
          video to a frame and then asks where the frame should land. The
          wheel shuts as it goes, because the flow is the next thing to look
          at and two of them open at once is one too many.
        */}
        {bg ? (
          <input
            ref={picture}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            aria-label="Import a picture or a video"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const video = f.type.startsWith("video/");
                play("confirm");
                closeRadial();
                openImport({ url: URL.createObjectURL(f), from: video ? "video" : "picture", name: f.name });
              }
              e.target.value = "";
            }}
          />
        ) : null}

        {pull ? <PullEnds pull={pull} /> : null}
      </div>
    </div>
  );
}

/** Is this part a data panel of its page, or inside one (`panels.ts`)? */
function inPanel(nodes: readonly StudioNode[], node: StudioNode): boolean {
  const source = (useStudio.getState().look as { styleSource?: { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] } } | undefined)?.styleSource;
  const file = source?.files?.find((f) => f.pageId === node.pageId)?.file ?? null;
  const screens = (source?.screens ?? []).filter((x) => !file || !x.page || x.page === file);
  return !!panelOf(nodes, pagePanels(nodes as unknown as PanelNode[], node.pageId, screens), node.id);
}

/**
 * A press, read off the board as plain facts for the rules table
 * (`press.ts`), and the drags those rules start, built from the parts as
 * they are when the hand goes down.
 */
import { frameRiders, liftToFrame, partUnder, stateFrames } from "../states";
import { getFeature } from "../shelf";
import { componentsOf, carriedBy, GRABBED } from "../components";
import { isControl } from "../control";
import { ownsOthers } from "../holds";
import { appAreaRiders, holds, isWrapper, liftToAppArea, ownerOf, ridersOf, wordsOf } from "../owner";
import { isLinkable } from "../shelf/ui";
import { resolvePalette } from "../shelf/run";
import { groupBounds, type StudioNode } from "./store";
import type { StudioState } from "./store/state";
import { DOUBLE_MS, DOUBLE_SLOP, HANDS_ON, placedOnBoard, shownOnBoard, type Drag, type Handle } from "./helpers";
import { picksAfter, type PartFacts, type PressFacts, type Tool } from "./press";

type Point = { x: number; y: number };
/** The press before this one, for telling a second press from a first. */
export type Pressed = { id: string; at: number; x: number; y: number } | null;

type PressEvent = { button: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; timeStamp: number; target: EventTarget | null };

export type PressRead = {
  facts: PressFacts;
  /** The part under the hand, by id. */
  hitId: string | null;
  hit: StudioNode | null;
  /** What one press picks: the owner (`owner.ts`), else the hit. */
  id: string | null;
  node: StudioNode | null;
  /** The selection once this press has picked. */
  ids: string[];
  groupHandle: HTMLElement | null;
  resizeHandle: HTMLElement | null;
  shapeId: string | null;
};

/** Everything the rules table asks about a press, read once. */
export function readPress(e: PressEvent, p: Point, tool: Tool, st: StudioState, prior: Pressed): PressRead {
  const target = e.target as HTMLElement;
  const nodeEl = target.closest?.("[data-node-id]") as HTMLElement | null;
  const groupHandle = target.closest?.("[data-group-resize]") as HTMLElement | null;
  const resizeHandle = target.closest?.("[data-resize]") as HTMLElement | null;
  const shapeEl = target.closest?.("[data-shape-id]") as HTMLElement | null;
  const shapeId = shapeEl?.dataset?.shapeId && shapeEl.dataset.shapeId !== "live" ? shapeEl.dataset.shapeId : null;
  /* The site's own wrapper is never under the hand: the press is on the page (`owner.ts#wrapperIds`). */
  const hitId = nodeEl?.dataset.nodeId && !isWrapper(st.nodes, { id: nodeEl.dataset.nodeId }) ? nodeEl.dataset.nodeId : null;
  const hit = hitId ? st.nodes.find((n) => n.id === hitId) ?? null : null;
  const twice = !!prior && !!hitId && prior.id === hitId && e.timeStamp - prior.at < DOUBLE_MS && Math.hypot(p.x - prior.x, p.y - prior.y) < DOUBLE_SLOP;

  const pal = resolvePalette(st.format, st.look);
  const comps = hit ? componentsOf(st.nodes, pal) : null;
  const partFacts = (n: StudioNode, deep: boolean): PartFacts => {
    const whole = comps?.byId.get(n.id);
    return {
      handsOn: HANDS_ON.has(n.featureId),
      control: isControl(n),
      whole: !!whole && GRABBED.has(whole.kind),
      holds: ownsOthers(st.nodes, n),
      inner: deep && !!partUnder(st.nodes, n, p, shownOnBoard(st), ((places) => (m: StudioNode) => places.get(m.id))(placedOnBoard(st))),
      words: !!wordsOf(n) || (n.id === st.selection[0] && st.selection.length === 1 && !!getFeature(n.featureId)?.content),
      link: !!n.link && isLinkable(n.featureId),
      locked: !!n.locked,
    };
  };

  /*
   * A PICKED HOLDER ITS PARTS COVER WHOLE IS GRABBED ANYWHERE ON IT (EDIT-ISSUES #17). Sol face's header button group is
   * all buttons: every press on it picked a button, and the group moved only by its edge, where its resize bars are.
   * Once it is picked (Escape from a button, or the list), one press inside it keeps it and a drag moves it with what
   * it holds; the second press goes in, as on any holder (`tests/covered-holder-grab.mjs`).
   */
  const kept = hit && !e.shiftKey && !twice && st.selection.length === 1 ? coveredHolder(st, st.selection[0]!, hit) : null;
  const lifted = kept ?? (hit && !e.shiftKey && !st.selection.includes(hit.id) ? ownerOf(st.nodes, hit, pal) : null);
  /*
   * THE SECOND PRESS GOES IN. The first press on a part inside a control or a card picks the control; the second of
   * two picks the part under the hand. Words had their own way in (they open), and a part that holds others its own
   * (`go-in`), but a picture or an icon in a link had none: two presses on sol face's logo picture or a card's sticker
   * kept the link or the card, and the picture could not be picked, swapped or resized (the hand-edit pass, 2026-10-22).
   */
  const owner = lifted && twice && st.selection.includes(lifted.id) ? null : lifted;
  const node = owner ?? hit;
  const id = owner?.id ?? hitId;
  const group = node?.groupId ? st.nodes.filter((n) => n.groupId === node.groupId).map((n) => n.id) : null;
  const ids = id ? picksAfter(st.selection, id, group, e.shiftKey) : [];
  const hitFacts = hit ? partFacts(hit, twice && tool === "select" && !e.shiftKey) : null;

  return {
    facts: {
      button: e.button,
      tool,
      alt: e.altKey,
      shift: e.shiftKey,
      mod: e.ctrlKey || e.metaKey,
      groupHandle: !!groupHandle,
      resizeHandle: !!resizeHandle,
      onPart: !!hitId,
      onPage: !!target.closest?.("[data-frame]"),
      onShape: !!shapeEl,
      twice,
      hit: hitFacts,
      picks: node ? { ...(node === hit ? hitFacts! : partFacts(node, false)), owner: !!owner, alone: ids.length === 1 } : null,
    },
    hitId, hit, id, node, ids, groupHandle, resizeHandle, shapeId,
  };
}

/** The picked part, when it holds `hit` and the parts it holds leave none of it bare to press on. */
function coveredHolder(st: StudioState, pickedId: string, hit: StudioNode): StudioNode | null {
  const held = st.nodes.find((n) => n.id === pickedId);
  if (!held || held.id === hit.id || held.locked || isWrapper(st.nodes, held) || !holds(held, hit)) return null;
  const shown = shownOnBoard(st);
  const kids = st.nodes.filter((n) => n.id !== held.id && shown(n) && n.w > 0 && n.h > 0 && holds(held, n));
  /* Read on a grid across it, inside its edge: every point lies on one of its parts. */
  const N = 12, pad = 2;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = held.x + pad + ((held.w - 2 * pad) * (i + 0.5)) / N, y = held.y + pad + ((held.h - 2 * pad) * (j + 0.5)) / N;
    if (!kids.some((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h)) return null;
  }
  return held;
}

/** A locked group's resize: the group as one box, its members as they were. */
export function groupDrag(st: StudioState, groupId: string, handle: Handle, p: Point): Drag | null {
  const b = groupBounds(st.nodes.filter((n) => n.pageId === st.activePageId), groupId);
  if (!b) return null;
  return {
    kind: "group", startX: p.x, startY: p.y, groupId, handle,
    box: { x: b.x, y: b.y, w: b.w, h: b.h },
    held: b.members.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, size: typeof n.font?.size === "number" ? n.font.size : null })),
    ids: b.members.map((n) => n.id),
  };
}

/** A part's resize: a component's layers and a frame's states keep their place and size on it (`components.ts#resizedWith`, `stateFrames.ts`). */
export function resizeDrag(st: StudioState, n: StudioNode, handle: Handle, p: Point): Drag {
  const own = carriedBy(componentsOf(st.nodes, resolvePalette(st.format, st.look)), n.id).filter((id) => id !== n.id);
  /* An app area (kit rule 34) scales everything inside with it: the code fills it to the box. */
  const layers = [...new Set([...own, ...frameRiders(st.nodes, [n.id, ...own]), ...appAreaRiders(st.nodes, n.id)])];
  const origin: NonNullable<Drag["origin"]> = { [n.id]: { x: n.x, y: n.y, w: n.w, h: n.h } };
  for (const m of st.nodes) if (layers.includes(m.id) && !m.locked) origin[m.id] = { x: m.x, y: m.y, w: m.w, h: m.h };
  return { kind: "resize", startX: p.x, startY: p.y, nodeId: n.id, handle, origin, riders: layers, frames: stateFrames(st.nodes) };
}

/**
 * A move: a face as big as its frame lifts to the frame (`liftToFrame`), a
 * button carries its words and icon (`owner.ts#ridersOf`), and a frame
 * carries its states, the hidden faces too (`stateFrames.ts#frameRiders`),
 * and anything inside an app area moves the area (`owner.ts#liftToAppArea`).
 */
export function moveDrag(st: StudioState, ids: readonly string[], p: Point): Drag {
  /* A drag on anything inside an app area moves the area (kit rule 34). */
  const lifted = liftToFrame(st.nodes, liftToAppArea(st.nodes, ids));
  const held = ridersOf(st.nodes, lifted, resolvePalette(st.format, st.look));
  const riders = [...held, ...frameRiders(st.nodes, [...lifted, ...held])];
  /* The site's own wrapper rides along once everything it holds is in hand (Select everything, then a drag). */
  const inHand = new Set([...lifted, ...riders]);
  for (const n of st.nodes) {
    if (inHand.has(n.id) || !isWrapper(st.nodes, n)) continue;
    const inside = st.nodes.filter((m) => holds(n, m) && !isWrapper(st.nodes, m));
    if (inside.length && inside.every((m) => inHand.has(m.id))) riders.push(n.id);
  }
  const carried = [...new Set([...lifted, ...riders])];
  const origin: NonNullable<Drag["origin"]> = {};
  for (const n of st.nodes) if (carried.includes(n.id)) origin[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
  return { kind: "node", startX: p.x, startY: p.y, ids: carried, origin, riders, frames: stateFrames(st.nodes) };
}

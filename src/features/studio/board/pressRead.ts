/**
 * A press, read off the board as plain facts for the rules table
 * (`press.ts`), and the drags those rules start, built from the parts as
 * they are when the hand goes down.
 */
import { frameRiders, liftToFrame, partUnder } from "../states";
import { getFeature } from "../catalog";
import { componentsOf, carriedBy, GRABBED } from "../components";
import { isControl } from "../control";
import { ownsOthers } from "../holds";
import { ownerOf, ridersOf, wordsOf } from "../owner";
import { isLinkable } from "../parts";
import { resolvePalette } from "../parts/theme";
import { groupBounds, type StudioNode } from "../store";
import type { StudioState } from "../store/state";
import { DOUBLE_MS, DOUBLE_SLOP, HANDS_ON, placedOnBoard, shownOnBoard, type Drag, type Handle } from "../canvas/helpers";
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
  const hitId = nodeEl?.dataset.nodeId || null;
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

  const owner = hit && !e.shiftKey && !st.selection.includes(hit.id) ? ownerOf(st.nodes, hit, pal) : null;
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
  const layers = [...own, ...frameRiders(st.nodes, [n.id, ...own])];
  const origin: NonNullable<Drag["origin"]> = { [n.id]: { x: n.x, y: n.y, w: n.w, h: n.h } };
  for (const m of st.nodes) if (layers.includes(m.id) && !m.locked) origin[m.id] = { x: m.x, y: m.y, w: m.w, h: m.h };
  return { kind: "resize", startX: p.x, startY: p.y, nodeId: n.id, handle, origin, riders: layers };
}

/**
 * A move: a face as big as its frame lifts to the frame (`liftToFrame`), a
 * button carries its words and icon (`owner.ts#ridersOf`), and a frame
 * carries its states, the hidden faces too (`stateFrames.ts#frameRiders`).
 */
export function moveDrag(st: StudioState, ids: readonly string[], p: Point): Drag {
  const lifted = liftToFrame(st.nodes, ids);
  const held = ridersOf(st.nodes, lifted, resolvePalette(st.format, st.look));
  const riders = [...held, ...frameRiders(st.nodes, [...lifted, ...held])];
  const carried = [...new Set([...lifted, ...riders])];
  const origin: NonNullable<Drag["origin"]> = {};
  for (const n of st.nodes) if (carried.includes(n.id)) origin[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
  return { kind: "node", startX: p.x, startY: p.y, ids: carried, origin, riders };
}

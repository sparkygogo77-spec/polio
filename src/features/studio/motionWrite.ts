"use client";
/**
 * Changing moving parts from the Motion tab: on or off, and how fast, for
 * one part or for a whole kind or bunch of them at once.
 *
 * Each change is written where the part's renderers already read it, so it
 * reaches the board, the preview and the export by the roads they have:
 * a library feature's switch and inputs (`node.work`), a captured part's
 * own motion (`node.motion`), a part's options, a crate's settings. However
 * many parts it touches, a change is one undo step.
 */
import { useStudio, type StudioNode } from "./board/store";
import { withInput, withSwitch, withWork, withoutWork, usesOf } from "./shelf";
import type { Effect } from "./motionEffects";
import { seconds, workSpeedInput, type MoveRow } from "./motionInventory";

const trim = (n: number) => String(Math.round(n * 1000) / 1000);

/** What turning one row on or off writes on its part. */
function onPatch(node: StudioNode, row: MoveRow, on: boolean): Partial<StudioNode> {
  if (row.source === "work" && row.workId) return { work: withSwitch(node.work, row.workId, on) };
  if (row.source === "captured" && node.motion) {
    const { off: _off, ...rest } = node.motion;
    void _off;
    return { motion: on ? rest : { ...rest, off: true } };
  }
  if (row.source === "part") {
    const o = { ...node.options };
    if (node.featureId === "marquee") {
      /* A ticker turned back on goes at the speed it had. */
      if (on) { o.speed = o.speedWas || "medium"; delete o.speedWas; }
      else { o.speedWas = o.speed && o.speed !== "still" ? o.speed : "medium"; o.speed = "still"; }
    } else if (node.featureId === "carousel") o.autoplay = on ? "yes" : "no";
    else if (on) delete o.off;
    else o.off = "yes";
    return { options: o };
  }
  return {};
}

/** What setting one row's speed writes on its part; `value` is the new number, or `scale` times the old. */
function speedPatch(node: StudioNode, row: MoveRow, value: number | string): Partial<StudioNode> {
  if (row.source === "work" && row.workId) {
    const use = usesOf(node.work).find((u) => u.id === row.workId);
    const input = workSpeedInput(row.workId, use?.inputs ?? {});
    return input ? { work: withInput(node.work, row.workId, input, trim(Number(value))) } : {};
  }
  if (row.source === "captured" && node.motion?.animation?.length) {
    /* Every animation the part has keeps its pace against the first: the whole of it goes faster or slower together. */
    const first = seconds(node.motion.animation[0]?.duration) ?? 0;
    const k = first > 0 ? Number(value) / first : 1;
    const animation = node.motion.animation.map((a) => {
      const d = seconds(a.duration);
      return d === null ? a : { ...a, duration: `${trim(d * k)}s` };
    });
    return { motion: { ...node.motion, animation } };
  }
  if (row.source === "part" && node.featureId === "marquee") return { options: { ...node.options, speed: String(value) } };
  return {};
}

/** Every row's patch on its part, a part with several rows taking them in turn; then the crates; one undo step for the lot. */
function writeAll(rows: readonly MoveRow[], nodeFn: (n: StudioNode, r: MoveRow) => Partial<StudioNode>, crateFn: (id: string, r: MoveRow) => void): void {
  const s = useStudio.getState();
  const mark = s.historyMark();
  const byNode = new Map<string, MoveRow[]>();
  for (const r of rows) if (r.source !== "crate") byNode.set(r.nodeId, [...(byNode.get(r.nodeId) ?? []), r]);
  if (byNode.size) {
    s.patchNodes([...byNode.keys()], (n) => {
      let cur = n;
      for (const r of byNode.get(n.id) ?? []) cur = { ...cur, ...nodeFn(cur, r) };
      const patch: Partial<StudioNode> = {};
      for (const k of ["work", "motion", "options"] as const) if (cur[k] !== n[k]) (patch as Record<string, unknown>)[k] = cur[k];
      return patch;
    });
  }
  for (const r of rows) if (r.source === "crate" && r.crateId) crateFn(r.crateId, r);
  useStudio.getState().oneStepSince(mark);
}

export function setRowsOn(rows: readonly MoveRow[], on: boolean): void {
  writeAll(rows, (n, r) => onPatch(n, r, on), (id) => useStudio.getState().updateMotion(id, { off: !on }));
}

export function setRowsSpeed(rows: readonly MoveRow[], value: number | string): void {
  writeAll(rows, (n, r) => speedPatch(n, r, value), (id) => useStudio.getState().updateMotion(id, { duration: Number(value) }));
}

export const setRowOn = (row: MoveRow, on: boolean) => setRowsOn([row], on);
export const setRowSpeed = (row: MoveRow, value: number | string) => setRowsSpeed([row], value);

/* ------------------------------------------------------------------ */
/* Who has an effect                                                   */
/* ------------------------------------------------------------------ */

/** What giving a part an effect writes: the same library feature with the same settings, or the same rule on its own box. */
function addPatch(node: StudioNode, e: Effect): Partial<StudioNode> {
  if (e.workId) return { work: withWork(node.work, { id: e.workId, inputs: { ...(e.workInputs ?? {}) } }) };
  const m = node.motion ?? {};
  const list = e.kind === "press" ? "active" : "hover";
  return {
    motion: {
      ...m,
      [list]: [...(m[list] ?? []), { self: true, style: { ...e.style } }],
      /* It eases in as the parts that already have it do, rather than jumping. */
      transition: m.transition?.length ? m.transition : [{ property: "all", duration: "0.2s", timing: "ease" }],
    },
  };
}

/** What taking an effect off a part writes: the feature gone, or that kind of rule gone from its box. */
function removePatch(node: StudioNode, e: Effect): Partial<StudioNode> {
  if (e.workId) return { work: withoutWork(node.work, e.workId) };
  if (!node.motion) return {};
  const list = e.kind === "press" ? "active" : "hover";
  const { [list]: _gone, ...rest } = node.motion;
  void _gone;
  return { motion: rest };
}

/** Gives the effect to some parts and takes it from others: one undo step. */
export function changeEffect(e: Effect, add: readonly string[], remove: readonly string[]): void {
  if (!add.length && !remove.length) return;
  const s = useStudio.getState();
  const mark = s.historyMark();
  const adding = new Set(add);
  s.patchNodes([...add, ...remove], (n) => (adding.has(n.id) ? addPatch(n, e) : removePatch(n, e)));
  useStudio.getState().oneStepSince(mark);
}

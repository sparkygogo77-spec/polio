"use client";
/**
 * Changing a moving part from the Motion tab: on or off, and how fast.
 *
 * Each change is written where the part's renderers already read it, so it
 * reaches the board, the preview and the export by the roads they have:
 * a library feature's switch and inputs (`node.work`), a captured part's
 * own motion (`node.motion`), a part's options, a crate's settings. Every
 * write is one undo step (`updateNode`, `updateMotion`).
 */
import { useStudio } from "./store";
import { withInput, withSwitch, usesOf } from "./library/works";
import { seconds, workSpeedInput, type MoveRow } from "./motionInventory";

const trim = (n: number) => String(Math.round(n * 1000) / 1000);

export function setRowOn(row: MoveRow, on: boolean): void {
  const s = useStudio.getState();
  const node = s.nodes.find((n) => n.id === row.nodeId);
  if (row.source === "crate" && row.crateId) { s.updateMotion(row.crateId, { off: !on }); return; }
  if (!node) return;
  if (row.source === "work" && row.workId) { s.updateNode(node.id, { work: withSwitch(node.work, row.workId, on) }); return; }
  if (row.source === "captured" && node.motion) {
    const { off: _off, ...rest } = node.motion;
    void _off;
    s.updateNode(node.id, { motion: on ? rest : { ...rest, off: true } });
    return;
  }
  if (row.source === "part") {
    const o = { ...node.options };
    if (node.featureId === "marquee") o.speed = on ? (o.speedWas || "medium") : "still";
    else if (node.featureId === "carousel") o.autoplay = on ? "yes" : "no";
    else if (on) delete o.off;
    else o.off = "yes";
    /* A ticker turned back on goes at the speed it had. */
    if (node.featureId === "marquee") { if (!on) o.speedWas = node.options?.speed && node.options.speed !== "still" ? node.options.speed : "medium"; else delete o.speedWas; }
    s.updateNode(node.id, { options: o });
  }
}

export function setRowSpeed(row: MoveRow, value: number | string): void {
  const s = useStudio.getState();
  if (row.source === "crate" && row.crateId) { s.updateMotion(row.crateId, { duration: Number(value) }); return; }
  const node = s.nodes.find((n) => n.id === row.nodeId);
  if (!node) return;
  if (row.source === "work" && row.workId) {
    const use = usesOf(node.work).find((u) => u.id === row.workId);
    const input = workSpeedInput(row.workId, use?.inputs ?? {});
    if (input) s.updateNode(node.id, { work: withInput(node.work, row.workId, input, trim(Number(value))) });
    return;
  }
  if (row.source === "captured" && node.motion?.animation?.length) {
    /* Every animation the part has keeps its pace against the first: the whole of it goes faster or slower together. */
    const first = seconds(node.motion.animation[0]?.duration) ?? 0;
    const k = first > 0 ? Number(value) / first : 1;
    const animation = node.motion.animation.map((a) => {
      const d = seconds(a.duration);
      return d === null ? a : { ...a, duration: `${trim(d * k)}s` };
    });
    s.updateNode(node.id, { motion: { ...node.motion, animation } });
    return;
  }
  if (row.source === "part" && node.featureId === "marquee") s.updateNode(node.id, { options: { ...node.options, speed: String(value) } });
}

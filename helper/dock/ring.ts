/**
 * The step ring (J's answer 10): one circle cut into the 8 steps of a lane,
 * brief to live check, clockwise from the top. Finished steps are filled;
 * the step under way breathes in its own segment (dock.css, held still under
 * reduced motion). A question adds an amber halo, only-you a red notch at
 * the step it stopped on, paused two bars in the middle, done turns the
 * whole ring green.
 *
 * Pure: it returns markup, so a test or the helper can draw it anywhere.
 */
import { STEPS, type Lane } from "../contract.ts";

const C = 14;   // centre of a 28 by 28 box
const R = 10;   // the ring's radius
const GAP = 7;  // degrees left open between two segments

const at = (deg: number, r = R) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
};

function arc(i: number): string {
  const span = 360 / STEPS.length;
  const from = i * span + GAP / 2;
  const to = (i + 1) * span - GAP / 2;
  return `M ${at(from)} A ${R} ${R} 0 0 1 ${at(to)}`;
}

const STEP_WORDS: Record<(typeof STEPS)[number], string> = {
  brief: "brief", red: "red test", fix: "fix", green: "green", push: "push", ci: "CI", merge: "merge", live: "live check",
};

export function ringLabel(l: Pick<Lane, "stepsDone" | "stepNow" | "state">): string {
  const now = l.stepNow ? `, now ${STEP_WORDS[l.stepNow]}` : "";
  const why = l.state === "working" || l.state === "done" ? "" : `, ${l.state === "only-you" ? "needs you" : l.state}`;
  return `${l.stepsDone} of ${STEPS.length} steps done${now}${why}`;
}

export function ringSvg(l: Pick<Lane, "stepsDone" | "stepNow" | "state">): string {
  const done = l.state === "done";
  const segs = STEPS.map((_, i) => {
    const cls = ["seg"];
    if (i < l.stepsDone) cls.push("filled");
    if (done) cls.push("green");
    // Only a step that is moving breathes; a question, a pause or a wait on
    // J marks where the lane stands without the motion.
    if (i === l.stepsDone && !done) cls.push(l.state === "working" ? "now" : "here");
    return `<path class="${cls.join(" ")}" data-i="${i}" d="${arc(i)}"/>`;
  }).join("");
  const span = 360 / STEPS.length;
  const mid = (Math.min(l.stepsDone, STEPS.length - 1) + 0.5) * span;
  const halo = l.state === "question" ? `<circle class="halo" cx="${C}" cy="${C}" r="${R + 2.5}"/>` : "";
  const notch = l.state === "only-you" ? `<path class="notch" d="M ${at(mid, R - 3.4)} L ${at(mid, R + 3.4)}"/>` : "";
  const bars = l.state === "paused" ? `<rect class="bar" x="10.6" y="9.5" width="2.2" height="9" rx="1"/><rect class="bar" x="15.2" y="9.5" width="2.2" height="9" rx="1"/>` : "";
  return `<svg class="ring" data-state="${l.state}" viewBox="0 0 28 28" width="28" height="28" role="img" aria-label="${ringLabel(l)}">${halo}${segs}${notch}${bars}</svg>`;
}

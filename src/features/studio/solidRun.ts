"use client";
/**
 * A drawn box, made a solid by a model, behind the routing table.
 *
 * The cube is code and it is the whole thing: six faces that turn, with
 * the author's words on them, and it costs nothing and needs no key. This
 * is the road *past* it, and it is only lit when it can be walked. The
 * two-axis table in `imageRoute.ts` already has one cell that returns a
 * solid rather than a picture — `object` at the first step — and one model
 * in it, `tencent/hunyuan3d-2mv`, which takes front, back, left and right
 * views. A cube's own faces are exactly those four views, so the box goes
 * up as four pictures of its own sides and comes back as a GLB the board
 * mounts (`parts/Mesh.tsx`).
 *
 * The rules it keeps:
 *
 * - **No token, no call, no error.** `rendererReady` asks whether this
 *   browser holds a Replicate token or the server has one, and the control
 *   is lit only then. Without one the card says what would light it, in a
 *   sentence, and the cube is not one face short of anything.
 * - **The token is the person's.** It rides with the call as a header from
 *   their own keys panel (`rendererHeader`); nothing here writes one down.
 * - **The cube is kept.** The node becomes `mesh-3d` with the GLB on it and
 *   `node.cube` still there, so the faces stay editable and "back to the
 *   cube" is one press with nothing lost.
 * - **A landed call is a thread.** What went up, what came back, what it
 *   cost, on the timeline like every other iteration.
 *
 * Tested by `tests/box-to-cube.mjs` against a mocked route: the request
 * that goes up and the part that lands are measured; the vendor is not
 * reached from a test.
 */
import { noRendererKeyMessage, rendererHeader, rendererReady } from "./loop/run";
import { saysSolid } from "./pictures";
import { cubeDims } from "./shelf";
import { CUBE_SIDES, REST, type CubeFace } from "./shelf";
import { SOLID_WORDS, solidModel, VIEWS, type View } from "./solidRoute";
import { useStudio, type StudioNode } from "./board/store";
import { askImage } from "./pictures/askImage";

export { SOLID_WORDS, solidModel, VIEWS };
export type { View };

/** The most pixels a view is drawn at on its long side. */
const VIEW_PX = 512;

/** A face's ground, from its role and the site's palette. */
function ground(face: CubeFace | undefined, palette: Record<string, string>): string {
  const own = (face?.colour ?? "").trim();
  if (!own) return palette.surface ?? "#1a1a1e";
  if (own in palette) return palette[own]!;
  return own;
}

/** Break a line into lines that fit, on spaces. */
function wrap(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > width && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/**
 * One face, drawn flat: its colour, its heading, its line, at the size
 * the object gives that side. Base64 PNG with no data-URL head, which is
 * what the route takes.
 */
export function faceView(node: StudioNode, view: View, palette: Record<string, string>): string | null {
  if (typeof document === "undefined") return null;
  const { W, H, D } = cubeDims(node.w, node.h, 1);
  const fw = view === "left" || view === "right" ? D : W;
  const fh = H;
  const scale = VIEW_PX / Math.max(fw, fh);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(fw * scale));
  canvas.height = Math.max(16, Math.round(fh * scale));
  const c = canvas.getContext("2d");
  if (!c) return null;
  const i = CUBE_SIDES.indexOf(view);
  const face = node.cube?.faces?.[i];
  c.fillStyle = ground(face, palette);
  c.fillRect(0, 0, canvas.width, canvas.height);
  const side = Math.min(canvas.width, canvas.height);
  const pad = Math.round(side * 0.1);
  const text = palette.text ?? "#f4f4f5";
  const heading = (face?.heading ?? "").trim();
  const body = (face?.body ?? "").trim();
  const lines: { text: string; size: number; weight: number; alpha: number }[] = [];
  if (heading) {
    c.font = `650 ${Math.max(11, Math.round(side * 0.11))}px system-ui, sans-serif`;
    for (const l of wrap(c, heading, canvas.width - pad * 2)) lines.push({ text: l, size: Math.max(11, Math.round(side * 0.11)), weight: 650, alpha: 1 });
  }
  if (body) {
    c.font = `400 ${Math.max(9, Math.round(side * 0.062))}px system-ui, sans-serif`;
    for (const l of wrap(c, body, canvas.width - pad * 2)) lines.push({ text: l, size: Math.max(9, Math.round(side * 0.062)), weight: 400, alpha: 0.72 });
  }
  const total = lines.reduce((a, l) => a + l.size * 1.3, 0);
  let y = canvas.height / 2 - total / 2;
  for (const l of lines) {
    c.font = `${l.weight} ${l.size}px system-ui, sans-serif`;
    c.fillStyle = text;
    c.globalAlpha = l.alpha;
    c.textBaseline = "top";
    c.fillText(l.text, pad, y);
    y += l.size * 1.3;
  }
  c.globalAlpha = 1;
  return canvas.toDataURL("image/png").split(",")[1] ?? null;
}

/**
 * The object, drawn flat: the box at its resting pose, the faces that show
 * at that angle shaded by the page's lamp, the words on them. This is the
 * still a solid falls back to when it cannot be mounted, and what the
 * board draws for it, so a person who has written on no face yet still
 * sees the thing they drew rather than a blank plate. Orthographic, so
 * every face is an affine map of its own flat picture, which is what a
 * canvas can draw text through.
 */
export function cubeStill(node: StudioNode, palette: Record<string, string>, px = VIEW_PX): string | null {
  if (typeof document === "undefined") return null;
  const { W, H, D } = cubeDims(node.w, node.h, 0.74);
  const turn = node.cube?.turn ?? REST;
  const rx = (turn.x * Math.PI) / 180;
  const ry = (turn.y * Math.PI) / 180;
  // The same order the CSS applies: rotateY first, then rotateX.
  const spin = (p: number[]): [number, number, number] => {
    const [x, y, z] = [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    return [x1, y2, z2];
  };
  // Each face: its centre, its right and down axes, its size, in the box's own frame.
  const faces: { side: View | "top" | "bottom"; c: number[]; u: number[]; v: number[]; fw: number; fh: number; n: number[] }[] = [
    { side: "front", c: [0, 0, D / 2], u: [1, 0, 0], v: [0, 1, 0], fw: W, fh: H, n: [0, 0, 1] },
    { side: "back", c: [0, 0, -D / 2], u: [-1, 0, 0], v: [0, 1, 0], fw: W, fh: H, n: [0, 0, -1] },
    { side: "right", c: [W / 2, 0, 0], u: [0, 0, -1], v: [0, 1, 0], fw: D, fh: H, n: [1, 0, 0] },
    { side: "left", c: [-W / 2, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fw: D, fh: H, n: [-1, 0, 0] },
    { side: "top", c: [0, -H / 2, 0], u: [1, 0, 0], v: [0, 0, -1], fw: W, fh: D, n: [0, -1, 0] },
    { side: "bottom", c: [0, H / 2, 0], u: [1, 0, 0], v: [0, 0, 1], fw: W, fh: D, n: [0, 1, 0] },
  ];
  const scale = px / Math.max(1, Math.hypot(W, H, D));
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = Math.round(px * Math.max(0.5, Math.min(2, node.h / Math.max(1, node.w))));
  const c = canvas.getContext("2d");
  if (!c) return null;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const lamp = { x: 0.3, y: 0.2 };
  const lx = (lamp.x - 0.5) * 2, ly = (lamp.y - 0.5) * 2, ll = Math.hypot(lx, ly, 1) || 1;
  const text = palette.text ?? "#f4f4f5";
  const dark = (palette.bg ?? "#000").toLowerCase() !== "#ffffff";
  const shown = faces
    .map((f) => ({ f, n: spin(f.n) }))
    .filter(({ n }) => n[2] > 0.02)
    .sort((a, b) => a.n[2] - b.n[2]);
  for (const { f, n } of shown) {
    const o = spin([f.c[0]! - f.u[0]! * f.fw / 2 - f.v[0]! * f.fh / 2, f.c[1]! - f.u[1]! * f.fw / 2 - f.v[1]! * f.fh / 2, f.c[2]! - f.u[2]! * f.fw / 2 - f.v[2]! * f.fh / 2]);
    const ux = spin(f.u), vx = spin(f.v);
    // Screen = origin + local.x * u + local.y * v, orthographically: an affine map.
    c.setTransform(ux[0] * scale, ux[1] * scale, vx[0] * scale, vx[1] * scale, cx + o[0] * scale, cy + o[1] * scale);
    const i = CUBE_SIDES.indexOf(f.side);
    const face = node.cube?.faces?.[i];
    c.fillStyle = ground(face, palette);
    c.fillRect(0, 0, f.fw, f.fh);
    // The lamp: a wash that darkens what is turned away, as the part does.
    const lit = Math.max(0, Math.min(1, 0.5 + ((n[0] * lx + n[1] * ly + n[2]) / ll) * 0.5));
    c.fillStyle = dark ? `rgba(255,255,255,${((1 - lit) * 0.14).toFixed(3)})` : `rgba(0,0,0,${((1 - lit) * 0.22).toFixed(3)})`;
    c.fillRect(0, 0, f.fw, f.fh);
    c.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
    c.lineWidth = 1 / scale;
    c.strokeRect(0, 0, f.fw, f.fh);
    const side = Math.min(f.fw, f.fh);
    const pad = Math.round(side * 0.1);
    const heading = (face?.heading ?? "").trim();
    const body = (face?.body ?? "").trim();
    const lines: { text: string; size: number; weight: number; alpha: number }[] = [];
    if (heading) {
      c.font = `650 ${Math.max(11, Math.round(side * 0.11))}px system-ui, sans-serif`;
      for (const l of wrap(c, heading, f.fw - pad * 2)) lines.push({ text: l, size: Math.max(11, Math.round(side * 0.11)), weight: 650, alpha: 1 });
    }
    if (body) {
      c.font = `400 ${Math.max(9, Math.round(side * 0.062))}px system-ui, sans-serif`;
      for (const l of wrap(c, body, f.fw - pad * 2)) lines.push({ text: l, size: Math.max(9, Math.round(side * 0.062)), weight: 400, alpha: 0.72 });
    }
    let y = f.fh / 2 - lines.reduce((a, l) => a + l.size * 1.3, 0) / 2;
    for (const l of lines) {
      c.font = `${l.weight} ${l.size}px system-ui, sans-serif`;
      c.fillStyle = text;
      c.globalAlpha = l.alpha;
      c.textBaseline = "top";
      c.fillText(l.text, pad, y);
      y += l.size * 1.3;
    }
    c.globalAlpha = 1;
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  return canvas.toDataURL("image/png").split(",")[1] ?? null;
}

export interface SolidResult {
  ok: boolean;
  reason?: "not-a-cube" | "no-token" | "no-picture" | "network" | string;
  /** One line for the card and the toast. */
  message: string;
  model?: string;
  name?: string;
  ms?: number;
  cost?: number | null;
  bytes?: number;
}

interface Answer {
  ok: boolean;
  solid?: boolean;
  mesh?: { glb: string; bytes?: number; from?: string };
  model?: string;
  name?: string;
  reason?: string;
  message?: string;
  ms?: number;
  cost?: number | null;
}

/**
 * Make this cube a solid.
 *
 * Refuses, in a sentence, when there is no token anywhere; otherwise sends
 * the four views up the ordinary image route at stage two with words that
 * route to the object cell, and lands the answer as a mesh part with the
 * cube kept underneath it.
 */
export async function makeSolid(nodeId: string, palette: Record<string, string>, deps: { onStep?: (s: string) => void } = {}): Promise<SolidResult> {
  const node = useStudio.getState().nodes.find((n) => n.id === nodeId);
  if (!node || (node.featureId !== "cube-3d" && !node.cube)) return { ok: false, reason: "not-a-cube", message: "Only a cube can be made a solid." };
  if (!saysSolid(SOLID_WORDS)) return { ok: false, reason: "not-routed", message: "The words that route to a solid no longer do." };
  deps.onStep?.("Checking for a Replicate token…");
  if (!(await rendererReady())) {
    return { ok: false, reason: "no-token", message: noRendererKeyMessage("Until then the cube is the whole thing.") };
  }
  const views = VIEWS.map((v) => faceView(node, v, palette));
  if (views.some((v) => !v)) return { ok: false, reason: "no-picture", message: "The faces could not be drawn as pictures in this browser." };
  const [front, ...rest] = views as string[];
  const model = solidModel();
  deps.onStep?.(`Sending four sides to ${model?.name ?? "the modeller"}…`);
  const from = Date.now();
  let answer: Answer;
  try {
    const res = await askImage({
      method: "POST",
      headers: { "content-type": "application/json", ...rendererHeader() },
      body: JSON.stringify({
        stage: 2,
        first: front,
        views: rest,
        said: SOLID_WORDS,
        prompt: node.prompt,
        label: node.label,
        kind: "raster",
        role: null,
        w: node.w,
        h: node.h,
        ...(model ? { model: model.slug } : {}),
      }),
    });
    answer = (await res.json()) as Answer;
  } catch (error) {
    return { ok: false, reason: "network", message: `The call did not complete: ${error instanceof Error ? error.message : "unknown"}.` };
  }
  const ms = answer.ms ?? Date.now() - from;
  const cost = answer.cost ?? null;
  const spendLine = `${answer.name ?? answer.model ?? "the modeller"} · ${(ms / 1000).toFixed(1)}s · ${cost === null ? "cost not reported" : `$${cost.toFixed(3)}`}`;
  if (!answer.ok || !answer.solid || !answer.mesh?.glb) {
    const message = answer.reason === "unavailable" ? noRendererKeyMessage("Until then the cube is the whole thing.") : (answer.message ?? "Nothing came back from the modeller.");
    useStudio.getState().landThread({ mode: "drawing", state: "cut", ask: `${node.label}: ${SOLID_WORDS}`, answer: message, madeId: node.id, changes: [spendLine] });
    return { ok: false, reason: answer.reason ?? "failed", message, model: answer.model, name: answer.name, ms, cost };
  }
  // Still there? A person who deleted it while the model thought has said something louder.
  if (!useStudio.getState().nodes.some((n) => n.id === nodeId)) return { ok: false, reason: "gone", message: "The cube was gone by the time the solid came back." };
  useStudio.getState().updateNode(nodeId, {
    featureId: "mesh-3d",
    custom: false,
    shape: null,
    outline: null,
    mesh: {
      glb: answer.mesh.glb,
      // The still is the object as it stood, not one flat face: a person
      // who has written on nothing yet still sees the box they drew.
      still: `data:image/png;base64,${cubeStill(node, palette) ?? front}`,
      turn: { x: -12, y: -28 },
      from: answer.mesh.from ?? answer.model,
      bytes: answer.mesh.bytes,
    },
  });
  const threadId = useStudio.getState().landThread({
    mode: "drawing",
    state: "done",
    model: answer.model,
    ask: `${node.label}: ${SOLID_WORDS}`,
    answer: `made solid by ${answer.name ?? answer.model ?? "the modeller"}, ${Math.round((answer.mesh.bytes ?? answer.mesh.glb.length) / 1024)}KB in the document`,
    madeId: node.id,
    changes: [`turned ${node.label} into a solid`, spendLine],
  });
  useStudio.getState().noteSpend({ dollars: cost ?? 0, ms, calls: 1, ...(cost ? { renderer: cost } : {}) }, threadId);
  return { ok: true, message: `Made solid · ${spendLine}`, model: answer.model, name: answer.name, ms, cost, bytes: answer.mesh.bytes };
}

/** Back to the cube: the mesh stays on the node, so the solid can be shown again. */
export function showCube(nodeId: string): void {
  useStudio.getState().updateNode(nodeId, { featureId: "cube-3d" });
}

/** The solid again, when one was made. */
export function showSolid(nodeId: string): void {
  const node = useStudio.getState().nodes.find((n) => n.id === nodeId);
  if (node?.mesh?.glb) useStudio.getState().updateNode(nodeId, { featureId: "mesh-3d" });
}

"use client";
/**
 * A drawn picture made 3D, from the drawing tool (J, 2026-10-10: "make sure
 * that my generated images have the options either within the generator to
 * become 3d or maybe for me to drag the sphere media shelf element into the
 * generator and it uses that inspiration").
 *
 * Two roads, and the cheap one first:
 *
 * - **On a shape.** Sphere, Cube, Pyramid from Media (`parts/Shape3D.tsx`):
 *   the picture is the shape's own picture, wrapped round the sphere or on
 *   every face. Code, no model, nothing spent past the picture itself.
 * - **A real solid.** The picture goes to the one model in the routing table
 *   that hands back a mesh (`imageRoute.ts`, the `object` cell, Hunyuan3D)
 *   on the same Replicate key, and lands as a Solid (`mesh-3d`) you turn.
 *
 * Asking for one also tells the drawing model what the picture is for: a map
 * that wraps a ball, a square face, or one object alone on a plain ground.
 */
import { SOLID_WORDS_PICTURE, solidModel } from "../solidRoute";
import { noRendererKeyMessage, rendererHeader, rendererReady } from "../loop/run";
import { useStudio } from "../board/store";
import { put as putPicture } from "./pictures";

export type ThreeD = "" | "sphere" | "cube" | "pyramid" | "solid";

export const THREE_D: readonly { value: ThreeD; label: string }[] = [
  { value: "", label: "Flat" },
  { value: "sphere", label: "On a sphere" },
  { value: "cube", label: "On a cube" },
  { value: "pyramid", label: "On a pyramid" },
  { value: "solid", label: "A real 3D model" },
];

/** The shelf part each shape lands as. */
export const SHAPE_PART: Readonly<Record<Exclude<ThreeD, "">, string>> = {
  sphere: "shape-sphere", cube: "shape-cube", pyramid: "shape-pyramid", solid: "mesh-3d",
};

/** Which choice a shelf card stands for, when it is dropped on the drawing tool. Null: it is not a 3D shape. */
export function threeDOf(featureId: string): ThreeD | null {
  if (featureId === "shape-sphere" || featureId === "orb-image" || featureId === "orb-css" || featureId === "orb-webgl") return "sphere";
  if (featureId === "shape-cube" || featureId === "cube-3d") return "cube";
  if (featureId === "shape-pyramid") return "pyramid";
  if (featureId === "mesh-3d") return "solid";
  return null;
}

/** What the drawing model is told the picture is for, after his own words. */
export const THREE_D_ASK: Readonly<Record<Exclude<ThreeD, "">, string>> = {
  sphere: "Draw it as a flat, seamless texture map that wraps round a ball: an equirectangular map, twice as wide as tall, the left and right edges meeting without a seam, no background, no border.",
  cube: "Draw it to fill one square face of a cube, edge to edge, no border, no background plate.",
  pyramid: "Draw it to fill one triangular face of a pyramid: centred, filling the square, no border.",
  solid: "Draw one single object, whole and centred, seen from the front, on a plain white background, nothing else in the picture, so it can be made into a 3D model.",
};

/** The ratio each wants, when the model offers it. */
export const THREE_D_RATIO: Readonly<Record<Exclude<ThreeD, "">, string>> = { sphere: "2:1", cube: "1:1", pyramid: "1:1", solid: "1:1" };

/** Ask the drawing tool to make its next picture 3D (a shape card dropped on it). */
export const THREE_D_EVENT = "studio:render-3d";

/** Is this point over the drawing tool? */
export function overGenerator(x: number, y: number): boolean {
  if (typeof document === "undefined") return false;
  return document.elementsFromPoint(x, y).some((el) => !!(el as HTMLElement).closest?.("[data-render-panel]"));
}

/** Place a new part in the middle of what the board shows, and hand back its id. */
function placeInView(featureId: string): string | null {
  const board = document.querySelector<HTMLElement>("[data-board-tool]");
  const b = board?.getBoundingClientRect();
  const clientX = b ? (Math.max(b.left, 0) + Math.min(b.right, window.innerWidth)) / 2 : window.innerWidth / 2;
  const clientY = b ? (Math.max(b.top, 0) + Math.min(b.bottom, window.innerHeight)) / 2 : window.innerHeight / 2;
  const before = new Set(useStudio.getState().nodes.map((n) => n.id));
  /* The board's own drop: same size, same snapping, same sound (DesktopCanvas `placeFeature`). Synchronous. */
  window.dispatchEvent(new CustomEvent("studio:place-feature", { detail: { featureId, clientX, clientY } }));
  return useStudio.getState().nodes.find((n) => !before.has(n.id) && n.featureId === featureId)?.id ?? null;
}

/** The picture on a new Sphere, Cube or Pyramid on the board. */
export async function onShape(src: string, shape: "sphere" | "cube" | "pyramid", alt: string): Promise<{ ok: boolean; message: string; id?: string }> {
  const blob = await (await fetch(src)).blob();
  const pic = await putPicture(blob, { alt: alt.slice(0, 120), from: "drawn" });
  const id = placeInView(SHAPE_PART[shape]);
  if (!id) return { ok: false, message: "The board was not there to put the shape on." };
  useStudio.getState().updateNode(id, { picture: pic });
  useStudio.getState().setSelection([id]);
  return { ok: true, id, message: `On a ${shape} on the board: drag it to turn it.` };
}

/** A picture as PNG base64, no data-URL head, at most `px` on its long side. */
async function pngOf(src: string, px = 1024): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  try { await img.decode(); } catch { return null; }
  const k = Math.min(1, px / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((img.naturalWidth || 1) * k));
  c.height = Math.max(1, Math.round((img.naturalHeight || 1) * k));
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(img, 0, 0, c.width, c.height);
  try { return c.toDataURL("image/png").split(",")[1] ?? null; } catch { return null; }
}

/**
 * The picture made a real solid by the model that returns one, landed as a
 * Solid on the board. Its own key (Replicate, the same one the pictures use);
 * with none, it says so and nothing is called.
 */
export async function asSolid(src: string, alt: string): Promise<{ ok: boolean; message: string; id?: string; cost?: number | null }> {
  if (!(await rendererReady())) return { ok: false, message: noRendererKeyMessage("Until then, put it on a sphere, cube or pyramid instead.") };
  const front = await pngOf(src);
  if (!front) return { ok: false, message: "The picture could not be read in this browser." };
  const model = solidModel();
  const ask = `${alt.slice(0, 80)}: ${SOLID_WORDS_PICTURE}`;
  const threadId = useStudio.getState().landThread({ mode: "drawing", state: "running", model: model?.slug, ask, answer: "" });
  let answer: { ok?: boolean; mesh?: { glb?: string; bytes?: number; from?: string }; message?: string; model?: string; name?: string; cost?: number | null; ms?: number };
  try {
    const res = await fetch("/api/studio/image", {
      method: "POST",
      headers: { "content-type": "application/json", ...rendererHeader() },
      body: JSON.stringify({ stage: 2, first: front, views: [], said: SOLID_WORDS_PICTURE, label: alt.slice(0, 80), kind: "raster", role: null, w: 420, h: 420, ...(model ? { model: model.slug } : {}) }),
    });
    answer = await res.json();
  } catch (err) {
    useStudio.getState().markThread(threadId, "cut");
    return { ok: false, message: `Could not reach the modeller: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!answer.ok || !answer.mesh?.glb) {
    useStudio.getState().markThread(threadId, "cut");
    return { ok: false, message: answer.message ?? "Nothing came back from the modeller." };
  }
  const id = placeInView("mesh-3d");
  if (!id) { useStudio.getState().markThread(threadId, "cut"); return { ok: false, message: "The board was not there to put the solid on." }; }
  const still = await pngOf(src, 384);
  useStudio.getState().updateNode(id, {
    label: alt.slice(0, 40) || "Solid",
    mesh: { glb: answer.mesh.glb, still: still ? `data:image/png;base64,${still}` : undefined, turn: { x: -12, y: -28 }, from: answer.mesh.from ?? answer.model, bytes: answer.mesh.bytes },
  });
  useStudio.getState().markThread(threadId, "done");
  if (typeof answer.cost === "number") useStudio.getState().noteSpend({ dollars: answer.cost, ms: answer.ms ?? 0, calls: 1, renderer: answer.cost }, threadId);
  useStudio.getState().setSelection([id]);
  const cost = typeof answer.cost === "number" ? ` It cost $${answer.cost.toFixed(3)}.` : "";
  return { ok: true, id, cost: answer.cost ?? null, message: `Made a real 3D model with ${answer.name ?? "the modeller"}: it is on the board, drag it to turn it.${cost}` };
}

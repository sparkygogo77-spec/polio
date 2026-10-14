import * as THREE from "three";

/**
 * A Blockbench `.bbmodel` as a three.js object, drawn the way the Lantern
 * Ring mod draws it (and the way its `tools/bbmodel_preview.py` does):
 *
 * - every face's UV rect laid across the face as ModelPart lays box UV,
 * - cube rotations as Blockbench's X-then-Y-then-Z Euler angles about the
 *   cube's origin, groups the same about theirs,
 * - texels under half alpha cut out, nearest-neighbour sampling,
 * - cubes named `glow…`, `core…` or `glass…` full-bright.
 *
 * One unit is one Blockbench pixel; the result is scaled to blocks (1/16).
 */

type V3 = [number, number, number];
interface Face { uv: [number, number, number, number]; texture?: number | null }
interface Cube {
  type?: string; uuid: string; name: string; from: V3; to: V3; origin?: V3; rotation?: V3;
  inflate?: number; visibility?: boolean; faces: Record<string, Face>;
}
interface Group { uuid?: string; name?: string; origin?: V3; rotation?: V3; visibility?: boolean; children?: (string | Group)[] }
interface Tex { source?: string; name?: string; uv_width?: number; uv_height?: number }
export interface BbModel {
  resolution?: { width: number; height: number };
  elements: Cube[];
  outliner?: (string | Group)[];
  textures?: Tex[];
}

const NORMALS: Record<string, V3> = {
  north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0],
};

/** The model point at (a, b) across a face's UV rect, as `face_corner` in the preview tool. */
function corner(f: V3, t: V3, face: string, a: number, b: number): V3 {
  const [x0, y0, z0] = f, [x1, y1, z1] = t;
  switch (face) {
    case "north": return [x1 - a * (x1 - x0), y1 - b * (y1 - y0), z0];
    case "south": return [x0 + a * (x1 - x0), y1 - b * (y1 - y0), z1];
    case "east": return [x1, y1 - b * (y1 - y0), z1 - a * (z1 - z0)];
    case "west": return [x0, y1 - b * (y1 - y0), z0 + a * (z1 - z0)];
    case "up": return [x1 - a * (x1 - x0), y1, z1 - b * (z1 - z0)];
    default: return [x1 - a * (x1 - x0), y0, z1 - b * (z1 - z0)];
  }
}

const isGlow = (name: string) => /^(glow|core|glass)/.test(name);

/** Blockbench angles in degrees, X first then Y then Z, as one quaternion. */
function turn(r?: V3): THREE.Quaternion | null {
  if (!r || (!r[0] && !r[1] && !r[2])) return null;
  const d = THREE.MathUtils.degToRad;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(d(r[0]), d(r[1]), d(r[2]), "ZYX"));
}

/** Rotate `object` about `origin` (model units) by `r`, wrapping it in a pivot. */
function pivot(object: THREE.Object3D, origin: V3 | undefined, r: V3 | undefined): THREE.Object3D {
  const q = turn(r);
  if (!q) return object;
  const o = new THREE.Vector3(...(origin ?? [0, 0, 0]));
  const p = new THREE.Group();
  p.position.copy(o);
  p.quaternion.copy(q);
  object.position.sub(o);
  p.add(object);
  return p;
}

async function loadTexture(src: string): Promise<THREE.Texture> {
  const tex = await new THREE.TextureLoader().loadAsync(src);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface Built { object: THREE.Object3D; cubes: number; faces: number; textures: number }

export async function buildBbModel(bb: BbModel): Promise<Built> {
  const uw = bb.resolution?.width ?? 16, uh = bb.resolution?.height ?? 16;
  const textures = await Promise.all((bb.textures ?? []).map((t) => (t.source ? loadTexture(t.source) : Promise.resolve(null))));
  const mats = new Map<string, THREE.Material>();
  const material = (tex: number, glow: boolean) => {
    const key = `${tex}:${glow}`;
    let m = mats.get(key);
    if (!m) {
      const map = textures[tex] ?? null;
      const opts = { map, alphaTest: 0.5, side: THREE.FrontSide, color: map ? 0xffffff : 0xb0b0b0 };
      m = glow ? new THREE.MeshBasicMaterial(opts) : new THREE.MeshLambertMaterial(opts);
      m.name = `${bb.textures?.[tex]?.name ?? "untextured"}${glow ? " (glow)" : ""}`;
      mats.set(key, m);
    }
    return m;
  };

  let faces = 0;
  const cubeMesh = (el: Cube): THREE.Object3D | null => {
    if (el.visibility === false) return null;
    const inf = el.inflate ?? 0;
    const f = el.from.map((v) => v - inf) as V3, t = el.to.map((v) => v + inf) as V3;
    const glow = isGlow(el.name);
    const byTex = new Map<number, { pos: number[]; uv: number[]; nor: number[]; idx: number[] }>();
    for (const [face, fc] of Object.entries(el.faces ?? {})) {
      if (!fc || fc.texture === null || !fc.uv || !NORMALS[face]) continue;
      const [u0, v0, u1, v1] = fc.uv;
      if (u0 === u1 || v0 === v1) continue;
      const tw = bb.textures?.[fc.texture ?? 0]?.uv_width ?? uw, th = bb.textures?.[fc.texture ?? 0]?.uv_height ?? uh;
      const ab: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const pts = ab.map(([a, b]) => corner(f, t, face, a, b));
      const e1 = new THREE.Vector3(...pts[1]!).sub(new THREE.Vector3(...pts[0]!));
      const e2 = new THREE.Vector3(...pts[3]!).sub(new THREE.Vector3(...pts[0]!));
      const n = new THREE.Vector3().crossVectors(e1, e2);
      if (n.lengthSq() < 1e-12) continue;
      const want = new THREE.Vector3(...NORMALS[face]!);
      const g = byTex.get(fc.texture ?? 0) ?? { pos: [], uv: [], nor: [], idx: [] };
      byTex.set(fc.texture ?? 0, g);
      const base = g.pos.length / 3;
      ab.forEach(([a, b], i) => {
        g.pos.push(...pts[i]!);
        g.nor.push(...NORMALS[face]!);
        g.uv.push((u0 + a * (u1 - u0)) / tw, 1 - (v0 + b * (v1 - v0)) / th);
      });
      // Wind the two triangles so they face out along the face's normal.
      if (n.dot(want) > 0) g.idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
      else g.idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
      faces++;
    }
    if (byTex.size === 0) return null;
    const holder = new THREE.Group();
    holder.name = el.name;
    for (const [tex, g] of byTex) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setIndex(g.idx);
      holder.add(new THREE.Mesh(geo, material(tex, glow)));
    }
    return pivot(holder, el.origin, el.rotation);
  };

  const byId = new Map(bb.elements.map((e) => [e.uuid, e]));
  const used = new Set<string>();
  let cubes = 0;
  const walk = (nodes: (string | Group)[]): THREE.Object3D[] =>
    nodes.flatMap((n): THREE.Object3D[] => {
      if (typeof n === "string") {
        const el = byId.get(n);
        if (!el || (el.type ?? "cube") !== "cube") return [];
        used.add(n);
        const m = cubeMesh(el);
        if (m) cubes++;
        return m ? [m] : [];
      }
      if (n.visibility === false) return [];
      const g = new THREE.Group();
      g.name = n.name ?? "group";
      walk(n.children ?? []).forEach((c) => g.add(c));
      return [pivot(g, n.origin, n.rotation)];
    });

  const root = new THREE.Group();
  walk(bb.outliner ?? []).forEach((c) => root.add(c));
  // Cubes the outliner never names still belong to the model.
  for (const el of bb.elements) {
    if (used.has(el.uuid) || (el.type ?? "cube") !== "cube") continue;
    const m = cubeMesh(el);
    if (m) { root.add(m); cubes++; }
  }
  root.scale.setScalar(1 / 16);
  return { object: root, cubes, faces, textures: textures.filter(Boolean).length };
}

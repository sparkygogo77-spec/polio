import type { ScaffoldPart } from "./types.ts";
import { inComment, jsxAttr } from "./jsx.ts";

export const FRAME_TSX = `"use client";
import * as React from "react";

export type Device = "desktop" | "tablet" | "phone";
export interface Box { left: number; top: number; width: number; height: number }

/** The layouts a page carries besides the board's own: the Builder's preview at a tablet (834) and a phone (390). */
export interface Layouts { tablet?: { width: number; height: number }; phone?: { width: number; height: number } }

const DeviceContext = React.createContext<Device>("desktop");

/** Which layout a screen this wide gets: the phone's up to 480, the tablet's up to 1024, when the page carries them. */
function deviceFor(innerWidth: number, layouts: Layouts | undefined): Device {
  if (layouts?.phone && innerWidth <= 480) return "phone";
  if (layouts?.tablet && innerWidth <= 1024) return "tablet";
  return "desktop";
}

/**
 * The page's own frame. At the board's width every position is the
 * board's. At a tablet or a phone it takes the placement the Builder's
 * preview computes for that width, when the page carries one, and only
 * scales down between those widths. Every part on the page sits in a
 * \`Place\`, which reads the device from here.
 */
export function Frame({ width, height, layouts, children }: { width: number; height: number; layouts?: Layouts; children: React.ReactNode }) {
  const [device, setDevice] = React.useState<Device>("desktop");
  const [scale, setScale] = React.useState(1);
  const size = device === "desktop" ? { width, height } : layouts?.[device] ?? { width, height };
  React.useEffect(() => {
    const fit = () => {
      const d = deviceFor(window.innerWidth, layouts);
      const w = d === "desktop" ? width : layouts?.[d]?.width ?? width;
      setDevice(d);
      setScale(Math.min(1, window.innerWidth / w));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width, layouts]);
  return (
    <DeviceContext.Provider value={device}>
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div style={{ width: size.width, height: size.height, position: "relative", transform: \`scale(\${scale})\`, transformOrigin: "top left", marginBottom: (scale - 1) * size.height, marginInline: "auto" }}>
          {children}
        </div>
      </div>
    </DeviceContext.Provider>
  );
}

/** One part's place on the page, at whichever device the frame is showing; the desktop's when a device has none. */
export function Place({ id, at, style, children, ...rest }: { id: string; at: Partial<Record<Device, Box>> & { desktop: Box }; style?: React.CSSProperties; children: React.ReactNode } & Record<\`data-\${string}\`, string>) {
  const device = React.useContext(DeviceContext);
  const box = at[device] ?? at.desktop;
  return (
    <div id={id} {...rest} style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, ...style }}>
      {children}
    </div>
  );
}
`;


/**
 * A solid, written out.
 *
 * Like the cube, a mesh is not markup: a snapshot of it is a photograph of
 * one angle. So the export writes the live part again as code: the GLB as
 * data at the top of the file, three.js loaded only in the browser and only
 * when it is there, the still the live page falls back to, and the same
 * turning by pointer and keys. The one dependency is named in BUILD.md.
 */
export function meshTsx(part: ScaffoldPart, name: string): string {
  const m = part.mesh!;
  const start = m.turn ?? { x: -12, y: -28 };
  return `"use client";
import * as React from "react";

/**
 * ${inComment(part.label)}, a solid you can turn. Written from the document (${part.featureId}${m.from ? `, made by ${inComment(m.from)}` : ""}).
 * The GLB rides in this file as data, so nothing is fetched. three.js is
 * loaded only in the browser and only when it is installed (npm install
 * three); without it, or without a 3D context, the still is shown and says so.
 */
const GLB = ${JSON.stringify(m.glb)};
const STILL = ${m.still ? JSON.stringify(m.still) : "null"};
const START = { x: ${Math.round(start.x)}, y: ${Math.round(start.y)} };
/** Degrees per pixel dragged: the cube's number, so the two turn alike. */
const PER_PX = 0.42;
const DECAY = 0.94;
const SETTLE = 0.35;
const rad = (d: number) => (d * Math.PI) / 180;

export function ${name}() {
  const host = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState("");
  const turn = React.useRef({ ...START });
  const spin = React.useRef({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const held = React.useRef(false);

  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stop = false;
    let frame = 0;
    let cleanup = () => {};
    void (async () => {
      let THREE: typeof import("three");
      let GLTFLoader: typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader;
      try {
        THREE = await import("three");
        ({ GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js"));
      } catch {
        if (!stop) setFailed("shown as a still: the 3D library did not load (npm install three)");
        return;
      }
      if (stop) return;
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch {
        if (!stop) setFailed("shown as a still: this browser gave no 3D context");
        return;
      }
      const box = el.getBoundingClientRect();
      const width = Math.max(64, Math.round(box.width || ${Math.round(part.w)}));
      const height = Math.max(64, Math.round(box.height || ${Math.round(part.h)}));
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      el.append(renderer.domElement);
      const scene = new THREE.Scene();
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(-0.8, 1.2, 3);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const rim = new THREE.DirectionalLight(0xffffff, 0.7);
      rim.position.set(-2, -1, -3);
      scene.add(rim);
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 100);
      const pivot = new THREE.Group();
      scene.add(pivot);
      let loaded: import("three").Object3D | null = null;
      try {
        loaded = (await new GLTFLoader().loadAsync(GLB)).scene;
      } catch {
        if (!stop) setFailed("shown as a still: the solid would not load");
        renderer.dispose();
        return;
      }
      if (stop || !loaded) { renderer.dispose(); return; }
      const bounds = new THREE.Box3().setFromObject(loaded);
      const size = bounds.getSize(new THREE.Vector3());
      const middle = bounds.getCenter(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z) || 1;
      loaded.position.sub(middle);
      pivot.add(loaded);
      pivot.scale.setScalar(1 / longest);
      camera.position.set(0, 0, 1 / 0.86 / (2 * Math.tan(rad(35 / 2))));
      camera.lookAt(0, 0, 0);
      const draw = () => {
        pivot.rotation.x = rad(turn.current.x);
        pivot.rotation.y = rad(turn.current.y);
        renderer.render(scene, camera);
      };
      const tick = () => {
        if (stop) return;
        frame = requestAnimationFrame(tick);
        if (held.current) return;
        const s = spin.current;
        if (Math.abs(s.x) > SETTLE || Math.abs(s.y) > SETTLE) {
          turn.current = { x: turn.current.x + s.x, y: turn.current.y + s.y };
          s.x *= DECAY;
          s.y *= DECAY;
          draw();
          return;
        }
        if (s.x || s.y) { s.x = 0; s.y = 0; draw(); }
      };
      draw();
      frame = requestAnimationFrame(tick);
      const resize = () => {
        const r = el.getBoundingClientRect();
        const rw = Math.max(64, Math.round(r.width));
        const rh = Math.max(64, Math.round(r.height));
        renderer.setSize(rw, rh, false);
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
        draw();
      };
      const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
      watch?.observe(el);
      cleanup = () => {
        cancelAnimationFrame(frame);
        watch?.disconnect();
        renderer.domElement.remove();
        renderer.dispose();
      };
    })();
    return () => { stop = true; cancelAnimationFrame(frame); cleanup(); };
  }, []);

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    held.current = true;
    drag.current = { x: e.clientX, y: e.clientY };
    spin.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    spin.current = { x: -dy * PER_PX, y: dx * PER_PX };
    turn.current = { x: turn.current.x - dy * PER_PX, y: turn.current.y + dx * PER_PX };
  };
  const up = (e: React.PointerEvent) => {
    held.current = false;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!spin.current.x && !spin.current.y) spin.current = { x: 0.01, y: 0.01 };
  };
  const keys = (e: React.KeyboardEvent) => {
    const step = ({ ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] } as Record<string, [number, number]>)[e.key];
    if (!step) return;
    e.preventDefault();
    turn.current = { x: Math.round(turn.current.x / 90) * 90 + step[0], y: Math.round(turn.current.y / 90) * 90 + step[1] };
    spin.current = { x: 0.01, y: 0.01 };
  };

  return (
    <div
      data-part=${JSON.stringify(part.id)}
      data-mesh=""
      data-mesh-still={failed ? "" : undefined}
      role="img"
      tabIndex={failed ? -1 : 0}
      aria-label=${jsxAttr(`${part.label}, a solid you can turn. Drag to turn it, or use the arrow keys.`)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={keys}
      style={{ width: "100%", height: "100%", outline: "none", cursor: failed ? "default" : "grab", touchAction: "none", position: "relative", overflow: "hidden" }}
    >
      <div ref={host} style={{ width: "100%", height: "100%", display: failed ? "none" : "block" }} />
      {failed ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {STILL ? <img src={STILL} alt=${jsxAttr(part.label)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <p style={{ color: "var(--muted)", fontSize: 11 }}>{${JSON.stringify(part.label)}}</p>}
          <p data-mesh-instead={failed} style={{ position: "absolute", bottom: 4, left: 4, padding: "2px 6px", borderRadius: 4, fontSize: 9, background: "var(--bg)", color: "var(--muted)" }}>{failed}</p>
        </div>
      ) : null}
    </div>
  );
}
`;
}

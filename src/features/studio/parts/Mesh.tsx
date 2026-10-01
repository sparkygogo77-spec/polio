"use client";
/**
 * A solid, mounted and turned.
 *
 * The cube next door is the part a drawing of a box becomes, and it is
 * code: six faces, real text on them, no library and no file. This is the
 * other half — the part a drawing of *anything else* becomes when somebody
 * asks for a thing they can turn. A bird cannot be six rectangles, so what
 * the model hands back is a mesh, and this mounts it.
 *
 * How it works, and why:
 *
 * - The GLB rides inside the document as a `data:` URI, exactly the way a
 *   raster body does. Nothing is fetched when the part is drawn, because
 *   nothing may be: a generated site ships what it draws. That is also why
 *   the model is asked for a small face count — this is bytes in a page.
 * - three.js is loaded **only when the part is live and only in the
 *   browser**, the same way the WebGL orb does it. A machine that will not
 *   give a WebGL context, or a build that did not ship the library, gets
 *   the still instead and says so rather than showing an empty box.
 * - Dragging turns it, at the same degrees-per-pixel the cube uses, so the
 *   two parts feel like the same hand. Arrow keys step a quarter turn, and
 *   it is focusable, because a thing you can turn with a pointer must be
 *   turnable without one.
 * - Where it is left standing is written back to the node, so the board
 *   draws that angle and publish keeps it.
 *
 * Board mode is one still frame, as the rule says: the photograph, no rAF,
 * no listeners, no library loaded at all.
 */
import * as React from "react";
import { Fill } from "./primitives";
import type { Theme } from "./theme";
import { num, opt, type PartProps } from "./types";

/** Degrees per pixel dragged. The cube's number, so the two turn alike. */
const PER_PX = 0.42;
/** How fast the spin dies, per frame at 60fps. */
const DECAY = 0.94;
/** Under this many degrees a frame, it is done spinning. */
const SETTLE = 0.35;

const rad = (d: number) => (d * Math.PI) / 180;

/** What the viewer could not do, said in a line rather than left blank. */
function Instead({ t, still, why, label }: { t: Theme; still?: string; why: string; label: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {still ? (
        <img src={still} alt={label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        <p className="px-3 text-center" style={{ color: t.muted, fontSize: t.fontPx * 0.6875 }}>{label}</p>
      )}
      <p
        data-mesh-instead={why}
        className="absolute bottom-1 left-1 rounded px-1.5 py-0.5"
        style={{ background: t.bg, color: t.muted, fontSize: t.fontPx * 0.5625 }}
      >
        {why}
      </p>
    </div>
  );
}

export function Mesh({ id, label, w, h, theme: t, mode, mesh, options, emit }: PartProps) {
  const live = mode === "live";
  const start = mesh?.turn ?? { x: -12, y: -28 };
  const fill = num(options, "size", 86, 30, 100) / 100;
  const spinning = opt(options, "turning", "when you turn it") === "on its own";

  const host = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState("");
  const turn = React.useRef(start);
  const spin = React.useRef({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const held = React.useRef(false);
  const said = React.useRef(`${Math.round(start.x)},${Math.round(start.y)}`);
  /*
   * The callbacks, held rather than depended on.
   *
   * The board hands a fresh arrow down on every render, and a renderer that
   * is torn down and rebuilt on every render is a lost GL context every
   * render. Nothing about mounting a solid depends on *which* function is
   * told where it was left, so the effect below depends on none of them.
   */
  const tell = React.useRef(emit);
  tell.current = emit;
  /*
   * Where it was left, written down.
   *
   * On the release rather than at the end of the spin. The angle is the
   * person's answer either way, and hanging it off the animation made it
   * depend on the loop still being alive a second later — which, on a board
   * that re-renders whenever anything moves, is not something to depend on.
   * Letting go is the gesture that means "there".
   */
  const rest = React.useCallback(() => {
    const at = { x: Math.round(turn.current.x), y: Math.round(turn.current.y) };
    const mark = `${at.x},${at.y}`;
    if (mark === said.current) return;
    said.current = mark;
    tell.current?.({ type: "mesh", turn: at });
  }, []);
  const lamp = t.lightFrom ?? { x: 0.3, y: 0.2 };
  const lampX = lamp.x;
  const lampY = lamp.y;

  /*
   * The whole of the WebGL half, in one effect, torn down completely on the
   * way out: a renderer left behind is a lost GL context, and a board holds
   * a lot of parts.
   */
  React.useEffect(() => {
    if (!live || !mesh?.glb) return;
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
        if (!stop) setFailed("shown as a still: the 3D library did not load");
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
      const width = Math.max(64, Math.round(box.width || w));
      const height = Math.max(64, Math.round(box.height || h));
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
      /*
       * The page's own light, not a studio's.
       *
       * Every other part is shaded by where the site says its lamp is, and
       * a solid that lit itself from somewhere else would sit in a
       * different room from the rest of the page.
       */
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set((lampX - 0.5) * 4, (0.5 - lampY) * 4, 3);
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
        const gltf = await new GLTFLoader().loadAsync(mesh.glb);
        loaded = gltf.scene;
      } catch {
        if (!stop) setFailed("shown as a still: the solid would not load");
        renderer.dispose();
        return;
      }
      if (stop || !loaded) {
        renderer.dispose();
        return;
      }

      /*
       * Centred and scaled to the box it was given.
       *
       * A mesh arrives at whatever size and offset the model chose, and a
       * part fills the box the board decided. So it is measured, moved onto
       * its own middle, and scaled until its longest side is the frame —
       * the same contract every other part keeps.
       */
      const bounds = new THREE.Box3().setFromObject(loaded);
      const size = bounds.getSize(new THREE.Vector3());
      const middle = bounds.getCenter(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z) || 1;
      loaded.position.sub(middle);
      pivot.add(loaded);
      pivot.scale.setScalar(1 / longest);
      camera.position.set(0, 0, 1 / fill / (2 * Math.tan(rad(35 / 2))));
      camera.lookAt(0, 0, 0);

      const draw = () => {
        pivot.rotation.x = rad(turn.current.x);
        pivot.rotation.y = rad(turn.current.y);
        renderer.render(scene, camera);
      };

      const tick = () => {
        if (stop) return;
        frame = requestAnimationFrame(tick);
        if (spinning && !held.current) {
          turn.current = { x: turn.current.x, y: turn.current.y + 0.25 };
          draw();
          return;
        }
        if (held.current) return;
        const s = spin.current;
        if (Math.abs(s.x) > SETTLE || Math.abs(s.y) > SETTLE) {
          turn.current = { x: turn.current.x + s.x, y: turn.current.y + s.y };
          s.x *= DECAY;
          s.y *= DECAY;
          draw();
          return;
        }
        if (!s.x && !s.y) return;
        s.x = 0;
        s.y = 0;
        // Come to rest. Where it was left was written the moment the hand
        // let go, not here: see `up`.
        rest();
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
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as import("three").Material | import("three").Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose?.();
        });
      };
    })();

    return () => {
      // `cleanup` is assigned inside the async half, so a re-render that
      // beats the loader to it would leave a renderer running. `stop` is
      // checked at every await for exactly that, and the loop reads it too.
      stop = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [live, mesh?.glb, spinning, fill, lampX, lampY, rest]);

  const down = (e: React.PointerEvent) => {
    if (!live) return;
    // The press stops here: the board's own surface captures every press,
    // which is right for a part you are moving and wrong for one you are
    // handling.
    e.stopPropagation();
    e.preventDefault();
    held.current = true;
    drag.current = { x: e.clientX, y: e.clientY };
    spin.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!live || !d) return;
    e.stopPropagation();
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    spin.current = { x: -dy * PER_PX, y: dx * PER_PX };
    turn.current = { x: turn.current.x - dy * PER_PX, y: turn.current.y + dx * PER_PX };
  };
  const up = (e: React.PointerEvent) => {
    const was = !!drag.current;
    if (live && was) e.stopPropagation();
    held.current = false;
    drag.current = null;
    if (live) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (live && was) rest();
  };
  const keys = (e: React.KeyboardEvent) => {
    if (!live) return;
    const step = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    // The board nudges the selected part with the arrows; while this has the
    // keys, they turn it instead of moving it.
    e.stopPropagation();
    spin.current = { x: 0, y: 0 };
    turn.current = { x: Math.round(turn.current.x / 90) * 90 + step[0]!, y: Math.round(turn.current.y / 90) * 90 + step[1]! };
    // A nudge, so the loop redraws it; the angle itself is written at once.
    spin.current = { x: 0.01, y: 0.01 };
    rest();
  };

  const none = !mesh?.glb;
  const still = !live || !!failed || none;

  return (
    <Fill t={t} data-part={id}>
      <div
        data-mesh=""
        data-mesh-from={mesh?.from ?? ""}
        data-mesh-bytes={mesh?.bytes ?? 0}
        data-mesh-still={still ? "" : undefined}
        role="img"
        tabIndex={live && !still ? 0 : -1}
        aria-label={`${label}, a solid you can turn. Drag to turn it, or use the arrow keys.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={keys}
        className="h-full w-full outline-none"
        style={{ cursor: live && !still ? "grab" : "default", touchAction: "none" }}
      >
        {still ? (
          <Instead
            t={t}
            still={mesh?.still}
            label={label}
            why={none ? "no solid on this part yet" : failed || "a still: the board draws one frame"}
          />
        ) : (
          <div ref={host} className="h-full w-full" />
        )}
      </div>
    </Fill>
  );
}

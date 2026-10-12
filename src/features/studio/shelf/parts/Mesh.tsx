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
 * - Dragging orbits it the way Replicate's own preview does (J, 2026-10-12:
 *   "replicates dragging system is good we need that exactly"): three.js's
 *   OrbitControls, live while the hand moves and easing to a stop after,
 *   upright, no zoom or pan to fight the board. Arrow keys step a quarter turn, and
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

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/*
 * The stored turn is the solid's own tilt (x) and swing (y). Orbiting moves
 * the camera instead, so the two are one change of frame apart: the camera
 * sits where turning the solid by (x, y) would have put the eye.
 */
function eyeAt(turn: { x: number; y: number }, d: number): [number, number, number] {
  const x = rad(turn.x), y = rad(turn.y);
  return [-d * Math.cos(x) * Math.sin(y), d * Math.sin(x), d * Math.cos(x) * Math.cos(y)];
}
function turnOf(p: { x: number; y: number; z: number }): { x: number; y: number } {
  const d = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: deg(Math.asin(Math.max(-1, Math.min(1, p.y / d)))), y: deg(Math.atan2(-p.x, p.z)) };
}

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
  /** Turns it to an angle from outside the loop: the arrow keys. */
  const aim = React.useRef<((to: { x: number; y: number }) => void) | null>(null);
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
    let cleanupControls = () => {};

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
      /*
       * Light from every side as well (J, 2026-10-12: the far side of a
       * solid went almost black). A model's GLB is usually PBR, lit mostly
       * by what it reflects, so it is given a room to reflect and a sky and
       * ground light; the page's lamp above still decides the highlights.
       */
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.9));
      try {
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        const pmrem = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        scene.environment = pmrem.fromScene(room, 0.04).texture;
        scene.environmentIntensity = 0.8;
        room.dispose?.();
        pmrem.dispose();
      } catch {
        // No room to reflect: the lights alone still reach every side.
      }
      if (stop) { renderer.dispose(); return; }

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
      const away = 1 / fill / (2 * Math.tan(rad(35 / 2)));
      camera.position.set(...eyeAt(turn.current, away));
      camera.lookAt(0, 0, 0);

      const draw = () => renderer.render(scene, camera);

      let OrbitControls: typeof import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;
      try {
        ({ OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js"));
      } catch {
        if (!stop) setFailed("shown as a still: the 3D library did not load");
        renderer.dispose();
        return;
      }
      if (stop) { renderer.dispose(); return; }
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.9;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.autoRotate = spinning;
      controls.autoRotateSpeed = 1.5;
      controls.target.set(0, 0, 0);
      controls.update();
      // Where it was left: written when the hand lets go, and again once the
      // ease after it has settled, so the angle kept is the one it stopped at.
      let settle: ReturnType<typeof setTimeout> | undefined;
      const note = () => {
        turn.current = turnOf(camera.position);
        clearTimeout(settle);
        settle = setTimeout(rest, 400);
      };
      controls.addEventListener("end", () => { turn.current = turnOf(camera.position); rest(); });
      controls.addEventListener("change", note);
      aim.current = (to) => {
        turn.current = to;
        camera.position.set(...eyeAt(to, away));
        controls.update();
        rest();
      };

      const tick = () => {
        if (stop) return;
        frame = requestAnimationFrame(tick);
        controls.update();
        draw();
      };
      cleanupControls = () => { clearTimeout(settle); controls.dispose(); aim.current = null; };

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
        cleanupControls();
        scene.environment?.dispose();
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

  /*
   * The press stops here: the board's own surface captures every press,
   * which is right for a part you are moving and wrong for one you are
   * handling. The turning itself is OrbitControls', on the canvas.
   */
  const keep = (e: React.PointerEvent) => { if (live) e.stopPropagation(); };
  const keys = (e: React.KeyboardEvent) => {
    if (!live) return;
    const step = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    // The board nudges the selected part with the arrows; while this has the
    // keys, they turn it instead of moving it. Upright stops short of the pole.
    e.stopPropagation();
    const x = Math.max(-85, Math.min(85, Math.round(turn.current.x / 90) * 90 + step[0]!));
    aim.current?.({ x, y: Math.round(turn.current.y / 90) * 90 + step[1]! });
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
        onPointerDown={keep}
        onPointerMove={keep}
        onPointerUp={keep}
        onPointerCancel={keep}
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

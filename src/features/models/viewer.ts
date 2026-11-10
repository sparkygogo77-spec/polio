/**
 * The Models view's 3D stage: three.js, loaded only when `/models` opens
 * (`ModelsPage` imports this file dynamically, so no other page carries it).
 *
 * Blender's way of looking at a model: drag orbits round the middle (360°,
 * over the top too), the wheel zooms, Shift + wheel turns it like a
 * turntable, right-drag (or Ctrl-drag) pans, double-click frames a part.
 * Front / Right / Top and the Ctrl ones are numpad 1 / 3 / 7, as in Blender.
 * Blender's Z-up is the glTF exporter's Y-up, so Blender front (from -Y) is
 * +Z here, Blender right (+X) is +X, and Blender top (+Z) is +Y.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type ViewName = "front" | "back" | "right" | "left" | "top" | "bottom";
export type Look = "material" | "solid";
export type CameraInfo = { azimuth: number; polar: number; distance: number; target: [number, number, number]; fov: number };

/** The angle the review site opened takes at ("35deg 75deg auto"). */
const HOME = { azimuth: 35, polar: 75 };
const DIRS: Record<ViewName, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0.0001),
  bottom: new THREE.Vector3(0, -1, 0.0001),
};
const SOLID = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.85, metalness: 0 });
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export class ModelStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private host: HTMLElement;
  private root: THREE.Object3D | null = null;
  private grid: THREE.Group;
  private marker: THREE.BoxHelper | null = null;
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private radius = 1;
  private center = new THREE.Vector3();
  private raf = 0;
  private ro: ResizeObserver;
  private ray = new THREE.Raycaster();
  private disposed = false;
  /** Something changed that the camera does not know about (a look, a mark, a size): draw the next frame. */
  dirty = true;
  look: Look = "material";
  /** Degrees a second the turntable turns at. */
  turntableSpeed = 30;
  turntable = false;
  name = "";
  onChange: () => void = () => {};

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.setAttribute("data-model-canvas", "");
    host.appendChild(this.renderer.domElement);

    /* Blender's viewport: a dark grey ground, studio light from the camera's side, soft fill. */
    this.scene.background = new THREE.Color(0x303030);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pm.dispose();
    /* Kept low: a light grey part (Workbench's 0.8) under more than about 1.2 of light saturates to white. */
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.45));
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    this.grid = this.makeGrid(1);
    this.scene.add(this.grid);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    /* Workbench's studio light rides with the view: from above and to the left of the camera, whichever side is shown. */
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(-1, 1.2, 0.6);
    key.target.position.set(0, 0, -1);
    this.camera.add(key, key.target);
    this.scene.add(this.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;
    /* Blender: middle drags orbit, Ctrl/right pans; here left orbits (it is the review site's habit) and right pans. */
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
    this.controls.addEventListener("change", () => {
      this.dirty = true;
      this.onChange();
    });

    /* Shift + wheel turns the model like a turntable instead of zooming: caught before OrbitControls sees it. */
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
    this.renderer.domElement.addEventListener("dblclick", this.onDouble);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.frameAll(false);
    let last = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.turntable) this.spin(this.turntableSpeed * dt);
      /* Drawn only when something moved: a pass of two thousand meshes would otherwise hold the page every frame. */
      if (this.controls.update() || this.dirty) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private makeGrid(size: number) {
    /* Blender's floor: grey lines, a red X axis and a green Y axis (Blender's Y is -Z here). */
    const g = new THREE.Group();
    const step = 10 ** Math.floor(Math.log10(Math.max(size, 0.001)));
    const half = Math.ceil(size / step) * step * 2;
    const divisions = Math.round((half * 2) / step);
    const lines = new THREE.GridHelper(half * 2, divisions, 0x5a5a5a, 0x444444);
    g.add(lines);
    const axis = (color: number, a: THREE.Vector3, b: THREE.Vector3) => {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
    };
    axis(0xd2404f, new THREE.Vector3(-half, 0.0005, 0), new THREE.Vector3(half, 0.0005, 0));
    axis(0x6ea72a, new THREE.Vector3(0, 0.0005, -half), new THREE.Vector3(0, 0.0005, half));
    g.name = "__grid";
    return g;
  }

  /** Opens a model from a URL, or from dropped files (a .glb, or a .gltf with its .bin and pictures). */
  async load(src: string | File[], name?: string): Promise<{ meshes: number; parts: string[] }> {
    const manager = new THREE.LoadingManager();
    const urls: string[] = [];
    let url: string;
    if (typeof src === "string") {
      url = src;
    } else {
      const byName = new Map(src.map((f) => [f.name, f]));
      const main = src.find((f) => /\.(glb|gltf)$/i.test(f.name));
      if (!main) throw new Error("No .glb or .gltf among the files");
      manager.setURLModifier((u) => {
        const file = byName.get(decodeURIComponent(u.split("/").pop() || ""));
        if (!file) return u;
        const b = URL.createObjectURL(file);
        urls.push(b);
        return b;
      });
      url = URL.createObjectURL(main);
      urls.push(url);
      name = name ?? main.name;
    }
    try {
      const gltf = await new GLTFLoader(manager).loadAsync(url);
      this.setModel(gltf.scene, name ?? url.split("/").pop() ?? "model");
    } finally {
      for (const u of urls) URL.revokeObjectURL(u);
    }
    return { meshes: this.meshes().length, parts: this.parts() };
  }

  private setModel(obj: THREE.Object3D, name: string) {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
    this.clearMark();
    this.originals.clear();
    this.root = obj;
    this.name = name;
    this.scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    this.radius = Math.max(size.length() / 2, 0.001);
    box.getCenter(this.center);
    this.scene.remove(this.grid);
    this.grid = this.makeGrid(Math.max(size.x, size.z, 0.01));
    this.grid.position.y = box.min.y;
    this.scene.add(this.grid);
    this.camera.near = this.radius / 500;
    this.camera.far = this.radius * 500;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.radius / 50;
    this.controls.maxDistance = this.radius * 50;
    this.setLook(this.look);
    this.reset();
    this.dirty = true;
  }

  meshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.root?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
    });
    return out;
  }

  /**
   * The model's groups, for Frame: Blender's collections (a pass's takes and
   * shelves) when the export kept them, else its top-level objects. Walks past
   * a lone wrapper so a pass in one collection still lists what is in it.
   */
  groups(): { name: string; meshes: number }[] {
    let level: THREE.Object3D[] = this.root ? [this.root] : [];
    for (let i = 0; i < 4 && level.length === 1 && level[0]!.children.length; i++) level = level[0]!.children;
    const count = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((x) => {
        if ((x as THREE.Mesh).isMesh) n++;
      });
      return n;
    };
    return level
      .map((o) => ({ name: o.name || "unnamed", meshes: count(o) }))
      .filter((g) => g.meshes > 0);
  }

  /** Frames one group by name (Frame in the bar), or the whole model for "". */
  frameGroup(name: string) {
    if (!name) return this.frameAll(false);
    let hit: THREE.Object3D | undefined;
    this.root?.traverse((o) => {
      if (!hit && o.name === name) hit = o;
    });
    if (hit) this.frame(hit);
  }

  parts(): string[] {
    return [...new Set(this.meshes().map((m) => partName(m)))];
  }

  /** Material: the model's own colours. Solid: Blender Workbench's flat studio grey, to judge the form. */
  setLook(look: Look) {
    this.look = look;
    for (const m of this.meshes()) {
      if (!this.originals.has(m)) this.originals.set(m, m.material);
      m.material = look === "solid" ? SOLID : this.originals.get(m)!;
    }
    this.dirty = true;
    this.onChange();
  }

  private place(azimuth: number, polar: number, distance: number, target: THREE.Vector3, smooth = false) {
    void smooth;
    const a = THREE.MathUtils.degToRad(azimuth);
    const p = THREE.MathUtils.degToRad(polar);
    this.controls.target.copy(target);
    this.camera.position.set(
      target.x + distance * Math.sin(p) * Math.sin(a),
      target.y + distance * Math.cos(p),
      target.z + distance * Math.sin(p) * Math.cos(a),
    );
    this.camera.lookAt(target);
    this.controls.update();
    this.onChange();
  }

  private fitDistance(radius: number) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect);
    return (radius * 1.15) / Math.sin(Math.min(fov, fovH) / 2);
  }

  /** Reset view: the whole model, from the review site's angle. Home in Blender. */
  reset() {
    this.turntable = false;
    this.frameAll(true);
  }

  private frameAll(home: boolean) {
    const info = this.cameraInfo();
    const az = home ? HOME.azimuth : info.azimuth;
    const po = home ? HOME.polar : info.polar;
    this.place(az, po, this.fitDistance(this.radius), this.center);
  }

  /** Blender's numpad views: 1 front, 3 right, 7 top; with Ctrl the opposite side. */
  view(name: ViewName) {
    const d = DIRS[name];
    const dist = this.camera.position.distanceTo(this.controls.target) || this.fitDistance(this.radius);
    const pos = this.controls.target.clone().addScaledVector(d.clone().normalize(), dist);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.onChange();
  }

  /** Turns the model's stand by some degrees (the camera goes round the other way). */
  spin(degrees: number) {
    const info = this.cameraInfo();
    const t = this.controls.target.clone();
    this.place(info.azimuth - degrees, info.polar, info.distance, t);
  }

  zoom(factor: number) {
    const info = this.cameraInfo();
    const d = THREE.MathUtils.clamp(info.distance * factor, this.controls.minDistance, this.controls.maxDistance);
    this.place(info.azimuth, info.polar, d, this.controls.target.clone());
  }

  cameraInfo(): CameraInfo {
    const off = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    let az = THREE.MathUtils.radToDeg(s.theta);
    az = ((az % 360) + 360) % 360;
    const t = this.controls.target;
    return { azimuth: round(az) % 360, polar: round(THREE.MathUtils.radToDeg(s.phi)), distance: round(s.radius, 3), target: [round(t.x, 3), round(t.y, 3), round(t.z, 3)], fov: this.camera.fov };
  }

  /** The part under a point of the canvas (client coordinates), or null. */
  pick(clientX: number, clientY: number): { name: string; mesh: THREE.Mesh; point: THREE.Vector3 } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(this.meshes(), false).find((h) => (h.object as THREE.Mesh).visible);
    if (!hit) return null;
    const mesh = hit.object as THREE.Mesh;
    return { name: partName(mesh), mesh, point: hit.point };
  }

  mark(mesh: THREE.Mesh | null) {
    this.clearMark();
    if (!mesh) return;
    this.marker = new THREE.BoxHelper(mesh, 0xffa23a);
    this.scene.add(this.marker);
    this.dirty = true;
  }

  private clearMark() {
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker.geometry.dispose();
      this.marker = null;
      this.dirty = true;
    }
  }

  /** Double-click (or numpad .): the part under the pointer fills the view. */
  frame(mesh: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(mesh);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, this.radius / 200);
    const info = this.cameraInfo();
    this.place(info.azimuth, info.polar, this.fitDistance(r), c);
  }

  private onWheel = (e: WheelEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    /* Shift often turns a vertical wheel into a sideways one: take whichever moved. */
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    this.spin(Math.sign(d) * Math.min(30, Math.abs(d) / 4 + 2));
  };

  private onDouble = (e: MouseEvent) => {
    const hit = this.pick(e.clientX, e.clientY);
    if (hit) this.frame(hit.mesh);
  };

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** The view as a PNG data URL, with an overlay canvas (the markup) drawn over it. */
  snapshot(overlay?: HTMLCanvasElement | null): string {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const g = out.getContext("2d")!;
    g.drawImage(src, 0, 0);
    if (overlay && overlay.width) g.drawImage(overlay, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener("wheel", this.onWheel, { capture: true });
    this.renderer.domElement.removeEventListener("dblclick", this.onDouble);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** A part's name as Blender shows it: the object's name (a multi-material mesh splits into children named after it). */
export function partName(m: THREE.Object3D): string {
  let o: THREE.Object3D | null = m;
  while (o && (!o.name || /^(Mesh|Object|node)?_?\d*$/.test(o.name))) o = o.parent;
  return o?.name || "unnamed part";
}

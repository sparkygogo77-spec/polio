import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildBbModel, type BbModel } from "./bbmodel";

/**
 * The viewer itself: one renderer, one camera on orbit controls, Minecraft's
 * entity lighting (two soft lights from above, ambient 0.4), and the nine
 * views of J's concept sheets so a model can be compared with its sheet the
 * same way `tools/bbmodel_preview.py` does it in the mod repository.
 *
 * Kept out of React: the page owns one of these and calls it.
 */

/** (label, yaw round the model from the front, toward its left; elevation). */
export const VIEWS: [string, number, number][] = [
  ["Front", 0, 8], ["Back", 180, 8], ["Top", 0, 89],
  ["Left", 90, 8], ["Right", -90, 8], ["Bottom", 0, -89],
  ["Front left", 40, 14], ["Front right", -40, 14], ["Back right", -140, 14],
];

export const BACKGROUNDS = { dark: 0x15171a, grey: 0xc8c8c8, sky: 0x8eb6f0, night: 0x05060a } as const;
export type Background = keyof typeof BACKGROUNDS;

export interface ModelInfo {
  name: string;
  kind: "glb" | "bbmodel";
  triangles: number;
  /** Width, height, depth in blocks. */
  size: [number, number, number];
  cubes?: number;
  textures?: number;
}

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(25, 1, 0.01, 1000);
  readonly controls: OrbitControls;
  private model: THREE.Object3D | null = null;
  private centre = new THREE.Vector3();
  private radius = 1;
  private grid: THREE.GridHelper | null = null;
  private frame = 0;
  private resize: ResizeObserver;
  spin = false;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4 * Math.PI));
    const l0 = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI); l0.position.set(0.2, 1, -0.7);
    const l1 = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI); l1.position.set(-0.2, 1, 0.7);
    this.scene.add(l0, l1);
    this.setBackground("dark");
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    const tick = () => {
      this.frame = requestAnimationFrame(tick);
      if (this.spin && this.model) this.model.rotation.y += 0.01;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.clear();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private fit() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setBackground(b: Background) {
    this.scene.background = new THREE.Color(BACKGROUNDS[b]);
  }

  setGrid(on: boolean) {
    if (this.grid) { this.scene.remove(this.grid); this.grid.dispose(); this.grid = null; }
    if (!on || !this.model) return;
    const box = new THREE.Box3().setFromObject(this.model);
    const span = Math.max(2, Math.ceil(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)) + 2);
    // One line per block, so a model's size in blocks can be read off the floor.
    this.grid = new THREE.GridHelper(span, span, 0x5a8f5a, 0x444444);
    this.grid.position.set(0, box.min.y - 0.001, 0);
    this.scene.add(this.grid);
  }

  setWireframe(on: boolean) {
    this.model?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) (mat as THREE.MeshBasicMaterial).wireframe = on;
    });
  }

  private clear() {
    if (!this.model) return;
    this.scene.remove(this.model);
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.model = null;
  }

  /** Load a model from its bytes. `name` decides the format by its extension. */
  async load(name: string, data: ArrayBuffer): Promise<ModelInfo> {
    let object: THREE.Object3D;
    let extra: Partial<ModelInfo> = {};
    const kind = /\.bbmodel$/i.test(name) ? "bbmodel" : "glb";
    if (kind === "bbmodel") {
      const bb = JSON.parse(new TextDecoder().decode(data)) as BbModel;
      const built = await buildBbModel(bb);
      object = built.object;
      extra = { cubes: built.cubes, textures: built.textures };
    } else {
      const gltf = await new GLTFLoader().parseAsync(data, "");
      object = gltf.scene;
    }
    this.clear();
    // Stand the model on the floor, centred over the origin.
    const wrap = new THREE.Group();
    wrap.add(object);
    const box = new THREE.Box3().setFromObject(wrap);
    const c = box.getCenter(new THREE.Vector3());
    object.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    this.model = wrap;
    this.scene.add(wrap);
    const fitted = new THREE.Box3().setFromObject(wrap);
    const sphere = fitted.getBoundingSphere(new THREE.Sphere());
    this.centre.copy(sphere.center);
    this.radius = Math.max(0.05, sphere.radius);
    this.camera.near = this.radius / 100;
    this.camera.far = this.radius * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(this.centre);
    this.view("Front left");
    let triangles = 0;
    wrap.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (g) triangles += (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
    });
    const s = fitted.getSize(new THREE.Vector3());
    return { name, kind, triangles, size: [s.x, s.y, s.z], ...extra };
  }

  /** Put the camera at one of the sheet's views (or any yaw/elevation). */
  view(label: string, yawDeg?: number, pitchDeg?: number) {
    const v = VIEWS.find((x) => x[0].toLowerCase() === label.toLowerCase());
    const y = THREE.MathUtils.degToRad(yawDeg ?? v?.[1] ?? 0);
    const p = THREE.MathUtils.degToRad(pitchDeg ?? v?.[2] ?? 8);
    const dist = this.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.08;
    // At yaw 0 the camera stands north of the model (-Z) looking at its front.
    const dir = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    this.camera.up.set(0, 1, 0);
    if (Math.abs(p) > THREE.MathUtils.degToRad(80)) this.camera.up.set(0, 0, p > 0 ? 1 : -1);
    this.camera.position.copy(this.centre).addScaledVector(dir, dist);
    this.controls.target.copy(this.centre);
    this.camera.lookAt(this.centre);
    if (this.model) this.model.rotation.y = 0;
  }

  /** The nine views in a 3x3 sheet, as a PNG data URL. */
  sheet(cell = 360): string {
    const out = document.createElement("canvas");
    out.width = out.height = cell * 3;
    const g = out.getContext("2d")!;
    const was = { pos: this.camera.position.clone(), up: this.camera.up.clone(), spin: this.spin, aspect: this.camera.aspect };
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    this.spin = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(cell, cell, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    VIEWS.forEach(([label], i) => {
      this.view(label);
      this.renderer.render(this.scene, this.camera);
      g.drawImage(this.renderer.domElement, (i % 3) * cell, Math.floor(i / 3) * cell, cell, cell);
      g.font = "600 15px system-ui, sans-serif";
      g.fillStyle = "rgba(0,0,0,.55)";
      g.fillRect((i % 3) * cell + 6, Math.floor(i / 3) * cell + 6, g.measureText(label).width + 12, 22);
      g.fillStyle = "#fff";
      g.fillText(label, (i % 3) * cell + 12, Math.floor(i / 3) * cell + 22);
    });
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(size.x, size.y, false);
    this.camera.aspect = was.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(was.pos);
    this.camera.up.copy(was.up);
    this.camera.lookAt(this.centre);
    this.spin = was.spin;
    return out.toDataURL("image/png");
  }

  /** What is on screen now, as a PNG data URL. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }
}

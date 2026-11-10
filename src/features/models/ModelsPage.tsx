"use client";
/**
 * MODELS: a Blender-like 360° look at a 3D model, inside the Builder (`/models`).
 *
 * Until the console drives Blender itself (the bridge lane), this is where a
 * pass is looked at from every side and marked up for the modeller, the way
 * the Lantern review site's 3D view did. A model fills the stage: drag orbits,
 * the wheel zooms, Shift + wheel (or Turntable) turns it, double-click frames
 * a part, and Front / Right / Top / Back are Blender's numpad 1 / 3 / 7.
 * A file dropped or picked stays in this browser: nothing is uploaded.
 *
 * Mark up: Pick part names the mesh under the pointer; Draw, Arrow and Circle
 * draw on the screen over the view; "Copy for the modeller" copies the note,
 * the parts, the camera angle and the model's name, and downloads the view as
 * a PNG with the marks on it.
 */
import * as React from "react";
import { Box, Circle, Copy, Crosshair, Hand, Home, MoveUpRight, PenLine, RotateCw, Trash2, Undo2, Upload } from "lucide-react";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/lib/cn";
import type { CameraInfo, Look, ModelStage, ViewName } from "./viewer";

type Tool = "orbit" | "pick" | "pen" | "arrow" | "circle";
type Mark = { type: "pen" | "arrow" | "circle"; color: string; pts: [number, number][] };

/** Small samples served from `public/models` (the catalogue's dark lantern, 1.7 MB). */
export const SAMPLES = [{ id: "dark_lantern", label: "Dark lantern", url: "/models/dark_lantern.glb" }] as const;
const COLOURS = ["#ff3b6b", "#2fd67f", "#ffd23f", "#ffffff"];
const VIEWS: { id: ViewName; label: string; key: string }[] = [
  { id: "front", label: "Front", key: "1" },
  { id: "right", label: "Right", key: "3" },
  { id: "top", label: "Top", key: "7" },
  { id: "back", label: "Back", key: "Ctrl 1" },
  { id: "left", label: "Left", key: "Ctrl 3" },
  { id: "bottom", label: "Bottom", key: "Ctrl 7" },
];

export function angleLine(c: CameraInfo): string {
  return `orbit ${c.azimuth}° round, ${c.polar}° from the top, ${c.distance} away, looking at (${c.target.join(", ")})`;
}

/** The words that go to the modeller: what model, which parts, from where, and what should change. */
export function modellerText(o: { model: string; parts: string[]; camera: CameraInfo; marks: Mark[]; note: string; png: string }): string {
  const count = (t: Mark["type"]) => o.marks.filter((m) => m.type === t).length;
  const marks = [["drawing", count("pen")], ["arrow", count("arrow")], ["circle", count("circle")]]
    .filter(([, n]) => n)
    .map(([w, n]) => `${n} ${w}${n === 1 ? "" : "s"}`)
    .join(", ");
  return [
    `Model: ${o.model}`,
    `View: ${angleLine(o.camera)}`,
    `Parts: ${o.parts.length ? o.parts.join(", ") : "none picked"}`,
    `Marks: ${marks || "none"}${marks ? ` (on the picture ${o.png})` : ""}`,
    `Change: ${o.note.trim() || "(no note)"}`,
  ].join("\n");
}

export function ModelsPage() {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const inkRef = React.useRef<HTMLCanvasElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const stageRef = React.useRef<ModelStage | null>(null);
  const [ready, setReady] = React.useState(false);
  const [status, setStatus] = React.useState("Loading the 3D view…");
  const [model, setModel] = React.useState<{ name: string; meshes: number; parts: string[]; groups: { name: string; meshes: number }[] } | null>(null);
  const [framed, setFramed] = React.useState("");
  const [cam, setCam] = React.useState<CameraInfo | null>(null);
  const [turntable, setTurntable] = React.useState(false);
  const [look, setLookState] = React.useState<Look>("material");
  const [tool, setTool] = React.useState<Tool>("orbit");
  const [colour, setColour] = React.useState<string>(COLOURS[0]!);
  const [marks, setMarks] = React.useState<Mark[]>([]);
  const [parts, setParts] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [said, setSaid] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const drawing = React.useRef<Mark | null>(null);

  const open = React.useCallback(async (src: string | File[], name?: string) => {
    const st = stageRef.current;
    if (!st) return;
    setStatus(`Opening ${name ?? "the model"}…`);
    try {
      const got = await st.load(src, name);
      setModel({ name: st.name, ...got, groups: st.groups() });
      setFramed("");
      setParts([]);
      setMarks([]);
      setTurntable(false);
      setStatus("Drag to orbit · scroll to zoom · Shift + scroll to turn · double-click a part to frame it");
    } catch (e) {
      setStatus(`That model could not open: ${(e as Error).message}`);
    }
  }, []);

  /* The stage, three.js and all, loads with this page only. */
  React.useEffect(() => {
    let st: ModelStage | null = null;
    let gone = false;
    void import("./viewer").then(({ ModelStage }) => {
      if (gone || !hostRef.current) return;
      st = new ModelStage(hostRef.current);
      stageRef.current = st;
      let pending = 0;
      st.onChange = () => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
          pending = 0;
          if (stageRef.current) setCam(stageRef.current.cameraInfo());
        });
      };
      /* For the checks (tests/models-view.mjs): read and drive the stage. */
      (window as unknown as { __polioModels?: unknown }).__polioModels = {
        camera: () => st!.cameraInfo(),
        model: () => ({ name: st!.name, meshes: st!.meshes().length, parts: st!.parts(), groups: st!.groups() }),
        turntable: () => st!.turntable,
        open: (url: string, name?: string) => open(url, name),
      };
      setReady(true);
      void open(SAMPLES[0].url, `${SAMPLES[0].label} (sample)`);
    });
    return () => {
      gone = true;
      st?.dispose();
      stageRef.current = null;
      delete (window as unknown as { __polioModels?: unknown }).__polioModels;
    };
  }, [open]);

  React.useEffect(() => {
    const st = stageRef.current;
    if (st) st.turntable = turntable;
  }, [turntable]);

  /* The drawing sits on the screen, not on the model: while there are marks, the model holds still. */
  const locked = marks.length > 0;
  React.useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    st.controls.enabled = tool === "orbit" && !locked;
    if (locked) setTurntable(false);
  }, [tool, locked, ready]);

  /* Blender's keys: numpad 1 / 3 / 7 (Ctrl for the far side), Home to reset, numpad . to frame the picked part. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      const st = stageRef.current;
      if (!st) return;
      const k = e.code;
      const n = k === "Numpad1" || k === "Digit1" ? 1 : k === "Numpad3" || k === "Digit3" ? 3 : k === "Numpad7" || k === "Digit7" ? 7 : 0;
      if (n && !locked) {
        e.preventDefault();
        st.view(n === 1 ? (e.ctrlKey ? "back" : "front") : n === 3 ? (e.ctrlKey ? "left" : "right") : e.ctrlKey ? "bottom" : "top");
      } else if (k === "Home") {
        e.preventDefault();
        if (!locked) st.reset();
        setTurntable(false);
      } else if (k === "NumpadDecimal" && parts.length && !locked) {
        const m = st.meshes().find((x) => parts.includes(x.name) || parts.includes(x.parent?.name ?? ""));
        if (m) st.frame(m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, parts]);

  /* The ink canvas matches the stage's pixels and redraws whenever the marks change. */
  const redraw = React.useCallback(() => {
    const c = inkRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) {
      c.width = Math.round(r.width * d);
      c.height = Math.round(r.height * d);
    }
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    const all = drawing.current ? [...marks, drawing.current] : marks;
    for (const m of all) drawMark(g, m, c.width, c.height, d);
  }, [marks]);
  React.useEffect(() => {
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [redraw]);

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = inkRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const onInkDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stageRef.current;
    if (!st) return;
    e.preventDefault();
    if (tool === "pick") {
      const hit = st.pick(e.clientX, e.clientY);
      if (!hit) {
        setSaid("That spot misses the model.");
        return;
      }
      st.mark(hit.mesh);
      setParts((p) => (p.includes(hit.name) ? p : [...p, hit.name]));
      setSaid(`Picked ${hit.name}`);
      return;
    }
    if (tool === "orbit") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { type: tool, color: colour ?? COLOURS[0]!, pts: [pt(e)] };
  };
  const onInkMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = drawing.current;
    if (!m) return;
    if (m.type === "pen") m.pts.push(pt(e));
    else m.pts[1] = pt(e);
    redraw();
  };
  const onInkUp = () => {
    const m = drawing.current;
    drawing.current = null;
    if (m && m.pts.length > 1) setMarks((x) => [...x, m]);
    else redraw();
  };

  const copyForModeller = async () => {
    const st = stageRef.current;
    if (!st || !model) return;
    const base = model.name.replace(/\.(glb|gltf)$/i, "").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "model";
    const png = `${base}-markup.png`;
    const url = st.snapshot(inkRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = png;
    a.setAttribute("data-model-png", "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    const text = modellerText({ model: model.name, parts, camera: st.cameraInfo(), marks, note, png });
    (window as unknown as { __polioModelsLast?: unknown }).__polioModelsLast = { text, png, dataUrl: url.length };
    try {
      await navigator.clipboard.writeText(text);
      setSaid(`Copied the note and downloaded ${png}: paste the words and attach the picture for the modeller.`);
    } catch {
      setSaid(`Downloaded ${png}. The clipboard is closed to this page: the words are below to copy by hand.`);
    }
  };

  const onFiles = (files: FileList | File[] | null) => {
    const list = files ? [...files] : [];
    if (!list.length) return;
    if (!list.some((f) => /\.(glb|gltf)$/i.test(f.name))) {
      setStatus("Drop a .glb or .gltf file (with its .bin and pictures, for a .gltf).");
      return;
    }
    void open(list);
  };

  const st = stageRef.current;
  const toolKey = (id: Tool, label: string, Icon: typeof Hand) => (
    <Button key={id} size="sm" variant={tool === id ? "subtle" : "ghost"} aria-pressed={tool === id} data-model-tool={id} onClick={() => setTool(id)}>
      <Icon />
      {label}
    </Button>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[480px] flex-col gap-2 p-3" data-models-page="">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-semibold text-fg">Models</h1>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-model-open="">
          <Upload />
          Open a model
        </Button>
        <input ref={fileRef} type="file" accept=".glb,.gltf,.bin,image/*" multiple hidden data-model-file="" onChange={(e) => onFiles(e.target.files)} />
        {SAMPLES.map((s) => (
          <Button key={s.id} size="sm" variant="ghost" data-model-sample={s.id} onClick={() => void open(s.url, `${s.label} (sample)`)}>
            <Box />
            {s.label}
          </Button>
        ))}
        <span className="truncate text-xs text-fg-muted" data-model-name="">
          {model ? `${model.name} · ${model.meshes} meshes` : ""}
        </span>
        {/* A pass holds several takes on shelves: Frame puts one of them in the middle (Blender's collections, kept by the export). */}
        {model && model.groups.length > 1 && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-fg-muted">
            Frame
            <select
              className="h-7 max-w-64 rounded-md border border-border bg-elevated px-1.5 text-xs text-fg"
              value={framed}
              data-model-frame=""
              onChange={(e) => {
                setFramed(e.target.value);
                setTurntable(false);
                stageRef.current?.frameGroup(e.target.value);
              }}
            >
              <option value="">Everything</option>
              {model.groups.map((g) => (
                <option key={g.name} value={g.name}>{`${g.name} (${g.meshes})`}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div
          className={cn("relative min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-[#303030]", dragOver && "ring-2 ring-accent")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          data-model-stage=""
        >
          <div ref={hostRef} className="absolute inset-0" />
          <canvas
            ref={inkRef}
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: tool === "orbit" ? "none" : "auto", cursor: tool === "pick" ? "crosshair" : tool === "orbit" ? "default" : "cell" }}
            onPointerDown={onInkDown}
            onPointerMove={onInkMove}
            onPointerUp={onInkUp}
            onPointerCancel={onInkUp}
            data-model-ink=""
          />
          {/* Blender's view buttons, top right, and the angle readout bottom left. */}
          <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
            <div className="flex flex-wrap justify-end gap-1">
              {VIEWS.map((v) => (
                <Button key={v.id} size="xs" variant="default" title={`${v.label} (numpad ${v.key})`} disabled={!ready || locked} data-model-view={v.id} onClick={() => st?.view(v.id)}>
                  {v.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="xs" variant={turntable ? "subtle" : "default"} aria-pressed={turntable} disabled={!ready || locked} data-model-turntable="" title="Turn the model on its stand (or Shift + scroll)" onClick={() => setTurntable((t) => !t)}>
                <RotateCw />
                Turntable
              </Button>
              <Button size="xs" variant="default" disabled={!ready || locked} data-model-reset="" title="Reset view (Home)" onClick={() => { setTurntable(false); st?.reset(); }}>
                <Home />
                Reset view
              </Button>
              <Button
                size="xs"
                variant="default"
                data-model-look={look}
                title="Material: the model's own colours. Solid: Blender's flat grey, to judge the form."
                onClick={() => {
                  const next = look === "material" ? "solid" : "material";
                  setLookState(next);
                  st?.setLook(next);
                }}
              >
                {look === "material" ? "Material" : "Solid"}
              </Button>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-col gap-0.5 text-[11px] text-white/70">
            <span data-model-status="">{status}</span>
            {cam && <span data-model-angle="">{angleLine(cam)}</span>}
          </div>
          {dragOver && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40 text-sm text-white">Drop to open: it stays in this browser</div>}
        </div>

        <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border border-border p-3" aria-label="Mark up for the modeller" data-model-markup="">
          <h2 className="text-sm font-semibold text-fg">Mark up for the modeller</h2>
          <div className="flex flex-wrap gap-1">
            {toolKey("orbit", "Move model", Hand)}
            {toolKey("pick", "Pick part", Crosshair)}
            {toolKey("pen", "Draw", PenLine)}
            {toolKey("arrow", "Arrow", MoveUpRight)}
            {toolKey("circle", "Circle", Circle)}
          </div>
          <div className="flex items-center gap-1">
            {COLOURS.map((c, i) => (
              <button key={c} type="button" aria-label={`Colour ${i + 1}`} aria-pressed={colour === c} className={cn("size-5 rounded-full border border-black/30", colour === c && "ring-2 ring-accent ring-offset-1")} style={{ background: c }} onClick={() => setColour(c)} />
            ))}
            <span className="flex-1" />
            <Button size="iconXs" variant="ghost" aria-label="Undo the last mark" disabled={!marks.length} onClick={() => setMarks((m) => m.slice(0, -1))}>
              <Undo2 />
            </Button>
            <Button size="iconXs" variant="ghost" aria-label="Clear the marks and parts" data-model-clear="" disabled={!marks.length && !parts.length} onClick={() => { setMarks([]); setParts([]); stageRef.current?.mark(null); }}>
              <Trash2 />
            </Button>
          </div>
          {locked && tool === "orbit" && <p className="text-xs text-fg-muted">The marks are drawn on the screen: clear them to move the model.</p>}
          <div className="flex flex-wrap gap-1" data-model-parts="">
            {parts.length ? parts.map((p) => (
              <span key={p} className="rounded bg-elevated px-1.5 py-0.5 text-xs text-fg">{p}</span>
            )) : <span className="text-xs text-fg-muted">Pick part, then click the model to name a mesh.</span>}
          </div>
          <textarea
            className="min-h-24 rounded-md border border-border bg-transparent p-2 text-sm text-fg"
            placeholder="What should change? e.g. make the nose longer, arrow: move the fins back"
            aria-label="Note for the modeller"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-model-note=""
          />
          <Button size="sm" variant="primary" disabled={!model} onClick={() => void copyForModeller()} data-model-copy="">
            <Copy />
            Copy for the modeller
          </Button>
          {said && <p className="text-xs text-fg-muted" data-model-said="">{said}</p>}
          {model && cam && (
            <pre className="whitespace-pre-wrap rounded bg-elevated p-2 text-[11px] text-fg-muted" data-model-text="">
              {modellerText({ model: model.name, parts, camera: cam, marks, note, png: "(downloaded with Copy)" })}
            </pre>
          )}
        </aside>
      </div>
    </div>
  );
}

function drawMark(g: CanvasRenderingContext2D, m: Mark, w: number, h: number, d: number) {
  const P = m.pts.map(([x, y]) => [x * w, y * h] as const);
  g.strokeStyle = m.color;
  g.fillStyle = m.color;
  g.lineWidth = 3 * d;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  if (m.type === "pen") {
    P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  } else if (m.type === "arrow" && P[1]) {
    const [x0, y0] = P[0]!;
    const [x1, y1] = P[1];
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const s = 14 * d;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x1 - s * Math.cos(a - 0.45), y1 - s * Math.sin(a - 0.45));
    g.lineTo(x1 - s * Math.cos(a + 0.45), y1 - s * Math.sin(a + 0.45));
    g.closePath();
    g.fill();
  } else if (m.type === "circle" && P[1]) {
    const [x0, y0] = P[0]!;
    const [x1, y1] = P[1];
    g.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

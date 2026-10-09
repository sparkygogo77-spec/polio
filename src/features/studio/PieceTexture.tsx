"use client";
/**
 * A TEXTURE, GIVEN FROM THE PREVIEW.
 *
 * HIS WORDS: "this menu is obsolete almost because its having me select which
 * fields or panels or background the texture should apply to when thats what
 * the preview is for ... this should all be managed via the preview instead
 * of the layers system below it". So the piece pressed in the Colours preview
 * (the page, a kind of panel, a kind of field) carries its own texture here:
 * the kinds painted on its own fill, then its colour (the same picker as
 * every other colour in the editor, not three bars) and how solid, how big,
 * which way and how fast.
 *
 * The page's texture is a layer behind the page, worn too by the parts as
 * wide as the page that paint its colour (on a site brought in, that is the
 * page you see). A kind's texture is one layer every part of the kind wears
 * (`node.texture`), so all of them change together. Picking, changing and
 * taking one off are each one undo.
 */
import * as React from "react";
import { TEXTURE_KINDS, parseColor, pickedLayer, spotsOfTarget, textureCss, toHex, type Palette, type TextureKind, type TextureLayer } from "./look";
import { useHeldStudio, useStudio } from "./board/store";
import { HandColour, Slider } from "./HandSlider";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";

const KINDS: TextureKind[] = ["flat", "noise", "stripes", "dots", "grid", "mesh"];

/** The layer the page wears: the first one on, behind the page. */
export function pageLayer(layers: readonly TextureLayer[]): TextureLayer | null {
  return layers.find((l) => l.on && spotsOfTarget(l.target).includes("page")) ?? null;
}

/** The layer most of these parts wear, if any. */
export function wornBy(ids: readonly string[], nodes: readonly { id: string; texture?: string | null }[], layers: readonly TextureLayer[]): TextureLayer | null {
  const want = new Set(ids);
  const count = new Map<string, number>();
  for (const n of nodes) if (want.has(n.id) && n.texture && n.texture !== "none") count.set(n.texture, (count.get(n.texture) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return (top && layers.find((l) => l.id === top)) || null;
}

export function PieceTexture({ ids, page, ground, palette }: { ids: string[]; page: boolean; ground: string; palette: Palette }) {
  const layers = useHeldStudio((s) => s.look.texture);
  const nodes = useHeldStudio((s) => s.nodes);
  const layer = page ? pageLayer(layers) : wornBy(ids, nodes, layers);

  /** One undo for whatever a press does. */
  const step = (fn: () => void) => { const st = useStudio.getState(); const mark = st.historyMark(); fn(); useStudio.getState().oneStepSince(mark); };
  const pick = (kind: TextureKind) => {
    play("select");
    step(() => {
      const st = useStudio.getState();
      if (layer) {
        if (layer.kind !== kind) st.updateTexture(layer.id, { kind, baked: undefined });
        return;
      }
      /* Off the site-wide stack unless it is the page's: a kind's layer is worn by its parts and lands nowhere else. */
      const l: TextureLayer = { ...pickedLayer(kind, ground, palette), on: page, target: page ? "page" : "surfaces" };
      st.addTexture(l);
      if (ids.length) useStudio.getState().patchNodes(ids, () => ({ texture: l.id }));
    });
  };
  const none = () => {
    if (!layer) return;
    play("close");
    step(() => {
      const st = useStudio.getState();
      const wearing = st.nodes.filter((n) => n.texture === layer.id).map((n) => n.id);
      const mine = new Set(ids);
      if (wearing.length) useStudio.getState().patchNodes(wearing.filter((id) => mine.has(id)), () => ({ texture: null }));
      /* Gone from the stack once nothing wears it and it lands nowhere of its own. */
      const still = useStudio.getState().nodes.some((n) => n.texture === layer.id);
      if (page || !still) useStudio.getState().removeTexture(layer.id);
    });
  };
  const set = (patch: Partial<TextureLayer>) => { if (layer) useStudio.getState().updateTexture(layer.id, patch); };
  const colour = layer ? layer.colour ?? palette[layer.role] : "";

  return (
    <div data-kind-texture="" className="space-y-1.5">
      <p className="text-fine text-fg-faint">Texture</p>
      <div className="grid grid-cols-4 gap-1">
        <button type="button" data-texture-sample="none" aria-pressed={!layer} onClick={none}
          className={cn("tactile flex flex-col overflow-hidden rounded-md border-2 text-left", !layer ? "border-accent" : "border-border hover:border-border-strong")}>
          <span aria-hidden className="block h-9 w-full" style={{ background: ground }} />
          <span className="block truncate bg-elevated px-1 py-0.5 text-fine font-medium text-fg">None</span>
        </button>
        {KINDS.map((k) => {
          const on = layer?.kind === k;
          const sample = on && layer ? { ...layer, on: true } : pickedLayer(k, ground, palette);
          const label = TEXTURE_KINDS.find((x) => x.id === k)?.label ?? k;
          return (
            <button key={k} type="button" data-texture-sample={k} aria-pressed={on} aria-label={label} title={TEXTURE_KINDS.find((x) => x.id === k)?.hint} onClick={() => pick(k)}
              className={cn("tactile flex flex-col overflow-hidden rounded-md border-2 text-left", on ? "border-accent" : "border-border hover:border-border-strong")}>
              <span aria-hidden className="block h-9 w-full" style={textureCss([sample], palette, ground)} />
              <span className="block truncate bg-elevated px-1 py-0.5 text-fine font-medium text-fg">{label}</span>
            </button>
          );
        })}
      </div>
      {layer ? (
        <div data-texture-dials="" className="space-y-1.5">
          <div data-kind-colour="texture" className="flex items-center gap-2 text-small text-fg">
            <HandColour aria-label="Texture colour" value={toHex(parseColor(colour) ?? { l: 0.5, c: 0, h: 0 }).slice(0, 7)}
              onPick={(to) => set({ colour: to })}
              className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent" />
            <span className="min-w-0 flex-1">Texture colour</span>
          </div>
          <Dial label="How solid" value={Math.round(layer.opacity * 100)} min={0} max={100} unit="%" onTo={(v) => set({ opacity: v / 100 })} />
          <Dial label="Scale" value={layer.scale} min={2} max={400} unit="px" onTo={(v) => set({ scale: v })} />
          <Dial label="Angle" value={layer.angle} min={0} max={360} unit="°" onTo={(v) => set({ angle: v })} />
          <Dial label="Drift" value={Math.round((layer.drift ?? 0) * 100)} min={0} max={100} unit="%" still onTo={(v) => set({ drift: v / 100 })} />
        </div>
      ) : null}
    </div>
  );
}

function Dial({ label, value, min, max, unit, still, onTo }: { label: string; value: number; min: number; max: number; unit: string; still?: boolean; onTo: (v: number) => void }) {
  return (
    <label className="block space-y-0.5 text-small text-fg">
      <span className="flex justify-between"><span>{label}</span><span className="num text-fg-faint">{still && value < 2 ? "still" : `${value}${unit}`}</span></span>
      <Slider value={[value]} min={min} max={max} step={1} silent aria-label={label} onValueChange={(v) => onTo(v[0] ?? value)} />
    </label>
  );
}

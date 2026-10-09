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
import { TEXTURE_KINDS, dialsOf, parseColor, pickedLayer, spotsOfTarget, textureCss, toHex, type Palette, type TextureKind, type TextureLayer } from "./look";
import { dropSiteDots, siteDotsOf, writeSiteDots, type Art, type SiteDots } from "./look/lookparts/siteDots";
import { useHeldStudio, useStudio } from "./board/store";
import { HandColour, Slider } from "./HandSlider";
import { ImageWell } from "./ImageIntake";
import { CropPicker } from "./CropPicker";
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

/**
 * The dots a site's own CSS draws on its page parts (`siteDots.ts`): the
 * parts that carry them, and the pattern as the first of them has it.
 */
export function siteDotsOn(ids: readonly string[], nodes: readonly { id: string; art?: unknown }[]): { ids: string[]; dots: SiteDots } | null {
  const want = new Set(ids);
  let dots: SiteDots | null = null;
  const on: string[] = [];
  for (const n of nodes) {
    if (!want.has(n.id)) continue;
    const d = siteDotsOf(n.art as Art | null | undefined);
    if (!d) continue;
    dots ??= d;
    on.push(n.id);
  }
  return dots ? { ids: on, dots } : null;
}

/** The site's dots as a layer the row can show and sample. Never stored: the gradient on the parts is the truth. */
const SITE_DOTS_ID = "site-dots";
function siteDotsLayer(d: SiteDots): TextureLayer {
  /* The dot's radius against the tile, as `textureCss` draws dots: r = s × (0.05 + contrast × 0.1); the site's stop is a share of the corner distance (s/√2). */
  const r = (d.stop / 100) * (d.scale / Math.SQRT2);
  const contrast = Math.max(0, Math.min(1, (r / d.scale - 0.05) / 0.1));
  return { id: SITE_DOTS_ID, kind: "dots", role: "text", colour: d.colour, scale: d.scale, angle: 0, opacity: d.opacity, contrast, blend: "normal", target: "page", on: true };
}

export function PieceTexture({ ids, page, ground, palette }: { ids: string[]; page: boolean; ground: string; palette: Palette }) {
  const layers = useHeldStudio((s) => s.look.texture);
  const nodes = useHeldStudio((s) => s.nodes);
  /* The page's texture: a layer given here, else the dots the site's own code draws on it. */
  const site = page ? siteDotsOn(ids, nodes) : null;
  const own = page ? pageLayer(layers) : wornBy(ids, nodes, layers);
  const siteOnly = !own && !!site;
  const layer = own ?? (site ? siteDotsLayer(site.dots) : null);

  /** One undo for whatever a press does. */
  const step = (fn: () => void) => { const st = useStudio.getState(); const mark = st.historyMark(); fn(); useStudio.getState().oneStepSince(mark); };
  /** Take the site's own dots off its parts (`none` is what goes back to the site). */
  const dropSite = () => {
    const now = page ? siteDotsOn(ids, useStudio.getState().nodes) : null;
    if (now) useStudio.getState().patchNodes(now.ids, (n) => { const d = siteDotsOf(n.art as Art | null | undefined); return d ? { art: dropSiteDots(n.art as Art, d) } as never : {}; });
  };
  /* A dial dragged on the site's dots: one undo for the drag, as a layer's dials are (`updateTexture`'s runs). */
  const run = React.useRef<{ key: string; at: number } | null>(null);
  const setSite = (to: Partial<Pick<SiteDots, "colour" | "opacity" | "scale">>) => {
    if (!site) return;
    const key = Object.keys(to).sort().join(",");
    const now = Date.now();
    const quiet = run.current?.key === key && now - run.current.at < 700;
    run.current = { key, at: now };
    const want = new Set(site.ids);
    const patch = (n: (typeof nodes)[number]) => { const d = siteDotsOf(n.art as Art | null | undefined); return d ? { ...n, art: writeSiteDots(n.art as Art, d, to) } as typeof n : n; };
    if (quiet) useStudio.setState((s) => ({ nodes: s.nodes.map((n) => (want.has(n.id) ? patch(n) : n)) }));
    else useStudio.getState().patchNodes(site.ids, (n) => patch(n));
  };
  const pick = (kind: TextureKind) => {
    play("select");
    if (siteOnly && kind === "dots") return;
    step(() => {
      /* Another kind for the page: the site's dots give way to it, so there is one texture, not two. */
      dropSite();
      const st = useStudio.getState();
      if (own) {
        /* The new kind's own shape and turn: a stripe's line width read as a flat colour's fade turned the page into a gradient. */
        if (own.kind !== kind) { const fresh = pickedLayer(kind, ground, palette); st.updateTexture(own.id, { kind, baked: undefined, contrast: fresh.contrast, angle: fresh.angle, ...(dialsOf(kind).drift ? null : { drift: 0 }) }); }
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
      dropSite();
      if (!own) return;
      const layer = own;
      const st = useStudio.getState();
      const wearing = st.nodes.filter((n) => n.texture === layer.id).map((n) => n.id);
      const mine = new Set(ids);
      if (wearing.length) useStudio.getState().patchNodes(wearing.filter((id) => mine.has(id)), () => ({ texture: null }));
      /* Gone from the stack once nothing wears it and it lands nowhere of its own. */
      const still = useStudio.getState().nodes.some((n) => n.texture === layer.id);
      if (page || !still) useStudio.getState().removeTexture(layer.id);
    });
  };
  const set = (patch: Partial<TextureLayer>) => {
    if (siteOnly) { setSite({ ...(patch.colour ? { colour: patch.colour } : {}), ...(patch.opacity != null ? { opacity: patch.opacity } : {}), ...(patch.scale != null ? { scale: patch.scale } : {}) }); return; }
    if (own) useStudio.getState().updateTexture(own.id, patch);
  };
  const colour = layer ? layer.colour ?? palette[layer.role] : "";

  return (
    <div data-kind-texture="" data-texture-site={siteOnly ? "" : undefined} className="space-y-1.5">
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
        {/* A picture of his own, tiled: what the folded-away layer stack used to be the only place for (J, 2026-10-09: "that tech should be shoved into the texture ... field"). */}
        <button type="button" data-texture-sample="image" aria-pressed={layer?.kind === "image"} aria-label="Picture" title="A picture you drop in, tiled and tinted" onClick={() => pick("image")}
          className={cn("tactile flex flex-col overflow-hidden rounded-md border-2 text-left", layer?.kind === "image" ? "border-accent" : "border-border hover:border-border-strong")}>
          <span aria-hidden className="block h-9 w-full" style={layer?.kind === "image" && layer.src ? textureCss([{ ...layer, on: true }], palette, ground) : { background: ground }} />
          <span className="block truncate bg-elevated px-1 py-0.5 text-fine font-medium text-fg">Picture</span>
        </button>
      </div>
      {layer?.kind === "image" && own ? (
        <div data-texture-picture="" className="space-y-1.5">
          <ImageWell src={own.src} onImage={(src) => set({ src, baked: undefined, crop: undefined })} onClear={own.src ? () => set({ src: undefined, baked: undefined, crop: undefined }) : undefined} label="picture" />
          {own.src ? <CropPicker src={own.src} crop={own.crop} onChange={(crop) => set({ crop })} /> : null}
          <Check label="Paint it in the texture colour" checked={!!own.pattern} onChange={(v) => set({ pattern: v })} />
          <Check label="Cut out its background" checked={!!own.cutout} onChange={(v) => set({ cutout: v })} />
        </div>
      ) : null}
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
          {/* The site's own dots are its CSS: a colour, how solid and a tile size are all it says. */}
          {siteOnly ? <p className="text-fine text-fg-faint">The site&apos;s own dots, from its code.</p> : (() => {
            /* Only the dials that change this kind (`dialsOf`): Angle where it turns it, Drift where it can travel, and the kind's own shape. */
            const d = dialsOf(layer.kind);
            const angle = d.angle === "whenShaped" ? layer.contrast >= 0.02 : d.angle;
            return (
              <>
                {d.shape ? <Dial label={d.shape} hook="shape" value={Math.round(layer.contrast * 100)} min={0} max={100} unit="%" onTo={(v) => set({ contrast: v / 100 })} /> : null}
                {angle ? <Dial label="Angle" hook="angle" value={layer.angle} min={0} max={360} unit="°" onTo={(v) => set({ angle: v })} /> : null}
                {d.drift ? <Dial label="Drift" hook="drift" value={Math.round((layer.drift ?? 0) * 100)} min={0} max={100} unit="%" still onTo={(v) => set({ drift: v / 100 })} /> : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-small text-fg">
      <input type="checkbox" checked={checked} onChange={(e) => { play("select"); onChange(e.target.checked); }} style={{ accentColor: "var(--accent)" }} />
      <span>{label}</span>
    </label>
  );
}

function Dial({ label, hook, value, min, max, unit, still, onTo }: { label: string; hook?: string; value: number; min: number; max: number; unit: string; still?: boolean; onTo: (v: number) => void }) {
  return (
    <label data-texture-dial={hook} className="block space-y-0.5 text-small text-fg">
      <span className="flex justify-between"><span>{label}</span><span className="num text-fg-faint">{still && value < 2 ? "still" : `${value}${unit}`}</span></span>
      <Slider value={[value]} min={min} max={max} step={1} silent aria-label={label} onValueChange={(v) => onTo(v[0] ?? value)} />
    </label>
  );
}

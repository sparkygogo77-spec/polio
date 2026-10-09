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
import { Segmented } from "@/core/ui/segmented";
import { BACKGROUND_MOTIONS, LIVE_PRESETS, MAX_SECONDS, MIN_SECONDS, isLiving, liveLayers, newLiving, switchPreset, type LivePreset, type LivingPicture } from "./living";
import { cutLayers } from "./livingCut";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";

/* No Flat colour: the Background colour above it already is one (J, 2026-10-09). */
const KINDS: TextureKind[] = ["noise", "stripes", "dots", "grid", "mesh"];
/** How many layers a picture is cut into when it first comes alive. */
const FIRST_CUT = 3;

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

/** A part's own background, as the site's code painted it when it was brought in (`source.was`): its "Original" texture. */
type Painted = { id: string; art?: unknown; source?: unknown };
export function originalOf(n: Painted): Art | null {
  const was = (n.source as { was?: { art?: Record<string, string> } } | null | undefined)?.was?.art;
  const img = was?.["background-image"]?.trim();
  if (!img || img === "none") return null;
  return { background: img, backgroundOptions: [was!["background-size"] ?? "auto", was!["background-position"] ?? "0% 0%", was!["background-repeat"] ?? "repeat"] };
}

/** The pattern a part paints itself now (its own gradient, a site's dots), as CSS over `ground`; null when it paints none. */
export function paintedCss(art: Art | null | undefined, ground: string): React.CSSProperties | null {
  const img = art?.background?.trim();
  if (!img || img === "none") return null;
  const o = art!.backgroundOptions ?? [];
  return { backgroundColor: ground, backgroundImage: img, ...(o[0] ? { backgroundSize: o[0] } : {}), ...(o[1] ? { backgroundPosition: o[1] } : {}), ...(o[2] ? { backgroundRepeat: o[2] } : {}) };
}

/**
 * THE PAGE AS THE PREVIEW DRAWS IT: the texture the page has, whichever it
 * is (J, 2026-10-09: PST's own dots were on the board and the site, never in
 * the preview, nor were the builder's Dots). A texture given here, else the
 * pattern the page's own parts paint, else its plain colour.
 */
export function pageGround(ids: readonly string[], nodes: readonly Painted[], layers: readonly TextureLayer[], palette: Palette, fill: string): React.CSSProperties {
  const own = pageLayer(layers);
  if (own) return textureCss([own], palette, fill);
  const want = new Set(ids);
  for (const n of nodes) if (want.has(n.id)) { const css = paintedCss(n.art as Art | null | undefined, fill); if (css) return css; }
  return { background: fill };
}

/** A kind of panel or field as the preview draws it: the texture its parts wear over its paint, or nothing to add. */
export function kindGround(ids: readonly string[], nodes: readonly { id: string; texture?: string | null }[], layers: readonly TextureLayer[], palette: Palette, fill: string): React.CSSProperties | null {
  const l = wornBy(ids, nodes, layers);
  return l ? textureCss([{ ...l, on: true }], palette, fill) : null;
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
  /* "Original": the texture the site's own code painted (J, 2026-10-09: PST's dots are not the builder's Dots).
     Shown first when the page was brought in with one; on while the page's parts still paint it. */
  const originals = page ? nodes.filter((n) => ids.includes(n.id) && originalOf(n)) : [];
  const painted = page ? nodes.find((n) => ids.includes(n.id) && paintedCss(n.art as Art | null | undefined, ground)) : undefined;
  const originalOn = !own && !!painted;
  const originalSample = (originals[0] && paintedCss(originalOf(originals[0]), ground)) || (painted && paintedCss(painted.art as Art, ground)) || null;

  /** One undo for whatever a press does. */
  const step = (fn: () => void) => { const st = useStudio.getState(); const mark = st.historyMark(); fn(); useStudio.getState().oneStepSince(mark); };
  /** Take the site's own dots off its parts (`none` is what goes back to the site). */
  const dropSite = () => {
    const now = page ? siteDotsOn(ids, useStudio.getState().nodes) : null;
    if (now) useStudio.getState().patchNodes(now.ids, (n) => { const d = siteDotsOf(n.art as Art | null | undefined); return d ? { art: dropSiteDots(n.art as Art, d) } as never : {}; });
    /* Any other pattern the site's code painted on the page (not dots): off too, so there is one texture. "Original" brings it back. */
    if (page) {
      const rest = useStudio.getState().nodes.filter((n) => ids.includes(n.id) && originalOf(n) && !siteDotsOf(n.art as Art | null | undefined) && paintedCss(n.art as Art | null | undefined, "transparent"));
      if (rest.length) useStudio.getState().patchNodes(rest.map((n) => n.id), (n) => ({ art: { ...(n.art as Art), background: "none", backgroundOptions: undefined } }) as never);
    }
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
    if (own?.kind === kind && kind !== "image") return;
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
  /** The site's own texture back, as its code painted it: whatever was given here goes. One undo. */
  const original = () => {
    play("select");
    if (originalOn && !own) return;
    step(() => {
      if (own) {
        const st = useStudio.getState();
        const wearing = st.nodes.filter((n) => n.texture === own.id).map((n) => n.id);
        if (wearing.length) st.patchNodes(wearing, () => ({ texture: null }));
        useStudio.getState().removeTexture(own.id);
      }
      const back = originals.map((n) => n.id);
      if (back.length) useStudio.getState().patchNodes(back, (n) => { const o = originalOf(n); return o ? { art: { ...((n.art as Art | null) ?? {}), ...o } } as never : {}; });
    });
  };
  const none = () => {
    if (!layer && !originalOn) return;
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

  /*
   * A LIVING PICTURE (J, 2026-10-09: "i uploaded still images and a code chat
   * dissected the lines of it and animated it in different directions or
   * motions which is what i want that option to be for"). The picture is cut
   * into layers by brightness (`livingCut.ts`) and its layers move on the
   * living picture's fixed keyframes (`living.ts`): on the board, in the
   * preview, and on the site through Send the design back.
   */
  const live = own && isLiving(own.live) ? own.live : null;
  const [cutting, setCutting] = React.useState(false);
  const [cutError, setCutError] = React.useState<string | null>(null);
  /* While its controls are open, the board lets it move (globals.css), so a motion picked is seen. */
  const alive = !!live;
  React.useEffect(() => {
    if (!alive) return;
    const root = document.documentElement;
    root.setAttribute("data-live-texture-open", "");
    return () => root.removeAttribute("data-live-texture-open");
  }, [alive]);
  /** Cut `src` into `count` layers; null when it could not be. */
  const cutFrom = async (src: string, count: number): Promise<string[] | null> => {
    setCutting(true);
    try { const got = await cutLayers(src, count, { type: "image/webp" }); setCutError(null); return got; }
    catch (e) { setCutError(e instanceof Error ? e.message : String(e)); return null; }
    finally { setCutting(false); }
  };
  /** A picture dropped in: kept, and alive in the motion it had (drift, the first time), in one undo. */
  const dropPicture = async (src: string) => {
    if (!own) return;
    const id = own.id, motion = live ?? (own.src ? null : { ...newLiving("drift"), angle: 0 });
    const layers = motion ? await cutFrom(src, liveLayers(motion).length || FIRST_CUT) : null;
    step(() => useStudio.getState().updateTexture(id, { src, baked: undefined, crop: undefined, ...(motion && layers ? { live: { ...motion, layers } } : {}) }));
  };
  /** A motion picked: Still takes the life away, the rest keep its cut and way. */
  const pickMotion = async (to: LivePreset | "still") => {
    if (!own) return;
    play("select");
    const id = own.id;
    if (to === "still") { if (live) step(() => useStudio.getState().updateTexture(id, { live: undefined })); return; }
    if (live) { if (live.preset !== to) step(() => useStudio.getState().updateTexture(id, { live: { ...switchPreset(live, to), angle: live.angle } })); return; }
    if (!own.src) return;
    const layers = await cutFrom(own.src, FIRST_CUT);
    if (layers) step(() => useStudio.getState().updateTexture(id, { live: { ...newLiving(to), angle: 0, layers } }));
  };
  /** Cut again into another number of layers: one undo. */
  const recut = async (count: number) => {
    if (!own?.src || !live || count === liveLayers(live).length) return;
    const id = own.id;
    const layers = await cutFrom(own.src, count);
    if (layers) step(() => useStudio.getState().updateTexture(id, { live: { ...(useStudio.getState().look.texture.find((l) => l.id === id)?.live ?? live), layers } }));
  };
  /** A dial on the motion: each drag of one dial is one undo (`updateTexture`). */
  const setLive = (patch: Partial<LivingPicture>) => { if (own && live) useStudio.getState().updateTexture(own.id, { live: { ...live, ...patch } }); };

  return (
    <div data-kind-texture="" data-texture-site={siteOnly ? "" : undefined} className="space-y-1.5">
      <p className="text-fine text-fg-faint">Texture</p>
      <div className="grid grid-cols-4 gap-1">
        <button type="button" data-texture-sample="none" aria-pressed={!layer} onClick={none}
          className={cn("tactile flex flex-col overflow-hidden rounded-md border-2 text-left", !layer && !originalOn ? "border-accent" : "border-border hover:border-border-strong")}>
          <span aria-hidden className="block h-9 w-full" style={{ background: ground }} />
          <span className="block truncate bg-elevated px-1 py-0.5 text-fine font-medium text-fg">None</span>
        </button>
        {originalSample ? (
          <button type="button" data-texture-sample="original" aria-pressed={originalOn} aria-label="Original" title="The site's own texture, as its code made it" onClick={original}
            className={cn("tactile flex flex-col overflow-hidden rounded-md border-2 text-left", originalOn ? "border-accent" : "border-border hover:border-border-strong")}>
            <span aria-hidden className="block h-9 w-full" style={originalOn && painted ? paintedCss(painted.art as Art, ground)! : originalSample} />
            <span className="block truncate bg-elevated px-1 py-0.5 text-fine font-medium text-fg">Original</span>
          </button>
        ) : null}
        {KINDS.map((k) => {
          const on = !!own && own.kind === k;
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
        <button type="button" data-texture-sample="image" aria-pressed={own?.kind === "image"} aria-label="Picture" title="A picture you drop in: alive (cut into layers that move) or still" onClick={() => pick("image")}
          className={cn("tactile flex flex-col overflow-hidden rounded-md border-2 text-left", layer?.kind === "image" ? "border-accent" : "border-border hover:border-border-strong")}>
          <span aria-hidden className="block h-9 w-full" style={layer?.kind === "image" && layer.src ? textureCss([{ ...layer, on: true }], palette, ground) : { background: ground }} />
          <span className="block truncate bg-elevated px-1 py-0.5 text-fine font-medium text-fg">Picture</span>
        </button>
      </div>
      {layer?.kind === "image" && own ? (
        <div data-texture-picture="" className="space-y-1.5">
          <ImageWell src={own.src} onImage={(src) => void dropPicture(src)} onClear={own.src ? () => step(() => useStudio.getState().updateTexture(own.id, { src: undefined, baked: undefined, crop: undefined, live: undefined })) : undefined} label="picture" />
          {own.src ? (
            <div data-texture-motions="" className="space-y-1">
              <span className="block text-fine text-fg-faint">How it moves</span>
              <div className="flex flex-wrap gap-1">
                {(["still", ...BACKGROUND_MOTIONS] as const).map((m) => {
                  const on = m === "still" ? !live : live?.preset === m;
                  const about = m === "still" ? "A still picture, tiled" : LIVE_PRESETS.find((p) => p.id === m)?.about;
                  const label = m === "still" ? "Still" : LIVE_PRESETS.find((p) => p.id === m)?.label ?? m;
                  return (
                    <button key={m} type="button" data-texture-motion={m} aria-pressed={on} title={about} disabled={cutting} onClick={() => void pickMotion(m)}
                      className={cn("tactile rounded-md border-2 px-2 py-0.5 text-small font-medium text-fg", on ? "border-accent" : "border-border hover:border-border-strong")}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {live ? (
            <div data-texture-live={live.preset} className="space-y-1.5">
              {live.preset !== "pulse" ? <Dial label="Direction" value={Math.round((((live.angle ?? 0) % 360) + 360) % 360)} min={0} max={359} unit="°" onTo={(v) => setLive({ angle: v })} /> : null}
              {/* Faster to the right: the slider runs over seconds backwards. */}
              <label className="block space-y-0.5 text-small text-fg">
                <span className="flex justify-between"><span>Speed</span><span className="num text-fg-faint">{live.seconds}s a round</span></span>
                <Slider value={[MAX_SECONDS + MIN_SECONDS - live.seconds]} min={MIN_SECONDS} max={MAX_SECONDS} step={0.5} silent aria-label="Speed"
                  onValueChange={(v) => setLive({ seconds: Math.round((MAX_SECONDS + MIN_SECONDS - (v[0] ?? 8)) * 10) / 10 })} />
              </label>
              <Dial label="Strength" value={Math.round(live.amount * 100)} min={10} max={100} unit="%" onTo={(v) => setLive({ amount: v / 100 })} />
              <div data-texture-layers={liveLayers(live).length} className="space-y-1">
                <span className="block text-fine text-fg-faint">Layers: its bright parts lift off and move in front</span>
                <Segmented size="xs" value={String(liveLayers(live).length)} onChange={(v) => void recut(Number(v))}
                  options={["2", "3", "4"].map((v) => ({ value: v, label: v, disabled: cutting }))} />
                <div className="flex gap-1">{liveLayers(live).map((src, i) => <img key={i} src={src} alt={`Layer ${i + 1}${i === 0 ? ", the front" : ""}`} className="size-9 rounded-sm border border-border bg-black/40 object-cover" />)}</div>
              </div>
            </div>
          ) : own.src ? (
            <>
              <CropPicker src={own.src} crop={own.crop} onChange={(crop) => set({ crop })} />
              <Check label="Paint it in the texture colour" checked={!!own.pattern} onChange={(v) => set({ pattern: v })} />
              <Check label="Cut out its background" checked={!!own.cutout} onChange={(v) => set({ cutout: v })} />
            </>
          ) : null}
          {cutting ? <p className="text-fine text-fg-faint">Cutting it into layers…</p> : null}
          {cutError ? <p className="text-fine text-danger">{cutError}</p> : null}
        </div>
      ) : null}
      {layer && !live ? (
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

"use client";
/**
 * Living picture: pick how a part moves by name, no prompt (`living.ts`).
 * A picture can be cut into layers first, so its bright parts drift over
 * the rest (`livingCut.ts`).
 */
import * as React from "react";
import { Button } from "@/core/ui/button";
import { Segmented } from "@/core/ui/segmented";
import { Slider } from "@/core/ui/slider";
import { play } from "@/core/audio/engine";
import { useStudio, type StudioNode } from "../store";
import { ImageWell } from "../ImageIntake";
import { reach } from "../pictures";
import { LIVE_PRESETS, MAX_SECONDS, MIN_SECONDS, isLiving, liveLayers, newLiving, switchPreset, type LivingPicture } from "../living";
import { cutLayers } from "../livingCut";

const LIGHT = new Set(["shimmer", "glow", "trace"]);

export function LivingField({ node }: { node: StudioNode }) {
  const live = isLiving(node.art?.live) ? node.art!.live : null;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (next: LivingPicture | null) => {
    const art = { ...(node.art ?? {}) };
    if (next) art.live = next; else delete art.live;
    useStudio.getState().updateNode(node.id, { art: Object.keys(art).length ? art : null });
  };
  const cut = async (src: string | null | undefined, count: number) => {
    if (!live) return;
    if (count < 2) { set({ ...live, layers: [] }); return; }
    if (!src) { setError("Drop a picture to cut first."); return; }
    setBusy(true);
    try { set({ ...live, layers: await cutLayers(src, count) }); setError(null); play("confirm"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const ownPicture = async () => (node.picture ? await reach(node.picture) : null);
  const heading = <span className="mb-1 block text-small font-medium uppercase tracking-wider text-fg-faint">Living picture</span>;
  const chips = (kind: "picture" | "shape") => (
    <div className="flex flex-wrap gap-1">
      {LIVE_PRESETS.filter((p) => p.for === kind).map((p) => (
        <Button key={p.id} size="xs" variant={live?.preset === p.id ? "subtle" : "outline"} data-live-preset={p.id} title={p.about}
          onClick={() => set(live ? switchPreset(live, p.id) : newLiving(p.id))}>{p.label}</Button>
      ))}
    </div>
  );
  const layers = live ? liveLayers(live) : [];
  return (
    <div data-part-living={live ? live.preset : ""} className="space-y-1.5">
      {heading}
      <span className="block text-small text-fg-muted">Pictures</span>
      {chips("picture")}
      <span className="block text-small text-fg-muted">Shapes</span>
      {chips("shape")}
      {live ? <>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-small text-fg-muted">Speed</span>
          {/* Faster to the right: the slider runs over seconds backwards. */}
          <Slider value={[MAX_SECONDS + MIN_SECONDS - live.seconds]} min={MIN_SECONDS} max={MAX_SECONDS} step={0.1} aria-label="Living picture speed"
            onValueChange={(v) => set({ ...live, seconds: Math.round((MAX_SECONDS + MIN_SECONDS - (v[0] ?? 4)) * 10) / 10 })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-small text-fg-muted">Strength</span>
          <Slider value={[Math.round(live.amount * 100)]} min={10} max={100} step={1} aria-label="Living picture strength"
            onValueChange={(v) => set({ ...live, amount: (v[0] ?? 50) / 100 })} />
        </div>
        {LIGHT.has(live.preset) ? (
          <label className="flex items-center gap-2 text-small text-fg-muted">
            <span className="w-14 shrink-0">Light</span>
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(live.colour) ? live.colour : "#77eeff"} aria-label="Living picture light" onChange={(e) => set({ ...live, colour: e.target.value })} />
          </label>
        ) : null}
        {live.preset === "drift" || live.preset === "parallax" ? (
          <div className="space-y-1" data-live-layers={layers.length}>
            <span className="block text-small text-fg-muted">Cut into layers: its bright parts move in front of the rest.</span>
            <Segmented size="xs" value={String(layers.length || 1)}
              onChange={(v) => void (async () => cut(node.picture ? await ownPicture() : layers.at(-1), Number(v)))()}
              options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v === "1" ? "one piece" : v, disabled: busy }))} />
            {!node.picture ? <ImageWell label="picture to cut" src={layers.at(-1)} onImage={(src) => void cut(src, Math.max(2, layers.length || 3))} /> : null}
            {layers.length ? <div className="flex gap-1">{layers.map((s, i) => <img key={i} src={s} alt={`Layer ${i + 1}`} className="size-10 rounded-sm border border-border bg-black/40 object-cover" />)}</div> : null}
          </div>
        ) : null}
        <Button size="xs" variant="outline" onClick={() => set(null)}>Keep it still</Button>
      </> : <span className="block text-small text-fg-muted">Moves on the board, the preview and your site. No prompt needed.</span>}
      {busy ? <p className="text-small text-fg-muted">Cutting…</p> : null}
      {error ? <p className="text-small text-danger">{error}</p> : null}
    </div>
  );
}

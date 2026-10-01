"use client";
/**
 * THE LAUNCH KIT, AS A PLACE TO MAKE AND TAKE IT.
 *
 * A key in the top bar (in the Builder) and a command in the palette open
 * it. Make draws the whole kit from the site's own style (`launchKit.ts`);
 * each picture shows at its real shape with its size, and Download saves it
 * under a name that says what it is. The memes take their captions here.
 * "Use on the published page" keeps the share card and the icons in the
 * site's link preview, and says that the next Update live site carries
 * them. `tests/launch-kit.mjs`.
 */
import * as React from "react";
import { create } from "zustand";
import { usePathname } from "next/navigation";
import { Check, Download, Loader2, Rocket } from "lucide-react";
import { Dialog } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Tooltip } from "@/core/ui/tooltip";
import { play } from "@/core/audio/engine";
import { makeKit, MEME_DEFAULTS, readStyle, useOnPage, type KitItem, type KitStyle, type MemeWords } from "./launchKit";

export const useLaunchKit = create<{ open: boolean }>(() => ({ open: false }));
export const openLaunchKit = () => useLaunchKit.setState({ open: true });

const GROUPS: { group: KitItem["group"]; heading: string; says: string }[] = [
  { group: "share", heading: "Share card", says: "The picture shown when a link to the site is posted on X, Discord, Telegram and the rest." },
  { group: "banner", heading: "X banner", says: "The header of the site's X profile. The bottom left is kept clear for the profile picture." },
  { group: "icon", heading: "Site icon", says: "The browser tab (16, 32, 48), the phone home screen (180) and app icons (192, 512)." },
  { group: "meme", heading: "Meme templates", says: "In the site's own fonts and colours. Type the captions, then download." },
];

function Thumb({ item }: { item: KitItem }) {
  const [url, setUrl] = React.useState<string | null>(null);
  /* The old address outlives a redraw a while: a download already started from it is not cut off. */
  React.useEffect(() => { const u = URL.createObjectURL(item.blob); setUrl(u); return () => { setTimeout(() => URL.revokeObjectURL(u), 60_000); }; }, [item.blob]);
  const small = item.group === "icon";
  return (
    <figure data-kit-item={item.id} data-kit-size={`${item.w}x${item.h}`} className="flex flex-col gap-1">
      <div className="flex items-center justify-center rounded-md border border-border bg-elevated/50 p-1" style={small ? { width: 72, height: 72 } : undefined}>
        {url ? <img src={url} alt={item.label} style={small ? { width: Math.min(64, item.w), height: Math.min(64, item.h), imageRendering: item.w < 64 ? "pixelated" : undefined } : { width: "100%", aspectRatio: `${item.w} / ${item.h}` }} /> : null}
      </div>
      <figcaption className="flex items-center gap-1 text-small text-fg-muted">
        <span className="min-w-0 flex-1 truncate">{small ? `${item.w}` : `${item.w} × ${item.h}`}</span>
        {url ? (
          <Tooltip content={`Download ${item.file}`}>
            <a data-kit-download={item.id} href={url} download={item.file} aria-label={`Download the ${item.label}`} className="tactile inline-flex items-center rounded p-0.5 text-fg-muted hover:bg-hover hover:text-fg"><Download className="size-3.5" /></a>
          </Tooltip>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function LaunchKitDialog() {
  const open = useLaunchKit((s) => s.open);
  const [style, setStyle] = React.useState<KitStyle | null>(null);
  const [kit, setKit] = React.useState<KitItem[] | null>(null);
  const [busy, setBusy] = React.useState<"make" | "use" | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [memeWords, setMemeWords] = React.useState<MemeWords>(MEME_DEFAULTS);
  const make = React.useCallback(async (words: MemeWords = memeWords) => {
    setBusy("make");
    try {
      const st = await readStyle();
      setStyle(st);
      setKit(await makeKit(st, words));
    } finally { setBusy(null); }
  }, [memeWords]);
  /* Made as it opens: the kit is the site's, so there is nothing to ask first. */
  React.useEffect(() => { if (open && !kit && !busy) void make(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const use = async () => {
    if (!kit) return;
    setBusy("use");
    try {
      await useOnPage(kit);
      play("confirm");
      setSaid("The share card and the icons are the site's now. The next Update live site puts them on the published page.");
    } catch (err) {
      setSaid(err instanceof Error ? err.message : String(err));
    } finally { setBusy(null); }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { useLaunchKit.setState({ open: v }); if (!v) setSaid(null); }}
      size="xl"
      title="Launch kit"
      description={style ? `Made from the site's own colours and fonts (${style.heading.split(",")[0]!.replace(/['"]/g, "")} and ${style.body.split(",")[0]!.replace(/['"]/g, "")})${style.logo ? " and its logo" : ""}.` : "Made from the site's own colours, fonts and logo."}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {said ? <p data-kit-said="" className="flex items-center gap-1 text-plain text-up"><Check className="size-3.5" />{said}</p> : null}
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void make()} disabled={!!busy}>Make again</Button>
          <Button variant="primary" size="sm" data-kit-use="" loading={busy === "use"} disabled={!kit || !!busy} onClick={() => void use()}>Use on the published page</Button>
        </div>
      }
    >
      <div data-launch-kit="" data-kit-busy={busy ? "1" : "0"} className="max-h-[66vh] space-y-4 overflow-y-auto pr-1">
        {!kit ? <p className="flex items-center gap-2 text-plain text-fg-muted"><Loader2 className="size-3.5 animate-spin" /> Drawing the kit from the site…</p> : null}
        {kit ? GROUPS.map((g) => {
          const items = kit.filter((k) => k.group === g.group);
          return (
            <section key={g.group} data-kit-group={g.group}>
              <h3 className="text-small font-medium text-fg">{g.heading}</h3>
              <p className="mb-1.5 text-small text-fg-faint">{g.says}</p>
              {g.group === "meme" ? (
                <div className="mb-2 grid grid-cols-2 gap-1.5 md:grid-cols-5">
                  {(Object.keys(MEME_DEFAULTS) as (keyof MemeWords)[]).map((k) => (
                    <Input key={k} data-meme-words={k} value={memeWords[k]} aria-label={`Meme caption: ${k}`} className="h-7 text-xs"
                      onChange={(e) => setMemeWords((w) => ({ ...w, [k]: e.target.value }))} onBlur={() => void make(memeWords)} />
                  ))}
                </div>
              ) : null}
              <div className={g.group === "icon" ? "flex flex-wrap gap-2" : g.group === "meme" ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-2 md:max-w-[560px]"}>
                {items.map((it) => <Thumb key={it.id} item={it} />)}
              </div>
            </section>
          );
        }) : null}
      </div>
    </Dialog>
  );
}

/** The key in the top bar, in the Builder only. */
export function LaunchKitKey() {
  const path = usePathname() ?? "";
  if (!/^\/(builder|studio)(\/|$)/.test(path) || /\/preview\//.test(path)) return null;
  return (
    <>
      <Tooltip content="Launch kit: share card, X banner, site icon, memes">
        <Button variant="ghost" size="icon" aria-label="Launch kit" data-launch-kit-open="" onClick={openLaunchKit}><Rocket /></Button>
      </Tooltip>
      <LaunchKitDialog />
    </>
  );
}

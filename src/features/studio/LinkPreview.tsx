"use client";
/**
 * Link preview: what a link to the site draws where it is pasted.
 *
 * The site's own (`brief.head`) under its name and description in the
 * Pages panel, and a page's own under that page, each folded away until
 * opened: most sites never need either, and a captured one arrives with
 * what the original said already in it (`siteHead.ts`). The description is
 * not asked for again here: the box above is the one, and a second
 * "Description" two rows below it would be two knobs with one name.
 *
 * What it cannot do is said plainly: a card's picture is drawn from a full
 * address, and the address is only known once the site has gone live.
 */
import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useStudio, type StudioPage } from "./store";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";
import { put as putPicture, usePicture, type Picture } from "./pictures";
import { cardFor, LARGE, withHead, type SiteHead } from "./siteHead";
import { useBuilds } from "@/features/builds/store";

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-small uppercase tracking-wider text-fg-faint">{children}</span>
);

/** A folded section: a quiet row that opens what is under it. */
function Fold({ label, children, data }: { label: string; children: React.ReactNode; data: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div data-link-preview={data}>
      <Button variant="ghost" size="xs" className="-ml-1.5" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown /> : <ChevronRight />}
        {label}
      </Button>
      {open ? <div className="mt-1 space-y-2">{children}</div> : null}
    </div>
  );
}

/** One picture: shown small, chosen from this machine, taken off. */
function PictureRow({ label, pic, onPick, onClear, hint }: { label: string; pic: Picture | undefined; onPick: (p: Picture) => void; onClear: () => void; hint?: string }) {
  const { src, looked } = usePicture(pic);
  const file = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const choose = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { onPick(await putPicture(f, { alt: f.name.replace(/\.[a-z0-9]+$/i, ""), from: "upload" })); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {pic && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={pic.alt} className="h-10 max-w-20 shrink-0 rounded-sm border border-border object-contain" />
        ) : null}
        {pic?.w && pic.h ? <span className="num whitespace-nowrap text-small text-fg-muted">{pic.w} × {pic.h}</span> : null}
        <span className="flex-1" />
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="outline" size="xs" disabled={busy} loading={busy} onClick={() => file.current?.click()}>{pic ? "Another" : "Choose"}</Button>
        {pic ? <Button variant="ghost" size="xs" onClick={onClear}>Remove</Button> : null}
      </div>
      {pic && !src ? <span className="text-small leading-snug text-warn">{looked ? "Not in this browser any more. Choose it again to put it back." : "Looking for it…"}</span> : null}
      {hint ? <span className="text-small leading-snug text-fg-faint">{hint}</span> : null}
    </div>
  );
}

const hexish = (v: string | undefined) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000");

/** The site's link preview, under its name and description. */
export function SiteLinkPreview() {
  const brief = useStudio((s) => s.brief);
  const live = useLive();
  const head = brief.head;
  const set = (patch: Partial<SiteHead>) => useStudio.getState().setBrief({ head: withHead(useStudio.getState().brief.head, patch) });
  const card = head?.image ? (head.card ?? cardFor(head.image)) : "summary";
  const favicon = head?.icons?.find((i) => i.rel === "icon" || i.rel === "shortcut icon") ?? head?.icons?.[0];
  return (
    <Fold label="Link preview" data="site">
      <label className="flex flex-col gap-1">
        <Label>Title</Label>
        <Input value={head?.title ?? ""} placeholder={brief.name || "The site's name"} aria-label="Link preview title" onChange={(e) => set({ title: e.target.value })} />
      </label>
      <PictureRow
        label="Share picture"
        pic={head?.image?.picture}
        hint="1200 × 630 draws the large card."
        onPick={(picture) => set({ image: { picture, w: picture.w, h: picture.h, alt: picture.alt } })}
        onClear={() => set({ image: undefined })}
      />
      {head?.image ? (
        <div className="flex items-center justify-between gap-2">
          <Label>Card</Label>
          <Segmented size="xs" aria-label="Card size" value={card === LARGE ? "large" : "small"} onChange={(v) => set({ card: v === "large" ? LARGE : "summary" })} options={[{ value: "large", label: "Large" }, { value: "small", label: "Small" }]} />
        </div>
      ) : null}
      <PictureRow
        label="Icon"
        pic={favicon?.picture}
        hint={head?.icons?.length ? undefined : "None chosen: the picture on the most pages is cut into one."}
        onPick={(picture) => set({ icons: [{ rel: "icon", picture, type: picture.type }, { rel: "apple-touch-icon", picture }] })}
        onClear={() => set({ icons: undefined })}
      />
      <div className="flex flex-col gap-1">
        <Label>Theme colour</Label>
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Pick the theme colour" value={hexish(head?.themeColor)} onChange={(e) => set({ themeColor: e.target.value })} className="size-7 cursor-pointer rounded-sm border border-border bg-transparent p-0" />
          <Input mono className="flex-1" value={head?.themeColor ?? ""} placeholder="None" aria-label="Theme colour" onChange={(e) => set({ themeColor: e.target.value })} />
        </div>
      </div>
      <p className="text-small leading-snug text-fg-faint" data-link-preview-live>
        {live
          ? `Previews name this site at ${live.replace(/^https?:\/\//, "")}.`
          : "Previews need the site to be live once: until it is, the share picture is named relative and most apps draw none. Go live again after the first time."}
      </p>
    </Fold>
  );
}

/** A page's own link preview, where it differs from the site's. */
export function PageLinkPreview({ page }: { page: StudioPage }) {
  const brief = useStudio((s) => s.brief);
  const head = page.head;
  const set = (patch: Partial<SiteHead>) => {
    const now = useStudio.getState().pages.find((p) => p.id === page.id);
    useStudio.getState().updatePage(page.id, { head: withHead(now?.head, patch) });
  };
  return (
    <Fold label="Link preview" data={page.id}>
      <Input value={head?.title ?? ""} placeholder={brief.head?.title || `${page.name} · ${brief.name || "Site"}`} aria-label="Page title" onChange={(e) => set({ title: e.target.value })} />
      <Input value={head?.description ?? ""} placeholder={brief.description || "The site's description"} aria-label="Page description" onChange={(e) => set({ description: e.target.value })} />
      <PictureRow
        label="Share picture"
        pic={head?.image?.picture}
        hint={brief.head?.image ? "None chosen: the site's." : undefined}
        onPick={(picture) => set({ image: { picture, w: picture.w, h: picture.h, alt: picture.alt } })}
        onClear={() => set({ image: undefined })}
      />
    </Fold>
  );
}

/** The published address, as Go live last wrote it on the site (`publishedAt` is the export's reading of the same). */
function useLive(): string | null {
  return useBuilds((b) => b.projects.find((p) => p.id === b.activeId)?.live?.url?.trim().replace(/\/+$/, "") || null);
}

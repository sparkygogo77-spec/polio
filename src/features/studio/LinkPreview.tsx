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
import { useStudio, type StudioPage } from "./board/store";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";
import { put as putPicture, usePicture, type Picture } from "./pictures";
import { cardFor, LARGE, withHead, type SiteHead } from "./siteHead";
import { useBuilds } from "@/features/builds/store";
import { HandColour } from "./HandSlider";

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
          <HandColour aria-label="Pick the theme colour" value={hexish(head?.themeColor)} onPick={(hex) => set({ themeColor: hex })} className="size-7 cursor-pointer rounded-sm border border-border bg-transparent p-0" />
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

/*
 * HOW LONG A NAME OR A LINE SHOULD BE, said where it is typed.
 *
 * A search listing shows about 60 characters of a title and about 160 of a
 * description before it cuts them with "…"; a chat app's card cuts sooner.
 * So each box carries a count against its limit, and says in words what
 * happens past it.
 */
export const NAME_LIMIT = 60;
export const DESCRIPTION_LIMIT = 160;
export const DESCRIPTION_MIN = 50;

export function CharGuide({ value, limit, min, what }: { value: string; limit: number; min?: number; what: "name" | "description" }) {
  const n = value.trim().length;
  const over = n > limit;
  const short = !!min && n > 0 && n < min;
  const says = !n
    ? what === "name" ? `Up to ${limit} characters show whole in a search listing.` : `Aim for ${min ?? 0} to ${limit} characters: enough to say what the site is, short enough not to be cut.`
    : over ? `${n - limit} over: search listings cut it at about ${limit}, with "…".`
    : short ? `A little short: ${min} to ${limit} characters says more in the space a card gives it.`
    : "Fits.";
  return (
    <span data-char-guide={what} data-over={over ? "" : undefined} className="flex items-baseline justify-between gap-2 text-fine leading-snug">
      <span className={over ? "text-warn" : "text-fg-faint"}>{says}</span>
      <span className={`num shrink-0 ${over ? "text-warn" : short ? "text-fg-muted" : "text-fg-faint"}`}>{n} / {limit}</span>
    </span>
  );
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/**
 * The link as a person sees it when it is pasted into a chat or a post: the
 * share picture, the address, the title and the line under it, cut where a
 * card cuts them. Drawn from exactly what the head will say (`brief.head`,
 * else the site's name and description), so what is typed above shows here
 * as it is typed.
 */
export function SharedCard() {
  const brief = useStudio((s) => s.brief);
  const live = useLive();
  const head = brief.head;
  const { src } = usePicture(head?.image?.picture);
  const large = !!head?.image && (head.card ?? cardFor(head.image)) === LARGE;
  const title = (head?.title || brief.name || "Untitled").trim();
  /* The published page's rule (`pageHead`): the description the owner typed. */
  const description = (brief.description || "").trim();
  const host = live ? live.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "your-site.example";
  const picture = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={large ? "block aspect-[1.91/1] w-full object-cover" : "size-16 shrink-0 object-cover"} />
  ) : large ? null : (
    <span className="flex size-16 shrink-0 items-center justify-center bg-elevated text-fine text-fg-faint">no picture</span>
  );
  return (
    <div data-shared-card={large ? "large" : "small"} className="space-y-1">
      <span className="text-small uppercase tracking-wider text-fg-faint">As a shared link</span>
      <div className="overflow-hidden rounded-md border border-border bg-[oklch(0.2_0.02_260)]">
        {large ? picture : null}
        <div className={large ? "space-y-0.5 p-2" : "flex items-center gap-2 p-1.5"}>
          {large ? null : picture}
          <div className="min-w-0 space-y-0.5">
            <div data-card-host="" className="truncate text-fine uppercase tracking-wide text-[oklch(0.7_0.02_260)]">{host}</div>
            <div data-card-title="" className="text-small font-semibold leading-snug text-[oklch(0.96_0_0)]">{cut(title, 70)}</div>
            {description ? <div data-card-description="" className="line-clamp-2 text-fine leading-snug text-[oklch(0.8_0.01_260)]">{cut(description, 200)}</div> : null}
          </div>
        </div>
      </div>
      {!live ? <span className="text-fine leading-snug text-fg-faint">The address is shown once the site is live.</span> : null}
    </div>
  );
}

"use client";
/**
 * The per-element prompt panel — the point of the whole exercise. Whatever is
 * selected gets its own instructions, and those instructions travel with its
 * position on the canvas into the brief.
 */
import { isKeptVersion, openRemake, PictureVersions } from "./RemakePicture";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { AlignCenter, AlignLeft, AlignRight, Bookmark, ChevronRight, Frame, Group, Image as ImageIconLucide, Lightbulb, Lock, Megaphone, Palette as PaletteIcon, Pencil, Play, Sparkles, Trash2, Type, Unlock } from "lucide-react";
import { getFeature, categoryOf, type FeatureOption } from "./catalog";
import { isLinkable } from "./parts";
import { BACKGROUND_ID, HUES, NODE_SHAPES, pageGroups, pageNodes, pageShapes, activePage, useStudio , type StudioNode } from "./store";
import { drop as dropPicture, put as putPicture, usePicture } from "./pictures";
import { ColourOverride } from "./ColourOverride";
import { AuditPanel, AuditReadout } from "./AuditPanel";
import { CUBE_SIDES, emptyFace, written } from "./parts/cubeFaces";
import { makeSolid, showCube, showSolid, solidModel } from "./solidRun";
import { rendererReady } from "./agent";
import { useKeys } from "@/features/keys/store";
import { ROLE_MEANS, ROLES, simplify, weigh, type VectorRole } from "./vector";
import { resolvePalette } from "./parts/theme";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Segmented } from "@/core/ui/segmented";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Switch } from "@/core/ui/switch";
import { Tooltip } from "@/core/ui/tooltip";
import { linkReason } from "./links";
import { plain, reword } from "./parts/spans";
import { growToWords } from "./growToWords";
import { WorkFields } from "./WorkFields";
import { capturedFrom, insideControl, isMachineLabel, partName, wordsOf } from "./partNames";
import { fontsInPageOrder, faceOf } from "./siteColours";
import { parseColor, toHex } from "./look";
import { wordsIn } from "./owner";
import { decisionSays } from "./library/badge";
import { movingParts } from "./motionInventory";
import { MoveRowView } from "./MotionPanel";
import { RenderPanel } from "./RenderPanel";
import { TourEditor } from "./TourEditor";
import { Crumbs, KindIcon, PanelSection, openSection, PartsBehind, ElementList, kindWord, useDecisions } from "./PartTreePanel";
import { ComponentFields } from "./ComponentFields";
import { componentsOf, KIND_WORD, type CompNode } from "./components";
import { PartFields } from "./PartFields";
import { WornLook, WornMotion, WornWords } from "./DrawKits";
import { PartEffects, SaveAsComponent, offeredIds } from "./PartEffects";
import { usesOf } from "./library/works";
import { LookCopy } from "./LookCopy";
import { MakeAllLike } from "./MakeAllLike";
import { KitStyles } from "./KitStyles";
import { RemixKept } from "./RemixCard";

/** The Element panel draws only the Version row from the fields data; its other rows are its own. */
const VERSION_ONLY = ["version"] as const;

export const GLYPHS = ["✦", "◆", "▲", "●", "✱", "❖", "☾", "⚡", "🌀", "🔮", "🧩", "🎛", "🪄", "🛰", "🧪", "🎚"];

/**
 * A set option: every preset on offer as a chip, the ones that are on filled
 * in. Click to add, click to take away — which is what "these social links,
 * not those" wants to be, and what a dropdown can never say.
 */
export /**
 * A range option: one slider and the number it is on.
 *
 * How big, how far over, what colour, how much glow — none of those is a
 * short list of names, and a list of five sizes is a list of five
 * compromises. The value is stored as a string like every other option, so
 * nothing downstream has to know this control exists.
 */
function OptionRange({ option, value, onChange }: { option: FeatureOption; value: string | undefined; onChange: (v: string) => void }) {
  const r = option.range ?? { min: 0, max: 100, step: 1 };
  const fallback = Number.parseFloat(option.values[0] ?? "0") || 0;
  const at = Number.parseFloat(value ?? "");
  const now = Number.isFinite(at) ? Math.max(r.min, Math.min(r.max, at)) : fallback;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-plain text-fg">{option.label}</span>
        <span className="num text-plain text-fg-muted">{now}{r.unit ?? ""}</span>
      </div>
      <Slider
        min={r.min}
        max={r.max}
        step={r.step ?? 1}
        value={[now]}
        aria-label={option.label}
        onValueChange={([v]) => onChange(String(v ?? fallback))}
      />
    </div>
  );
}

function OptionSet({ option, value, onChange }: { option: FeatureOption; value?: string; onChange: (v: string) => void }) {
  const on = React.useMemo(
    () => new Set((value === undefined ? option.preset ?? "" : value).split(",").map((s) => s.trim()).filter(Boolean)),
    [value, option.preset],
  );
  const toggle = (name: string) => {
    const next = new Set(on);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    // Keep the shelf order rather than the click order, so the row is stable.
    onChange(option.values.filter((v) => next.has(v)).join(", "));
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-plain text-fg">{option.label}</span>
        <span className="num text-small text-fg-faint">{on.size} on</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {option.values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={on.has(v)}
            onClick={() => { play(on.has(v) ? "close" : "select"); toggle(v); }}
            className={cn(
              "tactile rounded-full border px-2 py-0.5 text-small",
              on.has(v) ? "border-accent/60 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The picture a part holds: choose one, see it, take it away.
 *
 * WHERE THE BYTES ARE, because it changes what he should expect. Not in the
 * document: a photograph inlined there would share the browser's small
 * storage with his board, his builds and his keys, and take all of them with
 * it when it overflowed. They are in this browser's file storage while he
 * works, and in the repository once he publishes — and the line under the
 * picture says which of those is true right now, because a picture that has
 * only ever been here exists in one place and he is the only one who can
 * know that.
 */

/** THE WORDS, FIRST. Two presses on the part put the caret here (`wanted`). */
function WordsField({ node, content, label, alsoFor }: { node: StudioNode; content: { label: string; placeholder?: string }; label?: "link" | "button"; alsoFor?: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const wanted = useStudio((s) => s.wanted);
  React.useEffect(() => {
    if (!wanted || wanted.focus !== "words" || (wanted.id !== node.id && wanted.id !== alsoFor)) return;
    /* After the press that asked: the board takes the keys back on its
       pointerup, so the caret lands once that has happened. */
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      useStudio.getState().want(null);
    }, 160);
    return () => window.clearTimeout(t);
  }, [wanted, node.id, alsoFor]);
  return (
    <Field label="Words" hint={label ? `The ${label}'s label: one line, read as part of the ${label}. The board draws exactly this.` : `${content.label}. The board draws exactly this.`}>
      <Textarea
        ref={ref}
        autoGrow
        rows={2}
        aria-label="Words"
        value={plain(node.content)}
        placeholder={content.placeholder}
        onChange={(e) => { useStudio.getState().updateNode(node.id, { content: reword(node.content, e.target.value) }); growToWords(node.id); }}
      />
    </Field>
  );
}

function PictureField({ node }: { node: StudioNode }) {
  const pic = node.picture ?? null;
  const { src, looked } = usePicture(pic);
  const [busy, setBusy] = React.useState(false);
  const file = React.useRef<HTMLInputElement>(null);

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const made = await putPicture(f, { alt: f.name.replace(/\.[a-z0-9]+$/i, ""), from: "upload" });
      const had = node.picture;
      useStudio.getState().updateNode(node.id, { picture: made });
      // The one it replaced is nobody's now, unless it is one of the part's kept versions.
      if (had && !isKeptVersion(node, had)) void dropPicture(had);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    const had = node.picture;
    useStudio.getState().updateNode(node.id, { picture: null });
    if (had && !isKeptVersion(node, had)) void dropPicture(had);
  };

  return (
    <Field label="Picture" hint="Kept as a file, not inside the document, so a big one cannot take the board down with it.">
      <div className="space-y-2">
        {pic ? (
          <div className="overflow-hidden rounded-md border border-border bg-elevated">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={pic.alt} className="block max-h-32 w-full object-cover" />
            ) : looked ? (
              <div className="p-3 text-plain leading-relaxed text-warn">
                This picture is not in this browser any more. Choose it again to put it back.
              </div>
            ) : (
              <div className="p-3 text-plain text-fg-muted">Looking for it…</div>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }}
          />
          <Button variant="outline" size="xs" disabled={busy} onClick={() => file.current?.click()}>
            {pic ? "Choose another" : "Choose a picture"}
          </Button>
          <Button variant="ghost" size="xs" disabled={busy} data-draw-one="" onClick={() => openSection("make-picture")}>
            <Sparkles className="size-3" /> Draw one
          </Button>
          {pic ? <Button variant="ghost" size="xs" data-remake-open="" onClick={() => openRemake(node.id)}><Sparkles className="size-3" /> Remake…</Button> : null}
          {pic ? <Button variant="ghost" size="xs" onClick={clear}>Remove</Button> : null}
        </div>
        <PictureVersions node={node} />
        {pic ? (
          <p className="text-small leading-relaxed text-fg-muted">
            {pic.published
              ? <>Published with the site, at <code className="text-fg">{pic.path}</code>.</>
              : <>This picture is in this browser only. It goes up with the site the next time you publish, as <code className="text-fg">{pic.path}</code>.</>}
            {pic.bytes ? ` ${pic.bytes < 1024 * 1024 ? `${Math.round(pic.bytes / 1024)} KB` : `${(pic.bytes / 1024 / 1024).toFixed(1)} MB`}${pic.w ? `, ${pic.w}×${pic.h}` : ""}.` : ""}
          </p>
        ) : null}
      </div>
    </Field>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-small font-medium uppercase tracking-wider text-fg-faint">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-small text-fg-muted">{hint}</span> : null}
    </label>
  );
}

export function HuePicker({ value, onChange }: { value: number | null; onChange: (h: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn("tactile size-5 rounded-sm border text-fine text-fg-faint", value === null ? "border-accent" : "border-border")}
        title="Category colour"
      >
        A
      </button>
      {HUES.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          className={cn("tactile size-5 rounded-sm border", value === h ? "border-fg" : "border-transparent")}
          style={{ background: `oklch(0.72 0.16 ${h})` }}
          title={`Hue ${h}`}
        />
      ))}
    </div>
  );
}

/** A catalogue part's plain name, for naming a part that has nothing better. */
const featureName = (id: string) => getFeature(id)?.name;

/** Parts that are words: inside a button or a link they are its label. */
const TEXTY = new Set(["prose", "eyebrow-rule", "highlight", "heading-scale", "fluid-type"]);
/** Options that mean nothing on a control's label: a label is one line. */
const LABEL_HIDES = new Set(["measure"]);
const insideLink = (n: StudioNode) => /(^|>)\s*a(\b|[.:#[])/.test(n.from?.selector ?? "") || /computes it as an? link/i.test(n.prompt) || (!!n.link && !/(^|>)\s*button\b/.test(n.from?.selector ?? ""));

/**
 * A closed section with a one-line head: what the side panel folds away so
 * the things a person came for sit at the top. Remembers being opened for
 * the length of the visit, so a person who opened it once is not made to
 * open it again on every part.
 */
const OPENED = new Set<string>();
function Fold({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(() => OPENED.has(id));
  return (
    <details
      data-fold={id}
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        if (now === open) return;
        if (now) OPENED.add(id); else OPENED.delete(id);
        play(now ? "open" : "close");
        setOpen(now);
      }}
      className="group rounded-md border border-border"
    >
      <summary className="tactile flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-small font-medium text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 shrink-0 text-fg-faint transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1">{title}</span>
        {note ? <span className="shrink-0 text-fine font-normal text-fg-faint">{note}</span> : null}
      </summary>
      <div className="space-y-3 border-t border-border p-2">{children}</div>
    </details>
  );
}

/**
 * The page at a glance, for when nothing is picked: its parts, the site's
 * pages, the links on this page, and the parts still waiting on a decision
 * (the orange ! on the board, `library/badge.ts`). Each count that leads
 * somewhere is a press away from it.
 */
function PageSummary({ nodes }: { nodes: StudioNode[] }) {
  const pages = useStudio((s) => s.pages);
  const links = nodes.filter((n) => !!n.link).length;
  const open = useDecisions(nodes);
  const nowhere = open.filter((d) => d.why === "nowhere").length;
  const live = open.length - nowhere;
  /* A count that names parts opens the list of exactly those parts, here; it used to pick them all at once and show nothing. */
  const [behind, setBehind] = React.useState<"decide" | "links" | null>(null);
  const show = (w: "decide" | "links") => { play(behind === w ? "close" : "open"); setBehind((b) => (b === w ? null : w)); };
  const Stat = ({ n, one, many, onPress, id, on }: { n: number; one: string; many: string; onPress?: () => void; id: string; on?: boolean }) => (
    <button
      type="button"
      data-summary={id}
      aria-expanded={on === undefined ? undefined : on}
      disabled={!onPress || !n}
      onClick={onPress}
      className={cn("tactile flex flex-col items-start rounded-md border px-2 py-1.5 text-left enabled:hover:bg-hover disabled:cursor-default", on ? "border-accent bg-accent-soft" : "border-border")}
    >
      <span className="num text-large font-semibold text-fg">{n}</span>
      <span className="text-small text-fg-muted">{n === 1 ? one : many}</span>
    </button>
  );
  return (
    <div data-page-summary="" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Stat id="parts" n={nodes.length} one="part on this page" many="parts on this page" />
        <Stat id="pages" n={pages.length} one="page on the site" many="pages on the site"
          onPress={() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "pages" }))} />
        <Stat id="links" n={links} one="link on this page" many="links on this page" on={behind === "links"}
          onPress={() => show("links")} />
        <Stat id="open" n={open.length} one="part needs a decision" many="parts need a decision" on={behind === "decide"}
          onPress={() => show("decide")} />
      </div>
      {open.length && !behind ? (
        <p data-summary-says="" className="text-small leading-snug text-fg-muted">
          {[
            nowhere ? `${nowhere} ${nowhere === 1 ? "is a button or link that goes" : "are buttons or links that go"} nowhere yet` : "",
            live ? `${live} ${live === 1 ? "shows a number" : "show numbers"} frozen when the site was captured` : "",
          ].filter(Boolean).join("; ")}. They wear an orange ! on the board.
        </p>
      ) : null}
      {behind ? <PartsBehind which={behind} nodes={nodes} onClose={() => { play("close"); setBehind(null); }} /> : null}
    </div>
  );
}

export function Inspector() {
  const selection = useStudio((s) => s.selection);
  const nodes = useStudio(useShallow(pageNodes));
  const shapes = useStudio(useShallow(pageShapes));
  const groups = useStudio(useShallow(pageGroups));
  const page = useStudio(activePage);
  const frameWidth = useStudio((s) => s.frameWidth);
  /* Which mark is open. None is the resting state, and the prompt is
     always there under it — see the row below. */
  /* The back arrow on a part's panel shows the tree with the part still picked; picking another part opens its panel. */
  const [backTo, setBackTo] = React.useState<string | null>(null);
  const selKey = selection.join(",");
  React.useEffect(() => { setBackTo((b) => (b && selKey === b ? b : null)); }, [selKey]);
  /* Asked for again (its row pressed in the list, a double press on the board), the part's panel opens, even when it is the part the back arrow left. */
  React.useEffect(() => useStudio.subscribe((s, was) => { if (s.wanted && s.wanted !== was.wanted && s.wanted.panel === "inspector") setBackTo(null); }), []);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const openDecisions = useDecisions(nodes);

  const selNodes = nodes.filter((n) => selection.includes(n.id));
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const store = useStudio.getState;

  /*
   * THE BACKGROUND HAS LEFT THIS PANEL, by his ruling and for the reason he
   * gave: the page's fill and the textures on it are the SITE's look, not
   * this element's, and having them here was the one thing in Element that
   * genuinely belonged in Looks. They are a section of the Look panel now.
   *
   * Picking the background still has to answer for itself rather than read
   * as an empty panel, so it says where its controls went — and the way it
   * says so is a button that takes you there, not a sentence telling you to
   * go yourself.
   *
   * WHAT IT MAY NOT DO IS BE THE WHOLE PANEL, which is the fault he read as
   * this tab having nothing in it. A press on the page is how most people
   * arrive here, and what they arrived at was a tab called Element saying
   * one sentence about the page's fill and offering to send them somewhere
   * else. A tab named for a thing leads with that thing: the elements on
   * this page, each one a press away from its own editor, and the signpost
   * folded to a line at the foot where a signpost belongs.
   */
  if (selection.includes(BACKGROUND_ID)) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-page-picked="">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{page.name}</div>
          <div className="text-small text-fg-muted">
            {nodes.length ? `${nodes.length} element${nodes.length === 1 ? "" : "s"} on this page. Pick one to prompt it.` : "The page itself is picked."}
          </div>
        </div>
        <ElementList nodes={nodes} className="flex-1" />
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-sm"
            style={{ background: "oklch(0.7 0.15 320 / 0.18)", color: "oklch(0.84 0.16 320)" }}
          >
            <PaletteIcon className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-small text-fg-muted">The page&rsquo;s fill and its textures are the site&rsquo;s look.</p>
          <Button
            size="xs"
            variant="outline"
            data-to-looks=""
            onClick={() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "look" }))}
          >
            Open Looks
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- nothing picked */
  /*
   * With nothing picked, or with one part picked and the back arrow pressed:
   * where you are (the counts), then the page's parts as a tree in page
   * order, the picked one lit. The page's own prompt is folded at the foot.
   */
  const single = selNodes.length === 1 && selShapes.length === 0 ? selNodes[0]! : null;
  if ((selNodes.length === 0 && selShapes.length === 0) || (single && backTo === single.id)) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{page.name}</div>
          <div className="text-small text-fg-muted">
            {single ? <>Picked: <button type="button" data-back-to-part="" className="text-fg underline-offset-2 hover:underline" onClick={() => { play("open"); setBackTo(null); }}>{partName(single, nodes, featureName)}</button></> : "Press a part here or on the board to open it."}
          </div>
        </div>
        <div className="shrink-0 space-y-3 p-3 pb-2">
          {/*
            A SUMMARY FIRST, the prompt folded. What a person wants on
            arriving is where they are: how many parts, pages and links, and
            what still needs deciding, each count a press away from the parts
            it counts.
          */}
          <PageSummary nodes={nodes} />
          <div className="flex items-center justify-between">
            <span className="text-small font-semibold uppercase tracking-[0.08em] text-fg">Elements, top to bottom</span>
            <span className="num text-fine text-fg-faint">{nodes.length}</span>
          </div>
        </div>
        <ElementList nodes={nodes} picked={single?.id ?? null} className="mx-1.5 min-h-40 flex-1 rounded-md border border-border" />
        <div className="shrink-0 p-3 pt-2">
          <Fold id="page-prompt" title="This page's prompt" note={page.prompt.trim() ? "written" : "empty"}>
          <Field label="This page should…" hint="Applies to everything on this page.">
            <Textarea
              autoGrow
              rows={4}
              aria-label="Page prompt"
              placeholder="e.g. The whole page is one continuous scroll; nothing is clickable until the reader reaches the bottom."
              value={page.prompt}
              onChange={(e) => useStudio.getState().updatePage(page.id, { prompt: e.target.value })}
            />
          </Field>
          <Field label="Where it would go">
            <AuditReadout
              subject="a part made from these words"
              planned={{ label: page.name, prompt: page.prompt, featureId: "custom-idea", w: 1440, h: 800, role: null, outline: null, content: "" }}
            />
          </Field>
          </Fold>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- shape picked */
  if (selShapes.length === 1 && selNodes.length === 0) {
    const shape = selShapes[0]!;
    const kindLabel = shape.kind === "frame" ? "Region" : shape.kind === "arrow" ? "Connection" : "Sketch";
    const fromNode = nodes.find((n) => n.id === shape.fromNodeId);
    const toNode = nodes.find((n) => n.id === shape.toNodeId);
    /*
     * What the chain already says.
     *
     * A chain between two parts wears its reason on the board and carries it
     * into the blueprint whether or not anybody names it, so the Name box
     * shows that reason as its placeholder: what is in the field is what the
     * chain says, and typing over it says something else instead.
     */
    const derived = shape.kind === "arrow" && fromNode && toNode ? linkReason(fromNode, toNode, shape.relation ?? "flow") : "";
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="size-2 rounded-full" style={{ background: `oklch(0.75 0.16 ${shape.hue})` }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-plain font-semibold text-fg">{shape.label || kindLabel}</div>
            <div className="text-small text-fg-muted">
              {kindLabel}
              {fromNode && toNode ? ` · ${fromNode.label} → ${toNode.label}` : ""}
            </div>
          </div>
          <Button variant="ghost" size="iconXs" aria-label="Delete" onClick={() => useStudio.getState().removeShapes([shape.id])}>
            <Trash2 />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <Field label="Name" hint={derived ? "The chain says this by itself, from what the two parts already say. Write here to say it differently." : undefined}>
            <Input
              value={shape.label}
              placeholder={derived || (shape.kind === "frame" ? "e.g. Above the fold" : "e.g. opens on click")}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { label: e.target.value })}
            />
          </Field>
          <Field
            label="Prompt"
            hint={
              shape.kind === "frame"
                ? "Applies to everything inside this region."
                : shape.kind === "arrow"
                  ? "Describes the relationship between the two elements."
                  : "What this drawing represents."
            }
          >
            <Textarea
              autoGrow
              rows={4}
              value={shape.prompt}
              aria-label="Drawing prompt"
              placeholder={shape.kind === "arrow" ? "e.g. clicking the card expands it into this panel" : "Describe what this means…"}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { prompt: e.target.value })}
            />
          </Field>
          {shape.kind === "pen" ? (
            <Field label="Where it would go">
              <AuditReadout
                subject="this drawing"
                planned={{ label: shape.label, prompt: shape.prompt, featureId: "custom-idea", w: 320, h: 200, role: null, outline: null, content: "" }}
              />
            </Field>
          ) : null}
          {shape.kind === "arrow" ? (
            <Field
              label="Carries data"
              hint="A data wire means the part it points at reads from the part it starts on. Turning this on writes that into the target's data box."
            >
              <Segmented
                size="xs"
                value={shape.relation === "data" ? "data" : "flow"}
                onChange={(v) => useStudio.getState().setShapeRelation(shape.id, v as "data")}
                options={[
                  { value: "flow", label: "Relationship" },
                  { value: "data", label: "Data" },
                ]}
                aria-label="Carries data"
              />
            </Field>
          ) : null}
          <Field label="Colour">
            <HuePicker value={shape.hue} onChange={(h) => useStudio.getState().updateShape(shape.id, { hue: h ?? 265 })} />
          </Field>
          {shape.kind === "pen" ? (
            <Field label="Stroke width">
              <Slider
                value={[shape.width]}
                min={1}
                max={12}
                step={1}
                onValueChange={(v) => useStudio.getState().updateShape(shape.id, { width: v[0] ?? 3 })}
                readout={(n) => `${n}px`}
              />
            </Field>
          ) : null}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- multi-selection */
  if (selNodes.length > 1) {
    const groupIds = new Set(selNodes.map((n) => n.groupId).filter(Boolean));
    const sharedGroup = groupIds.size === 1 ? groups.find((g) => g.id === [...groupIds][0]) : null;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{selNodes.length} elements selected</div>
          <div className="truncate text-small text-fg-muted">{selNodes.map((n) => n.label).join(", ")}</div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <Field label="Look" hint="Paste a copied look on all of these, in one step.">
            <LookCopy node={null} targets={selNodes.map((n) => n.id)} />
          </Field>
          <RemixKept nodes={selNodes} />
          {sharedGroup ? (
            <>
              <Field label="Group name">
                <Input value={sharedGroup.label} onChange={(e) => useStudio.getState().updateGroup(sharedGroup.id, { label: e.target.value })} />
              </Field>
              <Field label="Group prompt" hint="Covers all members and how they relate to each other.">
                <Textarea
                  autoGrow
                  rows={4}
                  value={sharedGroup.prompt}
                  aria-label="Group prompt"
              placeholder="e.g. These three share one card shell and animate in together."
                  onChange={(e) => useStudio.getState().updateGroup(sharedGroup.id, { prompt: e.target.value })}
                />
              </Field>
              <Field label="Hold together" hint="Picked as one and sized as one: the members' places, spacing and sizes go with every resize.">
                <Switch
                  size="sm"
                  aria-label="Hold the group together"
                  checked={!!sharedGroup.locked}
                  onCheckedChange={(v) => useStudio.getState().updateGroup(sharedGroup.id, { locked: v })}
                />
              </Field>
              <Button variant="outline" size="sm" className="w-full" onClick={() => useStudio.getState().ungroup(sharedGroup.id)}>
                Ungroup
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" className="w-full" onClick={() => useStudio.getState().groupSelection()}>
              <Group />
              Group these {selNodes.length}
            </Button>
          )}

          <Field label="Set priority for all">
            <Segmented
              size="xs"
              value={selNodes[0]!.priority}
              onChange={(v) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { priority: v as "must" })}
              options={[
                { value: "must", label: "Must" },
                { value: "nice", label: "Nice" },
                { value: "idea", label: "Idea" },
              ]}
            />
          </Field>
          <Field label="Colour all" hint="Applies to every part selected.">
            <ColourOverride
              colour={selNodes[0]!.colour}
              palette={palette}
              onChange={(colour) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { colour })}
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => useStudio.getState().duplicateNodes(selNodes.map((n) => n.id))}>
              Duplicate
            </Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={() => useStudio.getState().removeNodes(selNodes.map((n) => n.id))}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- single node */
  const node = selNodes[0]!;
  const feature = getFeature(node.featureId);
  const cat = feature ? categoryOf(feature.category) : null;
  const group = groups.find((g) => g.id === node.groupId);
  const shownName = partName(node, nodes, featureName);
  const kind = kindWord(node);
  const effectIds = offeredIds(kind, node, nodes);
  const effectsOn = usesOf(node.work).filter((u) => effectIds.has(u.id)).length;
  /* Words inside a button or a link are that control's label: one line, no
     measure, not "long-form text with proper rhythm". */
  const isLabel = !!feature && (TEXTY.has(feature.id) || (feature.id === "box" && !!wordsOf(node))) && insideControl(node);
  const captured = capturedFrom(node, nodes);
  /* A link or a button whose words sit on a part inside it: the words are edited here, on the part that draws them. */
  /* A plain read, not a hook: this runs after the panel's early returns. Cached per board (`components.ts`). */
  const comps = componentsOf(nodes as unknown as CompNode[], palette);
  const comp = comps.byId.get(node.id) ?? null;
  const partOfId = comp ? null : comps.of.get(node.id);
  const partOf = partOfId ? comps.byId.get(partOfId) ?? null : null;
  const wordsPart = wordsIn(nodes, node);
  const wordsHere = wordsPart && wordsPart.id !== node.id ? wordsPart : null;
  const control = kind === "Link" || kind === "Button" || !!node.link || isLinkable(node.featureId);
  const decision = openDecisions.find((d) => d.id === node.id) ?? null;
  const featureOptions = feature?.options?.filter((o) => !(isLabel && LABEL_HIDES.has(o.id))) ?? [];
  /*
   * Typing a number into X, Y, W or H is his hand on the box exactly as a
   * drag is, so it marks the part his and the healing leaves it alone from
   * then on. Only the four: setting a colour or a prompt says nothing about
   * where the box belongs. See `StudioNode.byHand`.
   */
  const update = (patch: Parameters<ReturnType<typeof store>["updateNode"]>[1]) => {
    const movesTheBox = patch && ("x" in patch || "y" in patch || "w" in patch || "h" in patch);
    useStudio.getState().updateNode(node.id, movesTheBox && !node.byHand ? { ...patch, byHand: true } : patch);
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-part-panel={node.id}>
      <div className="shrink-0 space-y-1 border-b border-border px-3 pb-2 pt-1.5">
        <Crumbs node={node} nodes={nodes} pageName={page.name} onBack={() => setBackTo(node.id)} />
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            {node.glyph ? <span className="text-xs">{node.glyph}</span> : <KindIcon kind={kind} className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div data-element-name="" className="truncate text-plain font-semibold text-fg" title={shownName}>{shownName}</div>
            <div data-element-kind="" className="truncate text-small text-fg-muted">{isLabel ? (insideLink(node) ? "Label on a link" : "Label on a button") : kind}</div>
          </div>
          <Tooltip content={node.locked ? "Unlock" : "Lock position"}>
            <Button variant="ghost" size="iconXs" aria-label="Lock" onClick={() => update({ locked: !node.locked })}>
              {node.locked ? <Lock /> : <Unlock />}
            </Button>
          </Tooltip>
          {/* One Delete, not two. */}
          <Tooltip content="Delete">
            <Button variant="ghost" size="iconXs" aria-label="Delete" className="text-danger" onClick={() => useStudio.getState().removeNodes([node.id])}>
              <Trash2 />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {decision ? (
          <div data-part-decision={decision.why} className="mx-3 mt-3 space-y-1.5 rounded-md border p-2" style={{ borderColor: "oklch(0.74 0.18 55 / 0.6)", background: "oklch(0.74 0.18 55 / 0.08)" }}>
            <p className="flex items-start gap-1.5 text-small leading-snug text-fg">
              <span className="mt-px shrink-0 font-bold" style={{ color: "oklch(0.74 0.18 55)" }}>!</span>
              <span>This is {decisionSays(decision.why, kind)}.</span>
            </p>
            {decision.why === "nowhere" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-small text-fg-muted">Choose it under Links to, below, or:</span>
                <Button size="xs" variant="outline" data-nowhere-on-purpose="" onClick={() => { play("confirm"); update({ nowhere: true }); }}>It goes nowhere, on purpose</Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Recognised as one thing from its stacked parts: its options as one set, its layers one press away (`components.ts`). */}
        {comp ? null : partOf ? (
          <div data-layer-of={partOf.id} className="border-b border-border px-3 py-2 text-small text-fg-muted">
            A layer of {partOf.name}.{" "}
            <button type="button" className="tactile text-accent underline" onClick={() => { useStudio.getState().setSelection([partOf.id]); useStudio.getState().want({ panel: "inspector", id: partOf.id }); }}>Pick the whole {KIND_WORD[partOf.kind].toLowerCase()}</button>
          </div>
        ) : null}
        {node.featureId === "whats-new" ? (
          <PanelSection id="tour" title="What's new steps" icon={<Megaphone />} note={`${node.tour?.current.steps.length ?? 0} of 6`}>
            <TourEditor node={node} />
          </PanelSection>
        ) : null}

        <PanelSection id="content" title="Content" icon={<Type />} note={wordsOf(wordsHere ?? node) ? undefined : node.picture ? "a picture" : undefined}>
          {/* THE WORDS COME FIRST: they are what a first owner came to change.
              Two presses on the part land the caret here (`wanted`). */}
          {wordsHere ? (
            <WordsField node={wordsHere} content={{ label: "Its words" }} label={kind === "Button" ? "button" : "link"} alsoFor={node.id} />
          ) : feature?.content ? (
            <WordsField node={node} content={feature.content} label={isLabel ? (insideLink(node) ? "link" : "button") : undefined} />
          ) : null}
          {/* While it goes nowhere, the box at the top is where it is decided; the other half, saying what it should do, stays here. */}
          {control || decision?.why === "nowhere" ? <LinkField node={node} /> : null}
          {node.worn ? <WornWords node={node} /> : null}
          {!node.worn && (node.picture || feature?.id === "picture" || !wordsOf(wordsHere ?? node)) ? <PictureField node={node} /> : null}
          <WorkFields node={node} pick={(id) => !effectIds.has(id)} />
          {node.vector ? <Role node={node} /> : null}
          {node.featureId === "cube-3d" || (node.featureId === "mesh-3d" && node.cube) ? <Faces node={node} palette={palette} /> : null}
          {node.featureId === "cube-3d" || (node.featureId === "mesh-3d" && node.cube) ? <Solid node={node} palette={palette} /> : null}
          {/* The shelf item's versions, read off the item's data (`partOptions.ts`): switching one swaps the part that draws. */}
          <PartFields node={node} only={VERSION_ONLY} />
          {featureOptions.length ? (
            <div className="space-y-2">
              <div className="text-small font-medium uppercase tracking-wider text-fg-faint">Options</div>
              {featureOptions.map((opt) =>
                opt.kind === "set" ? (
                  <OptionSet key={opt.id} option={opt} value={node.options[opt.id]} onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })} />
                ) : opt.kind === "range" ? (
                  <OptionRange key={opt.id} option={opt} value={node.options[opt.id]} onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })} />
                ) : (
                  <div key={opt.id} className="flex items-center justify-between gap-2">
                    <span className="text-plain text-fg">{opt.label}</span>
                    <Select className="w-32" value={node.options[opt.id] ?? opt.values[0]!} onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                      options={opt.values.map((v) => ({ value: v, label: v }))} aria-label={opt.label} />
                  </div>
                ),
              )}
            </div>
          ) : null}
        </PanelSection>

        <PanelSection id="place" title="Position and size" icon={<Frame />} note={`${Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% wide`}>
          <div className="grid grid-cols-2 gap-1.5" data-place="">
            {(["x", "y", "w", "h"] as const).map((k) => {
              const word = k === "w" ? "Width" : k === "h" ? "Height" : k === "x" ? "Across" : "Down";
              return (
                <label key={k} className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-small text-fg-muted">{word}</span>
                  <Input
                    type="number"
                    inputSize="sm"
                    className="min-w-0 flex-1 px-1.5"
                    value={String(Math.round(node[k]))}
                    aria-label={k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      update({ [k]: k === "w" ? Math.max(40, v) : k === "h" ? Math.max(24, v) : v } as Partial<typeof node>);
                    }}
                  />
                </label>
              );
            })}
          </div>
          <p className="text-fine text-fg-faint">In pixels, from the page&apos;s top left corner.</p>
          <div className="flex gap-1">
            <Tooltip content="Span the whole page">
              <Button size="xs" variant="outline" className="flex-1" onClick={() => update({ x: 0, w: frameWidth })}>Full width</Button>
            </Tooltip>
            <Tooltip content="Against the left edge">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Flush left" onClick={() => update({ x: 0 })}><AlignLeft /></Button>
            </Tooltip>
            <Tooltip content="In the middle">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Centre" onClick={() => update({ x: Math.round((frameWidth - node.w) / 2) })}><AlignCenter /></Button>
            </Tooltip>
            <Tooltip content="Against the right edge">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Flush right" onClick={() => update({ x: frameWidth - node.w })}><AlignRight /></Button>
            </Tooltip>
          </div>
        </PanelSection>

        <PanelSection id="look" title="Look" icon={<PaletteIcon />} note={node.worn ? node.worn.kit.name : node.colour && Object.keys(node.colour).length ? "own colours" : undefined}>
          {/* Recognised as one thing from its stacked parts: its options as one set, its layers one press away (`components.ts`). */}
          {comp ? (
            <div data-component-block={comp.kind} className="space-y-1 border-b border-border pb-2">
              <div className="text-small font-semibold text-fg">This {KIND_WORD[comp.kind].toLowerCase()}</div>
              <ComponentFields comp={comp} nodes={nodes} />
            </div>
          ) : null}
          <RemixKept nodes={[node]} />
          <LookCopy node={node} targets={[node.id]} />
          <Field label="Styles" hint="This site's own styles. Point at one to see it on the part; click to put it on.">
            <KitStyles node={node} />
          </Field>
          <Field label="Make all like this" hint="Every part of this kind on the site, restyled to match, in one step.">
            <MakeAllLike node={node} />
          </Field>
          {/* A shape drawn wearing a style kit: its colour, style, lighting bar and outline (`DrawKits.tsx`). */}
          {node.worn ? <WornLook node={node} /> : null}
          {node.worn ? null : <>
          <Field label="Colour">
            <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} tryFor={node.id} />
          </Field>
          <FontField node={wordsHere ?? node} base={Number(format["type.baseSize"]) || 16} />
          <EdgeField node={node} />
          <Field label="Shape" hint="What the part is cut to.">
            <Segmented size="xs" value={node.shape ?? "box"} onChange={(v) => update({ shape: v === "box" ? null : (v as "circle") })}
              options={NODE_SHAPES.map((v) => ({ value: v, label: v }))} />
          </Field>
          <Field label="Mark" hint="Give a new idea its own mark so you can spot it on the board.">
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => update({ glyph: null })} className={cn("tactile size-6 rounded-sm border text-small", node.glyph === null ? "border-accent" : "border-border")}>
                <PaletteIcon className="mx-auto size-3" />
              </button>
              {GLYPHS.map((g) => (
                <button key={g} type="button" onClick={() => update({ glyph: g })} className={cn("tactile size-6 rounded-sm border text-xs", node.glyph === g ? "border-accent" : "border-border")}>{g}</button>
              ))}
            </div>
          </Field>
          </>}
        </PanelSection>

        <PanelSection id="motion" title="Motion" icon={<Play />} note={node.worn?.motion?.name}>
          {node.worn ? <WornMotion node={node} /> : <PartMotions node={node} />}
        </PanelSection>

        {/* EFFECTS: the ones that fit this kind of part, plain or as a site had them, with their settings (PartEffects.tsx). */}
        <PanelSection id="effects" title="Effects" icon={<Sparkles />} note={effectsOn ? `${effectsOn} on` : undefined}>
          <PartEffects node={node} kind={kind} nodes={nodes} />
        </PanelSection>

        <PanelSection id="save-component" title="Save as a component" icon={<Bookmark />} defaultOpen={false}>
          <SaveAsComponent node={node} kind={kind} />
        </PanelSection>

        <PanelSection id="prompt" title="Prompt" icon={<Pencil />} defaultOpen={false} note={(captured ? captured.rest : node.prompt).trim() ? "written" : "empty"}>
          <Field label="Prompt for this part" hint="Mention the parts beside it by name and the builder will keep them together.">
            {/* Where a captured part came from, said the way a person would: the
                site and the section, never the element path the capture used to
                find it. The path stays in the prompt the document keeps. */}
            {captured ? <span data-captured-from="" className="mb-1 block text-small text-fg-muted">{captured.says}</span> : null}
            <Textarea
              autoGrow
              rows={4}
              aria-label="Element prompt"
              value={captured ? captured.rest : node.prompt}
              placeholder={feature?.hint ?? `e.g. ${feature?.name ?? "This"} sits tight against the part on its left and shares its colour.`}
              onChange={(e) => update({ prompt: captured ? `${captured.prefix}${e.target.value}` : e.target.value })}
            />
          </Field>
          <Field label="Name">
            {/* A capture's own name for its box ("div · 1 inside") is not shown
                as if it were a name: the field is empty with the readable name
                as its placeholder, and typing gives the part a real one. */}
            <Input value={isMachineLabel(node.label) ? "" : node.label} placeholder={shownName} aria-label="Name" onChange={(e) => update({ label: e.target.value })} />
          </Field>
          <Field label="What it shows or does" hint="The values and actions the backend has to provide, in your words. Wires pointing at this part fill it in.">
            <Textarea autoGrow rows={2} aria-label="Data" value={node.data} placeholder="e.g. live coin price, trader profit and loss, time left, or: join duel" onChange={(e) => update({ data: e.target.value })} />
          </Field>
          <Field label="Priority">
            <Segmented size="xs" value={node.priority} onChange={(v) => update({ priority: v as "must" })}
              options={[{ value: "must", label: "Must have" }, { value: "nice", label: "Nice" }, { value: "idea", label: "Idea" }]} />
          </Field>
          {group ? (
            <Field label={`In the group ${group.label}`}>
              <Textarea autoGrow rows={2} value={group.prompt} placeholder="Prompt for the whole group…" onChange={(e) => useStudio.getState().updateGroup(group.id, { prompt: e.target.value })} />
            </Field>
          ) : null}
          {feature ? (
            <p data-element-means="" className="text-small leading-relaxed text-fg-muted">
              <Lightbulb className="mr-1 inline size-3 text-fg-faint" />
              {isLabel ? `The words on ${insideLink(node) ? "a link" : "a button"}: its label, kept on one line and read as part of the control.` : feature.blurb}
              {cat ? <span className="text-fg-faint"> ({cat.label})</span> : null}
            </p>
          ) : null}
        </PanelSection>

        {/* MAKE A PICTURE, closed. The model and its settings, for the one
            time in many a part is handed to a picture model. */}
        <PanelSection id="make-picture" title="Make a picture" icon={<ImageIconLucide />} defaultOpen={false} note={node.plan ? "set by you" : undefined}>
          {/* The one place a picture is made: draw one here and put it on
              this part. It was also a Generate tab, mostly empty, and a
              second "Draw one" on the picture field. */}
          <div data-make-picture="" className="-mx-3">
            <RenderPanel forNode={node.id} />
          </div>
          <div data-fold="make-picture">
            <Field label="Where a picture of this part is sent" hint="The route's own choice unless you say otherwise. Every option below is the model's own.">
              <AuditPanel node={node} />
            </Field>
          </div>
        </PanelSection>
      </div>
    </div>
  );
}

/** The face and size a part's words are set in, and a way to change both. */
function FontField({ node, base }: { node: StudioNode; base: number }) {
  const nodes = useStudio((s) => s.nodes);
  const carried = useStudio((s) => s.look.fonts);
  const pages = useStudio((s) => s.pages);
  /* The site's faces in page order, then any it carries that no part uses (`fontsInPageOrder`). */
  const faces = React.useMemo(() => [...new Set([...fontsInPageOrder(nodes, pages.map((p) => p.id)).map((f) => f.key).filter(Boolean), ...(carried ?? []).map((f) => f.family)])], [carried, nodes, pages]);
  if (!wordsOf(node) && !node.font) return null;
  const face = faceOf(node);
  const size = typeof node.font?.size === "number" ? node.font.size : 1;
  const set = (font: StudioNode["font"]) => useStudio.getState().updateNode(node.id, { font });
  return (
    <Field label="Font">
      <div className="flex items-center gap-1.5" data-part-font="">
        <Select
          className="min-w-0 flex-1"
          aria-label="Face"
          value={face || "site"}
          onChange={(v) => {
            const { stack: _s, face: _f, family: _fam, ...rest } = (node.font ?? {}) as NonNullable<StudioNode["font"]> & { stack?: unknown };
            void _s; void _f; void _fam;
            set(v === "site" ? (Object.keys(rest).length ? rest : null) : { ...rest, face: v });
          }}
          options={[{ value: "site", label: "The site's type" }, ...faces.map((f) => ({ value: f, label: f }))]}
        />
        <Input
          type="number"
          inputSize="sm"
          className="w-16 px-1.5"
          aria-label="Size in pixels"
          value={String(Math.round(base * size))}
          onChange={(e) => { const px = Number(e.target.value); if (Number.isFinite(px) && px > 0) set({ ...(node.font ?? {}), size: px / base }); }}
        />
        <span className="text-small text-fg-muted">px</span>
      </div>
    </Field>
  );
}

const toHexish = (v: string | undefined) => { const c = v ? parseColor(v) : null; return c ? toHex(c) : "#000000"; };

/** This part's border and shadow. */
function EdgeField({ node }: { node: StudioNode }) {
  const edge = node.edge ?? null;
  const set = (patch: Partial<NonNullable<StudioNode["edge"]>> | null) => useStudio.getState().updateNode(node.id, { edge: patch === null ? null : { ...(edge ?? {}), ...patch } });
  const width = edge?.style === "none" ? 0 : edge?.width ?? 0;
  return (
    <>
      <Field label="Border">
        <div className="flex items-center gap-1.5" data-part-border="">
          <Input type="number" inputSize="sm" className="w-14 px-1.5" aria-label="Border width in pixels" value={String(width)}
            onChange={(e) => { const w = Number(e.target.value); if (Number.isFinite(w) && w >= 0) set({ width: w, style: w ? (edge?.style && edge.style !== "none" ? edge.style : "solid") : "none" }); }} />
          <span className="text-small text-fg-muted">px</span>
          <Select className="min-w-0 flex-1" aria-label="Border style" value={edge?.style && edge.style !== "none" ? edge.style : "solid"}
            onChange={(v) => set({ style: v as "solid", width: width || 1 })}
            options={["solid", "dashed", "dotted", "double"].map((v) => ({ value: v, label: v }))} />
          <input type="color" aria-label="Border colour" className="h-7 w-8 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent"
            value={toHexish(edge?.colour)} onChange={(e) => set({ colour: e.target.value, width: width || 1, style: edge?.style && edge.style !== "none" ? edge.style : "solid" })} />
        </div>
      </Field>
      <Field label="Shadow">
        <div className="flex items-center gap-1.5" data-part-shadow="">
          <span className="min-w-0 flex-1 truncate text-small text-fg-muted">{edge?.shadow ? "A shadow the page gave it" : "None"}</span>
          {edge?.shadow ? <Button size="xs" variant="outline" onClick={() => set({ shadow: undefined })}>Remove</Button>
            : <Button size="xs" variant="outline" onClick={() => set({ shadow: "0 6px 18px rgb(0 0 0 / 0.25)" })}>Add a soft one</Button>}
        </div>
      </Field>
    </>
  );
}

/** This part's own motions: the rows the Motion tab lists for it, with the same controls. */
function PartMotions({ node }: { node: StudioNode }) {
  const nodes = useStudio((s) => s.nodes);
  const crates = useStudio((s) => s.motion);
  const rows = React.useMemo(() => movingParts(nodes, crates, node.pageId).filter((r) => r.nodeId === node.id), [nodes, crates, node.pageId, node.id]);
  const [note, setNote] = React.useState<{ key: string; says: string } | null>(null);
  if (!rows.length) {
    return <p className="text-small leading-snug text-fg-muted">This part does not move. Motions from the shelf&apos;s Motion category, or the wheel&apos;s Animation piece, put one on it.</p>;
  }
  return (
    <div className="space-y-1" data-part-motions="">
      {rows.map((r) => <MoveRowView key={r.key} row={r} selected note={note?.key === r.key ? note.says : null} onNote={(says) => setNote(says ? { key: r.key, says } : null)} />)}
    </div>
  );
}

/** Where a part sends people. Pages by name, or a web address. */
/**
 * The six faces of a cube, listed.
 *
 * A cube is the first part whose content is not one field, and the reason
 * it is here rather than in the part is that a part is a component a
 * generated site ships: it draws what it is given and never edits the
 * document. So the editing lives in the panel, all six faces at once,
 * because "which side is that on" is the only question anyone has, and
 * every change is one write to the node.
 */
/**
 * What a drawing is for, asked rather than guessed.
 *
 * A traced drawing is a shape with no purpose yet. The words choose a role
 * when they say one — "a bird icon" is an icon — and when they say nothing
 * this asks, with all three offered and none of them preselected. A bird
 * that quietly became an icon when it was meant to be a frame is worse
 * than a bird with no role yet, so nothing is chosen on the author's
 * behalf and the panel says so in as many words.
 */
function Role({ node }: { node: StudioNode }) {
  const set = (role: VectorRole | null) => {
    play(role ? "confirm" : "close");
    useStudio.getState().updateNode(node.id, {
      role,
      // An icon is a part of its own; the other two are what the part it
      // is already does, so only this one changes what it is.
      ...(role === "icon" && node.featureId !== "drawn-icon" ? { featureId: "drawn-icon", outline: null, shape: null } : {}),
    });
  };
  const kept = simplify(node.vector!, 6);
  return (
    <Field
      label="What the drawing is for"
      hint={node.role
        ? ROLE_MEANS[node.role]
        : "Nothing has been chosen, and nothing will be chosen for you. Pick one."}
    >
      <div className="flex flex-col gap-1.5" data-role-picker="">
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              data-role={r}
              aria-pressed={node.role === r}
              onClick={() => set(node.role === r ? null : r)}
              className={cn("tactile rounded-md border px-2 py-1 text-small capitalize", node.role === r ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-fine leading-snug text-fg-faint">
          {weigh(node.vector!).paths} paths traced, {kept.paths.length} kept for an icon. Drop an icon onto a button and the
          button wears it.
        </p>
      </div>
    </Field>
  );
}

/** The colours a face may be: the site's, or one of the roles it already has. */
const FACE_COLOURS = [
  { id: "", label: "site" },
  { id: "surface", label: "surface" },
  { id: "bg", label: "background" },
  { id: "accent", label: "accent" },
  { id: "highlight", label: "highlight" },
  { id: "muted", label: "muted" },
] as const;

function Faces({ node, palette }: { node: StudioNode; palette: Record<string, string> | null }) {
  const set = useStudio((s) => s.setCubeFace);
  /*
   * Every page but the one the cube is standing on. A surface showing the
   * page it is part of is a mirror, so it is not offered — the cube would
   * draw nothing there and the face would fall back to its words, which
   * looks like a bug rather than a rule.
   */
  const pages = useStudio((s) => s.pages);
  const sites = React.useMemo(() => pages.filter((p) => p.id !== node.pageId), [pages, node.pageId]);
  const picked = useStudio((s) => (s.pickedFace?.nodeId === node.id ? s.pickedFace.side : null));
  const faces = React.useMemo(() => CUBE_SIDES.map((_, i) => node.cube?.faces?.[i] ?? emptyFace()), [node.cube]);
  const filled = written(node.cube);
  /*
   * A face picked on the board is the one the panel is about: its card
   * comes into view and its heading takes the keys, so "pick a face and
   * give it words" is one press and then typing.
   */
  const cards = React.useRef<Record<string, HTMLDivElement | null>>({});
  const was = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!picked || picked === was.current) { was.current = picked; return; }
    was.current = picked;
    const card = cards.current[picked];
    if (!card) return;
    // Picked from the board: bring the card in and hand it the keys. Picked
    // from inside the card, the keys are already where they belong.
    if (card.contains(document.activeElement)) return;
    card.scrollIntoView({ block: "nearest" });
    const input = card.querySelector("input") as HTMLInputElement | null;
    input?.focus({ preventScroll: true });
  }, [picked]);
  return (
    <Field
      label="Faces"
      hint={`${filled} of six written. A face left blank stays blank: nothing is invented for it. Press a face on the cube, or its name here, to pick it. A face given a page becomes that page — the page's own parts on the side of the box, and a press goes there.`}
    >
      <div className="flex flex-col gap-2" data-face-list="">
        {CUBE_SIDES.map((side, i) => {
          const face = faces[i]!;
          const bare = !face.heading.trim() && !face.body.trim() && !face.pageId;
          const on = picked === side;
          return (
            <div
              key={side}
              ref={(el) => { cards.current[side] = el; }}
              data-cube-face={side}
              data-face-picked={on ? "" : undefined}
              className={cn("rounded-md border bg-elevated/40 p-2", on ? "border-accent" : "border-border")}
              // Typing on a face is pointing at it; a press on one of its
              // buttons is not, so the card does not move under the press.
              onFocusCapture={(e) => { if (!on && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) useStudio.getState().pickFace(node.id, side); }}
            >
              <div className="mb-1 flex items-center gap-2">
                <button
                  type="button"
                  data-pick-face={side}
                  aria-pressed={on}
                  aria-label={`Pick the ${side} face`}
                  onClick={() => { play(on ? "close" : "tap"); useStudio.getState().pickFace(node.id, on ? null : side); }}
                  className={cn("tactile rounded-sm px-1 text-small uppercase tracking-[0.14em]", on ? "text-fg" : "text-fg-faint hover:text-fg")}
                >
                  {side}
                </button>
                {bare ? <span className="text-fine text-fg-faint">empty</span> : null}
                {on ? <span className="text-fine text-accent">picked</span> : null}
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Clear the ${side} face`}
                  disabled={bare && !face.colour && !(face.prompt ?? "").trim() && !face.pageId}
                  onClick={() => set(node.id, i, null)}
                  className="tactile rounded-sm border border-border px-1.5 py-0.5 text-fine text-fg-muted disabled:opacity-40 hover:text-fg"
                >
                  clear
                </button>
              </div>
              <Input
                inputSize="sm"
                aria-label={`${side} heading`}
                value={face.heading}
                placeholder="Heading"
                onChange={(e) => set(node.id, i, { heading: e.target.value })}
              />
              <Textarea
                autoGrow
                rows={1}
                className="mt-1"
                aria-label={`${side} body`}
                value={face.body}
                placeholder="A line or two"
                onChange={(e) => set(node.id, i, { body: e.target.value })}
              />
              {/* The face's own prompt, exactly as any part has one: what
                  this side is for, for whoever builds the site. */}
              <Textarea
                autoGrow
                rows={1}
                className="mt-1"
                aria-label={`${side} prompt`}
                data-face-prompt={side}
                value={face.prompt ?? ""}
                placeholder="What this face is for"
                onChange={(e) => set(node.id, i, { prompt: e.target.value })}
              />
              {/* A surface is a page. Given one, this side stops being a
                  card with words on it and becomes that page, drawn at the
                  face's size; its heading and body wait behind it and come
                  back the moment the page is taken off. */}
              {sites.length ? (
                <div className="mt-1 flex flex-wrap items-center gap-1" data-face-pages={side}>
                  <span className="text-fine uppercase tracking-[0.14em] text-fg-faint">page</span>
                  <button
                    type="button"
                    data-pick-page="none"
                    aria-pressed={!face.pageId}
                    onClick={() => { play("close"); set(node.id, i, { pageId: null }); }}
                    className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", !face.pageId ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
                  >
                    none
                  </button>
                  {sites.map((p) => {
                    const on = face.pageId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-pick-page={p.id}
                        aria-pressed={on}
                        onClick={() => { play(on ? "close" : "confirm"); set(node.id, i, { pageId: on ? null : p.id }); }}
                        className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", on ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {face.pageId ? (
                <p className="mt-1 text-fine leading-snug text-fg-faint">
                  This side is the page. Its heading and body are kept and come back when the page is taken off.
                </p>
              ) : null}
              {/* One colour, named as a role, so a face stays inside the
                  site's palette rather than becoming a colour nobody can
                  find again. */}
              <div className="mt-1 flex flex-wrap gap-1">
                {FACE_COLOURS.map((role) => {
                  const is = (face.colour || "") === role.id;
                  return (
                    <button
                      key={role.id || "site"}
                      type="button"
                      aria-label={`${side} face, ${role.label}`}
                      aria-pressed={is}
                      onClick={() => set(node.id, i, { colour: role.id })}
                      className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", is ? "border-accent text-fg" : "border-border text-fg-faint hover:text-fg")}
                      style={role.id && palette?.[role.id] ? { boxShadow: `inset 3px 0 0 ${palette[role.id]}` } : undefined}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

/**
 * Does this browser, or the server, hold a Replicate token?
 *
 * Asked once, and again whenever the keys panel changes: the control it lights
 * is the one control on this panel that spends money.
 */
function useRendererReady(): boolean | null {
  const [ready, setReady] = React.useState<boolean | null>(null);
  const unlocked = useKeys((s) => s.unlocked);
  const held = useKeys((s) => !!s.values.REPLICATE_API_TOKEN);
  React.useEffect(() => {
    let live = true;
    void rendererReady(true).then((v) => { if (live) setReady(v); });
    return () => { live = false; };
  }, [unlocked, held]);
  return ready;
}

/**
 * The model road, behind the table.
 *
 * The cube needs no key and is the whole thing. This card is the road past
 * it: the same two-axis table that routes every picture routes a box to
 * the one model that returns a solid, and the button is lit the moment a
 * token is present. Without one it says what would light it, and nothing
 * on the cube is missing.
 */
function Solid({ node, palette }: { node: StudioNode; palette: Record<string, string> | null }) {
  const ready = useRendererReady();
  const model = React.useMemo(() => solidModel(), []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const isMesh = node.featureId === "mesh-3d";
  const go = async () => {
    play("confirm");
    setSaid(null);
    const r = await makeSolid(node.id, palette ?? {}, { onStep: setBusy });
    setBusy(null);
    setSaid(r.message);
    play(r.ok ? "confirm" : "deny");
  };
  return (
    <Field
      label="As a solid"
      hint={model ? `Routed to ${model.name} the moment a Replicate token is present: the four sides go up as pictures and a mesh comes back.` : "No model in the table returns a solid yet."}
    >
      <div className="flex flex-col gap-1.5" data-solid-card="" data-solid-ready={ready === null ? "asking" : ready ? "yes" : "no"} data-solid-model={model?.slug ?? ""}>
        {isMesh ? (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" data-solid-back="" onClick={() => { play("tap"); showCube(node.id); }}>Back to the cube</Button>
          </div>
        ) : ready ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" data-solid-make="" disabled={!!busy || !model} onClick={() => void go()}>{busy ?? "Make it a solid"}</Button>
            {node.mesh?.glb ? <Button size="sm" variant="outline" data-solid-show="" onClick={() => { play("tap"); showSolid(node.id); }}>Show the solid made before</Button> : null}
          </div>
        ) : (
          <p className="text-small leading-snug text-fg-muted" data-solid-needs="">
            {ready === null ? "Checking for a Replicate token…" : "No Replicate token yet. Paste one under Keys (⌘⇧K) and this lights up. Until then the cube is the whole thing: it turns, it takes words on every face, and nothing is missing from it."}
          </p>
        )}
        {said ? <p className="text-small leading-snug text-fg-faint" data-solid-said="">{said}</p> : null}
      </div>
    </Field>
  );
}

function LinkField({ node }: { node: StudioNode }) {
  const pages = useStudio((s) => s.pages);
  // A link drawn as an arrow points at another part; it is named here by
  // that part's name, where before no UI showed it at all.
  const other = useStudio((s) => (node.link?.kind === "node" ? s.nodes.find((n) => n.id === node.link!.target) ?? null : null));
  const nodesHere = useStudio(useShallow(pageNodes));
  const sections = React.useMemo(() => nodesHere.filter((n) => n.id !== node.id && kindWord(n) === "Section").sort((a, b) => a.y - b.y), [nodesHere, node.id]);
  const link = node.link;
  const toSection = link?.kind === "node" && sections.some((n) => n.id === link.target);
  const value = !link ? "none" : link.kind === "page" ? `page:${link.target}` : link.kind === "url" ? "url" : toSection ? `node:${link.target}` : "node";
  const set = (l: StudioNode["link"]) => useStudio.getState().updateNode(node.id, { link: l });
  return (
    <Field label="Links to" hint="Where this sends people in the live preview and the finished site.">
      <div data-link-field="">
      <Select
        value={value}
        onChange={(v) => (v === "none" ? set(null) : v === "url" ? set({ kind: "url", target: link?.kind === "url" ? link.target : "https://" }) : v === "node" ? undefined : v.startsWith("node:") ? set({ kind: "node", target: v.slice(5) }) : set({ kind: "page", target: v.slice(5) }))}
        options={[
          { value: "none", label: "Nowhere" },
          ...pages.map((p) => ({ value: `page:${p.id}`, label: `${p.name}  ${p.path}` })),
          ...sections.map((n) => ({ value: `node:${n.id}`, label: `Section: ${partName(n, nodesHere, featureName).replace(/^Section\s+/, "")}` })),
          { value: "url", label: "Web address…" },
          ...(link?.kind === "node" && !toSection ? [{ value: "node", label: `The part ${other?.label ?? link.target}, on this page` }] : []),
        ]}
        aria-label="Links to"
      />
      {link?.kind === "node" && !toSection ? (
        <p className="mt-1 text-small leading-snug text-fg-faint" data-link-node="">
          Drawn as an arrow to the part {other?.label ?? link.target}: pressing this scrolls to it. Pick a page or an address above to send people elsewhere.
        </p>
      ) : null}
      </div>
      {link?.kind === "url" ? (
        <Input className="mt-1.5" value={link.target} placeholder="https://" aria-label="Web address" onChange={(e) => set({ kind: "url", target: e.target.value })} />
      ) : null}
      {!link ? <WorkField node={node} /> : null}
    </Field>
  );
}

/**
 * The other thing a button that points nowhere can be: one that DOES something.
 *
 * HIS WORDS: "a drawn button if not linked to something should offer options
 * of a web link, prompt for backend to fill in, like a button i draw, I can
 * title it 'buy' and then i say 'swap route aggregator through jupiter or
 * specific exchange or platform via trading wallet' and it builds the backend
 * required to make it work where this exact button is."
 *
 * So the two are offered together, and only while it points nowhere: once it
 * sends people somewhere, asking what it should do instead is asking a
 * question he has already answered.
 *
 * What he writes goes on the part's own `data`, which is the field this app
 * already defines as "what it shows or does — the values and actions the
 * backend must provide". It is not a note about the button: it is the work,
 * and it is sited at the button because it lives on it, which is what the
 * backend surface reads when it builds.
 */
function WorkField({ node }: { node: StudioNode }) {
  const says = node.data ?? "";
  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="mb-1 text-small leading-snug text-fg-muted">
        Or say what it should <em>do</em>, and the backend for it is built here, on this button.
      </p>
      <Textarea
        data-backend-ask=""
        rows={3}
        value={says}
        aria-label="What this button should do"
        placeholder={"swap route aggregator through jupiter or specific exchange or platform via trading wallet"}
        onChange={(e) => useStudio.getState().updateNode(node.id, { data: e.target.value })}
      />
      {says.trim() ? (
        <p data-backend-sited="" className="mt-1 text-small leading-snug text-fg-faint">
          The backend builds this where this button is.
        </p>
      ) : null}
    </div>
  );
}

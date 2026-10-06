"use client";
import { isKeptVersion, openRemake, PictureVersions } from "../RemakePicture";
import * as React from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { getFeature, type FeatureOption } from "../catalog";
import { HUES, useHeldStudio, useStudio, type StudioNode } from "../store";
import { drop as dropPicture, put as putPicture, usePicture } from "../pictures";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Slider } from "@/core/ui/slider";
import { plain, reword } from "../parts/spans";
import { growToWords } from "../growToWords";

/** The Element panel draws only the Version row from the fields data; its other rows are its own. */
export const VERSION_ONLY = ["version"] as const;

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

export function OptionSet({ option, value, onChange }: { option: FeatureOption; value?: string; onChange: (v: string) => void }) {
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
export function WordsField({ node, content, label, alsoFor }: { node: StudioNode; content: { label: string; placeholder?: string }; label?: "link" | "button"; alsoFor?: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const wanted = useHeldStudio((s) => s.wanted);
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

export function PictureField({ node }: { node: StudioNode }) {
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
          <Button variant="ghost" size="xs" disabled={busy} data-draw-one="" onClick={() => useStudio.getState().want({ panel: "pictures" })}>
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

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
export const featureName = (id: string) => getFeature(id)?.name;

/** Parts that are words: inside a button or a link they are its label. */
export const TEXTY = new Set(["prose", "eyebrow-rule", "highlight", "heading-scale", "fluid-type"]);
/** Options that mean nothing on a control's label: a label is one line. */
export const LABEL_HIDES = new Set(["measure"]);
/** A feature option that is the part's look ("Look": solid, outline, ghost), shown in the Look section, not under Content. */
export const isLookOption = (o: FeatureOption) => /^(variant|look|style|tone|theme)$/i.test(o.id) || /^look$/i.test(o.label);
export const insideLink = (n: StudioNode) => /(^|>)\s*a(\b|[.:#[])/.test(n.from?.selector ?? "") || /computes it as an? link/i.test(n.prompt) || (!!n.link && !/(^|>)\s*button\b/.test(n.from?.selector ?? ""));

/**
 * A closed section with a one-line head: what the side panel folds away so
 * the things a person came for sit at the top. Remembers being opened for
 * the length of the visit, so a person who opened it once is not made to
 * open it again on every part.
 */
export const OPENED = new Set<string>();
export function Fold({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
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

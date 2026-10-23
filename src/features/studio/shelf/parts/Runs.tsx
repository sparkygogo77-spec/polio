"use client";
/**
 * A sentence drawn as the runs it is made of.
 *
 * HIS LINE: a Solana mark, "$118.35", a down arrow, "-0.46%" — one sentence,
 * several colours, on one line. And his header, "A Sol Works project", where
 * "Works" is a different face. Both arrived as separate parts, each with its
 * own box, its own wrap and its own alignment, which is why the line fell
 * apart and why "A Sol" wrapped inside a box too short for it.
 *
 * ONE COMPONENT, because the alternative is every part that draws words
 * growing its own idea of what a run is. A part hands its runs here and gets
 * inline spans back — no block, no wrapper, nothing that could introduce a
 * break the browser would not have made. What decides where the line breaks
 * is the browser, reading one continuous run of inline content, exactly as
 * it does on his own site.
 *
 * A run says only what differs from the part around it. Absent means "what
 * this part would have drawn anyway", so an unstyled run inherits the
 * part's colour, weight and face rather than being given them again here —
 * which is what keeps a plain string rendering byte for byte as it did
 * before any of this existed.
 */
import * as React from "react";
import type { Theme } from "./theme";
import { hasLetters, type Span } from "./spans";
import { animationsValue } from "./capturedMotion";
import type { NodeLink, PartMode } from "./types";
import { FAMILY } from "./theme";

export interface RunsProps {
  spans: readonly Span[];
  t: Theme;
  /** Live, a run that points somewhere is pressable. On the board it is words. */
  mode?: PartMode;
  onNavigate?: (link: NodeLink) => void;
}

/**
 * The style a run wears, or nothing at all.
 *
 * Nothing at all is the important case: a run that says nothing gets no
 * `<span>` attributes of its own, so the words sit in the part's own type
 * exactly as they did when the content was a flat string.
 */
/**
 * A colour a run named: one of the six roles, or a literal of his own.
 *
 * Resolved off the THEME rather than off a palette, because the theme is
 * this part's own six roles with any override the node made already applied
 * — so a run naming "accent" follows the part it is inside, not the site it
 * was captured from. It also keeps `parts/` self-contained, which is the
 * folder's rule: what ships with a generated site cannot reach outward.
 */
const ROLE_INK: Record<string, (t: Theme) => string> = {
  bg: (t) => t.bg, surface: (t) => t.surface, text: (t) => t.text,
  muted: (t) => t.muted, accent: (t) => t.accent, highlight: (t) => t.highlight,
};
function ink0f(raw: string, t: Theme): string {
  const v = raw.trim();
  if (!v) return "";
  const role = ROLE_INK[v];
  /* Anything that is not a role is his own literal and goes through as it
     was measured: a browser reported it, and a browser will read it back. */
  return role ? role(t) : v;
}

function look(s: Span, t: Theme, mode?: PartMode): React.CSSProperties | undefined {
  const out: React.CSSProperties = {};
  let any = false;
  /* A captured letter: its own size and effects, its transform, and live its own animation. A transform needs a box, so it stands inline-block. */
  if (typeof s.size === "number" && Number.isFinite(s.size) && s.size > 0) { out.fontSize = s.size; any = true; }
  if (s.textShadow) { out.textShadow = s.textShadow; any = true; }
  if (s.textStroke && s.textStroke.w > 0) { out.WebkitTextStroke = `${s.textStroke.w}px ${s.textStroke.color}`; any = true; }
  if (s.paintOrder) { out.paintOrder = s.paintOrder; any = true; }
  /* Words painted with a gradient clipped to their letters, over their transparent ink, on every line they wrap onto: thesolface's "MAP" and "FROG" were invisible without it (tests/run-fill.mjs). */
  if (s.fill?.image && s.fill.clip === "text") {
    out.backgroundImage = s.fill.image;
    out.backgroundClip = "text";
    (out as Record<string, string>).WebkitBackgroundClip = "text";
    out.boxDecorationBreak = "clone";
    (out as Record<string, string>).WebkitBoxDecorationBreak = "clone";
    any = true;
  }
  const anim = mode === "live" ? animationsValue(s.motion?.animation) : null;
  if ((s.transform && s.transform !== "none") || anim) {
    out.display = "inline-block";
    if (s.transform && s.transform !== "none") out.transform = s.transform;
    if (anim) out.animation = anim;
    any = true;
  }
  if (s.colour) { const ink = ink0f(s.colour, t); if (ink) { out.color = ink; any = true; } }
  if (typeof s.weight === "number" && Number.isFinite(s.weight)) { out.fontWeight = Math.round(Math.max(300, Math.min(800, s.weight)) / 100) * 100; any = true; }
  if (s.italic) { out.fontStyle = "italic"; any = true; }
  /* The face by its real name, with the part's own stack behind it: where
     the file is on this machine it draws in it, and where it is not the
     part's face draws rather than a browser default. */
  /* Or one of the app's own families by its plain name ("serif", "monospace"), as the Font control offers them: its stack, not a face called "serif". */
  if (s.face) { const name = s.face.replace(/['"]/g, "").trim(); out.fontFamily = FAMILY[name] ?? `'${name}', ${t.bodyFamily}`; any = true; }
  if (s.space?.length === 2) { if (s.space[0]) out.marginLeft = s.space[0]; if (s.space[1]) out.marginRight = s.space[1]; any = true; }
  /* A chip in the sentence: its own fill, padding and rounding, on every line it wraps onto (tests/run-chip.mjs). */
  if (s.bg) {
    out.backgroundColor = s.bg;
    if (s.pad?.length === 4) out.padding = s.pad.map((v) => `${v}px`).join(" ");
    if (s.radius) out.borderRadius = s.radius;
    out.boxDecorationBreak = "clone";
    (out as Record<string, string>).WebkitBoxDecorationBreak = "clone";
    any = true;
  }
  return any ? out : undefined;
}

/**
 * A line break inside a run drawn as one. A captured title keeps its page's
 * `<br>` as "\n" in its words (sunkcoin.fun's "The coin that pays\nyour sunk
 * cost."), and a heading draws its runs straight, without `lines()`: in
 * ordinary white space that "\n" would collapse to a space.
 */
function broken(text: string): React.ReactNode {
  if (!text.includes("\n")) return text;
  const bits = text.split("\n");
  return bits.map((b, i) => <React.Fragment key={i}>{i ? <br /> : null}{b}</React.Fragment>);
}

export function Runs({ spans, t, mode, onNavigate }: RunsProps) {
  const drawn = spans.map((s, i) => one(s, i, t, mode, onNavigate));
  /*
   * A title's letters are inline-blocks, and a line may break between any
   * two inline-blocks: "MORTY" broke after its M. So each word's letters are
   * held together, and the line breaks only at the spaces between words, as
   * the page's did.
   */
  if (!hasLetters(spans as Span[])) return <>{drawn}</>;
  const out: React.ReactNode[] = [];
  let word: React.ReactNode[] = [];
  const close = () => { if (word.length) out.push(<span key={`w${out.length}`} style={{ whiteSpace: "nowrap" }}>{word}</span>); word = []; };
  /* Only letters are held: a run with spaces in it (words typed after the title, `spans.ts#reword`) breaks at them, or it
     was one line 3,900px long (tests/letters-typed-plain.mjs). */
  spans.forEach((s, i) => { if (/\s/.test(s.text)) { close(); out.push(drawn[i]); } else word.push(drawn[i]); });
  close();
  return <>{out}</>;
}

/** One run, as the part draws it. */
function one(s: Span, i: number, t: Theme, mode: PartMode | undefined, onNavigate: RunsProps["onNavigate"]): React.ReactNode {
      {
        const style = look(s, t, mode);
        /* A brought-in page's hook, on the live page only: the board shows the words, the page's code finds the run. */
        const own = mode === "live" && s.hooks ? s.hooks : null;
        /* A letter that moves wears the class reduced motion stills (capturedMotion.ts). */
        const moving = !!style?.animation;
        const to = s.link;
        if (to && mode === "live" && onNavigate) {
          /* `data-run-to` is where it goes, written on the run itself so the
             export can make it a real href without pairing runs by order. */
          return (
            <span
              key={i}
              {...own}
              data-run-link={to.kind}
              data-run-to={to.target}
              role="link"
              tabIndex={0}
              style={{ ...style, cursor: "pointer", ...(s.bare ? {} : { textDecoration: "underline", textUnderlineOffset: 2 }) }}
              onClick={(e) => { e.stopPropagation(); onNavigate(to); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onNavigate(to); } }}
            >
              {s.text}
            </span>
          );
        }
        /*
         * On the board a run that points somewhere is WORDS: the board is a
         * layout surface and nothing on it takes a press. It carries the
         * same mark as the live one, so "which runs are links" is one
         * question with one answer on both surfaces rather than two
         * attributes that can drift apart.
         *
         * And a run that says nothing gets no element at all: no attributes,
         * no style, the words straight in, so nothing about being stored as
         * runs can change how they set.
         */
        if (to) return <span key={i} {...own} data-run-link={to.kind} data-run-to={to.target} style={style}>{broken(s.text)}</span>;
        if (own) return <span key={i} {...own} className={moving ? "mo-l" : undefined} style={style ?? undefined}>{broken(s.text)}</span>;
        return style ? <span key={i} className={moving ? "mo-l" : undefined} style={style}>{broken(s.text)}</span> : <React.Fragment key={i}>{broken(s.text)}</React.Fragment>;
      }
}

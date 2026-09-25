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
import type { Span } from "./spans";
import type { NodeLink, PartMode } from "./types";

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

function look(s: Span, t: Theme): React.CSSProperties | undefined {
  const out: React.CSSProperties = {};
  let any = false;
  if (s.colour) { const ink = ink0f(s.colour, t); if (ink) { out.color = ink; any = true; } }
  if (typeof s.weight === "number" && Number.isFinite(s.weight)) { out.fontWeight = Math.round(Math.max(300, Math.min(800, s.weight)) / 100) * 100; any = true; }
  if (s.italic) { out.fontStyle = "italic"; any = true; }
  /* The face by its real name, with the part's own stack behind it: where
     the file is on this machine it draws in it, and where it is not the
     part's face draws rather than a browser default. */
  if (s.face) { out.fontFamily = `'${s.face.replace(/['"]/g, "")}', ${t.bodyFamily}`; any = true; }
  return any ? out : undefined;
}

export function Runs({ spans, t, mode, onNavigate }: RunsProps) {
  return (
    <>
      {spans.map((s, i) => {
        const style = look(s, t);
        const to = s.link;
        if (to && mode === "live" && onNavigate) {
          /* `data-run-to` is where it goes, written on the run itself so the
             export can make it a real href without pairing runs by order. */
          return (
            <span
              key={i}
              data-run-link={to.kind}
              data-run-to={to.target}
              role="link"
              tabIndex={0}
              style={{ ...style, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
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
        if (to) return <span key={i} data-run-link={to.kind} data-run-to={to.target} style={style}>{s.text}</span>;
        return style ? <span key={i} style={style}>{s.text}</span> : <React.Fragment key={i}>{s.text}</React.Fragment>;
      })}
    </>
  );
}

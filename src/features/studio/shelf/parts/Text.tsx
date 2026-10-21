"use client";
/**
 * Words, and how they are set. Everything here honours the type settings in
 * the Format panel: size, line height, measure, alignment and box style.
 */
import * as React from "react";
import { Fill, useTicker } from "./primitives";
import { hash, rng, sample, unwritten } from "./sample";
import { boxStyles, cardStyle, FAMILY, items, titled, tint } from "./theme";
import { num, opt, type PartProps } from "./types";
import { Runs } from "./Runs";
import { lines } from "./spans";
import { useKeepLines } from "../../textFit";

/**
 * IN THE MIDDLE OF ITS BAND, BY ITS DRAWN CAPITALS. A line told to sit in
 * the middle of its band (`applyBand`) is one em tall and moved by how far
 * its capitals' ink sits off that em's middle, read off the face itself
 * (`measureText` on the line's own capitals and figures): a face's declared
 * cap height is not its letters' (Luckiest Guy's left the owner's red ribbon
 * 1.5px high). In em, so type that grows with the window keeps it. 0 until
 * the face has loaded. `tests/ribbon-band.mjs`.
 */
function useCapsNudge(on: boolean, family: string, weight: number | undefined, size: number, text: string): number {
  const font = `${weight ?? 400} ${size}px ${family}`;
  const [loaded, setLoaded] = React.useState(0);
  React.useEffect(() => {
    if (!on || typeof document === "undefined" || !document.fonts) return;
    let live = true;
    document.fonts.load(font, text.slice(0, 80)).then(() => { if (live) setLoaded((n) => n + 1); }, () => {});
    return () => { live = false; };
  }, [on, font, text]);
  /* Read while drawing, not after: the published page is written from one drawing, with no second pass. */
  return React.useMemo(() => {
    if (!on || typeof document === "undefined") return 0;
    const g = document.createElement("canvas").getContext("2d");
    if (!g) return 0;
    g.font = font;
    const m = g.measureText((text.match(/[A-Z0-9]/g) ?? ["H"]).slice(0, 80).join(""));
    const base = (size - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    const middle = base + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    return +((size / 2 - middle) / size).toFixed(4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, font, size, text, loaded]);
}
const capsOnly = (t: { band?: { middle: boolean } }, nudge: number): React.CSSProperties => (t.band?.middle ? { lineHeight: 1, position: "relative", top: `${nudge}em` } : {});

/** Paragraphs, quotes, drop caps, highlights — one component, several looks. */
export function Prose({ id, content, spans, theme: t, mode, onNavigate, w, h }: PartProps) {
  // Paragraphs break on lines, and only on lines. A comma inside prose is
  // punctuation, not a separator: "for the builders, believers, and bold
  // thinkers" was being drawn as three paragraphs, one clause each, which is
  // what the shared comma split does to every real sentence it is given.
  const typed = content.split("\n").map((x) => x.trim()).filter(Boolean);
  /*
   * The same paragraphs, as runs, when the node carries runs. Cut on lines
   * by `lines()` — which never lets a run straddle a newline — so a
   * paragraph's ink survives the split that used to lose it. Empty when the
   * node's words are a plain string, and then everything below is untouched.
   */
  const runParas = spans?.length ? lines(spans).filter((l) => l.length > 0) : null;
  const paras = typed.length ? typed : [unwritten(mode, () => sample.sentence(rng(hash(id)), 22), "", t.published), unwritten(mode, () => sample.sentence(rng(hash(id + "2")), 18), "", t.published)];
  const quote = id === "pull-quote";
  const dropCap = id === "drop-cap";
  const kinetic = id === "kinetic-type";
  const [word, setWord] = React.useState(0);
  const firstWords = String(paras[0] ?? "").split(" ");
  useTicker(mode, 300, () => setWord((v) => (v + 1) % Math.max(1, firstWords.length)), kinetic);

  const nudge = useCapsNudge(!!t.band?.middle, t.bodyFamily, t.fontWeight, t.fontPx, content);

  /* Words over several lines keep the box's number of lines in this machine's font (`textFit.ts#useKeepLines`); a line held to one line is `lineWidth`'s. */
  const wordsRef = React.useRef<HTMLDivElement>(null);
  const pad0 = boxStyles(t).padding;
  const roomY = h - ((typeof pad0 === "number" ? pad0 * 2 : 0) + (t.padY ?? 0));
  const heldToOne = !!t.said?.nowrap || (!t.said?.wrap && paras.length === 1 && (runParas?.length ?? 1) === 1 && h > 0 && roomY < 2 * t.fontPx * t.lineHeight - 1);
  useKeepLines(wordsRef, quote || heldToOne ? 0 : roomY, `${w}|${content}|${t.fontPx}|${t.lineHeight}|${t.bodyFamily}`);

  if (quote) {
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", padding: t.boxPad }}>
        <blockquote style={{ margin: 0, borderLeft: `4px solid ${t.accent}`, paddingLeft: t.fontPx, fontFamily: t.headingFamily, fontWeight: 600, fontSize: t.fontPx * 1.5, lineHeight: 1.3, maxWidth: t.measurePx }}>
          {paras[0]}
        </blockquote>
      </Fill>
    );
  }

  const scale = id === "heading-scale" || id === "fluid-type";
  /*
   * A hair of room on the left when the box style has none: `Fill` clips what
   * leaves its box, and text set flush against the edge loses the side
   * bearing of its first glyph — a capital B came out looking like a small
   * one on every plain paragraph, which is most of them.
   */
  const box = boxStyles(t);
  /*
   * A LINE THE DOCUMENT HOLDS AS ONE LINE IS DRAWN ON ONE LINE.
   *
   * His header price, "$ 116.59" in a box 59×20, is one line of its own type
   * tall. Drawn in this machine's monospace the words need a few pixels more
   * than the width the page measured, and they broke onto a second line; the
   * board then grew the part to 40, its group to 44, and stored it. So a
   * single paragraph in a box too short for two of its own lines is set on
   * one line, as wide as its words need, rather than broken to fit a width a
   * different machine measured. Drawing only: the box, its width and its
   * place are the document's. `tests/one-line-words.mjs`.
   *
   * TWO LINES TALL, LESS A ROUNDING, IS TWO LINES. The capture writes a
   * height in whole pixels, so a box two lines tall can be stored a fraction
   * under two lines: Docs' "Reclaim lost SOL…" is 59px and two of its lines
   * are 59.006, so it was held to one line 1254px long in an 832px box and
   * ran under the right column, on the board and on the published site. So
   * a box within a pixel of two lines is two lines. (Not the midpoint: the site's
   * "Ctrl K" is one line of 12px type in a 24px box, 1.504 lines, and it
   * wrapped.) `tests/published-site.mjs`.
   *
   * THE ROOM INSIDE ITS OWN PADDING. A captured link padded 9px above and
   * below (gotchi.gg's nav: "my pets", 15px words in a 33px box) is drawn
   * inside that padding by its box, and its height was read whole: 33 is
   * past two 15px lines, so it was set as a paragraph, free to wrap, and
   * clipped at a width another machine's glyphs overran ("adop", "par",
   * "my pets" on two lines). The node's padding (`t.padY`) is taken off too.
   * `tests/padded-one-line.mjs`.
   */
  const mid = t.centred;
  /* Words the page itself wrapped (`said.wrap`, an inline paragraph read over two rows) are never held to one line (`heldToOne`, above, on the room inside the padding). */
  const oneLine = heldToOne;
  /*
   * A CENTRED LINE OVERRUNS ON BOTH SIDES. A line held to one line is as wide
   * as its words, and a browser sets words too wide for their box from the
   * left whatever the alignment, so a centred pill ("My profile" in PST's
   * nav) ran out on the right only. Centred by the box instead, its words
   * stay in the middle of the fill when another machine's glyphs are wider.
   */
  const spill = oneLine && (!!mid?.x || t.textAlign === "center");
  /*
   * And words the page wrapped get a hair of room past their box before they
   * wrap: the box is where the page set them, and the same words a pixel
   * wider here (PST's Balance note on a phone: 315 in 314) would otherwise
   * wrap their last word where the page did not. One pixel, the rounding of
   * the box the page measured: it was four while the Builder's own number
   * forms (tnum, cv11) set the site's words wider, and four let PST's Balance
   * note keep "your" on its first line where the page wraps it. The site's
   * own forms are its own now (`[data-live-root]` in globals.css).
   */
  const slack = !!t.said?.wrap && !spill && !mid?.x && t.textAlign !== "center" && t.textAlign !== "right";
  return (
    /*
     * A hair of room on the left: `Fill` clips what leaves its box, and text
     * set flush against the edge loses the side bearing of its first glyph —
     * a capital B came out looking like a lowercase one on every paragraph
     * whose box style is plain, which is most of them.
     */
    /*
     * THE GLYPH INSET MUST NOT COST THE LINE ITS ROOM.
     *
     * The 2px in from the left keep a first glyph's side bearing from being
     * clipped, and they were taken out of the box: every plain paragraph had
     * 2px less to set its line in than the box the page measured. Measured on
     * a fresh import of sink: 64 one-line parts looked short of their words,
     * almost all by 2 to 2.5px, and the wordmark, 216px of words in a 216px
     * box, needed 218. The boxes were right. So the drawn surface reaches the
     * inset's width past the box, and its outer size stays the box's, so a
     * part that centres its own contents (a captured flex row, justify
     * centre) does not shift it by half the inset. Nothing is stored and no
     * part moves. `tests/inset-room.mjs`.
     *
     * AND THE INSET IS OUTSIDE THE BOX, NOT INSIDE IT. It reached past the
     * right edge, so the words still began 2px in from the left, and the box
     * a capture records is where the page set its words: against share.xyz
     * itself (1440 and 2000 wide), 70 of its runs sat 2px right of the
     * page's, left-set and centred alike ("Markets Move Fast.", the banner's
     * line, every card's date). Now the surface starts the inset left of the
     * box: the first glyph's side bearing is still inside what `Fill` clips,
     * the words start at the box's edge, and a line set from the left, the
     * middle or the right has exactly the box's width, where the page had
     * it.
     */
    /* Centred by its own box (a grid's `place-items: center`, `applyLayout`): the words sit in the middle, down and across, with no inset to move them off it. */
    /*
     * WORDS NEVER GROW A SCROLLBAR. A wrapped line whose words are a hair
     * wider in this machine's font than the box the page measured (sunkcoin
     * .fun's table head, "UNDERWATER FOR" in a 72px cell) scrolled: a bar
     * across the cell, the word cut to "UNDERWATE" (J, 2026-10-11). The
     * page had no bar there. What leaves the box is clipped, as `Fill`
     * clips everything else; the box grows with its words down, never
     * across. `tests/text-no-scrollbar.mjs`.
     */
    <Fill t={t} data-part={id} data-one-line={oneLine ? "" : undefined} style={{ ...box, overflow: oneLine ? "visible" : "clip", ...(slack ? { overflowX: "hidden" as const } : {}), paddingLeft: mid?.x ? Number(box.padding ?? 0) : Math.max(2, Number(box.padding ?? 0)), ...(!mid?.x && Number(box.padding ?? 0) < 2 ? { width: `calc(100% + ${2 - Number(box.padding ?? 0)}px)`, marginLeft: -(2 - Number(box.padding ?? 0)) } : {}), ...(mid?.y || spill ? { display: "flex", flexDirection: "column", justifyContent: mid?.y ? "center" : undefined, alignItems: spill ? "center" : undefined } : {}) }}>
      {/*
        The line length caps the words, and the cap has to sit where the
        words are set. It sat at the left edge whatever the alignment, so a
        centred line was centred inside 541px at the left of a 1457px part:
        his "No tokens created yet" drew 456px left of its part's centre.
        Centred, the capped block is centred in the part; set right, it
        sits right. The cap itself is kept, as Hero keeps it, so where a line
        wraps (and so how tall the words are) does not change.
        `tests/centred-text.mjs`.

        A captured part's "\n" is the page's own `<br>`: a line, not a
        paragraph. Its lines stand with no gap and in one ink; thesolface's
        footer wordmark stood 472 tall for the page's 248 with the gap, its
        second line grey (`tests/captured-breaks.mjs`).
      */}
      <div ref={wordsRef} style={{ maxWidth: spill ? "none" : mid?.x ? "100%" : t.measurePx, width: spill ? "max-content" : mid?.x ? "fit-content" : undefined, flexShrink: spill ? 0 : undefined, marginLeft: !spill && (mid?.x || t.textAlign === "center" || t.textAlign === "right") ? "auto" : undefined, marginRight: !spill && (mid?.x || t.textAlign === "center") ? "auto" : slack ? -1 : undefined, textAlign: t.textAlign, whiteSpace: oneLine ? "nowrap" : undefined, display: "flex", flexDirection: "column", gap: t.captured ? 0 : t.fontPx * 0.7 }}>
        {scale ? (
          <>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 2.4, lineHeight: 1.1 }}>Heading one</div>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.6, lineHeight: 1.2 }}>Heading two</div>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 600, fontSize: t.fontPx * 1.15 }}>Heading three</div>
          </>
        ) : null}
        {/*
          A captured sentence draws as its runs, and only then. The
          paragraph modes below — a drop cap, the kinetic one, a highlight —
          read a paragraph as a string and take it apart by character and by
          word, so they keep exactly the branch they had. Nothing hand-typed
          carries runs, so nothing hand-typed goes down this path.
        */}
        {runParas ? runParas.map((line, i) => (
          <p key={i} style={{ margin: 0, color: i === 0 || t.captured ? t.text : t.muted, fontSize: t.fontPx, lineHeight: t.lineHeight, ...capsOnly(t, nudge) }}>
            <Runs spans={line} t={t} mode={mode} onNavigate={onNavigate} />
          </p>
        )) : null}
        {runParas ? null : paras.map((p, i) => (
          <p key={i} style={{ margin: 0, color: i === 0 || t.captured ? t.text : t.muted, fontSize: t.fontPx, lineHeight: t.lineHeight, ...capsOnly(t, nudge) }}>
            {dropCap && i === 0 ? (
              <>
                <span style={{ float: "left", fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 3.2, lineHeight: 0.82, paddingRight: 8, color: t.accent }}>{p.charAt(0)}</span>
                {p.slice(1)}
              </>
            ) : kinetic && i === 0 ? (
              firstWords.map((wd, j) => (
                <span key={j} style={{ color: j === word ? t.accent : undefined, transition: "color 200ms" }}>{wd} </span>
              ))
            ) : id === "highlight" && i === 0 ? (
              <>
                <mark style={{ background: `${tint(t.accent, 0.2)}`, color: t.text, padding: "0 3px", borderRadius: 3 }}>{p.split(" ").slice(0, 4).join(" ")}</mark>{" "}
                {p.split(" ").slice(4).join(" ")}
              </>
            ) : (
              p
            )}
          </p>
        ))}
        {id === "reading-time" ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.8 }}>{Math.max(1, Math.round(paras.join(" ").split(" ").length / 200))} min read</span> : null}
        {id === "footnotes" ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.78, borderTop: `1px solid ${t.line}`, paddingTop: 6 }}>1. A note about the line above.</span> : null}
      </div>
    </Fill>
  );
}

/** A ticker that actually scrolls. */
export function Marquee({ id, content, options, theme: t, mode }: PartProps) {
  const words = items(content, ["Ships fast", "Reads well", "Feels right"]);
  const speed = opt(options, "speed", "medium");
  const seconds = speed === "fast" ? 8 : speed === "slow" ? 30 : 16;
  const run = [...words, ...words, ...words];
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>
      <div
        style={{
          display: "flex", gap: 32, whiteSpace: "nowrap", fontFamily: t.headingFamily, fontWeight: 700,
          fontSize: t.fontPx * 1.1, color: t.muted, paddingLeft: 32,
          /* "still": turned off in the Motion tab, the words stand where they start. */
          animation: mode === "live" && speed !== "still" ? `marquee-scroll ${seconds}s linear infinite` : undefined,
        }}
      >
        {run.map((w, i) => (
          <span key={i}>{w} <span style={{ color: t.accent }}>✦</span></span>
        ))}
      </div>
    </Fill>
  );
}

/** A code box, and the diff view that shares its look. */
export function CodeBlock({ id, content, theme: t, emit }: PartProps) {
  const code = content.trim() || (id === "diff-view" ? "- const site = sketch();\n+ const site = build(blueprint);\n  site.deploy();" : "const site = build(blueprint);\nsite.deploy();");
  const lineColour = (l: string) => (id !== "diff-view" ? undefined : l.startsWith("+") ? "oklch(0.78 0.16 150)" : l.startsWith("-") ? "oklch(0.72 0.17 25)" : undefined);
  return (
    <Fill
      t={t}
      data-part={id}
      style={{ ...cardStyle(t), background: t.light ? "oklch(0.2 0.01 260)" : "oklch(0.12 0.01 260)", color: "oklch(0.85 0.02 260)", fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.85, padding: t.fontPx, position: "relative", overflow: "auto" }}
    >
      <button
        type="button"
        onClick={() => { void navigator.clipboard?.writeText(code); emit?.({ type: "toast", text: "Copied", level: "success" }); }}
        style={{ position: "absolute", top: 6, right: 6, background: "oklch(1 0 0 / .08)", border: "none", cursor: "pointer", color: "inherit", font: "inherit", fontSize: t.fontPx * 0.7, padding: "2px 8px", borderRadius: 6 }}
      >
        copy
      </button>
      <pre style={{ margin: 0, whiteSpace: "pre" }}>
        {code.split("\n").map((l, i) => (
          <div key={i} style={{ color: lineColour(l) }}>{l}</div>
        ))}
      </pre>
    </Fill>
  );
}

/** Note boxes and empty states. */
export function Callout({ id, content, theme: t }: PartProps) {
  const empty = id === "empty-states";
  const text = items(content, [empty ? "Nothing here yet." : "A note the reader should not miss."])[0]!;
  return (
    <Fill
      t={t}
      data-part={id}
      style={{
        // The whole edge in one property, then the left rule: a shorthand and
        // its own longhand on one element is what React warns about.
        ...cardStyle(t),
        border: empty ? `1px dashed ${t.line}` : `1px solid ${t.line}`,
        ...(empty ? {} : { borderLeftWidth: 4, borderLeftColor: t.accent }),
        padding: t.fontPx, display: "flex", gap: 10, alignItems: "center",
        justifyContent: empty ? "center" : "flex-start", fontSize: t.fontPx * 0.95, textAlign: empty ? "center" : "left",
      }}
    >
      <span aria-hidden style={{ color: t.accent, fontWeight: 700 }}>{empty ? "◌" : "ⓘ"}</span>
      <span style={{ color: t.muted }}>{text}</span>
    </Fill>
  );
}

/** Article lists, changelogs and tag rows. */
export function ArticleList({ id, content, theme: t, mode, onNavigate, w }: PartProps) {
  const entries = items(content, id === "changelog" ? ["v1.2: what changed", "v1.1: what changed", "v1.0: first release"] : ["First article", "Second article", "Third article"]).map(titled);
  if (id === "tagging") {
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: 2 }}>
        {items(content, ["design", "process", "notes"]).map((tag, i) => (
          <button key={tag + i} type="button" onClick={() => onNavigate?.({ kind: "page", target: tag })} style={{ background: `${tint(t.accent, 0.118)}`, color: t.accent, border: `1px solid ${tint(t.accent, 0.267)}`, borderRadius: 999, padding: `${t.fontPx * 0.2}px ${t.fontPx * 0.65}px`, cursor: "pointer", font: "inherit", fontSize: t.fontPx * 0.8 }}>
            {tag}
          </button>
        ))}
      </Fill>
    );
  }
  const timeline = id === "changelog";
  return (
    <Fill t={t} data-part={id} style={{ display: timeline ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: timeline ? undefined : `repeat(${w < 600 ? 1 : 3}, 1fr)`, gap: t.fontPx * 0.75, overflow: "auto" }}>
      {entries.map((e, i) => {
        const r = rng(hash(e.title));
        return (
          <button
            key={e.title + i}
            type="button"
            onClick={() => onNavigate?.({ kind: "page", target: e.title })}
            style={{ ...cardStyle(t), padding: t.fontPx, cursor: "pointer", textAlign: "left", color: t.text, font: "inherit", display: "flex", flexDirection: "column", gap: 4, minHeight: 0 }}
          >
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{sample.int(r, 1, 28)} {["Jan", "Feb", "Mar", "Apr", "May", "Jun"][sample.int(r, 0, 5)]}</span>
            <span style={{ fontWeight: 600, fontFamily: t.headingFamily }}>{e.title}</span>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{e.body ?? unwritten(mode, () => sample.sentence(r, 10), e.title, t.published)}</span>
          </button>
        );
      })}
    </Fill>
  );
}

/**
 * The eyebrow: the small line of type that sits over a heading and says
 * which part of the argument you are in.
 *
 * It is a heading's label rather than a heading, so it is set small, wide
 * and upper case, usually in the monospace face, and a rule runs off it to
 * the edge of nothing in particular. The rule is the whole reason this is a
 * part and not a line of prose: it has to sit on the type's centre line and
 * stop where the words start, at every size, which is not something a
 * paragraph does on its own.
 */
export function Eyebrow({ id, content, options, theme: t }: PartProps) {
  const text = items(content, ["Built for the next block"]).join(" · ");
  const rule = opt(options, "rule", "before");
  const mono = opt(options, "type", "monospace") === "monospace";
  const tracking = num(options, "tracking", 25, 0, 60) / 100;
  const line = (
    <span aria-hidden style={{ display: "block", width: t.fontPx * 2.6, height: 1, background: t.accent, opacity: 0.85, flex: "none" }} />
  );
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.9, overflow: "visible" }}>
      {rule === "before" || rule === "both" ? line : null}
      <span
        style={{
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : t.headingFamily,
          fontSize: Math.max(9, t.fontPx * 0.75), fontWeight: 600, textTransform: "uppercase",
          letterSpacing: `${tracking}em`, color: t.accent, whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      {rule === "after" || rule === "both" ? line : null}
    </Fill>
  );
}

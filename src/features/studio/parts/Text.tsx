"use client";
/**
 * Words, and how they are set. Everything here honours the type settings in
 * the Format panel: size, line height, measure, alignment and box style.
 */
import * as React from "react";
import { Fill, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { boxStyles, cardStyle, FAMILY, items, titled } from "./theme";
import { opt, type PartProps } from "./types";

/** Paragraphs, quotes, drop caps, highlights — one component, several looks. */
export function Prose({ id, content, theme: t, mode }: PartProps) {
  const paras = items(content, [sample.sentence(rng(hash(id)), 22), sample.sentence(rng(hash(id + "2")), 18)]);
  const quote = id === "pull-quote";
  const dropCap = id === "drop-cap";
  const kinetic = id === "kinetic-type";
  const [word, setWord] = React.useState(0);
  const firstWords = String(paras[0] ?? "").split(" ");
  useTicker(mode, 300, () => setWord((v) => (v + 1) % Math.max(1, firstWords.length)), kinetic);

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
  return (
    <Fill t={t} data-part={id} style={{ ...boxStyles(t), overflow: "auto" }}>
      <div style={{ maxWidth: t.measurePx, textAlign: t.textAlign, display: "flex", flexDirection: "column", gap: t.fontPx * 0.7 }}>
        {scale ? (
          <>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 2.4, lineHeight: 1.1 }}>Heading one</div>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.6, lineHeight: 1.2 }}>Heading two</div>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 600, fontSize: t.fontPx * 1.15 }}>Heading three</div>
          </>
        ) : null}
        {paras.map((p, i) => (
          <p key={i} style={{ margin: 0, color: i === 0 ? t.text : t.muted, fontSize: t.fontPx, lineHeight: t.lineHeight }}>
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
                <mark style={{ background: `${t.accent}33`, color: t.text, padding: "0 3px", borderRadius: 3 }}>{p.split(" ").slice(0, 4).join(" ")}</mark>{" "}
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
          animation: mode === "live" ? `marquee-scroll ${seconds}s linear infinite` : undefined,
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
        ...cardStyle(t), borderLeft: empty ? undefined : `4px solid ${t.accent}`, borderStyle: empty ? "dashed" : "solid",
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
export function ArticleList({ id, content, theme: t, onNavigate, w }: PartProps) {
  const entries = items(content, id === "changelog" ? ["v1.2: what changed", "v1.1: what changed", "v1.0: first release"] : ["First article", "Second article", "Third article"]).map(titled);
  if (id === "tagging") {
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: 2 }}>
        {items(content, ["design", "process", "notes"]).map((tag, i) => (
          <button key={tag + i} type="button" onClick={() => onNavigate?.({ kind: "page", target: tag })} style={{ background: `${t.accent}1e`, color: t.accent, border: `1px solid ${t.accent}44`, borderRadius: 999, padding: `${t.fontPx * 0.2}px ${t.fontPx * 0.65}px`, cursor: "pointer", font: "inherit", fontSize: t.fontPx * 0.8 }}>
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
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{e.body ?? sample.sentence(r, 10)}</span>
          </button>
        );
      })}
    </Fill>
  );
}

"use client";
/**
 * The parts that divide a page: stacks, grids, splits, overlays, footers, and
 * the notes you pin to the board.
 */
import * as React from "react";
import { Btn, Fill, Placeholder } from "./primitives";
import { rng, hash, sample } from "./sample";
import { cardStyle, items, titled, type Theme } from "./theme";
import { opt, set, type PartProps } from "./types";

const cols = (options: Record<string, string>, def = 3) => Math.max(1, Math.min(6, Number(opt(options, "columns", String(def))) || def));

/** Stacked sections, three-band pages, named regions. */
export function Sections({ id, content, theme: t }: PartProps) {
  const secs = items(content, id === "holy-grail" ? ["Header", "Content", "Footer"] : id === "scan-region" ? ["Above the fold"] : ["Intro", "Details", "Proof", "Call to action"]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      {secs.map((s, i) => (
        <div
          key={s + i}
          style={{
            flex: id === "holy-grail" && i !== 1 ? "0 0 18%" : 1,
            ...cardStyle(t), borderStyle: "dashed",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.muted, fontSize: t.fontPx * 0.9,
          }}
        >
          {s}
        </div>
      ))}
    </Fill>
  );
}

/** Card, tile and staggered grids. Titles from content; "Title: body" sets the text. */
export function Grid({ id, content, options, theme: t, mode, onNavigate, w }: PartProps) {
  const n = cols(options, id === "bento-grid" ? 3 : 3);
  const titles = items(content, Array.from({ length: n * 2 }, (_, i) => `Card ${i + 1}`)).map(titled);
  const bento = id === "bento-grid";
  const masonry = id === "masonry";
  const r = rng(hash(id + content));
  return (
    <Fill
      t={t}
      data-part={id}
      style={{
        display: "grid", gridTemplateColumns: `repeat(${w < 520 ? 1 : n}, 1fr)`,
        gridAutoRows: masonry ? "minmax(80px, auto)" : "1fr", gap: t.fontPx * 0.75, overflow: "auto",
      }}
    >
      {titles.map((card, i) => (
        <button
          key={card.title + i}
          type="button"
          onClick={() => (mode === "live" ? onNavigate?.({ kind: "page", target: card.title }) : undefined)}
          style={{
            ...cardStyle(t), padding: t.fontPx, textAlign: "left", cursor: mode === "live" ? "pointer" : "default",
            color: t.text, font: "inherit", display: "flex", flexDirection: "column", gap: 6, minHeight: 0, overflow: "hidden",
            gridColumn: bento && i === 0 ? "span 2" : undefined,
            gridRow: masonry ? `span ${1 + Math.round(r())}` : undefined,
          }}
        >
          <Placeholder t={t} />
          <span style={{ fontWeight: 600, fontFamily: t.headingFamily, fontSize: t.fontPx * 0.98 }}>{card.title}</span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{card.body ?? sample.sentence(rng(hash(card.title)), 6)}</span>
        </button>
      ))}
    </Fill>
  );
}

/** Two halves, or a rail beside the content. The rail's items select. */
export function Split({ id, content, options, theme: t, w }: PartProps) {
  const side = opt(options, "side", "left");
  const list = items(content, id === "docs" ? ["Getting started", "Guides", "Reference"] : ["Section one", "Section two", "Section three"]);
  const [active, setActive] = React.useState(0);
  const narrow = w < 640;
  const railWidth = id === "split-screen" ? "50%" : "26%";
  const rail = (
    <div style={{ width: narrow ? "100%" : railWidth, ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: narrow ? "row" : "column", gap: 4, overflow: "auto", flexShrink: 0 }}>
      {list.map((x, i) => (
        <button
          key={x + i}
          type="button"
          aria-current={i === active ? "true" : undefined}
          onClick={() => setActive(i)}
          style={{
            background: i === active ? `${t.accent}22` : "transparent", border: "none", cursor: "pointer", textAlign: "left",
            color: i === active ? t.text : t.muted, font: "inherit", fontSize: t.fontPx * 0.9,
            padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.5}px`, borderRadius: Math.min(t.radius, 8), whiteSpace: "nowrap",
          }}
        >
          {x}
        </button>
      ))}
    </div>
  );
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: t.fontPx }}>
      {side === "right" && !narrow ? null : rail}
      <div style={{ flex: 1, minWidth: 0, ...cardStyle(t), padding: t.fontPx, color: t.muted, overflow: "auto" }}>
        <div style={{ fontWeight: 600, color: t.text, fontFamily: t.headingFamily, marginBottom: 6 }}>{list[active]}</div>
        {sample.sentence(rng(hash(String(list[active]))), 14)}
      </div>
      {side === "right" && !narrow ? rail : null}
    </Fill>
  );
}

/** Popups and slide-in panels. On the board they show open; live they can close and reopen. */
export function Overlay({ id, content, options, theme: t, emit }: PartProps) {
  const [open, setOpen] = React.useState(true);
  const title = items(content, [id === "modal" ? "Confirm your order" : "Your cart"])[0]!;
  const from = opt(options, "position", "right");
  if (!open) {
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Btn t={t} label={`Open ${id === "modal" ? "popup" : "panel"}`} onClick={() => setOpen(true)} />
      </Fill>
    );
  }
  return (
    <Fill
      t={t}
      data-part={id}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      style={{
        ...cardStyle(t), boxShadow: `0 16px 40px ${t.light ? "oklch(0 0 0 / .18)" : "oklch(0 0 0 / .55)"}`,
        display: "flex", flexDirection: "column", gap: t.fontPx * 0.8, padding: t.fontPx * 1.2,
        borderRadius: id === "drawer" ? (from === "right" ? `${t.radius}px 0 0 ${t.radius}px` : t.radius) : t.radius,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontFamily: t.headingFamily }}>
        <span>{title}</span>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.muted, font: "inherit", fontSize: t.fontPx }}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, color: t.muted, fontSize: t.fontPx * 0.92, overflow: "auto" }}>
        {items(content, [""])[1] ?? "What this contains goes here."}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn t={t} label="Cancel" primary={false} onClick={() => setOpen(false)} />
        <Btn t={t} label="Confirm" onClick={() => { setOpen(false); emit?.({ type: "toast", text: `${title} — confirmed`, level: "success" }); }} />
      </div>
    </Fill>
  );
}

/**
 * The footer. One part, three shapes, and everything it holds on show.
 *
 * There used to be nothing to see here but a column count: whatever you got,
 * you got. Now the links come from `content`, the social row is a set you add
 * to and take from, and the legal line is a choice — so the preview in the
 * shelf is a picture of what this footer will actually say.
 */
export function Footer({ id, content, options, theme: t, onNavigate, w }: PartProps) {
  const links = items(content, ["About", "Pricing", "Docs", "Contact", "Privacy"]);
  const shape = opt(options, "shape", "Thin bar");
  const legal = opt(options, "legal", "Copyright");
  const social = set(options, "social", ["X", "GitHub", "Instagram"]);
  const columns = shape === "Columns";
  const rows = shape === "Two rows";

  const link = (label: string, i: number) => (
    <button
      key={label + i}
      type="button"
      onClick={() => onNavigate?.({ kind: "page", target: label })}
      style={{ background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0, color: t.muted, font: "inherit", fontSize: t.fontPx * 0.84 }}
    >
      {label}
    </button>
  );
  const line = legal === "None" ? null : (
    <span style={{ color: t.muted, fontSize: t.fontPx * 0.76, whiteSpace: "nowrap" }}>
      © {new Date().getFullYear()} {legal === "Copyright + policies" ? "· Privacy · Terms" : ""}
    </span>
  );

  const shell: React.CSSProperties = {
    ...cardStyle(t), borderRadius: 0, borderBottom: "none", borderLeft: "none", borderRight: "none",
    display: "flex", minWidth: 0,
  };

  if (columns) {
    // The wide one: each link becomes a heading with its own short list under it.
    const heads = links.slice(0, w < 560 ? 2 : 4);
    return (
      <Fill t={t} data-part={id} style={{ ...shell, flexDirection: "column", gap: t.fontPx, padding: `${t.fontPx * 1.4}px ${t.fontPx * 1.5}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${heads.length}, 1fr)`, gap: t.fontPx, flex: 1, minHeight: 0 }}>
          {heads.map((head) => {
            const r = rng(hash(head));
            return (
              <div key={head} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: t.fontPx * 0.85, fontFamily: t.headingFamily }}>{head}</span>
                {Array.from({ length: 3 }, (_, i) => link(sample.word(r), i))}
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: t.fontPx * 0.6, display: "flex", alignItems: "center", gap: t.fontPx * 0.8 }}>
          {line}
          <span style={{ flex: 1 }} />
          <Social t={t} names={social} />
        </div>
      </Fill>
    );
  }

  if (rows) {
    return (
      <Fill t={t} data-part={id} style={{ ...shell, flexDirection: "column", justifyContent: "center", gap: t.fontPx * 0.6, padding: `${t.fontPx}px ${t.fontPx * 1.4}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.9, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontFamily: t.headingFamily }}>Logo</span>
          {links.map(link)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.8, borderTop: `1px solid ${t.line}`, paddingTop: t.fontPx * 0.55 }}>
          {line}
          <span style={{ flex: 1 }} />
          <Social t={t} names={social} />
        </div>
      </Fill>
    );
  }

  // The thin bar: one line, everything on it.
  return (
    <Fill t={t} data-part={id} style={{ ...shell, alignItems: "center", gap: t.fontPx * 0.9, padding: `0 ${t.fontPx * 1.4}px`, flexWrap: "nowrap", overflow: "hidden" }}>
      <span style={{ fontWeight: 800, fontFamily: t.headingFamily, whiteSpace: "nowrap" }}>Logo</span>
      {line}
      <span style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.8, minWidth: 0, overflow: "hidden" }}>
        {links.slice(0, w < 640 ? 2 : links.length).map(link)}
      </div>
      <Social t={t} names={social} />
    </Fill>
  );
}

/**
 * The preset social row.
 *
 * Marks, not logos: a rounded square with the platform's initial in it. A part
 * has to draw its own artwork — it cannot reach for an icon set — and a row of
 * real brand marks in a wireframe is a licensing question nobody asked. These
 * say "social links go here, these ones" and stay honest about being a stand-in.
 */
function Social({ t, names }: { t: Theme; names: string[] }) {
  if (!names.length) return null;
  const size = Math.round(t.fontPx * 1.7);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      {names.map((n) => (
        <span
          key={n}
          title={n}
          aria-label={n}
          style={{
            width: size, height: size, borderRadius: Math.min(t.radius, 7),
            border: `1px solid ${t.line}`, color: t.muted,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.5, fontWeight: 700, lineHeight: 1, letterSpacing: -0.2,
          }}
        >
          {MARK[n] ?? n.slice(0, 1)}
        </span>
      ))}
    </div>
  );
}

const MARK: Record<string, string> = {
  X: "X", GitHub: "G", Instagram: "In", YouTube: "▶", LinkedIn: "in",
  TikTok: "Tk", Discord: "D", Mastodon: "M", Bluesky: "B", RSS: "≈", Email: "@",
};

/** Notes, ideas, moods and rules — written to the board, not to the site. */
export function Note({ id, label, content, theme: t }: PartProps) {
  const body = content.trim();
  const kind = id === "constraint" ? "Rule" : id === "mood" ? "Reference" : id === "note" ? "Note" : id === "wildcard" ? "Surprise me" : "Idea";
  return (
    <Fill
      t={t}
      data-part={id}
      style={{ ...cardStyle(t), borderStyle: "dashed", padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }}
    >
      <span style={{ fontSize: t.fontPx * 0.7, textTransform: "uppercase", letterSpacing: 1, color: t.accent }}>{kind}</span>
      <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{label}</span>
      {body ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.9, whiteSpace: "pre-wrap" }}>{body}</span> : null}
    </Fill>
  );
}

/** Breadcrumb trails. The last crumb is where you are. */
export function Breadcrumbs({ id, content, theme: t, onNavigate }: PartProps) {
  const trail = items(content, ["Home", "Section", "Page"]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: t.fontPx * 0.9 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {trail.map((x, i) => {
          const last = i === trail.length - 1;
          return (
            <React.Fragment key={x + i}>
              {i > 0 ? <span aria-hidden style={{ opacity: 0.6 }}>/</span> : null}
              {last ? (
                <span aria-current="page" style={{ color: t.text }}>{x}</span>
              ) : (
                <button type="button" onClick={() => onNavigate?.({ kind: "page", target: x })} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: t.muted, font: "inherit" }}>
                  {x}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </Fill>
  );
}

/** Table of contents and section trackers: the current entry is marked. */
export function Outline({ id, content, theme: t }: PartProps) {
  const entries = items(content, ["Introduction", "How it works", "Details", "Summary"]);
  const [active, setActive] = React.useState(0);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "auto", paddingLeft: t.fontPx * 0.5, borderLeft: `1px solid ${t.line}` }}>
      {entries.map((e, i) => (
        <button
          key={e + i}
          type="button"
          aria-current={i === active ? "true" : undefined}
          onClick={() => setActive(i)}
          style={{
            background: "transparent", border: "none", borderLeft: `2px solid ${i === active ? t.accent : "transparent"}`,
            marginLeft: -t.fontPx * 0.5 - 1, paddingLeft: t.fontPx * 0.5, cursor: "pointer", textAlign: "left",
            color: i === active ? t.text : t.muted, font: "inherit", fontSize: t.fontPx * 0.88, paddingBlock: 4,
          }}
        >
          {e}
        </button>
      ))}
    </Fill>
  );
}

/** Page numbers that actually move. */
export function Pagination({ id, content, theme: t }: PartProps) {
  const total = Math.max(2, Number(items(content, ["8"])[0]) || 8);
  const [page, setPage] = React.useState(1);
  const shown = Array.from({ length: Math.min(total, 7) }, (_, i) => i + 1);
  const btn = (on: boolean): React.CSSProperties => ({
    minWidth: t.fontPx * 2, padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.5}px`, cursor: "pointer", font: "inherit",
    fontSize: t.fontPx * 0.9, borderRadius: Math.min(t.radius, 8),
    background: on ? t.accent : "transparent", color: on ? t.accentText : t.muted,
    border: `1px solid ${on ? "transparent" : t.line}`,
  });
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <nav aria-label="Pagination" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ ...btn(false), opacity: page === 1 ? 0.45 : 1 }}>←</button>
        {shown.map((p) => (
          <button key={p} type="button" aria-current={p === page ? "page" : undefined} onClick={() => setPage(p)} style={btn(p === page)}>{p}</button>
        ))}
        <button type="button" aria-label="Next page" disabled={page === total} onClick={() => setPage((p) => Math.min(total, p + 1))} style={{ ...btn(false), opacity: page === total ? 0.45 : 1 }}>→</button>
      </nav>
    </Fill>
  );
}

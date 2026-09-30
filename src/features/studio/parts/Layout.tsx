"use client";
/**
 * The parts that divide a page: stacks, grids, splits, overlays, footers, and
 * the notes you pin to the board.
 */
import * as React from "react";
import { Btn, Fill, Placeholder } from "./primitives";
import { rng, hash, sample, unwritten } from "./sample";
import { boxPicture, cardStyle, items, titled, type Theme, ghostStyle, tint } from "./theme";
import { opt, set, type PartProps } from "./types";
import { Runs } from "./Runs";
import { lines } from "./spans";

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
            ...ghostStyle(t),
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
  /*
   * What a card is. "boxed" is the card everyone knows: a filled box with a
   * picture at the top. "ruled" is the other kind, which this could not
   * draw at all — a hairline across the top, a small accent mark under it,
   * a title and two lines, and no box — and which is what a row of three
   * arguments looks like on almost every dark site. "plain" is neither.
   */
  const look = opt(options, "card", "boxed");
  const ruled = look === "ruled";
  const bare = look === "plain";
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
            // All longhands where only one edge is drawn: `border: none` and
            // `borderTop` on the same element is a shorthand fighting its own
            // longhand, which React warns about and the browser resolves by
            // order rather than by intent.
            ...(ruled || bare
              ? { background: "transparent", borderWidth: ruled ? "1px 0 0 0" : 0, borderStyle: "solid", borderColor: t.line, borderRadius: 0 }
              : cardStyle(t)),
            padding: ruled || bare ? `${t.fontPx * 0.9}px 0 0` : t.fontPx,
            textAlign: "left", cursor: mode === "live" ? "pointer" : "default",
            color: t.text, font: "inherit", display: "flex", flexDirection: "column", gap: 6, minHeight: 0, overflow: "hidden",
            gridColumn: bento && i === 0 ? "span 2" : undefined,
            gridRow: masonry ? `span ${1 + Math.round(r())}` : undefined,
          }}
        >
          {ruled ? <Mark t={t} seed={card.title} /> : bare ? null : <Placeholder t={t} />}
          <span style={{ fontWeight: 600, fontFamily: t.headingFamily, fontSize: t.fontPx * 0.98, textTransform: ruled ? "uppercase" : undefined, letterSpacing: ruled ? "0.1em" : undefined }}>{card.title}</span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{card.body ?? unwritten(mode, () => sample.sentence(rng(hash(card.title)), 6), card.title, t.published)}</span>
        </button>
      ))}
    </Fill>
  );
}

/**
 * The mark over a ruled card: a bolt, a shield or an arrow, picked from the
 * card's own title so the three in a row are three different marks and the
 * same card keeps the same one. Drawn rather than imported, because the
 * parts folder ships without an icon set.
 */
function Mark({ t, seed }: { t: Theme; seed: string }) {
  const which = hash(seed) % 3;
  const d = which === 0
    ? "M8.5 1.5 3 9h4l-.5 5.5L13 7H9l-.5-5.5Z"
    : which === 1
      ? "M8 1.5 2.5 4v5c0 3 2.4 5 5.5 5.5 3.1-.5 5.5-2.5 5.5-5.5V4L8 1.5Z"
      : "M4 12 12 4M6 4h6v6";
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={t.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Two halves, or a rail beside the content. The rail's items select. */
export function Split({ id, content, options, theme: t, mode, w }: PartProps) {
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
            background: i === active ? `${tint(t.accent, 0.133)}` : "transparent", border: "none", cursor: "pointer", textAlign: "left",
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
        {unwritten(mode, () => sample.sentence(rng(hash(String(list[active]))), 14), String(list[active] ?? ""), t.published)}
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
        <Btn t={t} label="Confirm" onClick={() => { setOpen(false); emit?.({ type: "toast", text: `${title}, confirmed`, level: "success" }); }} />
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
export function Footer({ id, content, options, theme: t, mode, onNavigate, link: own, w }: PartProps) {
  /*
   * The foot of the page carries the same wordmark the top of it does, and
   * for the same reason: "Logo" is not the name of anybody's site. An item
   * written `logo: $BORB` is the wordmark, exactly as in the top bar, and
   * everything else is a link — so a footer typed the plain way is
   * unchanged, and a site that has said its name once can say it twice.
   */
  const typed = items(content, ["About", "Pricing", "Docs", "Contact", "Privacy"]).map(titled);
  const wordmark = typed.find((x) => x.body && ["logo", "wordmark"].includes(x.title.toLowerCase()))?.body ?? t.siteName ?? unwritten(mode, () => "Logo", "", t.published);
  const links = typed
    .filter((x) => !(x.body && ["logo", "wordmark"].includes(x.title.toLowerCase())))
    .map((x) => (x.body ? `${x.title}: ${x.body}` : x.title));
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
  /*
   * The wordmark is the footer's own link, as the top bar's button is the
   * top bar's: where the part links, when it links, and home when it does
   * not. The links beside it are the content's own and go by their names.
   */
  const mark = (style: React.CSSProperties) => (
    <button
      type="button"
      data-footer-mark=""
      onClick={() => onNavigate?.(own ?? { kind: "page", target: "home" })}
      style={{ ...style, background: "transparent", border: "none", padding: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
    >
      {wordmark}
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
                {Array.from({ length: 3 }, (_, i) => link(unwritten(mode, () => sample.word(r), `${head} ${i + 1}`, t.published), i))}
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
          {mark({ fontWeight: 800, fontFamily: t.headingFamily })}
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
      {mark({ fontWeight: 800, fontFamily: t.headingFamily, whiteSpace: "nowrap" })}
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
  /* Words for whoever builds the site: in the blueprint, never on a page a stranger reads. */
  if (t.published) return null;
  const body = content.trim();
  const kind = id === "constraint" ? "Rule" : id === "mood" ? "Reference" : id === "note" ? "Note" : id === "wildcard" ? "Surprise me" : "Idea";
  return (
    <Fill
      t={t}
      data-part={id}
      style={{ ...ghostStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }}
    >
      <span style={{ fontSize: t.fontPx * 0.7, textTransform: "uppercase", letterSpacing: 1, color: t.accent }}>{kind}</span>
      <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{label}</span>
      {body ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.9, whiteSpace: "pre-wrap" }}>{body}</span> : null}
    </Fill>
  );
}

/**
 * A box that draws nothing of its own.
 *
 * A captured page is mostly wrappers: a header, a row, a column, a card
 * with no words of its own. Each one used to land as the Idea part and wear
 * a dashed edge, a kind word and a label over his content — 75 of the 126
 * parts on his page. This is only what the node carries: its colour through
 * the fill, its edge and padding from the box fields, and the words typed
 * into it, drawn plainly. With nothing typed it draws nothing at all: no
 * edge, no name, no count of what is inside.
 */
export function PlainBox({ id, content, spans, theme: t, mode, onNavigate, picture }: PartProps) {
  /*
   * A sentence with a coloured or differently faced word in it is ONE box
   * now. It was three — "A Sol", "Works", "project" — each wrapping on its
   * own, which is what made the first of them too short. The runs go in as
   * inline content so the browser decides the break, exactly as it does on
   * the page this came from. Nothing typed by hand carries runs, so a box
   * with a plain string draws precisely as it always has.
   */
  const runs = spans?.length ? lines(spans) : null;
  const words = content.trim();
  return (
    <Fill t={t} data-part={id} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...boxPicture(picture) }}>
      {runs
        ? runs.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 ? "\n" : null}
              <Runs spans={line} t={t} mode={mode} onNavigate={onNavigate} />
            </React.Fragment>
          ))
        : words ? words : null}
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
            background: "transparent", borderWidth: "0 0 0 2px", borderStyle: "solid", borderColor: i === active ? t.accent : "transparent",
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

/**
 * The "What's new" card: a centred card with the real part playing on top,
 * a title, two or three lines, an optional "where to find it" path with a
 * switch, one action button, dots, Back / Next / Finish, and "See previous
 * updates" (`tour.ts`).
 *
 * On the board it is drawn where it was put, open at the step being
 * edited, so what is edited is what is seen. Live (the Preview, the
 * published page) it is drawn closed, fixed over the window; the
 * `whats-new` feature (`library/tour.ts`) opens it, moves through it and
 * remembers each visitor's last update. Every press it answers is that
 * script's, so the Preview and the published page do the same thing, and
 * a script that fails to load leaves the page with no card over it.
 *
 * It wears the site's own type, colours and corners (the theme), and an
 * option or two: where it stands, how it dims the page, how wide it is.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { opt, type PartProps, type PartTour, type PartTourStep } from "./types";

const PREVIEW_H = 200;

/** How light a colour is, 0 to 1, from the forms a palette holds (#hex, rgb(), oklch()); null when it cannot tell. */
export function lightness(c: string | undefined): number | null {
  const s = (c ?? "").trim().toLowerCase();
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const fromRgb = (r: number, g: number, b: number) => Math.cbrt(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b));
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(s);
  if (m) {
    const h = m[1]!.length === 3 ? m[1]!.split("").map((x) => x + x).join("") : m[1]!;
    return fromRgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return fromRgb(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255);
  m = /^oklch\(\s*([\d.]+)(%?)/.exec(s);
  if (m) return m[2] ? Number(m[1]) / 100 : Number(m[1]);
  return null;
}

/** Words that read on this fill: the site's own when they do, else near-black or near-white. */
function readableOn(fill: string, ink: string): string {
  const a = lightness(fill), b = lightness(ink);
  if (a === null || b === null || Math.abs(a - b) >= 0.45) return ink;
  return a > 0.6 ? "oklch(0.2 0.02 265)" : "oklch(0.97 0.01 265)";
}

export function WhatsNew({ options, theme: site, mode, w, h, tour, partView, onNavigate }: PartProps) {
  /* The site's colours, faces and corners, with words that read on the card whatever the palette paired. */
  const text = readableOn(site.surface, site.text);
  const t = {
    ...site,
    text,
    muted: text === site.text ? site.muted : `color-mix(in oklch, ${text} 72%, transparent)`,
    accentText: readableOn(site.accent, site.accentText),
    headingFamily: opt(options, "titleFont", site.headingFamily),
    bodyFamily: opt(options, "bodyFont", site.bodyFamily),
  };
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const data: PartTour | null = tour ?? null;
  const steps = data?.current.steps ?? [];
  const board = mode === "board";
  const place = opt(options, "place", "centre");
  const dim = opt(options, "backdrop", "dim");
  const width = opt(options, "width", "regular") === "compact" ? 360 : 440;
  const at = Math.max(0, Math.min(steps.length - 1, data?.at ?? 0));
  const radius = Math.min(Math.max(t.radius * 1.6, 10), 26);
  const inner = Math.max(6, radius - 8);
  const cardW = board ? Math.max(260, w) : width;
  const previewW = cardW - 32;

  const button = (kind: "primary" | "ghost"): React.CSSProperties => ({
    appearance: "none", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, lineHeight: 1.2,
    padding: "10px 16px", borderRadius: Math.min(radius, 999), minHeight: 44,
    border: kind === "primary" ? "1px solid transparent" : `1px solid ${t.line}`,
    background: kind === "primary" ? t.accent : "transparent",
    color: kind === "primary" ? t.accentText : t.text,
    textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  });

  const action = (s: PartTourStep) => {
    if (s.action === "none" || !s.button.trim()) return null;
    if (s.action === "link") {
      if (!s.link?.target) return null;
      return (
        <a
          data-tour-action="link"
          data-run-link={s.link.kind}
          data-run-to={s.link.target}
          href={s.link.kind === "node" ? `#${s.link.target}` : "#"}
          onClick={(e) => { if (board) return; e.preventDefault(); if (s.link) onNavigate?.(s.link); }}
          style={{ ...button("primary"), width: "100%" }}
        >
          {s.button}
        </a>
      );
    }
    return (
      <button
        type="button"
        data-tour-action={s.action}
        data-tour-target={s.target ?? undefined}
        data-tour-option={s.action === "option" ? s.option : undefined}
        style={{ ...button("primary"), width: "100%" }}
      >
        {s.button}
      </button>
    );
  };

  const step = (s: PartTourStep, i: number) => (
    <section key={i} data-tour-step={i} hidden={i !== at} aria-roledescription="step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {s.target ? (
        <div
          data-tour-preview={s.target}
          style={{ height: PREVIEW_H, borderRadius: inner, overflow: "hidden", background: t.bg, border: `1px solid ${t.line}`, display: "grid", placeItems: "center", position: "relative" }}
        >
          {partView?.(s.target, { w: previewW, h: PREVIEW_H }) ?? (
            <span style={{ fontSize: 12, color: t.muted }}>{board ? "this part is not on this page any more" : ""}</span>
          )}
        </div>
      ) : null}
      <h2 id={`tour-${uid}-${i}`} data-tour-title="" style={{ margin: 0, fontFamily: t.headingFamily, fontSize: 21, lineHeight: 1.2, fontWeight: 700, color: t.text }}>
        {s.title || (board ? "A title for this step" : "")}
      </h2>
      {s.lines.trim() ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, color: t.muted, fontSize: 14.5, lineHeight: 1.5 }}>
          {s.lines.split("\n").filter((l) => l.trim()).slice(0, 3).map((l, j) => <p key={j} style={{ margin: 0 }}>{l}</p>)}
        </div>
      ) : null}
      {s.path.trim() ? (
        <div data-tour-path="" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: inner, border: `1px solid ${t.line}`, fontSize: 13, color: t.text }}>
          <span>{s.path}</span>
          {s.option ? (
            <button
              type="button"
              role="switch"
              aria-checked="false"
              aria-label={s.path}
              data-tour-switch=""
              data-tour-option={s.option}
              style={{ appearance: "none", cursor: "pointer", width: 40, height: 22, borderRadius: 999, border: `1px solid ${t.line}`, background: t.bg, position: "relative", flexShrink: 0, padding: 0 }}
            >
              <span aria-hidden data-tour-knob="" style={{ position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: 999, background: t.accent }} />
            </button>
          ) : null}
        </div>
      ) : null}
      {action(s)}
    </section>
  );

  const past = data?.past ?? [];
  const card = (
    <div
      data-tour-card=""
      role="dialog"
      aria-modal={board ? undefined : "true"}
      aria-labelledby={steps.length ? `tour-${uid}-${at}` : undefined}
      tabIndex={-1}
      style={{
        width: board ? "100%" : `min(${width}px, calc(100vw - 24px))`, maxHeight: board ? undefined : "calc(100dvh - 24px)", overflow: "auto",
        boxSizing: "border-box", padding: 16, display: "flex", flexDirection: "column", gap: 14,
        background: t.surface, color: t.text, border: `1px solid ${t.line}`, borderRadius: radius,
        fontFamily: t.bodyFamily, boxShadow: "0 24px 64px oklch(0 0 0 / .35)", pointerEvents: "auto", textAlign: "left",
        ...(t.surfacePaint ?? {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.accent }}>What&apos;s new</span>
        <button type="button" data-tour-close="" aria-label="Close" style={{ ...button("ghost"), minHeight: 32, width: 32, padding: 0, border: "none", fontSize: 18 }}>×</button>
      </div>
      <div data-tour-body="" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.length ? steps.map(step) : (
          <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>{board ? "No steps yet. Pick what the first step shows in the side panel." : ""}</p>
        )}
        {steps.length > 1 || !board ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Steps">
              {steps.length > 1 ? steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  data-tour-dot={i}
                  aria-label={`Step ${i + 1} of ${steps.length}`}
                  aria-current={i === at ? "step" : undefined}
                  style={{ appearance: "none", cursor: "pointer", padding: 0, width: 8, height: 8, borderRadius: 999, border: "none", background: t.line }}
                />
              )) : null}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" data-tour-back="" hidden={at === 0} style={{ ...button("ghost") }}>Back</button>
              <button type="button" data-tour-next="" hidden={at >= steps.length - 1} style={{ ...button("ghost") }}>Next</button>
              <button type="button" data-tour-finish="" hidden={at < steps.length - 1} style={{ ...button("ghost") }}>Finish</button>
            </div>
          </div>
        ) : null}
        {past.length ? (
          <button type="button" data-tour-past-open="" style={{ appearance: "none", cursor: "pointer", border: "none", background: "transparent", color: t.muted, font: "inherit", fontSize: 13, textDecoration: "underline", padding: 0, alignSelf: "center" }}>
            See previous updates
          </button>
        ) : null}
      </div>
      {past.length ? (
        <div data-tour-past="" hidden style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: t.headingFamily, fontSize: 18 }}>Previous updates</h2>
          {past.map((u) => (
            <div key={u.id} data-tour-past-update={u.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: t.muted }}>{u.date}</span>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2, fontSize: 14 }}>
                {u.steps.map((s, j) => <li key={j}><strong>{s.title}</strong>{s.lines.trim() ? ` · ${s.lines.split("\n")[0]}` : ""}</li>)}
              </ul>
            </div>
          ))}
          <button type="button" data-tour-past-close="" style={{ ...button("ghost"), alignSelf: "flex-start" }}>Back to what&apos;s new</button>
        </div>
      ) : null}
    </div>
  );

  /* `hidden` wins over the inline display every piece is drawn with: the script shows and hides by it alone. */
  const rule = (
    <style>{`[data-tour-root] [hidden],[data-tour-layer][hidden],[data-tour-layer] [hidden]{display:none !important}[data-tour-switch][aria-checked="true"]{background:${t.accent} !important}[data-tour-switch][aria-checked="true"] [data-tour-knob]{left:20px !important;background:${t.accentText} !important}[data-tour-card] :focus-visible{outline:2px solid ${t.accent};outline-offset:2px}[data-tour-dot][aria-current="step"]{background:${t.accent} !important}`}</style>
  );
  if (board) {
    return (
      <div data-part="whats-new" data-tour-root="" style={{ width: "100%", minHeight: h, display: "flex", alignItems: "flex-start" }}>
        {rule}
        {card}
      </div>
    );
  }
  const layer: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 2147483000, display: "flex", padding: 12, boxSizing: "border-box",
    alignItems: place === "corner" ? "flex-end" : "center", justifyContent: place === "corner" ? "flex-end" : "center",
    background: dim === "none" ? "transparent" : "oklch(0 0 0 / .45)",
    backdropFilter: dim === "blur" ? "blur(6px)" : undefined,
    pointerEvents: dim === "none" ? "none" : "auto",
  };
  /*
   * In the Builder's Preview the page is drawn scaled inside the workspace,
   * and "fixed" there is the page's box, not the window: the card would
   * open far down a tall page. So there, and only there, the closed card is
   * drawn on the window itself; the published page lifts it itself
   * (`library/tour.ts`), and the export's markup is written in place.
   */
  const host = !site.published && typeof document !== "undefined" ? document.body : null;
  const drawn = (
    <div data-tour-layer={uid} hidden style={layer}>
      {rule}
      {card}
    </div>
  );
  return (
    <div
      data-part="whats-new"
      data-tour-lid={uid}
      data-tour-root=""
      data-tour=""
      data-tour-when={data?.when ?? "update"}
      data-tour-update={data?.current.id ?? 1}
      data-tour-accent={t.accent}
      data-tour-width={width}
      style={{ position: "relative", width: 0, height: 0 }}
    >
      {rule}
      {host ? createPortal(drawn, host) : drawn}
    </div>
  );
}

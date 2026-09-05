"use client";
/**
 * Top bars. Links from content; each link navigates to the page with the
 * same name. The right-hand button honours the part's own link.
 */
import * as React from "react";
import { Btn, Fill } from "./primitives";
import { sample, rng, hash } from "./sample";
import { cardStyle, items, type Theme } from "./theme";
import { opt, type PartProps } from "./types";

export function Header({ id, content, options, theme: t, mode, link, onNavigate, emit, w }: PartProps) {
  const links = items(content, id === "mega-menu" ? ["Products", "Solutions", "Pricing", "Docs"] : ["Home", "Work", "About", "Contact"]);
  const compact = id === "mobile-nav" || w < 640;
  const withButton = opt(options, "button", "yes") === "yes" && id !== "home-anchor" && id !== "mobile-nav";
  const [openMenu, setOpenMenu] = React.useState<number | null>(null);
  const [sheet, setSheet] = React.useState(false);
  const go = (label: string) => {
    setOpenMenu(null);
    setSheet(false);
    onNavigate?.({ kind: "page", target: label });
  };
  const button = () => (link ? onNavigate?.(link) : emit?.({ type: "toast", text: "Get started" }));
  const linkStyle: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", color: t.muted, font: "inherit", fontSize: t.fontPx * 0.95, padding: `${t.fontPx * 0.3}px ${t.fontPx * 0.4}px`, borderRadius: Math.min(t.radius, 8) };

  if (compact) {
    return (
      <Fill t={t} data-part={id} overflow="visible" style={{ ...cardStyle(t), borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${t.fontPx}px` }}>
        <span style={{ fontWeight: 800, fontFamily: t.headingFamily }}>Logo</span>
        <button type="button" aria-label="Menu" aria-expanded={sheet} onClick={() => setSheet(!sheet)} style={{ ...linkStyle, color: t.text, display: "flex", flexDirection: "column", gap: 4 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ display: "block", width: 20, height: 2, background: "currentColor", borderRadius: 2 }} />)}
        </button>
        {sheet && mode === "live" ? (
          <nav aria-label="Menu" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, background: t.surface, borderBottom: `1px solid ${t.line}`, padding: t.fontPx * 0.5, display: "flex", flexDirection: "column" }}>
            {links.map((l) => <button key={l} type="button" onClick={() => go(l)} style={{ ...linkStyle, color: t.text, textAlign: "left", padding: `${t.fontPx * 0.6}px ${t.fontPx * 0.6}px` }}>{l}</button>)}
            {withButton ? <div style={{ padding: t.fontPx * 0.6 }}><Btn t={t} label="Get started" onClick={button} style={{ width: "100%" }} /></div> : null}
          </nav>
        ) : null}
      </Fill>
    );
  }

  return (
    <Fill t={t} data-part={id} overflow="visible" style={{ ...cardStyle(t), borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", display: "flex", alignItems: "center", gap: t.fontPx * 1.2, padding: `0 ${t.fontPx * 1.5}px` }}>
      <button type="button" onClick={() => go("Home")} style={{ ...linkStyle, color: t.text, fontWeight: 800, fontFamily: t.headingFamily, letterSpacing: -0.3, fontSize: t.fontPx, padding: 0 }}>
        Logo
      </button>
      <span style={{ flex: 1 }} />
      {id === "home-anchor" ? (
        <button type="button" onClick={() => go("Home")} style={linkStyle}>Home</button>
      ) : (
        <nav aria-label="Main" style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.4 }}>
          {links.map((l, i) => (
            <span key={l + i} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => (id === "mega-menu" ? setOpenMenu(openMenu === i ? null : i) : go(l))}
                aria-expanded={id === "mega-menu" ? openMenu === i : undefined}
                aria-haspopup={id === "mega-menu" ? "true" : undefined}
                style={{ ...linkStyle, color: openMenu === i ? t.text : t.muted }}
              >
                {l}{id === "mega-menu" ? <span aria-hidden style={{ marginLeft: 4, fontSize: "0.7em" }}>▾</span> : null}
              </button>
              {id === "mega-menu" && openMenu === i && mode === "live" ? <MegaPanel t={t} label={l} onPick={go} /> : null}
            </span>
          ))}
        </nav>
      )}
      {withButton ? <Btn t={t} label="Get started" onClick={button} /> : null}
    </Fill>
  );
}

function MegaPanel({ t, label, onPick }: { t: Theme; label: string; onPick: (l: string) => void }) {
  const r = rng(hash(label));
  const groups = ["Overview", "By use", "Learn"].map((g) => ({ g, items: Array.from({ length: 3 }, () => sample.word(r)) }));
  return (
    <div role="menu" style={{ position: "absolute", left: 0, top: "calc(100% + 10px)", zIndex: 20, minWidth: 420, ...cardStyle(t), padding: t.fontPx, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: t.fontPx, boxShadow: `0 16px 40px ${t.light ? "oklch(0 0 0 / .14)" : "oklch(0 0 0 / .55)"}` }}>
      {groups.map(({ g, items: xs }) => (
        <div key={g} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: t.fontPx * 0.75, textTransform: "uppercase", letterSpacing: 1, color: t.muted }}>{g}</span>
          {xs.map((x) => (
            <button key={x} type="button" role="menuitem" onClick={() => onPick(x)} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.text, font: "inherit", fontSize: t.fontPx * 0.9, textAlign: "left", padding: "4px 0", textTransform: "capitalize" }}>{x}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

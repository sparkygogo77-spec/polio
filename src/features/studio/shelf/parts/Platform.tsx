"use client";
/**
 * The things a visitor meets that are not "content": signing in, consent,
 * errors, language, theme, print. Each shows a truthful working mock — the
 * state really changes — and the blueprint names the service behind it.
 */
import * as React from "react";
import { Btn, Fill, focusRing, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items, FAMILY, type Theme, ghostStyle, tint } from "./theme";
import { opt, type PartProps } from "./types";

const field = (t: Theme): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.65}px`,
  borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.line}`, background: "transparent",
  color: t.text, font: "inherit", fontSize: t.fontPx * 0.88, outline: "none",
});

/** Sign in, and be signed in. The email is really checked. */
export function Auth({ id, content, theme: t, emit }: PartProps) {
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [who, setWho] = React.useState<string | null>(null);
  const providers = items(content, ["Google", "GitHub", "Email"]);

  if (who) {
    return (
      <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: t.fontPx * 2.4, height: t.fontPx * 2.4, borderRadius: 999, background: `${tint(t.accent, 0.267)}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{who[0]?.toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: t.fontPx * 0.95, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</strong>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>Signed in</span>
        </span>
        <Btn t={t} label="Sign out" primary={false} onClick={() => { setWho(null); emit?.({ type: "auth", signedIn: false }); }} />
      </Fill>
    );
  }

  const submit = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("That doesn't look like an email address."); return; }
    setError(null);
    setWho(email);
    emit?.({ type: "auth", signedIn: true, name: email });
  };

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, overflow: "auto" }}>
      <div role="tablist" aria-label="Sign in or sign up" style={{ display: "flex", gap: 4 }}>
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            style={{ flex: 1, padding: t.fontPx * 0.35, borderRadius: Math.min(t.radius, 8), border: "none", cursor: "pointer", font: "inherit", fontSize: t.fontPx * 0.85, fontWeight: 600, background: mode === m ? `${tint(t.accent, 0.118)}` : "transparent", color: mode === m ? t.accent : t.muted }}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <label style={{ fontSize: t.fontPx * 0.78, color: t.muted, display: "flex", flexDirection: "column", gap: 3 }}>
        Email
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@example.com" style={{ ...field(t), borderColor: error ? "oklch(0.65 0.2 25)" : t.line }} />
      </label>
      <label style={{ fontSize: t.fontPx * 0.78, color: t.muted, display: "flex", flexDirection: "column", gap: 3 }}>
        Password
        <input type="password" placeholder="••••••••" style={field(t)} />
      </label>
      {error ? <span role="alert" style={{ color: "oklch(0.7 0.19 25)", fontSize: t.fontPx * 0.78 }}>{error}</span> : null}
      <Btn t={t} label={mode === "in" ? "Sign in" : "Create account"} onClick={submit} style={{ width: "100%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: t.fontPx * 0.72 }}>
        <span style={{ flex: 1, height: 1, background: t.line }} />or<span style={{ flex: 1, height: 1, background: t.line }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {providers.filter((p) => p !== "Email").map((p) => (
          <Btn key={p} t={t} label={p} primary={false} onClick={() => { setWho(`you@${p.toLowerCase()}.com`); emit?.({ type: "auth", signedIn: true, name: p }); }} style={{ flex: 1 }} />
        ))}
      </div>
    </Fill>
  );
}

/** Ask before tracking, and remember the answer for this visit. */
export function CookieConsent({ id, content, theme: t, emit }: PartProps) {
  const [text, ...choices] = items(content, ["We use cookies to see which pages people read.", "Accept", "Only necessary"]);
  const key = "builder.consent";
  const [choice, setChoice] = React.useState<string | null>(null);
  React.useEffect(() => {
    try { setChoice(window.sessionStorage.getItem(key)); } catch { /* private mode */ }
  }, []);
  const decide = (what: string) => {
    setChoice(what);
    try { window.sessionStorage.setItem(key, what); } catch { /* private mode */ }
    emit?.({ type: "toast", text: `Preference saved: ${what}` });
  };

  if (choice) {
    return (
      <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.85, color: t.muted }}>
        <span style={{ flex: 1 }}>Cookies: <strong style={{ color: t.text }}>{choice}</strong></span>
        <Btn t={t} label="Change" primary={false} onClick={() => decide("")} style={{ fontSize: t.fontPx * 0.75 }} />
      </Fill>
    );
  }

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", alignItems: "center", gap: t.fontPx * 0.7, flexWrap: "wrap", boxShadow: `0 -6px 24px ${t.light ? "oklch(0 0 0 / .08)" : "oklch(0 0 0 / .4)"}` }}>
      <span style={{ flex: 1, minWidth: 180, fontSize: t.fontPx * 0.88, color: t.muted }}>{text}</span>
      {choices.map((c, i) => <Btn key={c} t={t} label={c} primary={i === 0} onClick={() => decide(c)} />)}
    </Fill>
  );
}

/** What people see when it breaks. */
export function ErrorScreen({ id, content, options, theme: t, emit, onNavigate }: PartProps) {
  const kinds = ["404", "500", "offline"];
  const [kind, setKind] = React.useState(opt(options, "kind", "404"));
  const copy: Record<string, [string, string]> = {
    "404": ["Nothing here", "That page has moved, or never existed."],
    "500": ["Something broke", "It's us, not you. Try again in a moment."],
    offline: ["You're offline", "We'll pick up where you left off when you're back."],
  };
  const [title, body] = copy[kind] ?? copy["404"]!;
  const typed = items(content, []);

  return (
    <Fill t={t} data-part={id} style={{ ...ghostStyle(t), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: t.fontPx * 0.4, padding: t.fontPx, textAlign: "center" }}>
      <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 2.6, color: t.accent, lineHeight: 1 }}>{kind}</span>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.1 }}>{typed[0] ?? title}</strong>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.88, maxWidth: t.measurePx }}>{typed[1] ?? body}</span>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <Btn t={t} label="Try again" onClick={() => emit?.({ type: "toast", text: "Retrying…" })} />
        <Btn t={t} label="Go home" primary={false} onClick={() => onNavigate?.({ kind: "page", target: "home" })} />
      </div>
      <div role="radiogroup" aria-label="Error kind" style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {kinds.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} style={{ padding: "1px 8px", borderRadius: 999, border: `1px solid ${kind === k ? t.accent : t.line}`, background: "transparent", color: kind === k ? t.accent : t.muted, font: "inherit", fontSize: t.fontPx * 0.7, cursor: "pointer" }}>{k}</button>
        ))}
      </div>
    </Fill>
  );
}

/** A language switcher that really swaps the words on screen. */
export function Languages({ id, content, theme: t, emit }: PartProps) {
  const langs = items(content, ["English", "Español", "Français", "Deutsch"]);
  const [lang, setLang] = React.useState(langs[0]!);
  const greet: Record<string, [string, string]> = {
    English: ["Welcome", "Everything on this page follows the language you pick."],
    "Español": ["Bienvenido", "Todo en esta página sigue el idioma que elijas."],
    "Français": ["Bienvenue", "Tout sur cette page suit la langue choisie."],
    Deutsch: ["Willkommen", "Alles auf dieser Seite folgt der gewählten Sprache."],
  };
  const [hello, line] = greet[lang] ?? greet.English!;
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {langs.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => { setLang(l); emit?.({ type: "toast", text: l }); }}
            style={{ padding: `${t.fontPx * 0.25}px ${t.fontPx * 0.6}px`, borderRadius: 999, cursor: "pointer", font: "inherit", fontSize: t.fontPx * 0.78, border: `1px solid ${lang === l ? t.accent : t.line}`, background: lang === l ? `${tint(t.accent, 0.118)}` : "transparent", color: lang === l ? t.accent : t.muted }}
          >
            {l}
          </button>
        ))}
      </div>
      <strong lang={lang.slice(0, 2).toLowerCase()} style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.4 }}>{hello}</strong>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.88, maxWidth: t.measurePx }}>{line}</span>
    </Fill>
  );
}

/** Light, dark and an accent — the visitor's own choice. */
export function ThemePicker({ id, content, options, theme: t, emit }: PartProps) {
  const darkOnly = id === "dark-mode";
  const [mode, setMode] = React.useState(opt(options, "default", darkOnly ? "system" : "dark"));
  const hues = items(content, ["265", "20", "150", "320"]).map((h) => Number(h.replace(/\D/g, "")) || 265);
  const [hue, setHue] = React.useState(hues[0]!);
  const modes = darkOnly ? ["system", "light", "dark"] : ["light", "dark"];

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>{darkOnly ? "Appearance" : "Theme"}</span>
      <div role="radiogroup" aria-label="Appearance" style={{ display: "flex", gap: 4, background: `${tint(t.muted, 0.094)}`, borderRadius: Math.min(t.radius, 999), padding: 3 }}>
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => { setMode(m); emit?.({ type: "theme", light: m === "light" }); }}
            style={{ flex: 1, padding: `${t.fontPx * 0.3}px 0`, borderRadius: Math.min(t.radius, 999), border: "none", cursor: "pointer", font: "inherit", fontSize: t.fontPx * 0.8, fontWeight: 600, background: mode === m ? t.surface : "transparent", color: mode === m ? t.text : t.muted, textTransform: "capitalize" }}
          >
            {m}
          </button>
        ))}
      </div>
      {darkOnly ? null : (
        <div role="radiogroup" aria-label="Accent" style={{ display: "flex", gap: 6 }}>
          {hues.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hue === h}
              aria-label={`Accent ${h}`}
              onClick={() => { setHue(h); emit?.({ type: "theme", hue: h }); }}
              style={{ width: t.fontPx * 1.6, height: t.fontPx * 1.6, borderRadius: 999, cursor: "pointer", background: `oklch(0.68 0.16 ${h})`, border: `2px solid ${hue === h ? t.text : "transparent"}`, boxShadow: hue === h ? focusRing(t) : undefined }}
            />
          ))}
        </div>
      )}
    </Fill>
  );
}

/** Logo, palette, type — the kit every page is built from. */
export function BrandKit({ id, content, theme: t }: PartProps) {
  const [name, ...notes] = items(content, ["Your name here", "Plain, direct, never shouty"]);
  const swatches: [string, string][] = [["Background", t.bg], ["Surface", t.surface], ["Text", t.text], ["Muted", t.muted], ["Accent", t.accent], ["Highlight", t.highlight]];
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: t.fontPx * 2.4, height: t.fontPx * 2.4, borderRadius: Math.min(t.radius, 10), background: `linear-gradient(135deg, ${t.accent}, ${t.highlight})`, color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.1 }}>
          {name![0]?.toUpperCase()}
        </span>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontFamily: t.headingFamily, fontSize: t.fontPx * 1.05 }}>{name}</strong>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>{notes[0] ?? "Voice: plain and direct"}</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {swatches.map(([label, colour]) => (
          <span key={label} title={label} style={{ flex: 1, height: t.fontPx * 1.8, borderRadius: Math.min(t.radius, 6), background: colour, border: `1px solid ${t.line}` }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.5, lineHeight: 1.1 }}>Headings set like this</span>
        <span style={{ fontSize: t.fontPx * 0.9, color: t.muted }}>Body copy set like this, at the measure the page uses.</span>
      </div>
    </Fill>
  );
}

/** Hand off between phone and desktop. The pattern is derived from the link. */
export function QrBridge({ id, content, theme: t }: PartProps) {
  const target = items(content, ["https://example.com/continue"])[0]!;
  const size = 21;
  const cells = React.useMemo(() => {
    const r = rng(hash(target));
    const finder = (x: number, y: number) => (x < 7 && y < 7) || (x > size - 8 && y < 7) || (x < 7 && y > size - 8);
    const onFinder = (x: number, y: number) => {
      const cx = x < 7 ? x : x - (size - 7);
      const cy = y < 7 ? y : y - (size - 7);
      const d = Math.max(Math.abs(cx - 3), Math.abs(cy - 3));
      return d === 3 || d <= 1;
    };
    return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => (finder(x, y) ? onFinder(x, y) : r() > 0.52)));
  }, [target]);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", alignItems: "center", gap: t.fontPx * 0.8 }}>
      <div role="img" aria-label={`QR code for ${target}`} style={{ width: t.fontPx * 6, height: t.fontPx * 6, flexShrink: 0, background: "oklch(1 0 0)", padding: t.fontPx * 0.3, borderRadius: Math.min(t.radius, 8), display: "grid", gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}>
        {cells.flatMap((row, y) => row.map((on, x) => <span key={`${x}-${y}`} style={{ background: on ? "oklch(0.15 0 0)" : "transparent" }} />))}
      </div>
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontFamily: t.headingFamily, fontSize: t.fontPx * 0.98 }}>Carry on where you left off</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.82 }}>Point a phone at this to open the same page there.</span>
      </span>
    </Fill>
  );
}

/** Changes with the visitor's clock. */
export function WeatherTime({ id, content, theme: t, mode }: PartProps) {
  const [now, setNow] = React.useState(() => new Date(2024, 0, 1, 9, 0));
  useTicker(mode, 1000, () => setNow(new Date()));
  React.useEffect(() => { if (mode === "live") setNow(new Date()); }, [mode]);
  const hour = now.getHours();
  const part = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const glyph = { night: "🌙", morning: "🌅", afternoon: "☀️", evening: "🌆" }[part];
  const typed = items(content, []);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", alignItems: "center", gap: t.fontPx * 0.8, background: `linear-gradient(120deg, ${tint(t.accent, 0.11)}, transparent)` }}>
      <span aria-hidden style={{ fontSize: t.fontPx * 2.2 }}>{glyph}</span>
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontFamily: t.headingFamily, fontSize: t.fontPx * 1.15 }}>
          {typed[0] ?? `Good ${part}`}
        </strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.85, fontVariantNumeric: "tabular-nums" }}>
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {typed[1] ?? "14° and clear"}
        </span>
      </span>
    </Fill>
  );
}

/** How it lands on paper. */
export function PrintLayout({ id, content, theme: t, emit }: PartProps) {
  const lines = items(content, ["Invoice", "Report", "Recipe card"]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.8, padding: t.fontPx * 0.4 }}>
      <div aria-hidden style={{ width: "38%", maxWidth: t.fontPx * 8, aspectRatio: "1 / 1.414", background: "oklch(0.99 0 0)", color: "oklch(0.2 0 0)", borderRadius: 3, boxShadow: "0 6px 18px oklch(0 0 0 / .3)", padding: t.fontPx * 0.5, display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, fontFamily: FAMILY.serif }}>
        <span style={{ fontWeight: 700, fontSize: t.fontPx * 0.6 }}>{lines[0]}</span>
        {Array.from({ length: 7 }, (_, i) => <span key={i} style={{ height: 2, background: `oklch(0.2 0 0 / ${i === 6 ? 0.2 : 0.35})`, width: i === 6 ? "50%" : "100%", borderRadius: 999 }} />)}
        <span style={{ marginTop: "auto", fontSize: t.fontPx * 0.42, color: "oklch(0.45 0 0)" }}>page 1 of 1</span>
      </div>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx }}>Made for paper too</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.82 }}>Navigation drops away, links print their address, nothing is cut off at the margin.</span>
        <Btn t={t} label="Print" primary={false} onClick={() => emit?.({ type: "toast", text: "Print dialog" })} style={{ alignSelf: "flex-start" }} />
      </span>
    </Fill>
  );
}

/** Deliberate layouts at three widths, side by side. */
export function Responsive({ id, content, theme: t }: PartProps) {
  const devices: [string, number, number][] = [["Phone", 60, 118], ["Tablet", 96, 128], ["Desktop", 168, 106]];
  const note = items(content, ["One column", "Two columns", "Three columns"]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: t.fontPx * 0.8, padding: t.fontPx * 0.4 }}>
      {devices.map(([name, w, h], i) => (
        <span key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <span style={{ width: w * (t.fontPx / 16), height: h * (t.fontPx / 16), borderRadius: Math.min(t.radius, 8), border: `2px solid ${t.line}`, background: t.surface, padding: 4, display: "grid", gridTemplateColumns: `repeat(${i + 1}, 1fr)`, gap: 3, alignContent: "start" }}>
            {Array.from({ length: (i + 1) * 3 }, (_, k) => <span key={k} style={{ height: 10, borderRadius: 2, background: k === 0 ? t.accent : `${tint(t.muted, 0.2)}` }} />)}
          </span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.7 }}>{name} · {note[i] ?? ""}</span>
        </span>
      ))}
    </Fill>
  );
}

/** Keyboard, contrast, labels, focus order — with a strip you can Tab through. */
export function A11y({ id, content, theme: t }: PartProps) {
  const checks = items(content, ["Every control reachable by keyboard", "Visible focus, never removed", "Text at 4.5:1 against its background", "Images carry real alt text", "Motion respects reduce-motion"]);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.45, overflow: "auto" }}>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Accessible by default</strong>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3, flex: 1, minHeight: 0 }}>
        {checks.map((c) => (
          <li key={c} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: t.fontPx * 0.85, color: t.muted }}>
            <span aria-hidden style={{ color: t.accent, fontWeight: 700 }}>✓</span>
            {c}
          </li>
        ))}
      </ul>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>Tab through these:</span>
      <div style={{ display: "flex", gap: 6 }}>
        {["One", "Two", "Three"].map((k) => (
          <button
            key={k}
            type="button"
            onFocus={(e) => { e.currentTarget.style.boxShadow = focusRing(t); }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            style={{ padding: `${t.fontPx * 0.28}px ${t.fontPx * 0.6}px`, borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.line}`, background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.8, cursor: "pointer", outline: "none" }}
          >
            {k}
          </button>
        ))}
      </div>
    </Fill>
  );
}

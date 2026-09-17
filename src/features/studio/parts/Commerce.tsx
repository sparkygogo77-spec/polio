"use client";
/**
 * Selling things. Everything here keeps real state in live mode — the cart
 * counts, the checkout validates a card number, the promo code is checked —
 * so a flow can be walked through before any backend exists. What the
 * generator has to make real is written into the blueprint, not faked here.
 */
import * as React from "react";
import { Btn, Fill, Placeholder, PictureSlot, useTicker } from "./primitives";
import { hash, rng, sample, unwritten } from "./sample";
import { cardStyle, items, titled, type Theme } from "./theme";
import { opt, type PartProps } from "./types";

const money = (n: number) => "$" + n.toFixed(2);

/** Reads "Name: 24" or "Name" and gives every product a stable price. */
function catalogue(content: string, fallback: string[], seed: string) {
  const r = rng(hash(seed));
  return items(content, fallback).map((raw) => {
    const { title, body } = titled(raw);
    const typed = body ? Number(body.replace(/[^0-9.]/g, "")) : NaN;
    return { name: title, price: Number.isFinite(typed) && body ? typed : Number(sample.money(r, 12, 180)) };
  });
}

/* ------------------------------------------------------------------ grid */

/** A browsable catalogue, and the saved-for-later list that shares its shape. */
export function ProductGrid({ id, content, options, theme: t, mode, emit, w }: PartProps) {
  const wish = id === "wishlist";
  const n = Math.max(1, Math.min(6, Number(opt(options, "columns", "3")) || 3));
  const products = catalogue(content, wish ? ["Saved one", "Saved two", "Saved three"] : Array.from({ length: n * 2 }, (_, i) => `Product ${i + 1}`), id + content);
  const [saved, setSaved] = React.useState<Record<string, boolean>>(() => (wish ? Object.fromEntries(products.map((p) => [p.name, true])) : {}));

  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${w < 520 ? 1 : n}, 1fr)`, gap: t.fontPx * 0.8, gridAutoRows: "1fr", overflow: "auto" }}>
      {products.map((p) => (
        <div key={p.name} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 6, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: t.fontPx * 3 }}><Placeholder t={t} /></div>
          <span style={{ fontWeight: 600, fontSize: t.fontPx * 0.95, fontFamily: t.headingFamily }}>{p.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: t.accent, fontSize: t.fontPx * 0.95, fontWeight: 600 }}>{money(p.price)}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                aria-label={saved[p.name] ? `Remove ${p.name} from saved` : `Save ${p.name}`}
                aria-pressed={!!saved[p.name]}
                onClick={() => {
                  setSaved((s) => ({ ...s, [p.name]: !s[p.name] }));
                  emit?.({ type: "toast", text: saved[p.name] ? `Removed ${p.name}` : `Saved ${p.name}` });
                }}
                style={{ border: "none", background: "transparent", cursor: mode === "live" ? "pointer" : "default", color: saved[p.name] ? t.accent : t.muted, fontSize: t.fontPx, padding: 2, lineHeight: 1 }}
              >
                {saved[p.name] ? "♥" : "♡"}
              </button>
              <Btn t={t} label={wish ? "Move to cart" : "Add"} onClick={() => emit?.({ type: "cart", delta: 1, item: p.name })} style={{ fontSize: t.fontPx * 0.8, padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.7}px` }} />
            </span>
          </div>
        </div>
      ))}
    </Fill>
  );
}

/* ---------------------------------------------------------------- detail */

/** One product: gallery, options, price, add to cart. */
export function ProductDetail({ id, content, theme: t, mode, emit, w, picture }: PartProps) {
  const [product, ...rest] = catalogue(content, ["This product: 48"], id + content);
  const variants = rest.length ? rest.map((r) => r.name) : ["Small", "Medium", "Large"];
  const [shot, setShot] = React.useState(0);
  const [variant, setVariant] = React.useState(variants[1] ?? variants[0]!);
  const [qty, setQty] = React.useState(1);
  const narrow = w < 640;
  const p = product!;

  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: t.fontPx * 1.2, overflow: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minHeight: t.fontPx * 6 }}><PictureSlot t={t} pic={picture?.pic} src={picture?.src} label={`view ${shot + 1}`} mode={mode} /></div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`View ${i + 1}`}
              aria-pressed={shot === i}
              onClick={() => setShot(i)}
              style={{ width: t.fontPx * 2.6, height: t.fontPx * 2.6, borderRadius: Math.min(t.radius, 8), border: `2px solid ${shot === i ? t.accent : t.line}`, background: `linear-gradient(140deg, ${t.accent}22, ${t.muted}18)`, cursor: "pointer", padding: 0 }}
            />
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.7, lineHeight: 1.15 }}>{p.name}</h2>
        <span style={{ color: t.accent, fontWeight: 700, fontSize: t.fontPx * 1.3 }}>{money(p.price)}</span>
        <p style={{ margin: 0, color: t.muted, fontSize: t.fontPx * 0.92, maxWidth: t.measurePx }}>{unwritten(mode, () => sample.sentence(rng(hash(p.name)), 14), p.name)}</p>
        <div role="radiogroup" aria-label="Options" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {variants.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={variant === v}
              onClick={() => setVariant(v)}
              style={{ padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.8}px`, borderRadius: Math.min(t.radius, 999), cursor: "pointer", font: "inherit", fontSize: t.fontPx * 0.85, border: `1px solid ${variant === v ? t.accent : t.line}`, background: variant === v ? `${t.accent}1e` : "transparent", color: variant === v ? t.accent : t.text }}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <Stepper t={t} value={qty} onChange={setQty} label={p.name} />
          <Btn t={t} label="Add to cart" onClick={() => emit?.({ type: "cart", delta: qty, item: `${qty} × ${p.name} (${variant})` })} />
        </div>
      </div>
    </Fill>
  );
}

function Stepper({ t, value, onChange, label }: { t: Theme; value: number; onChange: (n: number) => void; label: string }) {
  const btn: React.CSSProperties = { width: t.fontPx * 1.8, height: t.fontPx * 1.8, border: "none", background: "transparent", color: t.text, cursor: "pointer", font: "inherit", lineHeight: 1 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 8) }}>
      <button type="button" aria-label={`One fewer ${label}`} onClick={() => onChange(Math.max(1, value - 1))} style={btn}>−</button>
      <span aria-live="polite" style={{ minWidth: t.fontPx * 1.4, textAlign: "center", fontSize: t.fontPx * 0.9 }}>{value}</span>
      <button type="button" aria-label={`One more ${label}`} onClick={() => onChange(value + 1)} style={btn}>+</button>
    </span>
  );
}

/* ------------------------------------------------------------------ cart */

/** A cart that adds up. Quantities change the total; removing a line removes it. */
export function Cart({ id, content, theme: t, emit, onNavigate, link }: PartProps) {
  const start = catalogue(content, ["First item: 24", "Second item: 36"], id + content);
  const [lines, setLines] = React.useState(() => start.map((p) => ({ ...p, qty: 1 })));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", padding: t.fontPx, gap: t.fontPx * 0.6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.1 }}>Cart</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{lines.reduce((s, l) => s + l.qty, 0)} items</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, overflow: "auto", minHeight: 0 }}>
        {lines.length === 0 ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>Your cart is empty.</span> : null}
        {lines.map((l) => (
          <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: t.fontPx * 2.2, height: t.fontPx * 2.2, borderRadius: Math.min(t.radius, 6), background: `linear-gradient(140deg, ${t.accent}2a, ${t.muted}1f)`, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: t.fontPx * 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
            <Stepper t={t} value={l.qty} onChange={(q) => setLines((xs) => xs.map((x) => (x.name === l.name ? { ...x, qty: q } : x)))} label={l.name} />
            <span style={{ width: t.fontPx * 3.6, textAlign: "right", fontSize: t.fontPx * 0.9 }}>{money(l.price * l.qty)}</span>
            <button
              type="button"
              aria-label={`Remove ${l.name}`}
              onClick={() => { setLines((xs) => xs.filter((x) => x.name !== l.name)); emit?.({ type: "cart", delta: -l.qty, item: l.name }); }}
              style={{ border: "none", background: "transparent", color: t.muted, cursor: "pointer", font: "inherit", padding: 2 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: t.fontPx * 0.6, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>Subtotal</span>
        <strong style={{ marginLeft: "auto", fontSize: t.fontPx * 1.1 }}>{money(total)}</strong>
      </div>
      <Btn t={t} label="Checkout" onClick={() => (link ? onNavigate?.(link) : emit?.({ type: "toast", text: `Checkout, ${money(total)}` }))} style={{ width: "100%" }} />
    </Fill>
  );
}

/* -------------------------------------------------------------- checkout */

const luhn = (digits: string) => {
  if (digits.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
};

/** Address → payment → done. The card number is really checked (try 4242…). */
export function Checkout({ id, content, theme: t, emit }: PartProps) {
  const steps = items(content, ["Address", "Payment", "Done"]);
  const [step, setStep] = React.useState(0);
  const [card, setCard] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const digits = card.replace(/\D/g, "");
  const last = steps.length - 1;

  const next = () => {
    if (step === last - 1) {
      if (!luhn(digits)) { setError("That card number doesn't check out."); return; }
      emit?.({ type: "success" });
    }
    setError(null);
    setStep((s) => Math.min(last, s + 1));
  };

  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.7}px`, borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.line}`, background: t.light ? "oklch(1 0 0 / .6)" : "oklch(1 0 0 / .05)", color: t.text, font: "inherit", fontSize: t.fontPx * 0.9 };

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.7, overflow: "auto" }}>
      <ol style={{ display: "flex", gap: 6, margin: 0, padding: 0, listStyle: "none", fontSize: t.fontPx * 0.8 }}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 6, color: i <= step ? t.accent : t.muted }}>
            <span style={{ width: t.fontPx * 1.3, height: t.fontPx * 1.3, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: t.fontPx * 0.7, border: `1px solid ${i <= step ? t.accent : t.line}`, background: i < step ? t.accent : "transparent", color: i < step ? t.accentText : "inherit" }}>{i < step ? "✓" : i + 1}</span>
            {s}
            {i < last ? <span aria-hidden style={{ color: t.line }}>—</span> : null}
          </li>
        ))}
      </ol>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, minHeight: 0 }}>
        {step === 0 ? (
          <>
            <label style={{ fontSize: t.fontPx * 0.8, color: t.muted }}>Name<input style={field} placeholder="Your name" /></label>
            <label style={{ fontSize: t.fontPx * 0.8, color: t.muted }}>Address<input style={field} placeholder="Street, city, postcode" /></label>
          </>
        ) : step === last ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center" }}>
            <span aria-hidden style={{ color: t.accent, fontSize: t.fontPx * 2 }}>✓</span>
            <strong style={{ fontFamily: t.headingFamily }}>Order confirmed</strong>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>A receipt is on its way.</span>
          </div>
        ) : (
          <>
            <label style={{ fontSize: t.fontPx * 0.8, color: t.muted }}>
              Card number
              <input
                style={{ ...field, borderColor: error ? "oklch(0.65 0.2 25)" : t.line, fontFamily: "ui-monospace, monospace" }}
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                value={card}
                onChange={(e) => { setCard(e.target.value.replace(/[^0-9 ]/g, "").slice(0, 19)); setError(null); }}
              />
            </label>
            {error ? <span role="alert" style={{ color: "oklch(0.7 0.19 25)", fontSize: t.fontPx * 0.8 }}>{error}</span> : null}
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {step > 0 && step < last ? <Btn t={t} label="Back" primary={false} onClick={() => { setError(null); setStep((s) => s - 1); }} /> : null}
        {step < last ? <Btn t={t} label={step === last - 1 ? "Pay" : "Continue"} onClick={next} style={{ marginLeft: "auto" }} /> : null}
      </div>
    </Fill>
  );
}

/* --------------------------------------------------------------- pricing */

/** Tiers side by side, with a monthly/yearly switch that changes the numbers. */
export function Pricing({ id, content, options, theme: t, mode, emit, w }: PartProps) {
  const count = Math.max(2, Math.min(4, Number(opt(options, "tiers", "3")) || 3));
  const tiers = items(content, ["Free: 0", "Pro: 12", "Team: 32"].slice(0, count)).map(titled);
  const [yearly, setYearly] = React.useState(false);
  const hot = Math.min(1, tiers.length - 1);

  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.7, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", fontSize: t.fontPx * 0.85 }}>
        <span style={{ color: yearly ? t.muted : t.text }}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="Yearly billing"
          onClick={() => setYearly((v) => !v)}
          style={{ width: t.fontPx * 2.6, height: t.fontPx * 1.4, borderRadius: 999, border: `1px solid ${t.line}`, background: yearly ? t.accent : t.surface, position: "relative", cursor: "pointer", padding: 0 }}
        >
          <span style={{ position: "absolute", top: 2, left: yearly ? "calc(100% - 2px)" : 2, transform: yearly ? "translateX(-100%)" : "none", width: t.fontPx * 1.1, height: t.fontPx * 1.1, borderRadius: 999, background: yearly ? t.accentText : t.muted, transition: "left 160ms, transform 160ms" }} />
        </button>
        <span style={{ color: yearly ? t.text : t.muted }}>Yearly <span style={{ color: t.accent }}>−20%</span></span>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${w < 560 ? 1 : tiers.length}, 1fr)`, gap: t.fontPx * 0.8, minHeight: 0 }}>
        {tiers.map((tier, i) => {
          const base = Number(String(tier.body ?? "").replace(/[^0-9.]/g, "")) || i * 12;
          const price = yearly ? Math.round(base * 0.8) : base;
          return (
            <div key={tier.title} style={{ ...cardStyle(t), border: `1px solid ${i === hot ? t.accent : t.line}`, padding: t.fontPx * 1.1, display: "flex", flexDirection: "column", gap: t.fontPx * 0.45, minHeight: 0 }}>
              {i === hot ? <span style={{ alignSelf: "flex-start", background: `${t.accent}22`, color: t.accent, borderRadius: 999, padding: "1px 8px", fontSize: t.fontPx * 0.7, fontWeight: 700 }}>Recommended</span> : null}
              <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{tier.title}</span>
              <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 2 }}>
                ${price}
                <span style={{ fontSize: t.fontPx * 0.75, color: t.muted, fontWeight: 400 }}>/{yearly ? "mo, billed yearly" : "mo"}</span>
              </span>
              {[0, 1, 2].map((k) => <span key={k} style={{ color: t.muted, fontSize: t.fontPx * 0.88 }}><span style={{ color: t.accent }}>✓</span> {unwritten(mode, () => sample.word(rng(hash(tier.title + k))), `${tier.title} ${k + 1}`)}</span>)}
              <span style={{ marginTop: "auto", display: "flex" }}>
                <Btn t={t} label="Choose" primary={i === hot} onClick={() => emit?.({ type: "toast", text: `${tier.title}, $${price}/mo` })} style={{ width: "100%" }} />
              </span>
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

/** Us against them, feature by feature. */
export function Comparison({ id, content, theme: t }: PartProps) {
  const rows = items(content, ["Unlimited pages", "Own your data", "No ads", "Priority support"]);
  const cols = ["This", "Them", "Also them"];
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: t.fontPx * 0.9 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: t.fontPx * 0.6, color: t.muted, fontWeight: 600, borderBottom: `1px solid ${t.line}` }}>Feature</th>
            {cols.map((c, i) => (
              <th key={c} style={{ padding: t.fontPx * 0.6, borderBottom: `1px solid ${t.line}`, color: i === 0 ? t.accent : t.muted, fontWeight: 700, fontFamily: t.headingFamily }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const r = rng(hash(row));
            return (
              <tr key={row}>
                <td style={{ padding: t.fontPx * 0.55, borderBottom: `1px solid ${t.line}` }}>{row}</td>
                {cols.map((c, ci) => {
                  const yes = ci === 0 || r() > 0.45 - ri * 0.05;
                  return (
                    <td key={c} style={{ padding: t.fontPx * 0.55, textAlign: "center", borderBottom: `1px solid ${t.line}`, color: yes ? t.accent : t.muted }}>
                      {yes ? "✓" : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Fill>
  );
}

/** Quotes with names and faces. */
export function Testimonials({ id, content, theme: t, w }: PartProps) {
  const quotes = items(content, ["It took an afternoon, not a quarter.", "The only tool the whole team actually opens.", "We shipped on the day we said we would."]);
  const people = sample.people(quotes.length, id + content);
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${w < 560 ? 1 : Math.min(3, quotes.length)}, 1fr)`, gap: t.fontPx * 0.8, overflow: "auto" }}>
      {quotes.map((q, i) => {
        const who = people[i] ?? people[0]!;
        return (
          <figure key={q} style={{ ...cardStyle(t), margin: 0, padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6, minHeight: 0 }}>
            <span aria-hidden style={{ color: t.accent, fontFamily: t.headingFamily, fontSize: t.fontPx * 1.8, lineHeight: 0.6 }}>&ldquo;</span>
            <blockquote style={{ margin: 0, flex: 1, fontSize: t.fontPx * 0.95 }}>{q}</blockquote>
            <figcaption style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ width: t.fontPx * 1.9, height: t.fontPx * 1.9, borderRadius: 999, background: `${t.accent}40`, color: t.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: t.fontPx * 0.72, fontWeight: 700 }}>{who.initials}</span>
              <span style={{ fontSize: t.fontPx * 0.85 }}>
                <strong style={{ display: "block", fontWeight: 600 }}>{who.name}</strong>
                <span style={{ color: t.muted }}>{who.role}</span>
              </span>
            </figcaption>
          </figure>
        );
      })}
    </Fill>
  );
}

/** A deadline that actually counts down in live mode. */
export function Countdown({ id, content, theme: t, mode }: PartProps) {
  const label = items(content, ["Offer ends in"])[0]!;
  const [left, setLeft] = React.useState(2 * 86400 + 7 * 3600 + 42 * 60 + 30);
  useTicker(mode, 1000, () => setLeft((s) => Math.max(0, s - 1)));
  const parts: [string, number][] = [
    ["days", Math.floor(left / 86400)],
    ["hours", Math.floor((left % 86400) / 3600)],
    ["mins", Math.floor((left % 3600) / 60)],
    ["secs", left % 60],
  ];
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: t.fontPx * 0.5 }}>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>{label}</span>
      <div style={{ display: "flex", gap: t.fontPx * 0.5 }}>
        {parts.map(([name, value]) => (
          <div key={name} style={{ ...cardStyle(t), padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.8}px`, textAlign: "center", minWidth: t.fontPx * 3 }}>
            <div style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.7, fontVariantNumeric: "tabular-nums" }}>{String(value).padStart(2, "0")}</div>
            <div style={{ color: t.muted, fontSize: t.fontPx * 0.68, textTransform: "uppercase", letterSpacing: 0.6 }}>{name}</div>
          </div>
        ))}
      </div>
    </Fill>
  );
}

/** A promo code box, and the referral link that shares its shape. */
export function Discount({ id, content, theme: t, emit }: PartProps) {
  const referral = id === "affiliate";
  const codes = items(content, referral ? ["yourname"] : ["SAVE10", "WELCOME"]);
  const [code, setCode] = React.useState("");
  const [state, setState] = React.useState<"idle" | "ok" | "bad">("idle");
  const url = `https://example.com/?ref=${codes[0]}`;

  if (referral) {
    return (
      <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.05 }}>Your referral link</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.6}px`, borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.line}`, fontFamily: "ui-monospace, monospace", fontSize: t.fontPx * 0.82 }}>{url}</code>
          <Btn t={t} label="Copy" onClick={() => { void navigator.clipboard?.writeText(url); emit?.({ type: "toast", text: "Link copied", level: "success" }); }} />
        </div>
        <div style={{ display: "flex", gap: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.85 }}>
          <span><strong style={{ color: t.text }}>128</strong> clicks</span>
          <span><strong style={{ color: t.text }}>14</strong> signups</span>
          <span><strong style={{ color: t.accent }}>$210</strong> earned</span>
        </div>
      </Fill>
    );
  }

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>Promo code</span>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          aria-label="Promo code"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setState("idle"); }}
          placeholder={codes[0]}
          style={{ flex: 1, minWidth: 0, padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.6}px`, borderRadius: Math.min(t.radius, 8), border: `1px solid ${state === "bad" ? "oklch(0.65 0.2 25)" : t.line}`, background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.9, letterSpacing: 1 }}
        />
        <Btn
          t={t}
          label="Apply"
          onClick={() => {
            const ok = codes.some((c) => c.toUpperCase() === code.trim());
            setState(ok ? "ok" : "bad");
            emit?.({ type: "toast", text: ok ? "Code applied" : "That code isn't valid", level: ok ? "success" : "error" });
          }}
        />
      </div>
      {state !== "idle" ? (
        <span role="status" style={{ fontSize: t.fontPx * 0.8, color: state === "ok" ? t.accent : "oklch(0.7 0.19 25)" }}>
          {state === "ok" ? "Applied, 10% off at checkout." : "That code isn't valid."}
        </span>
      ) : null}
    </Fill>
  );
}

/** The plan you are on, and how to change it. */
export function Subscription({ id, content, theme: t, emit }: PartProps) {
  const plans = items(content, ["Free: 0", "Pro: 12", "Team: 32"]).map(titled);
  const [current, setCurrent] = React.useState(plans[1]?.title ?? plans[0]!.title);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.05 }}>Your plan</strong>
        <span style={{ marginLeft: "auto", background: `${t.accent}22`, color: t.accent, borderRadius: 999, padding: "1px 9px", fontSize: t.fontPx * 0.75, fontWeight: 700 }}>{current}</span>
      </div>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>Renews on the 1st. Cancel any time.</span>
      <div role="radiogroup" aria-label="Plan" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {plans.map((p) => (
          <button
            key={p.title}
            type="button"
            role="radio"
            aria-checked={current === p.title}
            onClick={() => { setCurrent(p.title); emit?.({ type: "toast", text: `Switched to ${p.title}`, level: "success" }); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: t.fontPx * 0.55, borderRadius: Math.min(t.radius, 8), border: `1px solid ${current === p.title ? t.accent : t.line}`, background: current === p.title ? `${t.accent}14` : "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.9, cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ width: t.fontPx * 0.8, height: t.fontPx * 0.8, borderRadius: 999, border: `2px solid ${current === p.title ? t.accent : t.line}`, background: current === p.title ? t.accent : "transparent" }} />
            <span style={{ flex: 1 }}>{p.title}</span>
            <span style={{ color: t.muted }}>${String(p.body ?? "0").replace(/[^0-9.]/g, "") || "0"}/mo</span>
          </button>
        ))}
      </div>
      <Btn t={t} label="Manage billing" primary={false} onClick={() => emit?.({ type: "toast", text: "Billing portal" })} />
    </Fill>
  );
}

/** A receipt you can print. */
export function Invoice({ id, content, theme: t, emit }: PartProps) {
  const lines = catalogue(content, ["First item: 24", "Second item: 36", "Delivery: 6"], id + content);
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  const tax = subtotal * 0.2;
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, fontSize: t.fontPx * 0.9, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.05 }}>Receipt</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.8 }}>#{1000 + (hash(id + content) % 8999)}</span>
        <span style={{ marginLeft: "auto", color: t.accent, fontSize: t.fontPx * 0.78, fontWeight: 700 }}>PAID</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minHeight: 0 }}>
        {lines.map((l) => (
          <div key={l.name} style={{ display: "flex", gap: 8, borderBottom: `1px solid ${t.line}`, padding: "3px 0" }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(l.price)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: t.muted }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", color: t.muted }}><span>Tax</span><span>{money(tax)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: t.fontPx }}><span>Total</span><span>{money(subtotal + tax)}</span></div>
      <Btn t={t} label="Download PDF" primary={false} onClick={() => emit?.({ type: "toast", text: "Receipt downloaded" })} />
    </Fill>
  );
}

/** Points, credits, coins — an in-site balance with a ledger. */
export function CoinEconomy({ id, content, theme: t, emit }: PartProps) {
  const name = items(content, ["Credits"])[0]!;
  const [balance, setBalance] = React.useState(1250);
  const ledger = React.useMemo(() => {
    const r = rng(hash(id + content));
    return Array.from({ length: 4 }, () => ({ what: sample.word(r), amount: sample.int(r, -180, 320) }));
  }, [id, content]);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ width: t.fontPx * 2, height: t.fontPx * 2, borderRadius: 999, background: `radial-gradient(circle at 35% 30%, ${t.highlight}, ${t.accent})`, color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: t.fontPx * 0.85 }}>◎</span>
        <span>
          <strong aria-live="polite" style={{ display: "block", fontFamily: t.headingFamily, fontSize: t.fontPx * 1.5, fontVariantNumeric: "tabular-nums" }}>{balance.toLocaleString()}</strong>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.8 }}>{name}</span>
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Btn t={t} label="Earn more" onClick={() => { setBalance((b) => b + 50); emit?.({ type: "toast", text: `+50 ${name}`, level: "success" }); }} style={{ fontSize: t.fontPx * 0.8 }} />
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "auto", minHeight: 0, fontSize: t.fontPx * 0.85 }}>
        {ledger.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: `1px solid ${t.line}` }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.muted }}>{l.what}</span>
            <span style={{ color: l.amount >= 0 ? t.accent : t.muted, fontVariantNumeric: "tabular-nums" }}>{l.amount >= 0 ? "+" : ""}{l.amount}</span>
          </div>
        ))}
      </div>
    </Fill>
  );
}

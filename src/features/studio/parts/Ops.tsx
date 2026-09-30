"use client";
/**
 * Under the hood: the parts nobody sees until they matter. Each one is a
 * truthful panel rather than a chip, because looking at it is how you decide
 * whether you need it — and the blueprint carries the real requirement.
 */
import * as React from "react";
import { Btn, Fill, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items, titled, FAMILY, type Theme, tint } from "./theme";
import type { PartProps } from "./types";

function Bar({ t, pct, colour }: { t: Theme; pct: number; colour?: string }) {
  return (
    <span style={{ display: "block", height: 5, borderRadius: 999, background: `${tint(t.muted, 0.149)}`, overflow: "hidden" }}>
      <span style={{ display: "block", width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: colour ?? t.accent }} />
    </span>
  );
}

/** How the page looks in search results and when it is shared. */
export function MetaPreview({ id, content, theme: t }: PartProps) {
  const [title, description] = items(content, ["Your page title, under sixty characters", "The sentence that decides whether anyone clicks. Around 155 characters is right."]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.6, overflow: "auto" }}>
      <div style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>example.com › this-page</span>
        <span style={{ color: t.accent, fontSize: t.fontPx * 1.05, fontFamily: t.headingFamily }}>{title}</span>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.82 }}>{description}</span>
      </div>
      <div style={{ ...cardStyle(t), overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <span style={{ height: t.fontPx * 3.4, background: `linear-gradient(120deg, ${tint(t.accent, 0.267)}, ${tint(t.highlight, 0.2)})` }} />
        <span style={{ padding: t.fontPx * 0.5, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.68, textTransform: "uppercase", letterSpacing: 0.5 }}>example.com</span>
          <span style={{ fontWeight: 600, fontSize: t.fontPx * 0.88 }}>{title}</span>
        </span>
      </div>
    </Fill>
  );
}

/** What people actually do. */
export function Analytics({ id, content, theme: t }: PartProps) {
  const pages = items(content, ["/", "/pricing", "/docs", "/about"]);
  const r = rng(hash(id + content));
  const rows = pages.map((page) => ({ page, views: sample.int(r, 200, 9000) })).sort((a, b) => b.views - a.views);
  const max = rows[0]?.views || 1;
  const sources = ["Direct", "Search", "Social"].map((s) => ({ s, pct: sample.int(r, 12, 60) }));
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.45, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Last 7 days</strong>
        <span style={{ marginLeft: "auto", color: t.accent, fontSize: t.fontPx * 0.8 }}>▲ {sample.int(r, 3, 40)}%</span>
      </div>
      {rows.map((row) => (
        <div key={row.page} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ display: "flex", gap: 8, fontSize: t.fontPx * 0.82 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FAMILY.monospace }}>{row.page}</span>
            <span style={{ color: t.muted, fontVariantNumeric: "tabular-nums" }}>{row.views.toLocaleString()}</span>
          </span>
          <Bar t={t} pct={(row.views / max) * 100} />
        </div>
      ))}
      <div style={{ display: "flex", gap: t.fontPx * 0.7, color: t.muted, fontSize: t.fontPx * 0.75, marginTop: "auto", paddingTop: 4, borderTop: `1px solid ${t.line}` }}>
        {sources.map((s) => <span key={s.s}>{s.s} <strong style={{ color: t.text }}>{s.pct}%</strong></span>)}
      </div>
    </Fill>
  );
}

/** Where the data lives, and what shape it is. */
export function Database({ id, content, theme: t, mode }: PartProps) {
  const tables = items(content, ["users: id, email, created", "pages: id, title, body", "orders: id, user, total"]).map(titled);
  const [open, setOpen] = React.useState(tables[0]?.title ?? "");
  const r = rng(hash(id + content));
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 4, overflow: "auto", fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.82 }}>
      {tables.map((table) => (
        <div key={table.title}>
          <button
            type="button"
            aria-expanded={open === table.title}
            onClick={() => setOpen((v) => (v === table.title ? "" : table.title))}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: `${t.fontPx * 0.25}px 0`, color: t.text, font: "inherit", cursor: mode === "live" ? "pointer" : "default", textAlign: "left" }}
          >
            <span aria-hidden style={{ color: t.accent, transform: open === table.title ? "rotate(90deg)" : "none", transition: "transform 140ms" }}>▸</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table.title}</span>
            <span style={{ color: t.muted }}>{sample.int(r, 40, 90000).toLocaleString()} rows</span>
          </button>
          {open === table.title ? (
            <div style={{ paddingLeft: t.fontPx * 1.2, display: "flex", flexDirection: "column", gap: 1, color: t.muted, fontSize: t.fontPx * 0.75 }}>
              {(table.body ?? "id, created").split(",").map((col) => <span key={col}>{col.trim()} <span style={{ opacity: 0.6 }}>text</span></span>)}
            </div>
          ) : null}
        </div>
      ))}
    </Fill>
  );
}

/** Endpoints other software can call, with a sample response. */
export function Api({ id, content, theme: t, mode }: PartProps) {
  const routes = items(content, ["GET /api/pages", "POST /api/pages", "GET /api/pages/:id"]);
  const [picked, setPicked] = React.useState(routes[0]!);
  const body = React.useMemo(() => JSON.stringify({ ok: true, data: sample.rows(["id", "title"], 2, picked) }, null, 2), [picked]);
  const colourOf = (route: string) => (route.startsWith("POST") ? "oklch(0.72 0.15 140)" : route.startsWith("DELETE") ? "oklch(0.68 0.19 25)" : t.accent);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 5, overflow: "hidden", fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.8 }}>
      {routes.map((route) => {
        const [verb, ...pathParts] = route.split(" ");
        return (
          <button
            key={route}
            type="button"
            aria-pressed={picked === route}
            onClick={() => setPicked(route)}
            style={{ display: "flex", gap: 8, alignItems: "center", background: picked === route ? `${tint(t.accent, 0.078)}` : "transparent", border: "none", borderRadius: Math.min(t.radius, 6), padding: `${t.fontPx * 0.25}px ${t.fontPx * 0.35}px`, color: t.text, font: "inherit", cursor: mode === "live" ? "pointer" : "default", textAlign: "left" }}
          >
            <span style={{ color: colourOf(route), fontWeight: 700, width: t.fontPx * 3 }}>{verb}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.muted }}>{pathParts.join(" ")}</span>
          </button>
        );
      })}
      <pre style={{ margin: 0, flex: 1, minHeight: 0, overflow: "auto", background: t.light ? "oklch(0.2 0.01 260)" : "oklch(0.12 0.01 260)", color: "oklch(0.85 0.02 260)", borderRadius: Math.min(t.radius, 8), padding: t.fontPx * 0.5, fontSize: t.fontPx * 0.72 }}>
        {body}
      </pre>
    </Fill>
  );
}

/** Installable, and useful with no connection. */
export function Pwa({ id, content, theme: t, emit }: PartProps) {
  const [installed, setInstalled] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const name = items(content, ["This site"])[0]!;
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: t.fontPx * 2.4, height: t.fontPx * 2.4, borderRadius: Math.min(t.radius, 10), background: `linear-gradient(135deg, ${t.accent}, ${t.highlight})`, color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{name[0]?.toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: t.fontPx * 0.95 }}>{name}</strong>
          <span style={{ color: online ? t.muted : "oklch(0.75 0.16 70)", fontSize: t.fontPx * 0.78 }}>{online ? "Ready to install" : "Offline, showing saved pages"}</span>
        </span>
        <Btn t={t} label={installed ? "Installed" : "Install"} primary={!installed} onClick={() => { setInstalled(true); emit?.({ type: "toast", text: "Added to your home screen", level: "success" }); }} />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!online}
        onClick={() => setOnline((v) => !v)}
        style={{ alignSelf: "flex-start", background: "transparent", border: `1px solid ${t.line}`, borderRadius: 999, padding: `2px ${t.fontPx * 0.6}px`, color: t.muted, font: "inherit", fontSize: t.fontPx * 0.75, cursor: "pointer" }}
      >
        Simulate {online ? "offline" : "online"}
      </button>
    </Fill>
  );
}

/** A budget, and whether it is being kept. */
export function Perf({ id, content, theme: t }: PartProps) {
  const budgets = items(content, ["Largest paint: 1.8s of 2.5s", "Layout shift: 0.04 of 0.1", "JavaScript: 180kB of 250kB"]).map(titled);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Speed budget</strong>
      {budgets.map((b) => {
        const nums = String(b.body ?? "").match(/[\d.]+/g)?.map(Number) ?? [1, 2];
        const pct = ((nums[0] ?? 0) / (nums[1] || 1)) * 100;
        const over = pct > 100;
        return (
          <div key={b.title} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ display: "flex", gap: 8, fontSize: t.fontPx * 0.82 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</span>
              <span style={{ color: over ? "oklch(0.7 0.19 25)" : t.accent, fontVariantNumeric: "tabular-nums" }}>{b.body}</span>
            </span>
            <Bar t={t} pct={pct} colour={over ? "oklch(0.68 0.19 25)" : t.accent} />
          </div>
        );
      })}
    </Fill>
  );
}

/** Proof it still works. Running it again really re-runs. */
export function Testing({ id, content, theme: t, mode, emit }: PartProps) {
  const names = items(content, ["adds a part to the board", "keeps the board after reload", "checkout rejects a bad card", "phone layout stacks"]);
  const [run, setRun] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const results = React.useMemo(() => {
    const r = rng(hash(id + content + run));
    return names.map((name) => ({ name, ok: r() > 0.12, ms: sample.int(r, 12, 900) }));
  }, [names.join("|"), id, content, run]);
  const failed = results.filter((x) => !x.ok).length;
  useTicker(mode, 700, () => { setBusy(false); setRun((v) => v + 1); }, busy);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.92 }}>{results.length - failed}/{results.length} passing</strong>
        <span style={{ marginLeft: "auto" }}>
          <Btn t={t} label={busy ? "Running…" : "Run"} primary={false} onClick={() => { setBusy(true); emit?.({ type: "toast", text: "Running tests…" }); }} style={{ fontSize: t.fontPx * 0.75 }} />
        </span>
      </div>
      {results.map((x) => (
        <div key={x.name} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: t.fontPx * 0.82, opacity: busy ? 0.5 : 1 }}>
          <span aria-hidden style={{ color: x.ok ? t.accent : "oklch(0.7 0.19 25)", fontWeight: 700 }}>{x.ok ? "✓" : "✕"}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: x.ok ? t.muted : t.text }}>{x.name}</span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.7, fontVariantNumeric: "tabular-nums" }}>{x.ms}ms</span>
        </div>
      ))}
    </Fill>
  );
}

/** The email that goes out, as it will land. */
export function EmailPreview({ id, content, theme: t, emit }: PartProps) {
  const [subject, ...body] = items(content, ["Your receipt from us", "Thanks, here's what you bought.", "Questions? Just reply to this email."]);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: t.fontPx * 0.55, borderBottom: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 1, fontSize: t.fontPx * 0.78 }}>
        <span style={{ fontWeight: 600, fontSize: t.fontPx * 0.9 }}>{subject}</span>
        <span style={{ color: t.muted }}>from hello@example.com · to you</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, fontSize: t.fontPx * 0.85 }}>
        {body.map((line) => <span key={line} style={{ color: t.muted }}>{line}</span>)}
        <Btn t={t} label="View your order" onClick={() => emit?.({ type: "toast", text: "Opens the order page" })} style={{ alignSelf: "flex-start" }} />
      </div>
      <span style={{ padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.7}px`, borderTop: `1px solid ${t.line}`, color: t.muted, fontSize: t.fontPx * 0.68 }}>Unsubscribe · sent by this site</span>
    </Fill>
  );
}

/** Copy anyone can change, edited where it sits. */
export function Cms({ id, content, theme: t, mode, emit }: PartProps) {
  const original = items(content, ["Click this text to edit it, then save."])[0]!;
  const [text, setText] = React.useState(original);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(original);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, justifyContent: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: t.muted, fontSize: t.fontPx * 0.72 }}>
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: editing ? "oklch(0.75 0.16 70)" : t.accent }} />
        {editing ? "Editing, unsaved" : "Editable"}
      </span>
      {editing ? (
        <>
          <textarea
            aria-label="Edit text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            style={{ resize: "none", padding: t.fontPx * 0.5, borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.accent}`, background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.9, outline: "none" }}
          />
          <span style={{ display: "flex", gap: 6 }}>
            <Btn t={t} label="Save" onClick={() => { setText(draft); setEditing(false); emit?.({ type: "toast", text: "Saved", level: "success" }); }} />
            <Btn t={t} label="Cancel" primary={false} onClick={() => { setDraft(text); setEditing(false); }} />
          </span>
        </>
      ) : (
        <button
          type="button"
          onClick={() => (mode === "live" ? setEditing(true) : undefined)}
          style={{ textAlign: "left", background: "transparent", border: `1px dashed ${t.line}`, borderRadius: Math.min(t.radius, 8), padding: t.fontPx * 0.5, color: t.text, font: "inherit", fontSize: t.fontPx * 0.92, cursor: mode === "live" ? "text" : "default" }}
        >
          {text}
        </button>
      )}
    </Fill>
  );
}

/** Draft, publish, roll back. */
export function Versions({ id, content, theme: t, emit }: PartProps) {
  const entries = items(content, ["Published: live since Tuesday", "Draft: new pricing copy", "Published: launch version"]).map(titled);
  const [current, setCurrent] = React.useState(0);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
      {entries.map((e, i) => {
        const draft = /draft/i.test(e.title);
        return (
          <div key={e.title + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.4}px`, borderRadius: Math.min(t.radius, 8), background: current === i ? `${tint(t.accent, 0.071)}` : undefined, fontSize: t.fontPx * 0.85 }}>
            <span style={{ background: draft ? "oklch(0.75 0.16 70 / .18)" : `${tint(t.accent, 0.133)}`, color: draft ? "oklch(0.8 0.15 70)" : t.accent, borderRadius: 999, padding: "0 7px", fontSize: t.fontPx * 0.66, fontWeight: 700 }}>
              {draft ? "DRAFT" : "LIVE"}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.muted }}>{e.body ?? e.title}</span>
            {current === i ? (
              <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>current</span>
            ) : (
              <Btn t={t} label="Restore" primary={false} onClick={() => { setCurrent(i); emit?.({ type: "toast", text: "Restored", level: "success" }); }} style={{ fontSize: t.fontPx * 0.7, padding: `${t.fontPx * 0.18}px ${t.fontPx * 0.45}px` }} />
            )}
          </div>
        );
      })}
    </Fill>
  );
}

/** Connect a third-party service, and see that it is connected. */
export function Integration({ id, content, theme: t, emit }: PartProps) {
  const services = items(content, ["Stripe: takes the payments", "Resend: sends the email", "Plausible: counts the visits"]).map(titled);
  const [on, setOn] = React.useState<Record<string, boolean>>({});
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, overflow: "auto" }}>
      {services.map((s) => (
        <div key={s.title} style={{ ...cardStyle(t), padding: t.fontPx * 0.6, display: "flex", alignItems: "center", gap: 9 }}>
          <span aria-hidden style={{ width: t.fontPx * 2, height: t.fontPx * 2, borderRadius: Math.min(t.radius, 8), background: `${tint(t.accent, 0.133)}`, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.accent, fontWeight: 700, fontSize: t.fontPx * 0.8 }}>
            {s.title[0]}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: t.fontPx * 0.9 }}>{s.title}</strong>
            <span style={{ color: on[s.title] ? t.accent : t.muted, fontSize: t.fontPx * 0.76 }}>{on[s.title] ? "Connected" : s.body ?? "Not connected"}</span>
          </span>
          <Btn
            t={t}
            label={on[s.title] ? "Disconnect" : "Connect"}
            primary={!on[s.title]}
            onClick={() => { setOn((v) => ({ ...v, [s.title]: !v[s.title] })); emit?.({ type: "toast", text: on[s.title] ? `${s.title} disconnected` : `${s.title} connected`, level: "success" }); }}
            style={{ fontSize: t.fontPx * 0.78 }}
          />
        </div>
      ))}
    </Fill>
  );
}

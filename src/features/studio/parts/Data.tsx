"use client";
/**
 * Numbers made legible. Charts are hand-drawn SVG — no chart library, because
 * the whole folder ships with a generated site and a dependency would ship
 * with it. Everything is seeded from `sample.ts`, so the board, the preview
 * and the built site show the same figures.
 */
import * as React from "react";
import { Btn, Fill, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items, titled, type Theme } from "./theme";
import { opt, type PartProps } from "./types";

/** Title and body share the same header treatment across this file. */
function Head({ t, title, right }: { t: Theme; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>{title}</strong>
      {right ? <span style={{ marginLeft: "auto", color: t.muted, fontSize: t.fontPx * 0.8 }}>{right}</span> : null}
    </div>
  );
}

const path = (values: number[], w: number, h: number, pad = 4) => {
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => `${i ? "L" : "M"}${(pad + i * step).toFixed(1)},${(h - pad - (v / 100) * (h - pad * 2)).toFixed(1)}`).join(" ");
};

/* ----------------------------------------------------------------- chart */

/** Lines, bars, areas and the tiny inline trend. Hover reads a value out. */
export function Chart({ id, content, options, theme: t, mode, w, h }: PartProps) {
  const spark = id === "sparkline";
  const series = items(content, spark ? ["Trend"] : ["This year", "Last year"]);
  const kind = opt(options, "kind", spark ? "line" : "line");
  const [at, setAt] = React.useState<number | null>(null);
  const box = { w: Math.max(80, w - (spark ? 0 : 24)), h: Math.max(40, h - (spark ? 0 : t.fontPx * 3.2)) };
  const data = series.map((name) => ({ name, values: sample.series(spark ? 16 : 24, id + name + content) }));
  const n = data[0]!.values.length;

  const body = (
    <svg
      viewBox={`0 0 ${box.w} ${box.h}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`${series.join(" and ")} over time`}
      preserveAspectRatio="none"
      onMouseMove={mode === "live" ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setAt(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
      } : undefined}
      onMouseLeave={() => setAt(null)}
      style={{ display: "block", overflow: "visible" }}
    >
      {!spark ? [0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={box.w} y1={box.h * g} y2={box.h * g} stroke={t.line} strokeWidth={1} />
      )) : null}
      {data.map((d, si) => {
        const colour = si === 0 ? t.accent : t.highlight;
        if (kind === "bar" || (kind === "mixed" && si === 1)) {
          const bw = (box.w / d.values.length) * 0.7;
          return (
            <g key={d.name}>
              {d.values.map((v, i) => (
                <rect key={i} x={(i + 0.15) * (box.w / d.values.length)} y={box.h - (v / 100) * box.h} width={bw} height={(v / 100) * box.h} fill={colour} opacity={si ? 0.55 : 0.85} rx={2} />
              ))}
            </g>
          );
        }
        return (
          <g key={d.name}>
            {kind === "area" ? <path d={`${path(d.values, box.w, box.h)} L${box.w},${box.h} L0,${box.h} Z`} fill={colour} opacity={0.16} /> : null}
            <path d={path(d.values, box.w, box.h)} fill="none" stroke={colour} strokeWidth={spark ? 1.6 : 2} strokeLinejoin="round" strokeLinecap="round" opacity={si ? 0.6 : 1} />
          </g>
        );
      })}
      {at !== null ? (
        <g>
          <line x1={(at / (n - 1)) * box.w} x2={(at / (n - 1)) * box.w} y1={0} y2={box.h} stroke={t.muted} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={(at / (n - 1)) * box.w} cy={box.h - (data[0]!.values[at]! / 100) * box.h} r={3.5} fill={t.accent} />
        </g>
      ) : null}
    </svg>
  );

  if (spark) {
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: t.fontPx * 0.6 }}>
        <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.6, fontVariantNumeric: "tabular-nums" }}>{data[0]!.values.at(-1)}</span>
        <span style={{ flex: 1, height: "60%", minWidth: 40 }}>{body}</span>
        <span style={{ color: t.accent, fontSize: t.fontPx * 0.8 }}>▲</span>
      </Fill>
    );
  }

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4 }}>
      <Head t={t} title={items(content, ["Over time"])[0]!} right={at !== null ? `${data[0]!.values[at]}` : `${n} points`} />
      <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
      <div style={{ display: "flex", gap: t.fontPx * 0.7, color: t.muted, fontSize: t.fontPx * 0.75, flexShrink: 0 }}>
        {data.map((d, i) => (
          <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? t.accent : t.highlight }} />
            {d.name}
          </span>
        ))}
      </div>
    </Fill>
  );
}

/** How a whole splits into parts. */
export function Pie({ id, content, theme: t, mode }: PartProps) {
  const slices = items(content, ["Direct", "Search", "Social", "Referral"]);
  const r = rng(hash(id + content));
  const raw = slices.map(() => 10 + r() * 40);
  const total = raw.reduce((a, b) => a + b, 0);
  const shares = raw.map((v) => v / total);
  const [hot, setHot] = React.useState<number | null>(null);
  const hues = [t.accent, t.highlight, `${t.accent}88`, `${t.highlight}88`, `${t.muted}99`];
  let acc = 0;
  const stops = shares.map((s, i) => {
    const from = acc * 100;
    acc += s;
    return `${hues[i % hues.length]} ${from.toFixed(2)}% ${(acc * 100).toFixed(2)}%`;
  });

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", alignItems: "center", gap: t.fontPx }}>
      <div
        role="img"
        aria-label={slices.map((s, i) => `${s} ${Math.round(shares[i]! * 100)}%`).join(", ")}
        style={{ width: "40%", aspectRatio: "1", maxHeight: "100%", borderRadius: 999, background: `conic-gradient(${stops.join(", ")})`, position: "relative", flexShrink: 0 }}
      >
        <span style={{ position: "absolute", inset: "26%", borderRadius: 999, background: t.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 0.95 }}>
          {hot === null ? "100%" : `${Math.round(shares[hot]! * 100)}%`}
        </span>
      </div>
      <ul style={{ flex: 1, margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, minWidth: 0, fontSize: t.fontPx * 0.85 }}>
        {slices.map((s, i) => (
          <li
            key={s}
            onMouseEnter={mode === "live" ? () => setHot(i) : undefined}
            onMouseLeave={() => setHot(null)}
            style={{ display: "flex", alignItems: "center", gap: 6, opacity: hot === null || hot === i ? 1 : 0.5 }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 2, background: hues[i % hues.length], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
            <span style={{ color: t.muted, fontVariantNumeric: "tabular-nums" }}>{Math.round(shares[i]! * 100)}%</span>
          </li>
        ))}
      </ul>
    </Fill>
  );
}

/** Density over two dimensions. */
export function Heatmap({ id, content, theme: t, mode }: PartProps) {
  const rowNames = items(content, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const cols = 18;
  const r = rng(hash(id + content));
  const cells = rowNames.map((row) => ({ row, values: Array.from({ length: cols }, () => r()) }));
  const [tip, setTip] = React.useState<string | null>(null);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6 }}>
      <Head t={t} title={"Activity"} right={tip ?? "less → more"} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minHeight: 0 }}>
        {cells.map(({ row, values }) => (
          <div key={row} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minHeight: 0 }}>
            <span style={{ width: t.fontPx * 2.2, color: t.muted, fontSize: t.fontPx * 0.7, flexShrink: 0 }}>{row}</span>
            {values.map((v, i) => (
              <span
                key={i}
                onMouseEnter={mode === "live" ? () => setTip(`${row} · ${Math.round(v * 100)}`) : undefined}
                onMouseLeave={() => setTip(null)}
                style={{ flex: 1, height: "100%", minWidth: 4, borderRadius: 2, background: v < 0.12 ? `${t.muted}22` : t.accent, opacity: v < 0.12 ? 1 : 0.2 + v * 0.8 }}
              />
            ))}
          </div>
        ))}
      </div>
    </Fill>
  );
}

/* ----------------------------------------------------------------- tiles */

/** Headline numbers with a change indicator, and the goal bar beside them. */
export function StatTiles({ id, content, options, theme: t, w }: PartProps) {
  const goal = id === "progress-tracker";
  const tiles = items(content, goal ? ["Signups: 640", "Goal: 1000"] : ["Users", "Revenue", "Uptime", "Orders"]).map(titled);
  const n = Math.max(1, Math.min(6, Number(opt(options, "columns", String(Math.min(4, tiles.length)))) || tiles.length));

  if (goal) {
    const value = Number(String(tiles[0]?.body ?? "").replace(/\D/g, "")) || 640;
    const target = Number(String(tiles[1]?.body ?? "").replace(/\D/g, "")) || 1000;
    const pct = Math.max(0, Math.min(100, (value / target) * 100));
    return (
      <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
        <Head t={t} title={tiles[0]?.title ?? "Progress"} right={`${Math.round(pct)}%`} />
        <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={tiles[0]?.title ?? "Progress"} style={{ height: t.fontPx * 0.7, borderRadius: 999, background: `${t.muted}28`, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${t.accent}, ${t.highlight})` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: t.muted, fontSize: t.fontPx * 0.8 }}>
          <span>{value.toLocaleString()}</span>
          <span>{target.toLocaleString()}</span>
        </div>
      </Fill>
    );
  }

  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${w < 460 ? Math.min(2, n) : n}, 1fr)`, gap: t.fontPx * 0.6, overflow: "auto" }}>
      {tiles.map((tile, i) => {
        const r = rng(hash(id + tile.title));
        const series = sample.series(12, id + tile.title);
        const delta = sample.int(r, -9, 24);
        return (
          <div key={tile.title} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: 2, minHeight: 0, overflow: "hidden" }}>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>{tile.title}</span>
            <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.6, fontVariantNumeric: "tabular-nums" }}>
              {tile.body ?? (i === 1 ? "$" + sample.money(r, 4000, 90000) : sample.int(r, 120, 9800).toLocaleString())}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: delta >= 0 ? t.accent : "oklch(0.7 0.19 25)", fontSize: t.fontPx * 0.78 }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>
              <svg viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden style={{ flex: 1, height: t.fontPx * 0.9, minWidth: 0 }}>
                <path d={path(series, 60, 16, 1)} fill="none" stroke={t.accent} strokeWidth={1.4} opacity={0.7} />
              </svg>
            </span>
          </div>
        );
      })}
    </Fill>
  );
}

/* ----------------------------------------------------------------- table */

const ROW_COUNT: Record<string, number> = { dozens: 40, hundreds: 400, "thousands+": 5000 };

/** Sortable, filterable, and windowed so thousands of rows stay smooth. */
export function DataTable({ id, content, options, theme: t, mode, emit, h }: PartProps) {
  const dense = id === "dense-tables";
  const cols = items(content, dense ? ["ID", "Name", "Status", "Amount", "Updated", "Owner"] : ["Name", "Status", "Amount", "Updated"]);
  const total = ROW_COUNT[opt(options, "rows", "hundreds")] ?? 400;
  const rows = React.useMemo(() => sample.rows(cols, total, id + content), [cols.join("|"), total, id, content]);

  const [sort, setSort] = React.useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [query, setQuery] = React.useState("");
  const rowH = Math.round(t.fontPx * (dense ? 1.5 : 2.1));

  const view = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => cols.some((c) => String(r[c]).toLowerCase().includes(q))) : rows;
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => String(a[sort.col]).localeCompare(String(b[sort.col]), undefined, { numeric: true }) * sort.dir);
  }, [rows, query, sort, cols.join("|")]);

  const [top, setTop] = React.useState(0);
  const viewport = Math.max(120, h - t.fontPx * (dense ? 4.6 : 6.4));
  const first = Math.max(0, Math.floor(top / rowH) - 4);
  const slice = view.slice(first, first + Math.ceil(viewport / rowH) + 8);
  const grid = `repeat(${cols.length}, minmax(0, 1fr))`;

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", fontSize: t.fontPx * (dense ? 0.82 : 0.9), overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.7}px`, borderBottom: `1px solid ${t.line}` }}>
        <input
          aria-label="Filter rows"
          placeholder="Filter…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setTop(0); }}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: t.text, font: "inherit", fontSize: t.fontPx * 0.85 }}
        />
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.75, whiteSpace: "nowrap" }}>{view.length.toLocaleString()} rows</span>
        <Btn t={t} label="Export" primary={false} onClick={() => emit?.({ type: "toast", text: `${view.length} rows exported as CSV`, level: "success" })} style={{ fontSize: t.fontPx * 0.72, padding: `${t.fontPx * 0.22}px ${t.fontPx * 0.5}px` }} />
      </div>
      <div role="row" style={{ display: "grid", gridTemplateColumns: grid, gap: 8, padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.7}px`, borderBottom: `1px solid ${t.line}`, color: t.muted, fontWeight: 600, fontSize: t.fontPx * 0.72, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {cols.map((c) => (
          <button
            key={c}
            type="button"
            aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
            onClick={() => setSort((s) => (s?.col === c ? { col: c, dir: s.dir === 1 ? -1 : 1 } : { col: c, dir: 1 }))}
            style={{ background: "none", border: "none", padding: 0, textAlign: "left", font: "inherit", color: sort?.col === c ? t.accent : "inherit", cursor: mode === "live" ? "pointer" : "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {c}{sort?.col === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>
      <div onScroll={(e) => setTop(e.currentTarget.scrollTop)} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <div style={{ height: view.length * rowH, position: "relative" }}>
          <div style={{ position: "absolute", top: first * rowH, left: 0, right: 0 }}>
            {slice.map((row, i) => (
              <div key={first + i} style={{ display: "grid", gridTemplateColumns: grid, gap: 8, alignItems: "center", height: rowH, padding: `0 ${t.fontPx * 0.7}px`, borderBottom: `1px solid ${t.line}`, background: (first + i) % 2 && dense ? `${t.muted}0c` : undefined }}>
                {cols.map((c, ci) => (
                  <span key={c} style={{ color: ci === 0 ? t.text : t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{row[c]}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Fill>
  );
}

/** Ranked, with movement since last time. */
export function Leaderboard({ id, content, theme: t }: PartProps) {
  const names = items(content, sample.people(8, id + content).map((p) => p.name));
  const r = rng(hash(id + content));
  const rows = names.map((name) => ({ name, score: sample.int(r, 400, 9800), move: sample.int(r, -3, 3) })).sort((a, b) => b.score - a.score);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.6, display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
      {rows.map((row, i) => (
        <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.4}px`, borderRadius: Math.min(t.radius, 8), background: i === 0 ? `${t.accent}14` : undefined, fontSize: t.fontPx * 0.9 }}>
          <span style={{ width: t.fontPx * 1.6, textAlign: "right", color: i < 3 ? t.accent : t.muted, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
          <span aria-hidden style={{ width: t.fontPx * 1.6, height: t.fontPx * 1.6, borderRadius: 999, background: `${t.accent}33`, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
          <span style={{ color: row.move > 0 ? t.accent : row.move < 0 ? "oklch(0.7 0.19 25)" : t.muted, fontSize: t.fontPx * 0.75 }}>
            {row.move > 0 ? `▲${row.move}` : row.move < 0 ? `▼${-row.move}` : "–"}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{row.score.toLocaleString()}</span>
        </div>
      ))}
    </Fill>
  );
}

/* ------------------------------------------------------------- composite */

/** Several linked views on one screen. */
export function Dashboard({ id, content, theme: t, mode, w, h }: PartProps) {
  const panels = items(content, ["Revenue", "Signups", "Over time", "Recent"]);
  const narrow = w < 640;
  const cell = (child: React.ReactNode, key: string, span = 1) => (
    <div key={key} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, gridColumn: narrow ? undefined : `span ${span}`, display: "flex", flexDirection: "column", gap: 4, minHeight: 0, overflow: "hidden" }}>
      {child}
    </div>
  );
  const r = rng(hash(id + content));
  const series = sample.series(20, id + content);
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(2, 1fr)", gridAutoRows: "minmax(0, 1fr)", gap: t.fontPx * 0.6, overflow: "auto" }}>
      {[0, 1].map((i) =>
        cell(
          <>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{panels[i] ?? `Panel ${i + 1}`}</span>
            <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.5 }}>{i ? sample.int(r, 200, 4000).toLocaleString() : "$" + sample.money(r, 8000, 60000)}</span>
            <span style={{ color: t.accent, fontSize: t.fontPx * 0.75 }}>▲ {sample.int(r, 2, 26)}%</span>
          </>,
          `stat-${i}`,
        ),
      )}
      {cell(
        <>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{panels[2] ?? "Over time"}</span>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden style={{ flex: 1, minHeight: 0 }}>
            <path d={`${path(series, 200, 60)} L200,60 L0,60 Z`} fill={t.accent} opacity={0.16} />
            <path d={path(series, 200, 60)} fill="none" stroke={t.accent} strokeWidth={2} />
          </svg>
        </>,
        "chart",
        2,
      )}
      {cell(
        <>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{panels[3] ?? "Recent"}</span>
          <div style={{ flex: 1, overflow: "auto", minHeight: 0, fontSize: t.fontPx * 0.8 }}>
            {sample.rows(["Name", "Status"], 5, id + "rows").map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "2px 0", borderBottom: `1px solid ${t.line}` }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.Name}</span>
                <span style={{ color: t.muted }}>{row.Status}</span>
              </div>
            ))}
          </div>
        </>,
        "recent",
        2,
      )}
    </Fill>
  );
}

/** Events along an axis. */
export function Timeline({ id, content, theme: t }: PartProps) {
  const events = items(content, ["Started: the first commit", "Beta: first ten people", "Launch: doors open", "Today: still here"]).map(titled);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: 0, overflow: "auto", paddingLeft: t.fontPx * 0.3 }}>
      {events.map((e, i) => (
        <div key={e.title + i} style={{ display: "flex", gap: t.fontPx * 0.8, flex: 1, minHeight: t.fontPx * 2.4 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <span style={{ width: t.fontPx * 0.7, height: t.fontPx * 0.7, borderRadius: 999, background: i === 0 ? t.accent : t.surface, border: `2px solid ${i === 0 ? t.accent : t.line}`, marginTop: 3 }} />
            {i < events.length - 1 ? <span style={{ flex: 1, width: 2, background: t.line }} /> : null}
          </div>
          <div style={{ paddingBottom: t.fontPx * 0.8, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>{e.title}</div>
            <div style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{e.body ?? sample.sentence(rng(hash(e.title)), 8)}</div>
          </div>
        </div>
      ))}
    </Fill>
  );
}

/** Cards in columns. In live mode a card really moves between them. */
export function Kanban({ id, content, theme: t, mode, emit }: PartProps) {
  const columns = items(content, ["To do", "Doing", "Done"]);
  const [cards, setCards] = React.useState(() => {
    const r = rng(hash(id + content));
    return Array.from({ length: columns.length * 2 }, (_, i) => ({ id: i, text: sample.word(r), col: i % columns.length }));
  });
  const move = (cardId: number, col: number) => {
    setCards((xs) => xs.map((c) => (c.id === cardId ? { ...c, col } : c)));
    emit?.({ type: "toast", text: `Moved to ${columns[col]}` });
  };
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: t.fontPx * 0.6, overflow: "auto" }}>
      {columns.map((col, ci) => (
        <div
          key={col}
          onDragOver={mode === "live" ? (e) => e.preventDefault() : undefined}
          onDrop={mode === "live" ? (e) => { e.preventDefault(); const n = Number(e.dataTransfer.getData("text/plain")); if (Number.isFinite(n)) move(n, ci); } : undefined}
          style={{ ...cardStyle(t), background: `${t.muted}10`, padding: t.fontPx * 0.5, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, minHeight: 0 }}
        >
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.75, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {col} <span style={{ opacity: 0.7 }}>{cards.filter((c) => c.col === ci).length}</span>
          </span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: t.fontPx * 0.35, overflow: "auto", minHeight: 0 }}>
            {cards.filter((c) => c.col === ci).map((c) => (
              <div
                key={c.id}
                draggable={mode === "live"}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}
                style={{ ...cardStyle(t), padding: t.fontPx * 0.5, fontSize: t.fontPx * 0.85, cursor: mode === "live" ? "grab" : "default" }}
              >
                {c.text}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Fill>
  );
}

/** Updates that arrive on their own. */
export function LiveFeed({ id, content, theme: t, mode }: PartProps) {
  const kinds = items(content, ["order placed", "signup", "comment", "payment"]);
  const seed = React.useRef(rng(hash(id + content)));
  const [rows, setRows] = React.useState(() =>
    Array.from({ length: 5 }, (_, i) => ({ id: i, what: kinds[i % kinds.length]!, who: sample.name(seed.current), fresh: false })),
  );
  const next = React.useRef(5);
  useTicker(mode, 1800, () =>
    setRows((xs) => [{ id: next.current++, what: kinds[next.current % kinds.length]!, who: sample.name(seed.current), fresh: true }, ...xs.slice(0, 9)]),
  );
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
      <Head
        t={t}
        title={id === "realtime-stream" ? "Live stream" : "Live"}
        right={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, animation: mode === "live" ? "pulse-soft 1.6s ease-in-out infinite" : undefined }} />connected</span>}
      />
      <div aria-live="polite" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", minHeight: 0, fontSize: t.fontPx * 0.85 }}>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: `1px solid ${t.line}`, animation: row.fresh && mode === "live" ? "slide-up var(--motion-base, 200ms) ease-out both" : undefined }}>
            <span style={{ color: t.accent, fontSize: t.fontPx * 0.7, marginTop: 3 }}>●</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ fontWeight: 600 }}>{row.who}</strong> <span style={{ color: t.muted }}>{row.what}</span>
            </span>
          </div>
        ))}
      </div>
    </Fill>
  );
}

/** Nodes and edges you can explore. Clicking one lights up its neighbours. */
export function NetworkGraph({ id, content, theme: t, mode }: PartProps) {
  const names = items(content, ["Core", "Design", "Data", "People", "Money", "Ops"]);
  const r = rng(hash(id + content));
  const nodes = names.map((name, i) => {
    const angle = (i / names.length) * Math.PI * 2;
    return { name, x: 50 + Math.cos(angle) * (26 + r() * 12), y: 50 + Math.sin(angle) * (26 + r() * 12) };
  });
  const edges = nodes.flatMap((n, i) => nodes.slice(i + 1).map((m, j) => ({ a: i, b: i + 1 + j, on: r() > 0.45 })).filter((e) => e.on));
  const [hot, setHot] = React.useState<number | null>(null);
  const near = (i: number) => hot === null || hot === i || edges.some((e) => (e.a === hot && e.b === i) || (e.b === hot && e.a === i));

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.5, overflow: "hidden" }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label={`${names.length} connected things`} preserveAspectRatio="xMidYMid meet">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={nodes[e.a]!.x} y1={nodes[e.a]!.y} x2={nodes[e.b]!.x} y2={nodes[e.b]!.y}
            stroke={hot !== null && (e.a === hot || e.b === hot) ? t.accent : t.line}
            strokeWidth={hot !== null && (e.a === hot || e.b === hot) ? 0.8 : 0.4}
          />
        ))}
        {nodes.map((n, i) => (
          <g key={n.name} onMouseEnter={mode === "live" ? () => setHot(i) : undefined} onMouseLeave={() => setHot(null)} opacity={near(i) ? 1 : 0.28}>
            <circle cx={n.x} cy={n.y} r={hot === i ? 4 : 3} fill={hot === i ? t.accent : t.highlight} />
            <text x={n.x} y={n.y - 5} textAnchor="middle" fill={t.muted} fontSize={3.4} fontFamily={t.bodyFamily}>{n.name}</text>
          </g>
        ))}
      </svg>
    </Fill>
  );
}

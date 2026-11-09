"use client";
/**
 * AUDIT AND OPTIMIZE: POLIO'S FEATURES ON ONE DATED LINE.
 *
 * What is on the screen, top to bottom:
 *
 *   · The meter. One deployment of Polio against its 500 MB limit: the red
 *     part is what the ticked findings would take off, the green what stays.
 *     Beside it the one button, Audit and optimize, which asks the runner
 *     for a fresh receipt; and Make the piece, which turns the ticked
 *     findings into a lane brief (shown whole before it is written).
 *   · The line. Every feature merged into Polio, dated, oldest first. A
 *     feature with findings is lit (amber) and its findings hang under it;
 *     a run of quiet features folds to one row that says how many, and
 *     opens on a press. A finding is one card: What, Why, what it gives up,
 *     before → after, and Apply or Skip, the chosen one lit red the way a
 *     control that is *on* is everywhere in the Builder (docs/DESIGN.md §1).
 *
 * The page changes nothing itself. Apply is a tick; the piece is a page of
 * words for a lane; the runner reads a build and writes a receipt. Ticks
 * are kept in this browser per receipt, so coming back finds them.
 *
 * Colours are the menu's: void slabs with a lit rim, blue for the one
 * action, green for the second level and for "fine", red only for the
 * control that is on. `tests/audit-screen.mjs`.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Gauge, Maximize2, Wrench } from "lucide-react";
import { Button } from "@/core/ui/button";
import { play } from "@/core/audio/engine";
import type { RouteProps } from "@/core/types";
import { useStudio } from "@/features/studio/board/store";
import { openDetailTab } from "@/features/studio/TimelineDetail";
import { briefFor, defaultTicks, featureOf, mb, saves, totalWith, type Feature, type Finding, type Receipt } from "./receipt";

/* The menu's palette (docs/DESIGN.md §1): the void, its rim, blue, green, red for "on". */
const VOID = "oklch(0.16 0.04 288)";
const VOID2 = "oklch(0.21 0.05 288)";
const RIM = "oklch(0.42 0.08 288)";
const INK = "oklch(0.93 0.02 288)";
const DIM = "oklch(0.74 0.04 288)";
const BLUE = "oklch(0.78 0.15 205)";
const GREEN = "oklch(0.80 0.19 148)";
const GREEN_DIM = "oklch(0.45 0.12 148)";
const RED = "oklch(0.64 0.23 27)";
const AMBER = "oklch(0.82 0.15 85)";
const SCREEN = "oklch(0.20 0.04 190)";
const SCREEN_LINE = "oklch(0.42 0.08 185)";
const PHOS = "oklch(0.88 0.13 160)";

const slab: React.CSSProperties = { background: VOID2, border: `1px solid ${RIM}`, borderRadius: 16, padding: "14px 16px", boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.06), 0 4px 18px oklch(0 0 0 / 0.4)", color: INK };
const screen: React.CSSProperties = { background: SCREEN, border: `1px solid ${SCREEN_LINE}`, borderRadius: 10, padding: "10px 12px", color: PHOS, fontFamily: "var(--font-mono)", fontSize: 13, backgroundImage: "repeating-linear-gradient(0deg, oklch(1 0 0 / 0.03) 0 1px, transparent 1px 3px)" };
const pill = (colour: string): React.CSSProperties => ({ display: "inline-block", borderRadius: 99, padding: "2px 9px", fontSize: 12, fontWeight: 600, border: `1px solid ${colour}`, color: colour });

const TICKS = "builder.audit.ticks";
function readTicks(r: Receipt): Record<string, boolean> {
  try {
    const kept = JSON.parse(localStorage.getItem(TICKS) ?? "null") as { when: string; ticks: Record<string, boolean> } | null;
    if (kept?.when === r.when) return { ...defaultTicks(r), ...kept.ticks };
  } catch { /* fresh */ }
  return defaultTicks(r);
}
function keepTicks(r: Receipt, ticks: Record<string, boolean>) {
  try { localStorage.setItem(TICKS, JSON.stringify({ when: r.when, ticks })); } catch { /* private window */ }
}

/** The route: the same view filling the screen, for going deep; Back opens the timeline's Audit tab. */
export function AuditPage(_: RouteProps) {
  return <AuditView full />;
}

/**
 * The view. In the band under the timeline (`full` off) it is one more tab
 * beside the iterations; on /builder/audit (`full` on) it takes the screen,
 * with a way back to the timeline that opens this same tab there.
 */
export function AuditView({ full = false }: { full?: boolean }) {
  const router = useRouter();
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [why, setWhy] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({});
  const [piece, setPiece] = React.useState<{ name: string; text: string } | null>(null);
  const [written, setWritten] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const take = React.useCallback((r: Receipt) => { setReceipt(r); setTicks(readTicks(r)); setWhy(null); setPiece(null); setWritten(null); }, []);

  React.useEffect(() => {
    let gone = false;
    void fetch("/api/studio/audit").then(async (res) => {
      const j = (await res.json()) as { ok: boolean; receipt?: Receipt; why?: string };
      if (gone) return;
      if (j.ok && j.receipt) take(j.receipt); else setWhy(j.why ?? "No audit yet.");
    }).catch((e: Error) => { if (!gone) setWhy(e.message); });
    return () => { gone = true; };
  }, [take]);

  const run = async () => {
    setBusy(true); play("tap");
    try {
      const res = await fetch("/api/studio/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "run" }) });
      const j = (await res.json()) as { ok: boolean; receipt?: Receipt; why?: string };
      if (j.ok && j.receipt) take(j.receipt); else setWhy(j.why ?? "The runner did not answer.");
    } catch (e) { setWhy((e as Error).message); }
    setBusy(false);
  };

  const tick = (f: Finding, on: boolean) => {
    if (!receipt) return;
    const next = { ...ticks, [f.id]: on };
    setTicks(next); keepTicks(receipt, next); setPiece(null); play(on ? "toggleOn" : "toggleOff");
  };
  const skipAll = () => { if (!receipt) return; const next = Object.fromEntries(receipt.findings.map((f) => [f.id, false])); setTicks(next); keepTicks(receipt, next); setPiece(null); };

  const makePiece = () => { if (!receipt) return; const b = briefFor(receipt, ticks); setPiece({ name: b.name, text: b.text }); setWritten(null); };
  const writePiece = async () => {
    if (!piece) return;
    setBusy(true);
    try {
      const res = await fetch("/api/studio/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "piece", name: piece.name, text: piece.text }) });
      const j = (await res.json()) as { ok: boolean; path?: string; why?: string };
      if (j.ok && j.path) { setWritten(j.path); play("tick"); } else setWhy(j.why ?? "Not written.");
    } catch (e) { setWhy((e as Error).message); }
    setBusy(false);
  };

  const ticked = receipt ? receipt.findings.filter((f) => ticks[f.id]) : [];
  const after = receipt ? totalWith(receipt, ticks) : 0;

  /* The way back from the full screen: the timeline, with this tab open under it. */
  const back = () => { play("navigate"); useStudio.getState().setMode("book"); openDetailTab("audit"); router.push("/builder"); };
  const deep = () => { play("navigate"); router.push("/builder/audit"); };

  return (
    <div data-audit-page="" data-audit-full={full ? "" : undefined} style={{ minHeight: full ? "100%" : undefined, background: full ? "oklch(0.11 0.03 288)" : undefined, color: INK, padding: full ? "20px 16px 40px" : "14px 16px 28px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          {full ? (
            <Button data-audit-back="" variant="ghost" size="sm" onClick={back} style={{ color: DIM }}><ArrowLeft /> Back to the timeline</Button>
          ) : null}
          <h1 style={{ fontSize: full ? 22 : 18, margin: 0, color: BLUE, fontWeight: 700, flex: 1 }}>Audit and optimize · Polio's features</h1>
          {full ? null : (
            <Button data-audit-deep="" variant="ghost" size="sm" onClick={deep} style={{ color: DIM }}><Maximize2 /> Fill the screen</Button>
          )}
        </div>
        <p style={{ color: DIM, margin: "0 0 18px", fontSize: 14 }}>Every feature Polio has, on one dated line. One button checks them all. Each thing it finds is pinned to the feature that brought it in, with the date it came. Nothing changes until a lane makes the piece.</p>

        {/* One column on a phone, the meter and the buttons side by side from a tablet up. */}
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_330px]">
          <Meter receipt={receipt} after={after} ticked={ticked.length} why={why} />
          <div style={slab}>
            <Button data-audit-run="" variant="primary" size="lg" className="w-full justify-center" loading={busy} onClick={() => void run()} style={{ background: BLUE, color: "oklch(0.18 0.05 240)", boxShadow: `0 0 14px oklch(0.78 0.15 205 / 0.45)`, fontSize: 16, height: 44 }}>
              <Gauge /> Audit and optimize
            </Button>
            <p style={{ color: DIM, fontSize: 13, margin: "10px 0 0" }}>
              {receipt ? `Last run ${receipt.when.slice(0, 10)} · ${receipt.findings.length} found · ${ticked.length} ticked · ${receipt.findings.length - ticked.length} left for later.` : "Not run yet on this PC."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button data-audit-piece="" variant="up" size="md" className="flex-1 justify-center" disabled={!receipt || !ticked.length} onClick={makePiece} style={{ background: GREEN, color: "oklch(0.2 0.06 148)", borderColor: "transparent" }}><Wrench /> Make the piece ({ticked.length})</Button>
              <Button data-audit-skip-all="" variant="ghost" size="md" disabled={!receipt} onClick={skipAll} style={{ color: INK, border: `1px solid ${RIM}` }}>Skip all</Button>
            </div>
            <p style={{ color: DIM, fontSize: 13, margin: "8px 0 0" }}>Make the piece writes a brief for a lane. Nothing changes until that lane's work is merged by the merge chat.</p>
          </div>
        </div>

        {piece ? (
          <div data-audit-brief="" style={{ ...slab, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ color: GREEN, flex: 1 }}>The brief, as it will be written: {piece.name}</b>
              {written ? <span data-audit-written="" style={pill(GREEN)}>Written · {written}</span> : (
                <>
                  <Button data-audit-write="" size="md" loading={busy} onClick={() => void writePiece()} style={{ background: GREEN, color: "oklch(0.2 0.06 148)", borderColor: "transparent" }}><Check /> Write it</Button>
                  <Button variant="ghost" size="md" onClick={() => setPiece(null)} style={{ color: INK, border: `1px solid ${RIM}` }}>Back</Button>
                </>
              )}
            </div>
            <pre style={{ ...screen, marginTop: 10, whiteSpace: "pre-wrap", maxHeight: "40vh", overflow: "auto" }}>{piece.text}</pre>
          </div>
        ) : null}

        {receipt ? <Line receipt={receipt} ticks={ticks} tick={tick} open={open} setOpen={setOpen} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The meter                                                           */
/* ------------------------------------------------------------------ */

function Meter({ receipt, after, ticked, why }: { receipt: Receipt | null; after: number; ticked: number; why: string | null }) {
  if (!receipt) {
    return (
      <div data-audit-meter="" style={slab}>
        <b>One deployment of Polio</b>
        <p style={{ color: DIM, margin: "8px 0 0", fontSize: 14 }}>{why ?? "Reading the last audit…"}</p>
      </div>
    );
  }
  const limit = receipt.limit;
  const scale = Math.max(limit * 1.2, receipt.before.total * 1.05);
  const pct = (b: number) => `${Math.min(100, (b / scale) * 100).toFixed(1)}%`;
  return (
    <div data-audit-meter="" data-total={receipt.before.total} data-after={after} style={slab}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <b style={{ flex: 1 }}>One deployment of Polio</b>
        <span style={pill(receipt.before.over ? RED : GREEN)}>{receipt.before.over ? "over the limit" : "under the limit"}</span>
      </div>
      <div style={{ position: "relative", height: 26, borderRadius: 8, background: VOID, border: `1px solid ${RIM}`, overflow: "hidden", margin: "10px 0 4px" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: pct(receipt.before.total), background: "oklch(0.5 0.17 27 / 0.75)" }} />
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: pct(after), background: GREEN }} />
        <div style={{ position: "absolute", top: -2, bottom: -2, left: pct(limit), width: 2, background: "white" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: DIM }}>
        <span>0</span><span>limit {mb(limit)}</span><span>{mb(scale)}</span>
      </div>
      <div className="font-mono" style={{ marginTop: 8, fontSize: 14 }}>
        <span style={{ color: DIM, textDecoration: "line-through" }}>{mb(receipt.before.total)}</span> → <b style={{ color: GREEN }}>{mb(after)}</b> <span style={{ color: DIM, fontFamily: "inherit", fontSize: 13 }}>with the {ticked} ticked{receipt.findings.some((f) => ticks0(f)) ? " (a cut that stops stray files being traced also drops what they pulled in, so it lands lower)" : ""}</span>
      </div>
      <p style={{ color: DIM, fontSize: 13, margin: "8px 0 0" }}>{receipt.before.functions} functions, read from the build of {receipt.when.slice(0, 10)}. Also checked: each function's size, what a build pulls in, pieces nothing calls.</p>
    </div>
  );
}
const ticks0 = (f: Finding) => Boolean(f.bytes.ceiling);

/* ------------------------------------------------------------------ */
/* The line                                                            */
/* ------------------------------------------------------------------ */

function Line({ receipt, ticks, tick, open, setOpen }: { receipt: Receipt; ticks: Record<string, boolean>; tick: (f: Finding, on: boolean) => void; open: Record<string, boolean>; setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  /* Quiet features fold into runs between the lit ones. */
  const rows: ({ kind: "feature"; f: Feature } | { kind: "quiet"; from: Feature; to: Feature; n: number; key: string; items: Feature[] })[] = [];
  let run: Feature[] = [];
  const flush = () => { if (run.length) { rows.push({ kind: "quiet", from: run[0]!, to: run[run.length - 1]!, n: run.length, key: `q${run[0]!.commit}`, items: run }); run = []; } };
  for (const f of receipt.features) { if (f.found) { flush(); rows.push({ kind: "feature", f }); } else run.push(f); }
  flush();
  const rowsOut = rows.flatMap((r) => (r.kind === "quiet" && open[r.key] ? r.items.map((f) => ({ kind: "feature" as const, f })) : [r]));

  return (
    <div data-audit-line="" style={{ position: "relative", marginLeft: 16, paddingLeft: 22, borderLeft: `3px solid oklch(0.55 0.13 205)`, marginTop: 22 }}>
      {rowsOut.map((r) => r.kind === "quiet" ? (
        <button key={r.key} type="button" data-audit-quiet={r.n} onClick={() => setOpen((o) => ({ ...o, [r.key]: true }))} style={{ display: "block", textAlign: "left", background: "none", border: 0, color: DIM, fontSize: 13, padding: "4px 0", margin: "0 0 10px", cursor: "pointer", position: "relative" }}>
          <Dot colour={GREEN_DIM} rim={GREEN} />
          {r.n === 1 ? `${r.from.date} · ${r.from.name} · fine` : `${r.from.date} → ${r.to.date} · ${r.n} features, nothing found · show`}
        </button>
      ) : (
        <div key={r.f.commit} data-audit-feature={r.f.name} data-found={r.f.found} style={{ position: "relative", margin: "0 0 14px" }}>
          <Dot colour={r.f.found ? AMBER : GREEN_DIM} rim={r.f.found ? AMBER : GREEN} lit={Boolean(r.f.found)} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: DIM, fontSize: 12, minWidth: 80 }}>{r.f.uncertain ? `by ${r.f.date}` : r.f.date}</span>
            <b style={{ fontSize: 15 }}>{r.f.name}</b>
            {r.f.found ? <span style={pill(AMBER)}>{r.f.found} found</span> : <span style={pill(GREEN)}>✓ fine</span>}
            {r.f.saves ? <span style={{ color: DIM, fontSize: 13 }}>{mb(r.f.saves)} to cut</span> : null}
          </div>
          {receipt.findings.filter((x) => featureOf(receipt, x)?.name === r.f.name).map((x) => <Card key={x.id} f={x} on={Boolean(ticks[x.id])} tick={tick} />)}
        </div>
      ))}
      {receipt.findings.filter((x) => !featureOf(receipt, x)).map((x) => <Card key={x.id} f={x} on={Boolean(ticks[x.id])} tick={tick} />)}
    </div>
  );
}

function Dot({ colour, rim, lit }: { colour: string; rim: string; lit?: boolean }) {
  return <span style={{ position: "absolute", left: -31, top: 4, width: 14, height: 14, borderRadius: "50%", background: colour, border: `2px solid ${rim}`, boxShadow: lit ? `0 0 10px ${rim}` : undefined }} />;
}

/* ------------------------------------------------------------------ */
/* A finding                                                           */
/* ------------------------------------------------------------------ */

function Card({ f, on, tick }: { f: Finding; on: boolean; tick: (f: Finding, on: boolean) => void }) {
  const kind = f.kind === "cut" ? { label: "Cut · nothing lost", colour: GREEN } : f.kind === "shortcut" ? { label: "Shortcut · you give something up", colour: AMBER } : { label: "To look at", colour: RED };
  const onStyle: React.CSSProperties = { background: RED, color: "white", borderColor: "transparent", boxShadow: `0 0 0 1.5px ${RED}, 0 0 6px oklch(0.64 0.23 27 / 0.5)` };
  const offStyle: React.CSSProperties = { background: "transparent", color: INK, border: `1px solid ${RIM}` };
  return (
    <div data-audit-finding={f.id} data-kind={f.kind} data-tick={on ? "apply" : "skip"} style={{ border: `1px solid ${RIM}`, borderRadius: 12, padding: 12, background: VOID, marginTop: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16, flex: 1, minWidth: 200 }}>{f.what}</h3>
        <span style={pill(kind.colour)}>{kind.label}</span>
      </div>
      <p style={{ margin: "6px 0 2px", fontSize: 14 }}><span style={{ color: DIM, fontSize: 13, display: "inline-block", minWidth: 64 }}>Why</span>{f.why}</p>
      {f.loses ? <p style={{ margin: "2px 0", fontSize: 14 }}><span style={{ color: DIM, fontSize: 13, display: "inline-block", minWidth: 64 }}>Gives up</span>{f.loses}</p> : null}
      <p style={{ margin: "2px 0", fontSize: 14 }}><span style={{ color: DIM, fontSize: 13, display: "inline-block", minWidth: 64 }}>How</span>{f.apply}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <div className="font-mono" style={{ flex: 1, fontSize: 14 }}>
          {f.bytes.after != null ? <><span style={{ color: DIM, textDecoration: "line-through" }}>{mb(f.bytes.before)}</span> → <b style={{ color: GREEN }}>{f.bytes.ceiling ? "at most " : ""}{mb(f.bytes.after)}</b>{saves(f) ? <span style={{ color: DIM, fontSize: 12 }}> · saves {mb(saves(f))}</span> : null}</> : <span style={{ color: DIM }}>{mb(f.bytes.before)}</span>}
        </div>
        {f.kind !== "look" ? (
          <>
            <Button data-audit-apply="" size="md" onClick={() => tick(f, true)} style={on ? onStyle : offStyle}>Apply{on ? " ✓" : ""}</Button>
            <Button data-audit-skip="" size="md" onClick={() => tick(f, false)} style={on ? offStyle : onStyle}>{f.kind === "shortcut" ? "Later" : "Skip"}{on ? "" : " ✓"}</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

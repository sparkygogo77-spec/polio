"use client";
/**
 * THE AGENTS MANAGER (J's drawing, 2026-11-10/11): the whole screen for the
 * chats, a toggle from the Agents dock. On the Builder's nebula: tall framed
 * columns side by side, one per coordinator, in J's design blocks (the Finish
 * timeline's molten boxes, `core/ui/molten`), each with a thick outside ring
 * in its coordinator's colour; and the orb system beside them, in its own
 * corner at the right, each ring in its coordinator's colour.
 *
 *   · a column: a head band (C-number big, badge and name, what the column
 *     costs the PC, the question count as a plain red disc, a red button per
 *     question of the coordinator's own, the cube, its age, its turn out of
 *     5), chats stacked as compact panes, a foot of finished chats by age;
 *   · a pane: one head row (name, state dot, memory pill, kind icons, CPU and
 *     running time, a red button per question, the cube, age, turns, the
 *     model chip), two lines of words, the say-something bar. Hovering the
 *     pill or an icon shows each kind's share. A parked or done chat is one
 *     line until opened;
 *   · a question opens over its coordinator's column, whole, every Choose
 *     showing; only a decision with pictures takes the full width, as slides
 *     stepped up and down;
 *   · one press archives a chat (with Undo; never deleted), and the model
 *     chip asks the coordinator for another model.
 *
 * Hovering a column lights its ring and the other way round; hovering an orb
 * shows that chat in its column, a press pins it.
 *
 * Everything shown here was read from the helper on J's PC and stays on this
 * page: nothing is written into the site, an export or a request other than
 * the presses themselves, which go to the helper (tests/agents-manager.mjs).
 * The rules, with sizes: Pleo/handovers/open/columns-rules.md.
 */
import * as React from "react";
import { AppWindow, Archive, Box, Circle, Globe, Hexagon, PanelRight, SquareTerminal, Undo2, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { moltenClass, moltenKeyClass, moltenSeed, type MoltenKind } from "@/core/ui/molten";
import { HELPER_ORIGIN } from "./context";
import { ANSWER_URL, ASK_URL, PageFrame } from "./Decisions";
import { LanesBoard } from "./LanesBoard";
import { managerShown, readLanes, setPrivate, useLive, usePrivate } from "./feed";
import { badgeOf, scrub } from "./privacy";
import { closeDock, closeManager, useAgents } from "./store";
import {
  HELPER_COLOUR, STATE_COLOUR, STATE_WORD, ageOf, carriedWords, chatLink, chatsAbout, helperWords, pictureKind, pictureUrl, veilFeed, whenOf,
  type ChatState, type Decision, type LaneChat, type LaneCoordinator, type LanesFeed,
} from "./lanes";
import {
  EFFORTS, KIND_WORD, MODELS, PANE_BLOCK, RING, asksOf, chipWords, columnCost, columnWidth, columnsOf, costOf, cpuWords, cubeOf, cutAt, hasPictures, memWords, modelOf, pillShare, shareLines,
  slideAcross, slidesOf, stepSlide, turnsOf, unowned, upWords,
  SAY_WHEN, countWords, labelOf, layoutOf, newestFirst, nucleusChats, questionGroups, ringSlots,
  type Column, type CostKind, type OwnerCost, type PcCost, type QuestionGroups, type SayKind, type Slide,
} from "./manager";

const mono = "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";
const INK = "#f6f1ff", SOFT = "#d9d0ee", DIM = "#a9b6c8";
const EDGE = "0 1px 2px rgba(0,0,0,.95), 0 0 3px rgba(0,0,0,.7)";
const RED = STATE_COLOUR.need;
const GONE_KEY = "polio.manager.gone", MODEL_KEY = "polio.manager.models", OPEN_KEY = "polio.manager.open";
/** BAM: the questions J has opened here (what "new since you last looked" is measured from), and what J typed in the terminal. */
const SEEN_KEY = "polio.manager.seen", SAID_KEY = "polio.manager.said";
const LIVE_BUILDER = "https://polio-two.vercel.app";

const kept = <T,>(key: string, fallback: T): T => { try { const v = JSON.parse(localStorage.getItem(key) ?? "null"); return v && typeof v === "object" ? (v as T) : fallback; } catch { return fallback; } };
const keep = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* not kept, still live */ } };

type Reply = { ok: true; j: Record<string, unknown> } | { ok: false; says: string };
/** One press to the helper. A refusal says why in plain words; an older helper doesn't know the newer presses. */
async function post(url: string, body: Record<string, unknown>, newer = false): Promise<Reply> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 4000);
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: stop.signal });
    const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Record<string, unknown>) | null;
    if (r.ok && j?.ok) return { ok: true, j };
    return { ok: false, says: r.status === 403 && newer ? "Not saved on your PC: the Helper there is older than this Builder. It takes this press once it is updated." : `Not sent: ${j?.error ?? `the helper answered ${r.status}`}.` };
  } catch {
    if (window.location.origin !== LIVE_BUILDER) return { ok: false, says: "Not sent: the helper takes presses from the live Builder only, while it runs." };
    return { ok: false, says: newer ? "Not saved on your PC: the Helper is off, or older than this Builder (it takes this press once it is updated)." : "Not sent: the helper isn't running. Start it from the dock's Helper tab, then press again." };
  } finally { clearTimeout(timer); }
}

function useNow(ms = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number, number] {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(0);
  const [h, setH] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => { setW(el.clientWidth); setH(el.clientHeight); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w, h];
}

/**
 * One of J's design blocks: the Finish timeline's molten construct, at the
 * temperature asked for. A colour no temperature has is the nearest one with
 * its hue turned, on the face only (the words above it keep their own colour).
 */
function Block({ kind, turn = 0, seed, at, boxRef, className, style, children, ...rest }: { kind: MoltenKind; turn?: number; seed: string; at?: number; boxRef?: React.Ref<HTMLDivElement> } & React.HTMLAttributes<HTMLDivElement>) {
  if (!turn) {
    return (
      <div {...rest} ref={boxRef} data-manager-block={kind} className={cn(moltenClass(kind), className)} style={{ ...(moltenSeed(seed, at) as React.CSSProperties), color: INK, textShadow: EDGE, ...style }}>
        <span data-molten="" />
        {children}
      </div>
    );
  }
  return (
    <div {...rest} ref={boxRef} data-manager-block={kind} data-turn={turn} className={cn("relative isolate overflow-hidden", className)} style={{ color: INK, textShadow: EDGE, ...style }}>
      <div aria-hidden className={moltenClass(kind)} style={{ ...(moltenSeed(seed, at) as React.CSSProperties), position: "absolute", inset: 0, borderRadius: "inherit", filter: `hue-rotate(${turn}deg)` }}><span data-molten="" /></div>
      <div className="relative" style={{ zIndex: 2 }}>{children}</div>
    </div>
  );
}

const KIND_ICON: Record<CostKind, typeof Box> = { shell: SquareTerminal, host: AppWindow, node: Hexagon, browser: Globe, other: Circle };
const KIND_TINT: Record<CostKind, string> = { shell: "#6fb6ff", host: "#e8e2f6", node: "#6ee58a", browser: "#ffc94d", other: "#b9b3c9" };

/**
 * What a chat (or a column) costs the PC, in one run of the head row (J:
 * "memory and CPU and time and the type of programs running … and on hover it
 * displays how much of the total value it is contributing"): the memory pill
 * with its bar on one scale for every chat, the kind icons with a count where
 * a kind occurs more than once, then CPU now and running time. Hovering the
 * pill tells every kind's share; hovering an icon, that kind's.
 */
function Cost({ cost, heaviest, now, priv, onShares }: { cost: OwnerCost; heaviest: number; now: number; priv: boolean; onShares: (k: CostKind | "all" | null) => void }) {
  const cpu = cpuWords(cost.cpu), up = upWords(cost.startedAt, now);
  return (
    <span data-manager-cost="" className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5" onMouseLeave={() => onShares(null)}>
      <span data-manager-pill="" tabIndex={0} title="What it runs on this PC: hover for each kind's share" onMouseEnter={() => onShares("all")} onFocus={() => onShares("all")} onBlur={() => onShares(null)}
        className="inline-flex shrink-0 flex-col justify-center" style={{ width: 84, height: 16, borderRadius: 999, background: "#d9dbe2", color: "#101418", textShadow: "none", padding: "0 8px", cursor: "help" }}>
        <span data-manager-mem="" className="text-center font-bold" style={{ fontSize: 9.5, lineHeight: "10px" }}>{priv ? "memory" : memWords(cost.memBytes)}</span>
        <span aria-hidden className="block" style={{ height: 2.5, borderRadius: 2, background: "#9aa0ab" }}><span data-manager-pill-bar="" className="block h-full" style={{ width: `${Math.round(pillShare(cost.memBytes, heaviest) * 100)}%`, borderRadius: 2, background: "#1fa650" }} /></span>
      </span>
      {cost.kinds.map((k) => {
        const Icon = KIND_ICON[k.kind];
        return (
          <span key={k.kind} data-manager-kind={k.kind} tabIndex={0} aria-label={`${KIND_WORD[k.kind]}${k.count > 1 ? `, ${k.count}` : ""}`} className="inline-flex shrink-0 items-center" style={{ color: KIND_TINT[k.kind], cursor: "help", fontSize: 10 }}
            onMouseEnter={() => onShares(k.kind)} onFocus={() => onShares(k.kind)} onBlur={() => onShares(null)}>
            <Icon style={{ width: 14, height: 14 }} />{k.count > 1 ? <b>{k.count}</b> : null}
          </span>
        );
      })}
      {cpu || up ? <span data-manager-cpu="" title={[cpu ? `${cpu} of the whole PC, now` : "", up ? `running: ${up}` : ""].filter(Boolean).join(" · ")} className="shrink-0" style={{ fontSize: 10.5, color: SOFT }}>{[cpu, up.replace(/^up /, "")].filter(Boolean).join(" · ")}</span> : null}
    </span>
  );
}
function Shares({ cost, show, of, priv }: { cost: OwnerCost; show: CostKind | "all"; of: string; priv: boolean }) {
  const lines = shareLines(cost, of, priv).filter((l) => show === "all" || l.kind === show);
  return (
    <ul data-manager-shares={show} className="m-0 flex list-none flex-col p-0" style={{ fontSize: 10.5, lineHeight: 1.35, color: INK, background: "rgba(0,0,0,.45)", borderRadius: 6, padding: "3px 8px" }}>
      {lines.map((l) => <li key={l.kind} data-manager-share={l.kind} style={{ color: KIND_TINT[l.kind] }}>{l.words}</li>)}
    </ul>
  );
}

/**
 * One question button with its count (BAM mark 11, the console's marks 18 and 19): never a row of "!n" pills. On a
 * head it opens every open question of the column, grouped; on a pane, that chat's newest question.
 */
function QuestionsButton({ count, words, label, big, onOpen }: { count: number; words: string; label: string; big?: boolean; onOpen: () => void }) {
  if (!count) return null;
  return (
    <button type="button" data-manager-questions={count} title={`${count} ${count === 1 ? "question" : "questions"} for ${label}${words ? `: ${words}` : ""}`} aria-label={`${count} ${count === 1 ? "question" : "questions"} for ${label}${words ? `: ${words}` : ""}`}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="inline-flex shrink-0 items-center gap-1 font-black" style={{ height: big ? 26 : 22, padding: big ? "0 10px" : "0 8px", borderRadius: 999, background: RED, color: "#fff", border: "1.5px solid #fff", fontSize: big ? 13 : 11.5, textShadow: "none", boxShadow: "0 0 8px rgba(255,77,77,.7)" }}>
      <span aria-hidden>?</span>{count}{big && words ? <span data-manager-questions-words="" style={{ fontWeight: 700, fontSize: 10.5, opacity: 0.92 }}>· {words}</span> : null}
    </button>
  );
}
/** The cube: everything to look at that is not a question, with a count. */
function CubeButton({ count, label, onOpen }: { count: number; label: string; onOpen: () => void }) {
  if (!count) return null;
  return (
    <button type="button" data-manager-cube={count} title={`${count} to look at for ${label}`} aria-label={`${count} to look at for ${label}`} onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="inline-flex shrink-0 items-center gap-0.5 font-black" style={{ height: 20, padding: "0 6px", borderRadius: 6, background: "#f2c230", color: "#1a1204", fontSize: 11, textShadow: "none" }}>
      <Box style={{ width: 12, height: 12 }} />{count}
    </button>
  );
}

/** The model chip (rules §7): what it runs on; a press opens the choices in place; "Use" asks the coordinator, who alone can set it. */
function ModelChip({ chat, asked, priv, onAsk }: { chat: LaneChat; asked: { model: string; effort: string } | null; priv: boolean; onAsk: (model: string, effort: string) => Promise<string> }) {
  const now = modelOf(chat);
  const [open, setOpen] = React.useState(false);
  const [model, setModel] = React.useState<string>(asked?.model ?? now?.model ?? MODELS[1]);
  const [effort, setEffort] = React.useState<string>(asked?.effort ?? (now?.effort || "medium"));
  const [said, setSaid] = React.useState("");
  const pick = (on: boolean): React.CSSProperties => ({ padding: "1px 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, textShadow: "none", color: on ? "#04121c" : INK, background: on ? "#9fe3ff" : "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)" });
  return (
    <span data-manager-chip={chat.id} data-open={open ? "1" : "0"} style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>
      <button type="button" data-manager-chip-open="" aria-expanded={open} title="What this chat runs on. Press to ask for another model." onClick={() => setOpen((o) => !o)}
        className="inline-flex min-w-0 max-w-full items-center text-left" style={{ minHeight: 18, padding: "1px 7px", borderRadius: 9, fontSize: 10.5, lineHeight: "14px", fontWeight: 700, color: INK, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.35)", textShadow: "none", whiteSpace: "normal", overflowWrap: "anywhere" }}>
        ▸ {chipWords(now, asked, priv && !open)}
      </button>
      {open ? (
        <span data-manager-chip-choices="" className="flex w-full flex-col gap-1" style={{ flexBasis: "100%", order: 9, background: "rgba(0,0,0,.5)", borderRadius: 8, padding: 6 }}>
          <span className="flex flex-wrap gap-1">{MODELS.map((m) => <button key={m} type="button" data-manager-model={m} aria-pressed={model === m} style={pick(model === m)} onClick={() => setModel(m)}>{m}{now?.model === m ? " ·now" : ""}</button>)}</span>
          <span className="flex flex-wrap gap-1">{EFFORTS.map((e) => <button key={e} type="button" data-manager-effort={e} aria-pressed={effort === e} style={pick(effort === e)} onClick={() => setEffort(e)}>{e}{now?.effort === e ? " ·now" : ""}</button>)}</span>
          <button type="button" data-manager-model-use="" className={cn(moltenKeyClass("azure"), "self-start rounded-md px-2 py-0.5 font-bold")} style={{ ...(moltenSeed(chat.id) as React.CSSProperties), fontSize: 11, color: INK }}
            onClick={() => void onAsk(model, effort).then((s) => { setSaid(s); if (!s) setOpen(false); })}>
            <span data-molten="" /><span>Use {model} · {effort}</span>
          </button>
          <span style={{ fontSize: 10, color: DIM }}>Saved for the coordinator, who sets it; no message is sent.</span>
          {said ? <span data-manager-chip-said="" role="status" style={{ fontSize: 10.5, color: "#ffc9c9" }}>{said}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

type PaneProps = {
  chat: LaneChat; asks: Decision[]; cube: number; cost: OwnerCost | null; heaviest: number; now: number; priv: boolean; at: number;
  open: boolean; shown: boolean; pinned: boolean; peek?: boolean; asked: { model: string; effort: string } | null;
  onFlip: () => void; onPoint: (id: string | null) => void; onAsk: (id: string) => void; onCube: () => void; onArchive: () => void; onModel: (model: string, effort: string) => Promise<string>;
};
/**
 * One chat, compact (rules §4): the head row, two lines of words, the bar.
 * A closed pane is the head row alone. Its ring is its state's colour, its
 * fill its state's design block.
 */
function Pane({ chat, asks, cube, cost, heaviest, now, priv, at, open, shown, pinned, peek, asked, onFlip, onPoint, onAsk, onCube, onArchive, onModel }: PaneProps) {
  const [shares, setShares] = React.useState<CostKind | "all" | null>(null);
  const [more, setMore] = React.useState(false);
  const [text, setText] = React.useState("");
  const [said, setSaid] = React.useState("");
  const me = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (shown) me.current?.scrollIntoView({ block: "nearest" }); }, [shown]);
  const block = PANE_BLOCK[chat.state];
  const colour = STATE_COLOUR[chat.state];
  const age = ageOf(chat.lastSeen || chat.sentAt, now), turns = turnsOf(chat);
  const full = open || shown;
  const note = scrub(priv, chat.note ?? ""), last = scrub(priv, chat.report || chat.last || "");
  /* Mark 20: a pane opens at its full size, its words whole up to a long paragraph. */
  const one = cutAt(note, shown || more ? 4000 : 420), two = cutAt(last && last !== note ? last : "", shown || more ? 4000 : 420);
  const newest = newestFirst(asks)[0];
  const rounds = cube;
  const needs = [asks.length ? `${asks.length} ${asks.length === 1 ? "question" : "questions"}` : "", rounds ? `${rounds} to look at` : ""].filter(Boolean).join(" · ");
  const link = chatLink(chat.id);
  const say = async () => {
    const words = text.trim();
    if (!words) return;
    let copied = true;
    try { await navigator.clipboard.writeText(words); } catch { copied = false; }
    setSaid(copied ? "Copied. Paste it in the chat that just opened." : "Couldn't copy it: the chat opened, type it there.");
    if (link) window.location.href = link;
    setText("");
  };
  const body = (
    <>
      {/* The head row, as drawn: name, dot, pill, question, cube at the left; the age always at the right of the first line. */}
      <div data-manager-pane-head="" role="button" tabIndex={0} aria-expanded={full} onClick={onFlip} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onFlip(); } }}
        className="flex cursor-pointer items-start gap-x-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1" style={{ minHeight: 20 }}>
          <b data-manager-name="" className="min-w-0" style={{ fontSize: 14, color: "#fff", overflowWrap: "anywhere" }}>{labelOf(chat)}</b>
          <span data-manager-dot={chat.state} role="img" aria-label={STATE_WORD[chat.state]} title={STATE_WORD[chat.state]} className="inline-block size-3 shrink-0 rounded-full" style={{ background: colour, border: "1.5px solid rgba(255,255,255,.85)", boxShadow: `0 0 7px ${colour}` }} />
          {cost ? <Cost cost={cost} heaviest={heaviest} now={now} priv={priv} onShares={setShares} /> : null}
          <QuestionsButton count={asks.length} words="" label={labelOf(chat)} onOpen={() => { if (newest) onAsk(newest.id); }} />
          <CubeButton count={cube} label={chat.name} onOpen={onCube} />
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5" style={{ height: 20 }}>
          {!full ? turns ? <span data-manager-turns={turns.tone} title="Turns so far, of the five a chat is good for" className="shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: turns.tone === "over" ? "#ff8a8a" : turns.tone === "full" ? "#ffd166" : SOFT }}>{turns.words}</span> : null : null}
          {!full ? (
            <button type="button" data-manager-archive={chat.id} title="Archive: off the board, kept in the feed, one press to undo. Never deleted." aria-label={`Archive ${chat.name}`} onClick={(e) => { e.stopPropagation(); onArchive(); }}
              className="inline-flex shrink-0 items-center justify-center rounded" style={{ width: 18, height: 18, color: INK, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.3)" }}>
              <Archive style={{ width: 11, height: 11 }} />
            </button>
          ) : null}
          {age ? <span data-manager-age="" style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{age}</span> : null}
        </span>
      </div>
      {shares && cost ? <Shares cost={cost} show={shares} of="this chat" priv={priv} /> : null}
      {full ? (
        <>
          {needs ? <p data-manager-needs="" className="m-0 font-bold" style={{ fontSize: 11.5, color: "#ffd0d0" }}>{STATE_WORD[chat.state]} · {needs}</p> : null}
          {newest ? (
            <button type="button" data-manager-pane-question={newest.id} title="Open this question" onClick={(e) => { e.stopPropagation(); onAsk(newest.id); }}
              className="m-0 text-left font-bold" style={{ fontSize: 12.5, lineHeight: 1.3, color: "#fff", background: "rgba(0,0,0,.28)", borderRadius: 6, padding: "4px 8px", borderLeft: `3px solid ${RED}`, overflowWrap: "anywhere" }}>
              {newest.question}
            </button>
          ) : null}
          {one.words ? <p data-manager-line="1" className="m-0" style={{ fontSize: 12, lineHeight: 1.3, color: INK }}>{one.words}{one.more ? <button type="button" data-manager-more="" className="ml-1 font-bold" style={{ color: "#9fe3ff" }} onClick={() => setMore(true)}>▸ more</button> : null}</p> : null}
          {two.words ? <p data-manager-line="2" className="m-0" style={{ fontSize: 11.5, lineHeight: 1.3, color: SOFT }}>{two.words}{two.more ? <button type="button" className="ml-1 font-bold" style={{ color: "#9fe3ff" }} onClick={() => setMore(true)}>▸ more</button> : null}</p> : null}
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1" style={{ display: chat.history.length && (shown || more) ? undefined : "none" }}>
            {chat.history.length && (shown || more) ? (
              <details data-manager-history="" style={{ fontSize: 11, color: SOFT }} onClick={(e) => e.stopPropagation()}>
                <summary className="cursor-pointer" style={{ color: "#9fe3ff" }}>Timeline · {chat.history.length}</summary>
                <ol className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">{[...chat.history].reverse().slice(0, 12).map((h, i) => <li key={i}><span style={{ color: DIM }}>{whenOf(h.at)}</span> {scrub(priv, h.text)}</li>)}</ol>
              </details>
            ) : null}
          </div>
          {/* The bar along the bottom: say something to this chat; the model chip and the chat's own link sit at its ends. */}
          <div data-manager-bar="" className="flex flex-wrap items-center gap-x-1.5 gap-y-1" style={{ background: "#040208", borderRadius: 5, padding: "2px 6px 2px 2px", textShadow: "none" }} onClick={(e) => e.stopPropagation()}>
            <form className="flex min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); void say(); }}>
              <input data-manager-say="" aria-label={`Say something to ${chat.name}`} placeholder={`Say something to ${chat.name}`} value={text} onChange={(e) => setText(e.target.value)}
                className="min-w-0 flex-1" style={{ boxSizing: "border-box", height: 20, padding: "0 8px", borderRadius: 4, border: 0, outlineOffset: -1, background: "transparent", color: "#fff", font: `11.5px ${mono}` }} />
            </form>
            <ModelChip chat={chat} asked={asked} priv={priv} onAsk={onModel} />
            {turns ? <span data-manager-turns={turns.tone} title="Turns so far, of the five a chat is good for" className="shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: turns.tone === "over" ? "#ff8a8a" : turns.tone === "full" ? "#ffd166" : SOFT }}>{turns.words}</span> : null}
            <button type="button" data-manager-archive={chat.id} title="Archive: off the board, kept in the feed, one press to undo. Never deleted." aria-label={`Archive ${chat.name}`} onClick={(e) => { e.stopPropagation(); onArchive(); }}
              className="inline-flex shrink-0 items-center justify-center rounded" style={{ width: 18, height: 18, color: INK, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.3)" }}>
              <Archive style={{ width: 11, height: 11 }} />
            </button>
            {link ? <a data-manager-open-chat="" href={link} title="Open this chat in the desktop app" className="shrink-0 underline" style={{ fontSize: 10.5, color: "#9fe3ff" }}>Open</a> : null}
          </div>
          {said ? <div data-manager-said="" role="status" style={{ fontSize: 10.5, color: DIM }}>{said}</div> : null}
        </>
      ) : null}
    </>
  );
  const frame: React.CSSProperties = {
    boxSizing: "border-box", borderRadius: RING.paneRadius, border: `${RING.pane}px solid ${colour}`, padding: full ? "10px 12px 10px" : "7px 12px",
    display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
    boxShadow: shown ? `0 0 0 2px #fff, 0 0 22px ${colour}` : "0 2px 5px rgba(0,0,0,.5)",
  };
  const tell = { "data-manager-pane": chat.id, "data-state": chat.state, "data-open": full ? "1" : "0", "data-shown": shown ? "1" : "0", "data-pinned": pinned ? "1" : "0", "data-peek": peek ? "1" : undefined };
  const point = { onMouseEnter: () => onPoint(chat.id), onMouseLeave: () => onPoint(null) };
  /* A parked chat is cold: no boil, a grey slab. */
  if (!block) return <div ref={me} {...tell} {...point} style={{ ...frame, color: INK, textShadow: EDGE, background: "linear-gradient(180deg, rgba(96,104,122,.6), rgba(44,48,60,.72))" }}>{body}</div>;
  return <Block boxRef={me} kind={block} seed={chat.id} at={at} {...tell} {...point} style={frame}>{body}</Block>;
}

/** A question whole, over its coordinator's column (rules §5): everything needed to answer, every Choose showing. */
function QuestionPage({ d, at, of, label, who, now, width, onBack, onStep, onAnswered }: { d: Decision; at: number; of: number; label: string; who: string; now: number; width: number; onBack: () => void; onStep: (by: number) => void; onAnswered: (d: Decision) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState("");
  const [text, setText] = React.useState("");
  const [ask, setAsk] = React.useState("");
  const [askedFor, setAskedFor] = React.useState(d.ask);
  const press = async (answer: string) => {
    if (busy || !answer.trim()) return;
    setBusy(true); setSaid("");
    const r = await post(ANSWER_URL, { id: d.id, answer });
    setBusy(false);
    if (!r.ok) { setSaid(r.says); return; }
    onAnswered(d);
  };
  const tweak = async () => {
    const w = ask.trim();
    if (busy || !w) return;
    setBusy(true); setSaid("");
    const r = await post(ASK_URL, { id: d.id, ask: w });
    setBusy(false);
    if (!r.ok) { setSaid(r.says); return; }
    setAskedFor(w); setAsk("");
  };
  const across = Math.max(1, Math.min(d.options.length, Math.floor(width / 260)));
  const field: React.CSSProperties = { boxSizing: "border-box", minWidth: 0, flex: 1, height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.28)", background: "rgba(0,0,0,.5)", color: "#fff", font: `12px ${mono}` };
  const small: React.CSSProperties = { height: 26, padding: "0 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: INK, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)" };
  return (
    <article data-manager-question={d.id} className="flex flex-col gap-2" style={{ color: INK, opacity: busy ? 0.75 : 1 }}>
      <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 11.5 }}>
        <button type="button" data-manager-back="" style={small} onClick={onBack}>◂ Back to the chats</button>
        <span data-manager-question-at="" style={{ color: SOFT }}>Question {at + 1} of {of}{label ? ` · ${label}` : ""}</span>
        <span className="ml-auto flex gap-1">
          <button type="button" data-manager-prev="" disabled={at <= 0} style={{ ...small, opacity: at <= 0 ? 0.4 : 1 }} onClick={() => onStep(-1)}>◀ Prev</button>
          <button type="button" data-manager-next="" disabled={at >= of - 1} style={{ ...small, opacity: at >= of - 1 ? 0.4 : 1 }} onClick={() => onStep(1)}>Next ▶</button>
        </span>
      </div>
      <h3 data-manager-question-words="" className="m-0 font-bold" style={{ fontSize: 16, lineHeight: 1.25, color: "#fff", textShadow: EDGE }}>{d.question}</h3>
      <p className="m-0" style={{ fontSize: 11, color: DIM }}>{d.carried || carriedWords(d, who) || `asked by ${who || d.about || "the coordinator"}`}{d.asked ? ` · ${whenOf(d.asked)} (${ageOf(d.asked, now)} ago)` : ""}</p>
      <dl data-manager-question-whole="" className="m-0 grid gap-x-2 gap-y-0.5" style={{ gridTemplateColumns: "3.2em 1fr", fontSize: 12, lineHeight: 1.3, color: SOFT }}>
        {d.what ? <><dt className="font-bold text-white">What</dt><dd className="m-0">{d.what}</dd></> : null}
        {d.why ? <><dt className="font-bold text-white">Why</dt><dd className="m-0">{d.why}</dd></> : null}
        {d.how ? <><dt className="font-bold text-white">How</dt><dd className="m-0">{d.how}</dd></> : null}
      </dl>
      {d.context ? <details data-manager-question-background="" style={{ fontSize: 12, color: SOFT }}><summary className="cursor-pointer" style={{ color: "#9fe3ff" }}>Background</summary><p className="m-0 mt-1 whitespace-pre-wrap">{d.context}</p></details> : null}
      <div data-manager-options={across} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` }}>
        {d.options.map((o, i) => (
          <Block key={o.key} kind={o.pick ? "verdant" : "azure"} seed={`${d.id}:${o.key}`} at={i} data-manager-option={o.key} className="flex flex-col gap-1 rounded-lg" style={{ padding: "11px 13px 11px" }}>
            <span style={{ fontSize: 12.5, lineHeight: 1.25 }}><b>{o.key.toUpperCase()}</b> {o.label}{o.pick ? <span data-manager-pick="" className="ml-1 rounded-full px-1.5 font-bold" style={{ fontSize: 10, color: "#04140b", background: STATE_COLOUR.done, textShadow: "none" }}>pick</span> : null}</span>
            {o.desc ? <span style={{ fontSize: 11, lineHeight: 1.3, color: SOFT }}>{o.desc}</span> : null}
            <button type="button" data-manager-choose={o.key} disabled={busy} onClick={() => void press(o.key)} className="mt-auto self-start rounded-md font-black" style={{ padding: "3px 12px", fontSize: 12, color: "#04121c", background: "#fff", textShadow: "none" }}>Choose</button>
          </Block>
        ))}
      </div>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void press(text); }}>
        <input data-manager-type="" aria-label={`Or type an answer to: ${d.question}`} placeholder="Or type an answer" value={text} onChange={(e) => setText(e.target.value)} style={field} />
        <button type="submit" disabled={busy || !text.trim()} style={{ ...small, opacity: busy || !text.trim() ? 0.5 : 1 }}>Send</button>
      </form>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void tweak(); }}>
        <input data-manager-tweak="" aria-label="New options, because" placeholder="New options, because…" value={ask} onChange={(e) => setAsk(e.target.value)} style={field} />
        <button type="submit" disabled={busy || !ask.trim()} style={{ ...small, opacity: busy || !ask.trim() ? 0.5 : 1 }}>Ask</button>
      </form>
      {askedFor ? <p data-manager-asked-for="" className="m-0" style={{ fontSize: 11.5, color: "#9fe3ff" }}>Asked for new options: <span style={{ color: SOFT }}>{askedFor}</span></p> : null}
      {said ? <p data-manager-question-said="" role="status" className="m-0" style={{ fontSize: 12, color: "#ffc9c9" }}>{said}</p> : null}
    </article>
  );
}

/** The cube opened over the column: the things to look at, and the picture rounds (which open as slides). */
function CubePage({ feed, chat, base, onBack, onSlide, onCheck }: { feed: LanesFeed; chat: LaneChat; base: string; onBack: () => void; onSlide: (id: string) => void; onCheck: (id: string) => Promise<string> }) {
  const { checks, rounds } = cubeOf(feed, chat);
  const [said, setSaid] = React.useState<Record<string, string>>({});
  const small: React.CSSProperties = { height: 26, padding: "0 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: INK, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)" };
  return (
    <article data-manager-cube-page={chat.id} className="flex flex-col gap-2" style={{ color: INK }}>
      <div className="flex items-center gap-2"><button type="button" data-manager-back="" style={small} onClick={onBack}>◂ Back to the chats</button><span style={{ fontSize: 11.5, color: SOFT }}>To look at · {chat.name}</span></div>
      {checks.map((c, i) => (
        <Block key={c.id} kind="lantern" seed={c.id} at={i} data-manager-check={c.id} className="flex flex-col gap-1 rounded-lg" style={{ padding: "11px 13px 11px" }}>
          <span style={{ fontSize: 12.5, lineHeight: 1.3 }}>{c.what}</span>
          <button type="button" data-manager-looks-right={c.id} className="self-start rounded-md font-black" style={{ padding: "3px 12px", fontSize: 12, color: "#04121c", background: "#fff", textShadow: "none" }}
            onClick={() => void onCheck(c.id).then((s) => setSaid((x) => ({ ...x, [c.id]: s || "Saved for the coordinator." })))}>Looks right</button>
          {said[c.id] ? <span role="status" style={{ fontSize: 11, color: SOFT }}>{said[c.id]}</span> : null}
        </Block>
      ))}
      {rounds.map((r, i) => (
        <Block key={r.id} kind="azure" seed={r.id} at={i} data-manager-round={r.id} className="flex flex-col gap-1.5 rounded-lg" style={{ padding: "11px 13px 11px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.title}</span>
          <span className="flex gap-1.5">{r.options.slice(0, 4).map((o) => pictureKind(o.picture) === "image" ? <img key={o.key} src={pictureUrl(base, o.picture)} alt={o.label} loading="lazy" draggable={false} style={{ width: 84, height: 56, objectFit: "cover", borderRadius: 4, background: "#000" }} /> : <span key={o.key} className="grid place-items-center rounded" style={{ width: 84, height: 56, background: "rgba(0,0,0,.5)", fontSize: 10 }}>{o.label}</span>)}</span>
          <button type="button" data-manager-open-slides={r.id} className="self-start rounded-md font-black" style={{ padding: "3px 12px", fontSize: 12, color: "#04121c", background: "#fff", textShadow: "none" }} onClick={() => onSlide(r.id)}>Compare across the screen</button>
        </Block>
      ))}
      {!checks.length && !rounds.length ? <p className="m-0" style={{ fontSize: 12, color: SOFT }}>Nothing left to look at here.</p> : null}
    </article>
  );
}

/**
 * Pictures across the whole view (rules §5), one round a slide, stepped up
 * and down: the buttons, the arrow keys, and the wheel once the slide itself
 * has no further to scroll. Each option as large as fits, its Choose showing.
 */
function Slides({ slides, at, base, onStep, onBack, onChoose }: { slides: Slide[]; at: number; base: string; onStep: (by: number) => void; onBack: () => void; onChoose: (s: Slide, key: string) => Promise<string> }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [said, setSaid] = React.useState("");
  const s = slides[at];
  React.useEffect(() => { setSaid(""); }, [at]);
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); e.stopPropagation(); onStep(1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); e.stopPropagation(); onStep(-1); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onBack(); }
    };
    /* Heard first, and not passed on: the Builder under the manager has its own use for these keys. */
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onStep, onBack]);
  const wheelAt = React.useRef(0);
  const wheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget, down = e.deltaY > 0;
    const edge = down ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 0;
    if (!edge || Math.abs(e.deltaY) < 8 || Date.now() - wheelAt.current < 450) return;
    wheelAt.current = Date.now();
    onStep(down ? 1 : -1);
  };
  if (!s) return null;
  const options = s.kind === "question" ? s.d.options.map((o) => ({ key: o.key, label: o.label, picture: o.picture, desc: o.desc, pick: o.pick })) : s.r.options.map((o) => ({ key: o.key, label: o.label, picture: o.picture, desc: "", pick: s.r.pick === o.key }));
  const across = slideAcross(width, options.length);
  const small: React.CSSProperties = { height: 28, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: INK, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)" };
  return (
    <div ref={box} data-manager-slides={slides.length} data-slide-at={at} onWheel={wheel} className="absolute inset-0 z-30 flex flex-col gap-2 overflow-y-auto p-3" style={{ background: "rgba(6,3,12,.9)", color: INK, fontFamily: mono }}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" data-manager-slides-back="" style={small} onClick={onBack}>◂ Back to the columns</button>
        <h3 data-manager-slide={s.id} className="m-0 min-w-0 flex-1 font-bold" style={{ fontSize: 17, color: "#fff" }}>{s.title}</h3>
        <span data-manager-slide-count="" style={{ fontSize: 12, color: SOFT }}>{s.who} · picture round {at + 1} of {slides.length}</span>
        <button type="button" data-manager-slide-step="up" disabled={at <= 0} style={{ ...small, opacity: at <= 0 ? 0.4 : 1 }} onClick={() => onStep(-1)}>▲ Previous</button>
        <button type="button" data-manager-slide-step="down" disabled={at >= slides.length - 1} style={{ ...small, opacity: at >= slides.length - 1 ? 0.4 : 1 }} onClick={() => onStep(1)}>▼ Next</button>
      </div>
      <div data-manager-slide-options={across} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` }}>
        {options.map((o, i) => {
          const kind = pictureKind(o.picture), src = kind ? pictureUrl(base, o.picture) : "";
          return (
            <Block key={o.key} kind={o.pick ? "verdant" : "azure"} seed={`${s.id}:${o.key}`} at={i} data-manager-slide-option={o.key} className="flex min-w-0 flex-col gap-1.5 rounded-lg" style={{ padding: 10 }}>
              {kind === "image" ? <img data-manager-slide-picture={o.key} src={src} alt={`${o.label}, as drawn`} draggable={false} style={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "contain", background: "#000", borderRadius: 4 }} />
                : kind === "page" ? <PageFrame src={src} title={`${o.label}, live`} k={o.key} />
                : <div className="grid place-items-center rounded" style={{ aspectRatio: "3 / 2", background: "rgba(0,0,0,.5)", fontSize: 11, color: DIM }}>no picture</div>}
              <span style={{ fontSize: 13, lineHeight: 1.25 }}><b>{o.key.toUpperCase()}</b> {o.label}{o.pick ? <span className="ml-1 rounded-full px-1.5 font-bold" style={{ fontSize: 10, color: "#04140b", background: STATE_COLOUR.done, textShadow: "none" }}>pick</span> : null}</span>
              {o.desc ? <span style={{ fontSize: 11.5, lineHeight: 1.3, color: SOFT }}>{o.desc}</span> : null}
              <button type="button" data-manager-slide-choose={o.key} className="self-start rounded-md font-black" style={{ padding: "4px 14px", fontSize: 13, color: "#04121c", background: "#fff", textShadow: "none" }}
                onClick={() => void onChoose(s, o.key).then(setSaid)}>Choose</button>
            </Block>
          );
        })}
      </div>
      {s.kind === "question" ? <p className="m-0" style={{ fontSize: 12, color: SOFT }}>{[s.d.what, s.d.why, s.d.how].filter(Boolean).join(" · ")}</p> : null}
      {said ? <p data-manager-slide-said="" role="status" className="m-0" style={{ fontSize: 12, color: "#ffc9c9" }}>{said}</p> : null}
    </div>
  );
}

/**
 * Every open question of a column, from its head's one button (BAM mark 11, the console's mark 19): new since J
 * last looked, then by chat, then older ones carried over; newest first in each, each with its age and who asked.
 */
function AllQuestions({ feed, groups, label, now, onBack, onOpen }: { feed: LanesFeed; groups: QuestionGroups; label: string; now: number; onBack: () => void; onOpen: (d: Decision, list: Decision[]) => void }) {
  const small: React.CSSProperties = { height: 26, padding: "0 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: INK, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)" };
  const all = [...groups.fresh, ...groups.byChat.flatMap((g) => g.list), ...groups.older];
  const row = (d: Decision, list: Decision[], isNew: boolean) => {
    const x = chatsAbout(feed, d.about)[0];
    return (
      <li key={d.id}>
        <button type="button" data-manager-all-row={d.id} onClick={() => onOpen(d, list)} className="flex w-full flex-col gap-0.5 rounded-lg text-left" style={{ padding: "7px 10px", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.16)", color: INK }}>
          <span className="flex flex-wrap items-baseline gap-x-2" style={{ fontSize: 10.5, color: SOFT }}>
            {isNew ? <b data-manager-new="" style={{ color: "#04140b", background: STATE_COLOUR.done, borderRadius: 999, padding: "0 6px", textShadow: "none" }}>new</b> : null}
            <span>{x ? labelOf(x) : d.askedBy || "the coordinator"}</span>
            {d.asked ? <span>{ageOf(d.asked, now)} ago</span> : null}
            {d.carried ? <span>{d.carried}</span> : null}
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 700, color: "#fff", overflowWrap: "anywhere" }}>{d.question}</span>
        </button>
      </li>
    );
  };
  const section = (key: string, title: string, list: Decision[], isNew = false) => list.length ? (
    <section key={key} data-manager-all-group={key} className="flex flex-col gap-1">
      <h4 className="m-0 font-bold" style={{ fontSize: 11.5, letterSpacing: ".04em", color: "#9fe3ff", textTransform: "uppercase" }}>{title} · {list.length}</h4>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">{list.map((d) => row(d, list, isNew))}</ul>
    </section>
  ) : null;
  return (
    <article data-manager-all={all.length} className="flex flex-col gap-2.5" style={{ color: INK }}>
      <div className="flex items-center gap-2"><button type="button" data-manager-back="" style={small} onClick={onBack}>◂ Back to the chats</button><span style={{ fontSize: 11.5, color: SOFT }}>All questions · {label}</span></div>
      {section("new", "New since you last looked", groups.fresh, true)}
      {groups.byChat.map((g) => section(`chat:${g.who}`, g.who, g.list))}
      {section("older", "Older, carried over", groups.older)}
      {!all.length ? <p className="m-0" style={{ fontSize: 12, color: SOFT }}>No question waits on you here.</p> : null}
    </article>
  );
}

type Said = { at: string; kind: SayKind | "answer"; text: string; to: string };
/**
 * The coordinator's terminal (BAM marks 1, 9 and 14): under the ring, the rest of the rail's height. The
 * coordinator's latest messages in line, oldest above newest, with what J typed here between them; J types at the
 * bottom with the real keyboard (Enter sends, Shift+Enter a new line). Send says it to the coordinator; Note saves
 * it on the open question (or the coordinator); New chat makes it the brief of a new chat; with a question open,
 * Answer answers it. Every press is saved through the Helper and read on the coordinator's next turn.
 */
function Terminal({ coord, question, qLabel, priv, now, onAnswered }: { coord: LaneChat | null; question: Decision | null; qLabel: string; priv: boolean; now: number; onAnswered: (d: Decision) => void }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [says, setSays] = React.useState("");
  const [mine, setMine] = React.useState<Said[]>(() => { const v = kept<Said[]>(SAID_KEY, []); return Array.isArray(v) ? v : []; });
  const list = React.useRef<HTMLOListElement>(null);
  const lines = React.useMemo(() => {
    const theirs = (coord?.messages ?? []).map((m) => ({ at: m.at, who: "them" as const, text: m.text, kind: "" }));
    const ours = mine.filter((m) => !coord || m.to === coord.id || m.kind === "answer").map((m) => ({ at: m.at, who: "you" as const, text: m.text, kind: m.kind }));
    return [...theirs, ...ours].sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0)).slice(-40);
  }, [coord, mine]);
  React.useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [lines.length]);
  const send = async (kind: SayKind | "answer") => {
    const words = text.trim();
    if (busy || !words || !coord) return;
    if (kind === "answer" && !question) return;
    setBusy(true); setSays("");
    const r = kind === "answer"
      ? await post(ANSWER_URL, { id: question!.id, answer: words })
      : await post(`${HELPER_ORIGIN}/lanes/press`, { kind, target: kind === "note" && question ? question.id : coord.id, text: words }, true);
    setBusy(false);
    if (!r.ok) { setSays(r.says); return; }
    const row: Said = { at: new Date().toISOString(), kind, text: words, to: coord.id };
    setMine((m) => { const n = [...m, row].slice(-30); keep(SAID_KEY, n); return n; });
    setText("");
    setSays(kind === "answer" ? "Answered. The coordinator reads it on its next turn." : SAY_WHEN);
    if (kind === "answer" && question) onAnswered(question);
  };
  const KIND_WORDS: Record<string, string> = { say: "", note: "note", "new-chat": "new chat", answer: "answer" };
  const button = (kind: SayKind | "answer", words: string, primary = false) => (
    <button key={kind} type="button" data-manager-term-send={kind} disabled={busy || !text.trim() || !coord} onClick={() => void send(kind)}
      className="shrink-0 rounded-md font-bold" style={{ height: 26, padding: "0 10px", fontSize: 11.5, color: primary ? "#04121c" : INK, background: primary ? "#9fe3ff" : "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)", opacity: busy || !text.trim() || !coord ? 0.5 : 1 }}>
      {words}
    </button>
  );
  const name = coord ? labelOf(coord) : "the coordinator";
  return (
    <section data-manager-terminal={coord?.id ?? ""} aria-label={`Talk to ${name}`} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
      style={{ background: "rgba(3,2,8,.86)", border: "1px solid rgba(159,227,255,.35)", boxShadow: "0 0 18px rgba(0,0,0,.6)", fontFamily: mono }}>
      <header className="flex shrink-0 items-center gap-2 px-3" style={{ height: 30, borderBottom: "1px solid rgba(255,255,255,.12)", fontSize: 11.5 }}>
        <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: coord ? STATE_COLOUR[coord.state] : DIM }} />
        <b data-manager-term-name="" style={{ color: "#fff" }}>{name}</b>
        <span style={{ color: DIM }}>· terminal</span>
      </header>
      <ol ref={list} data-manager-term-lines={lines.length} className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-0 px-3 py-2" style={{ fontSize: 12, lineHeight: 1.4 }}>
        {!lines.length ? <li data-manager-term-empty="" style={{ color: DIM }}>{coord ? "No message from the coordinator here yet. Its messages show once the Helper on your PC is updated (the dock's Helper tab)." : "No live coordinator."}</li> : null}
        {lines.map((l, i) => (
          <li key={`${l.at}:${i}`} data-manager-term-line={l.who} style={{ color: l.who === "you" ? "#c9f7ff" : INK, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            <span style={{ color: DIM }}>{whenOf(l.at)} {l.who === "you" ? `you${KIND_WORDS[l.kind] ? ` (${KIND_WORDS[l.kind]})` : ""} ›` : `${coord?.code || "coordinator"} ›`}</span> {scrub(priv, l.text)}
            {l.who === "you" && ageOf(l.at, now) && Date.now() - Date.parse(l.at) < 3600_000 && i === lines.length - 1 ? <span style={{ color: DIM }}> · saved, read on its next turn</span> : null}
          </li>
        ))}
      </ol>
      {question ? <p data-manager-term-question={question.id} className="m-0 shrink-0 px-3 py-1" style={{ fontSize: 11, color: "#ffd0d0", borderTop: "1px solid rgba(255,255,255,.1)" }}>Open: {qLabel} · {question.question}</p> : null}
      <form className="flex shrink-0 flex-col gap-1.5 px-2 pb-2 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }} onSubmit={(e) => { e.preventDefault(); void send(question ? "answer" : "say"); }}>
        <span className="flex items-start gap-1.5">
          <span aria-hidden style={{ color: "#9fe3ff", fontSize: 13, lineHeight: "26px" }}>›</span>
          <textarea data-manager-term-input="" aria-label={question ? `Answer, or say something to ${name}` : `Say something to ${name}`} placeholder={question ? "Type an answer, a note, or a new chat's brief" : `Say something to ${coord?.code || "the coordinator"}`}
            value={text} rows={2} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(question ? "answer" : "say"); } }}
            onKeyUp={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 resize-none" style={{ boxSizing: "border-box", minHeight: 44, maxHeight: 140, padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,.22)", background: "#040208", color: "#fff", font: `12.5px ${mono}`, outlineOffset: -1 }} />
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {question ? button("answer", "Answer", true) : button("say", `Send to ${coord?.code || "coordinator"}`, true)}
          {button("note", "Note")}
          {button("new-chat", "New chat")}
        </span>
        <span data-manager-term-says="" role="status" style={{ fontSize: 10.5, color: says && !says.startsWith("Saved") && !says.startsWith("Answered") ? "#ffc9c9" : DIM }}>{says || "Enter sends · Shift+Enter a new line · read on the coordinator's next turn"}</span>
      </form>
    </section>
  );
}

/** The archived chats behind the nucleus (mark 16): loaded only when J presses the sun, newest first. */
function NucleusList({ chats, now, onClose, onPutBack }: { chats: LaneChat[]; now: number; onClose: () => void; onPutBack: (x: LaneChat) => void }) {
  return (
    <div data-manager-nucleus-list={chats.length} className="absolute inset-x-3 bottom-3 z-30 flex max-h-[60%] flex-col overflow-hidden rounded-xl" style={{ background: "rgba(8,4,16,.92)", border: "1px solid rgba(176,124,255,.5)" }}>
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5" style={{ fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
        <b style={{ color: "#d9c2ff" }}>Archived · {chats.length}</b>
        <span style={{ color: DIM, fontSize: 10.5 }}>finished a day ago with nothing waiting, or archived by you</span>
        <button type="button" data-manager-nucleus-close="" className="ml-auto rounded px-2" style={{ color: INK, background: "rgba(255,255,255,.12)" }} onClick={onClose}>Close</button>
      </div>
      <ul className="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto p-2" style={{ fontSize: 11.5 }}>
        {chats.slice(0, 120).map((x) => (
          <li key={x.id} data-manager-nucleus-chat={x.id} className="flex items-baseline gap-2 px-1">
            <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATE_COLOUR[x.state] }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: "#fff" }}>{labelOf(x)}</span>
            <span style={{ color: SOFT }}>{ageOf(x.lastSeen || x.sentAt, now)}</span>
            {x.archived ? <button type="button" className="underline" style={{ color: "#9fe3ff" }} onClick={() => onPutBack(x)}>Put back</button> : null}
            {chatLink(x.id) ? <a href={chatLink(x.id)!} className="underline" style={{ color: "#9fe3ff" }}>Open</a> : null}
          </li>
        ))}
        {!chats.length ? <li style={{ color: SOFT }}>Nothing archived.</li> : null}
      </ul>
    </div>
  );
}

type Opened = { col: string; kind: "question"; id: string; list: string[]; label: string } | { col: string; kind: "all" } | { col: string; kind: "cube"; chat: string } | null;

export function AgentsManager() {
  const { feed: read, base } = useLive((s) => s.lanes);
  const helper = useLive((s) => s.helper);
  const cost = useLive((s) => s.cost);
  const priv = usePrivate((s) => s.on);
  const lit = useAgents((s) => s.lit);
  const now = useNow();
  React.useEffect(() => managerShown(), []);

  const [gone, setGone] = React.useState<Record<string, boolean>>(() => kept(GONE_KEY, {}));
  const [models, setModels] = React.useState<Record<string, { model: string; effort: string }>>(() => kept(MODEL_KEY, {}));
  const [flipped, setFlipped] = React.useState<Record<string, boolean>>(() => kept(OPEN_KEY, {}));
  const [opened, setOpened] = React.useState<Opened>(null);
  const [slideAt, setSlideAt] = React.useState<number | null>(null);
  const [point, setPoint] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState<string | null>(null);
  const [footOpen, setFootOpen] = React.useState<Record<string, boolean>>({});
  const [undo, setUndo] = React.useState<{ id: string; name: string; says: string; at: number } | null>(null);
  const [said, setSaid] = React.useState("");
  const [seenIds, setSeenIds] = React.useState<Set<string>>(() => { const v = kept<string[]>(SEEN_KEY, []); return new Set(Array.isArray(v) ? v : []); });
  const [nucleusOpen, setNucleusOpen] = React.useState(false);
  const markSeen = React.useCallback((id: string) => setSeenIds((x) => { if (x.has(id)) return x; const n = new Set(x); n.add(id); keep(SEEN_KEY, [...n].slice(-400)); return n; }), []);

  const feed = React.useMemo(() => (read ? veilFeed(read, priv, badgeOf) : null), [read, priv]);
  /* What this browser archived or put back holds until the feed says the same. */
  React.useEffect(() => {
    if (!read) return;
    const all = new Map(read.coordinators.flatMap((c) => c.chats).map((x) => [x.id, x]));
    setGone((g) => { const n = Object.fromEntries(Object.entries(g).filter(([id, v]) => all.has(id) && (all.get(id)!.archived === true) !== v)); if (Object.keys(n).length === Object.keys(g).length) return g; keep(GONE_KEY, n); return n; });
    setModels((m) => { const n = Object.fromEntries(Object.entries(m).filter(([id, a]) => { const x = all.get(id), is = x ? modelOf(x) : null; return x && !(is && is.model === a.model && is.effort === a.effort); })); if (Object.keys(n).length === Object.keys(m).length) return m; keep(MODEL_KEY, n); return n; });
  }, [read]);
  const cols = React.useMemo(() => columnsOf(feed, gone), [feed, gone]);
  const slides = React.useMemo(() => slidesOf(feed, cols), [feed, cols]);
  const pc: PcCost | null = cost.pc;
  const everyChat = React.useMemo(() => cols.flatMap((c) => [...(c.coord ? [c.coord] : []), ...c.panes, ...c.foot]), [cols]);
  const heaviest = React.useMemo(() => Math.max(0, ...everyChat.map((x) => costOf(pc, x)?.memBytes ?? 0)), [pc, everyChat]);
  /* Mark 16: what has left the ring for the nucleus; read once a minute is plenty for "a day ago". */
  const minute = Math.floor(now / 60_000);
  const inNucleus = React.useMemo(() => nucleusChats(feed, minute * 60_000), [feed, minute]);

  /* The board beside the columns: a ring per column, in its colour; the retired coordinators by the sun. */
  const beside = React.useMemo(() => {
    if (!feed) return { feed: null as LanesFeed | null, colours: {}, names: {}, slots: new Map<string, number>() };
    /* Mark 16: the chats in the nucleus are off the rings; mark 18: the rest each have their own place by when they began. */
    const away = new Set(inNucleus.map((x) => x.id));
    const rings: LaneCoordinator[] = cols.map((c) => ({ id: c.id, name: c.name, retired: false, chats: [...(c.coord ? [c.coord] : []), ...c.panes, ...c.foot].filter((x) => !away.has(x.id)) }));
    const slots = new Map<string, number>();
    for (const r of rings) for (const [id, f] of ringSlots(r.chats.filter((x) => x.state !== "done"))) slots.set(id, f);
    const old: LaneCoordinator[] = cols[0]?.coord ? (cols[0].retired ?? []).map((x) => ({ id: `ring:${x.id}`, name: x.name, retired: true, chats: [x] })) : feed.coordinators.filter((c) => c.retired);
    return {
      feed: { ...feed, coordinators: [...rings, ...old] },
      colours: Object.fromEntries(cols.map((c) => [c.id, [c.colours.outer, c.colours.inner] as [string, string]])),
      names: Object.fromEntries(cols.map((c) => [c.id, `${c.label} · ${c.coord ? labelOf(c.coord) : c.name}`])),
      slots,
    };
  }, [feed, cols, inNucleus]);

  const colOf = React.useCallback((id: string | null) => (id ? cols.find((c) => c.id === id || c.coord?.id === id || c.panes.some((x) => x.id === id) || c.foot.some((x) => x.id === id)) ?? null : null), [cols]);
  /**
   * A question opens over its column, stepping through the list it was opened from (the console's mark 18: the
   * counter is per button): by default that chat's own questions, newest first, named by its code word.
   */
  const openQuestionHere = React.useCallback((id: string, list?: Decision[], label?: string) => {
    const at = slides.findIndex((s) => s.id === id);
    markSeen(id);
    if (at >= 0) { setSlideAt(at); return; }
    const col = cols.find((c) => c.questions.some((d) => d.id === id));
    if (!col || !feed) return;
    const d = col.questions.find((q) => q.id === id)!;
    const x = chatsAbout(feed, d.about)[0];
    const mine = list ?? newestFirst(col.questions.filter((q) => (x ? chatsAbout(feed, q.about).some((y) => y.id === x.id) : !chatsAbout(feed, q.about).length)));
    setOpened({ col: col.id, kind: "question", id, list: mine.map((q) => q.id), label: label ?? (x ? x.code || x.name : col.label) });
  }, [cols, slides, feed, markSeen]);
  /* A slice of the pie, a moon or an orb asked for a question: it opens over its column here. */
  React.useEffect(() => { if (lit && Date.now() - lit.at < 2000) openQuestionHere(lit.id); }, [lit, openQuestionHere]);
  React.useEffect(() => {
    if (slideAt !== null) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && opened) { e.preventDefault(); e.stopPropagation(); setOpened(null); } };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [opened, slideAt]);

  /** A press on an orb: its chat is pinned in its column; if a question waits about it, that question opens. */
  const pressOrb = (id: string) => {
    const col = colOf(id);
    if (!col) return;
    const chat = everyChat.find((x) => x.id === id);
    if (!chat) return;
    setPin((p) => (p === id ? null : id));
    const q = feed ? asksOf(feed, col, chat)[0] ?? (col.coord?.id === id ? col.own[0] : undefined) : undefined;
    if (q) openQuestionHere(q.id);
  };

  const archive = async (chat: LaneChat, archived: boolean) => {
    setGone((g) => { const n = { ...g, [chat.id]: archived }; keep(GONE_KEY, n); return n; });
    if (pin === chat.id) setPin(null);
    const r = await post(`${HELPER_ORIGIN}/lanes/archive`, { id: chat.id, archived }, true);
    if (archived) setUndo({ id: chat.id, name: chat.name, says: r.ok ? "" : `Off this screen. ${r.says}`, at: Date.now() });
    else { setUndo(null); if (!r.ok) setSaid(r.says); }
    if (r.ok) setTimeout(() => void readLanes(), 300);
  };
  React.useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 12_000); return () => clearTimeout(t); }, [undo]);
  React.useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(""), 8000); return () => clearTimeout(t); }, [said]);

  const askModel = async (chat: LaneChat, model: string, effort: string): Promise<string> => {
    const r = await post(`${HELPER_ORIGIN}/lanes/press`, { kind: "model", target: chat.id, model, effort }, true);
    if (!r.ok) return r.says;
    setModels((m) => { const n = { ...m, [chat.id]: { model, effort } }; keep(MODEL_KEY, n); return n; });
    return "";
  };
  const choose = async (s: Slide, key: string): Promise<string> => {
    const r = s.kind === "question" ? await post(ANSWER_URL, { id: s.id, answer: key }) : await post(`${HELPER_ORIGIN}/lanes/press`, { kind: "choose", target: s.id, option: key }, true);
    if (!r.ok) return r.says;
    setTimeout(() => void readLanes(), 300);
    /* The next round, or the columns after the last one. */
    if (slideAt !== null && slideAt < slides.length - 1) setSlideAt(slideAt + (s.kind === "round" ? 1 : 0)); else setSlideAt(null);
    return "";
  };
  const check = async (id: string): Promise<string> => { const r = await post(`${HELPER_ORIGIN}/lanes/press`, { kind: "check", target: id }, true); return r.ok ? "" : r.says; };

  const [body, width, height] = useWidth<HTMLDivElement>();
  /* J's drawing (marks 12 and 13): the column off the left wall, the ring top right with the terminal under it. */
  const lay = layoutOf(width, height, cols.length);
  const stacked = lay.stacked;
  const colW = lay.col;
  const current = cols[0] ?? null;
  const openQ = opened?.kind === "question" ? cols.find((c) => c.id === opened.col)?.questions.find((d) => d.id === opened.id) ?? null : null;
  const loose = unowned(pc, cols);
  const flip = (x: LaneChat, was: boolean) => setFlipped((f) => { const n = { ...f, [x.id]: !was }; keep(OPEN_KEY, n); return n; });
  const head: React.CSSProperties = { height: 24, padding: "0 9px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: INK, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.26)" };

  return (
    <section data-agents-manager="" data-manager-columns={cols.length} aria-label="Agents manager" className="fixed inset-x-0 bottom-0 top-(--topbar-h) z-[65] flex flex-col" style={{ fontFamily: mono, color: INK, background: "#06030c" }}>
      {/* The Builder's nebula, not a black box: J's own tiles, the blue over the green, under a soft vignette. */}
      <div aria-hidden data-manager-nebula="" className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 70% 45%, rgba(6,3,12,0) 0%, rgba(6,3,12,.55) 70%, rgba(6,3,12,.9) 100%), var(--nebula-azure, none), var(--nebula-verdant, none)", backgroundSize: "auto, 620px auto, 900px auto", backgroundBlendMode: "normal, screen, normal", opacity: 0.9 }} />
      <header className="relative z-10 flex h-9 shrink-0 items-center gap-3 px-3" style={{ borderBottom: "1px solid rgba(255,255,255,.14)", background: "rgba(6,3,12,.55)" }}>
        <span className="text-xs font-semibold tracking-wide">AGENTS MANAGER</span>
        <span data-manager-helper={helper.state} className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: SOFT }}>
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: HELPER_COLOUR[helper.state] }} />{helperWords(helper.state, helper.paired)}
        </span>
        {/* What runs on the PC for no chat here: by its label's own word, never "no session". */}
        <span data-manager-loose={loose.length} className="flex min-w-0 items-center gap-2 overflow-hidden" style={{ fontSize: 10.5, color: SOFT }}>
          {loose.slice(0, 4).map((o) => <span key={o.key} data-manager-loose-owner={o.key} className="shrink-0 rounded-full px-2" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)" }} title={shareLines(o, "its total", priv).map((l) => l.words).join("\n")}><b style={{ color: "#fff" }}>{priv && /^local_|^[0-9a-f-]{20,}$/i.test(o.key) ? "a chat" : (o.title || o.key)}</b>{priv ? "" : ` · ${memWords(o.memBytes)}`}{upWords(o.startedAt, now) ? ` · ${upWords(o.startedAt, now)}` : ""}</span>)}
          {cost.asked && !pc ? <span data-manager-no-cost="">PC cost shows once the Helper on your PC is on and updated</span> : null}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" data-manager-private={priv ? "on" : "off"} aria-pressed={priv} style={head} title={priv ? "Private: names are badges, memory and models are hidden. Press to show them." : "Private is off: press to hide names, memory and models for a screenshot."} onClick={() => setPrivate(!priv)}>{priv ? "🫥 Private" : "Private off"}</button>
          <button type="button" data-manager-to-dock="" style={head} title="Back to the dock at the side" onClick={closeManager}><PanelRight className="mr-1 inline size-3.5" />Dock</button>
          <button type="button" data-manager-close="" aria-label="Close agents" style={{ ...head, padding: "0 6px" }} onClick={closeDock}><X className="size-3.5" /></button>
        </span>
      </header>
      <div ref={body} data-manager-body="" className={cn("relative z-10 flex min-h-0 flex-1 gap-2 p-2", stacked ? "flex-col overflow-y-auto" : "flex-row")} style={{ paddingLeft: stacked ? 8 : lay.gap }}>
        {!feed ? <p data-manager-empty="" className="m-auto max-w-md text-center" style={{ fontSize: 13, color: SOFT }}>The chats are listed on your PC, and the helper isn&apos;t answering. Start it from the dock&apos;s Helper tab.</p> : null}
        {cols.map((col, ci) => {
          const cc = col.colours;
          const on = !!point && colOf(point)?.id === col.id;
          const sum = columnCost(pc, col);
          const page = opened && opened.col === col.id ? opened : null;
          const q = page?.kind === "question" ? col.questions.find((d) => d.id === page.id) ?? null : null;
          const cubeChat = page?.kind === "cube" ? everyChat.find((x) => x.id === page.chat) ?? null : null;
          const coordCube = col.coord && feed ? cubeOf(feed, col.coord).count : 0;
          const coordTurns = turnsOf(col.coord);
          const coordAge = col.coord ? ageOf(col.coord.lastSeen || col.coord.sentAt, now) : "";
          const peek = [pin, point].map((id) => (id ? col.foot.find((x) => x.id === id) : undefined)).find(Boolean);
          const foot = footOpen[col.id] ?? false;
          const ages = col.foot.map((x) => ageOf(x.lastSeen || x.sentAt, now)).filter(Boolean);
          const groups = feed ? questionGroups(feed, col.questions, seenIds, now) : null;
          const qList = q && page?.kind === "question" ? page.list.map((id) => col.questions.find((d) => d.id === id)).filter((d): d is Decision => !!d) : [];
          return (
            <section key={col.id} data-manager-column={col.id} data-label={col.label} data-current={col.current ? "1" : "0"} data-outer={cc.outer} data-inner={cc.inner} data-lit={on || over === col.id ? "1" : "0"}
              onMouseEnter={() => setOver(col.id)} onMouseLeave={() => setOver((o) => (o === col.id ? null : o))}
              className="flex min-h-0 shrink-0 flex-col" style={{ boxSizing: "border-box", width: colW, minHeight: stacked ? 480 : undefined, border: `${RING.outer}px solid ${cc.outer}`, borderRadius: RING.radius, boxShadow: on || over === col.id ? `0 0 0 1px #fff, 0 0 30px ${cc.outer}` : `0 0 16px ${cc.outer}66`, transition: "box-shadow .15s" }}>
              <div data-manager-ring-inner="" className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ boxSizing: "border-box", border: `${RING.inner}px solid ${cc.inner}`, borderRadius: RING.innerRadius, background: cc.fill, backdropFilter: "saturate(1.2)" }}>
                {/* The head band: a design block in the column's colour, divided from the chats by a line in the ring's inner colour. */}
                <Block kind={cc.block} turn={cc.turn} seed={col.id} at={ci} data-manager-head={col.id} className="shrink-0" style={{ borderBottom: `${RING.inner}px solid ${cc.inner}`, padding: "11px 13px 10px" }}
                  onMouseEnter={() => setPoint(col.coord?.id ?? col.id)} onMouseLeave={() => setPoint(null)}>
                  {/* As drawn: the C-number big at the left, the turn number at the right of the first line. */}
                  <div className="flex items-start gap-x-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <b data-manager-cnumber="" style={{ fontSize: 30, lineHeight: "30px", fontWeight: 900, color: cc.inner, letterSpacing: "-0.02em" }}>{col.label}</b>
                    <b data-manager-head-name="" className="min-w-0 truncate" style={{ fontSize: 15, color: "#fff" }}>{col.coord ? labelOf(col.coord) : col.name}</b>
                    {sum ? <HeadCost cost={sum} heaviest={Math.max(heaviest, sum.memBytes)} now={now} priv={priv} /> : null}
                    {/* Mark 11: one question button with its count, not a row of pills. */}
                    <span data-manager-count={col.questions.length} style={{ display: "contents" }}>
                      <QuestionsButton big count={col.questions.length} words={groups ? countWords(groups) : ""} label={col.label} onOpen={() => setOpened({ col: col.id, kind: "all" })} />
                    </span>
                    {col.coord ? <CubeButton count={coordCube} label={col.name} onOpen={() => setOpened({ col: col.id, kind: "cube", chat: col.coord!.id })} /> : null}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2" style={{ height: 30 }}>
                      {coordAge ? <span data-manager-age="" style={{ fontSize: 12, fontWeight: 800 }}>{coordAge}</span> : null}
                      {coordTurns ? <span data-manager-turns={coordTurns.tone} title="This coordinator's turn, of the five a chat is good for" style={{ fontSize: 14, fontWeight: 900, color: coordTurns.tone === "over" ? "#ff8a8a" : coordTurns.tone === "full" ? "#ffd166" : "#d9c2ff" }}># {coordTurns.words}</span> : null}
                    </span>
                  </div>
                  {col.coord ? (
                    <div className="mt-1 flex flex-wrap items-start gap-x-2 gap-y-1" style={{ fontSize: 10.5, color: SOFT }}>
                      <ModelChip chat={col.coord} asked={models[col.coord.id] ?? null} priv={priv} onAsk={(m, e) => askModel(col.coord!, m, e)} />
                      {col.coord.note ? <details data-manager-head-details="" className="min-w-0"><summary className="cursor-pointer" style={{ color: "#9fe3ff" }}>Details</summary><p className="m-0 mt-0.5" style={{ fontSize: 11.5, color: INK }}>{scrub(priv, col.coord.note)}</p>{col.coord.last ? <p className="m-0" style={{ fontSize: 11 }}>{scrub(priv, col.coord.last)}</p> : null}</details> : null}
                    </div>
                  ) : null}
                </Block>
                {/* The body: the chats, or the question that opened over them. */}
                <div data-manager-column-body="" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto" style={{ padding: RING.pad }}>
                  {q && feed ? (
                    <QuestionPage key={q.id} d={q} at={Math.max(0, qList.indexOf(q))} of={Math.max(1, qList.length)} label={page?.kind === "question" ? page.label : ""} who={chatsAbout(feed, q.about)[0] ? labelOf(chatsAbout(feed, q.about)[0]!) : ""} now={now} width={colW - 2 * (RING.outer + RING.inner + RING.pad)}
                      onBack={() => setOpened(null)} onStep={(by) => { const n = qList[qList.indexOf(q) + by]; if (n && page?.kind === "question") openQuestionHere(n.id, qList, page.label); }}
                      onAnswered={() => { setOpened(null); setTimeout(() => void readLanes(), 300); }} />
                  ) : page?.kind === "all" && feed && groups ? (
                    <AllQuestions feed={feed} groups={groups} label={col.coord ? labelOf(col.coord) : col.label} now={now} onBack={() => setOpened(null)} onOpen={(d, list) => openQuestionHere(d.id, list, list === groups.fresh ? "new" : list === groups.older ? "older" : (chatsAbout(feed, d.about)[0]?.code || col.label))} />
                  ) : cubeChat && feed ? (
                    <CubePage feed={feed} chat={cubeChat} base={base} onBack={() => setOpened(null)} onSlide={(id) => { const at = slides.findIndex((s) => s.id === id); if (at >= 0) setSlideAt(at); }} onCheck={check} />
                  ) : (
                    <>
                      {peek && feed ? <Pane key={`peek:${peek.id}`} peek chat={peek} asks={[]} cube={0} cost={costOf(pc, peek)} heaviest={heaviest} now={now} priv={priv} at={0} open shown pinned={pin === peek.id} asked={models[peek.id] ?? null}
                        onFlip={() => setPin(null)} onPoint={() => {}} onAsk={openQuestionHere} onCube={() => {}} onArchive={() => void archive(peek, true)} onModel={(m, e) => askModel(peek, m, e)} /> : null}
                      {col.panes.map((x, i) => {
                        /* Mark 20: a pane opens at its full size unless J folded it. */
                        const openNow = flipped[x.id] ?? true;
                        return <Pane key={x.id} chat={x} asks={feed ? asksOf(feed, col, x) : []} cube={feed ? cubeOf(feed, x).count : 0} cost={costOf(pc, x)} heaviest={heaviest} now={now} priv={priv} at={i}
                          open={openNow} shown={point === x.id || pin === x.id} pinned={pin === x.id} asked={models[x.id] ?? null}
                          onFlip={() => flip(x, openNow)} onPoint={setPoint} onAsk={openQuestionHere} onCube={() => setOpened({ col: col.id, kind: "cube", chat: x.id })} onArchive={() => void archive(x, true)} onModel={(m, e) => askModel(x, m, e)} />;
                      })}
                      {!col.panes.length ? <p data-manager-no-panes="" className="m-0 px-1 py-2" style={{ fontSize: 12, color: SOFT }}>No chat is working under {col.label} just now.</p> : null}
                    </>
                  )}
                </div>
                {/* The foot: finished chats by age, newest first; the archived ones, findable, never deleted. */}
                <Block kind={cc.block} turn={cc.turn} seed={`${col.id}:foot`} at={ci + 1} data-manager-foot={col.id} data-open={foot ? "1" : "0"} className="shrink-0" style={{ borderTop: `${RING.inner}px solid ${cc.inner}`, padding: "10px 13px 10px" }}>
                  <button type="button" data-manager-foot-toggle="" aria-expanded={foot} className="flex w-full items-baseline gap-2 text-left" style={{ fontSize: 12, color: INK }} onClick={() => setFootOpen((f) => ({ ...f, [col.id]: !foot }))}>
                    <b style={{ color: cc.inner, fontSize: 14 }}>Age</b>
                    <span>{foot ? "▾" : "▸"} {col.foot.length} finished{ages.length ? ` · newest ${ages[0]}, oldest ${ages[ages.length - 1]}` : ""}{col.retired.length ? ` · ${col.retired.length} retired ${col.retired.length === 1 ? "coordinator" : "coordinators"}` : ""}{col.archived.length ? ` · ${col.archived.length} archived` : ""}</span>
                  </button>
                  {foot ? (
                    <ul data-manager-foot-list="" className="m-0 mt-1 flex max-h-56 list-none flex-col gap-0.5 overflow-y-auto p-0" style={{ fontSize: 11.5 }}>
                      {col.foot.map((x) => (
                        <li key={x.id} data-manager-foot-chat={x.id} className="flex items-baseline gap-2 rounded px-1" style={{ background: pin === x.id ? "rgba(255,255,255,.14)" : "transparent" }} onMouseEnter={() => setPoint(x.id)} onMouseLeave={() => setPoint(null)}>
                          <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATE_COLOUR.done }} />
                          <button type="button" className="min-w-0 flex-1 truncate text-left font-bold" style={{ color: "#fff" }} onClick={() => setPin((p) => (p === x.id ? null : x.id))}>{x.name}</button>
                          <span style={{ color: SOFT }}>{ageOf(x.lastSeen || x.sentAt, now)}</span>
                          <button type="button" data-manager-archive={x.id} title="Archive: off the board, kept in the feed" aria-label={`Archive ${x.name}`} onClick={() => void archive(x, true)}><Archive style={{ width: 12, height: 12 }} /></button>
                        </li>
                      ))}
                      {col.retired.map((x) => <li key={x.id} data-manager-retired={x.id} className="flex items-baseline gap-2 px-1" style={{ color: SOFT }}><span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: "#b07cff" }} /><span className="min-w-0 flex-1 truncate">{x.name} · retired</span><span>{ageOf(x.lastSeen || x.sentAt, now)}</span></li>)}
                      {col.archived.length ? (
                        <li>
                          <details data-manager-archived={col.archived.length}>
                            <summary className="cursor-pointer" style={{ color: "#9fe3ff" }}>Archived · {col.archived.length}</summary>
                            <ul className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0">
                              {col.archived.slice(0, 60).map((x) => (
                                <li key={x.id} data-manager-archived-chat={x.id} className="flex items-baseline gap-2 px-1" style={{ color: SOFT }}>
                                  <span className="min-w-0 flex-1 truncate">{x.name}</span><span>{ageOf(x.lastSeen || x.sentAt, now)}</span>
                                  <button type="button" data-manager-unarchive={x.id} className="underline" style={{ color: "#9fe3ff" }} onClick={() => void archive(x, false)}>Put back</button>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </Block>
              </div>
            </section>
          );
        })}
        {/* The nebula shows between the columns and the rail. */}
        {!stacked ? <div aria-hidden data-manager-gap="" className="min-w-0 flex-1" /> : null}
        {/* The rail (marks 9, 13): the ring in the top right, the coordinator's terminal under it, the rest of the height. */}
        {feed ? (
          <div data-manager-rail="" className="flex min-h-0 shrink-0 flex-col gap-2" style={{ width: stacked ? "100%" : lay.rail, minHeight: stacked ? 760 : undefined }}>
            <div data-manager-orbs="" className="relative shrink-0" style={{ height: lay.orbsH }}>
              <LanesBoard beside={{ feed: beside.feed, colours: beside.colours, names: beside.names, lit: point ?? over ?? pin, onPoint: setPoint, onPress: pressOrb, slots: beside.slots, archived: inNucleus.length, onNucleus: () => setNucleusOpen((o) => !o) }} />
              {nucleusOpen ? <NucleusList chats={inNucleus} now={now} onClose={() => setNucleusOpen(false)} onPutBack={(x) => void archive(x, false)} /> : null}
            </div>
            <Terminal coord={current?.coord ?? null} question={openQ} qLabel={opened?.kind === "question" ? opened.label : ""} priv={priv} now={now} onAnswered={() => { setOpened(null); setTimeout(() => void readLanes(), 300); }} />
          </div>
        ) : null}
        {slideAt !== null && slides.length ? (
          <Slides slides={slides} at={Math.min(slideAt, slides.length - 1)} base={base} onStep={(by) => setSlideAt((a) => stepSlide(Math.min(a ?? 0, slides.length - 1), by, slides.length))} onBack={() => setSlideAt(null)} onChoose={choose} />
        ) : null}
      </div>
      {undo ? (
        <div data-manager-undo={undo.id} role="status" className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2" style={{ background: "rgba(10,6,20,.94)", border: "1px solid rgba(255,255,255,.3)", fontSize: 12.5, maxWidth: "80%" }}>
          <span>Archived <b>{undo.name}</b>. Nothing is deleted.{undo.says ? ` ${undo.says}` : ""}</span>
          <button type="button" data-manager-undo-press="" className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 font-black" style={{ color: "#04121c", background: "#fff" }} onClick={() => { const x = read?.coordinators.flatMap((c) => c.chats).find((c) => c.id === undo.id); if (x) void archive(x, false); }}><Undo2 className="size-3.5" />Undo</button>
        </div>
      ) : null}
      {said ? <div data-manager-said="" role="status" className="absolute bottom-4 right-4 z-40 rounded-xl px-4 py-2" style={{ background: "rgba(10,6,20,.94)", border: "1px solid rgba(255,140,140,.5)", fontSize: 12.5, maxWidth: "50%" }}>{said}</div> : null}
    </section>
  );
}

/** The head's cost: the same run as a pane's, with its shares under it on hover ("… of this column"). */
function HeadCost({ cost, heaviest, now, priv }: { cost: OwnerCost; heaviest: number; now: number; priv: boolean }) {
  const [shares, setShares] = React.useState<CostKind | "all" | null>(null);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Cost cost={cost} heaviest={heaviest} now={now} priv={priv} onShares={setShares} />
      {shares ? <Shares cost={cost} show={shares} of="this column" priv={priv} /> : null}
    </span>
  );
}

export type { ChatState };

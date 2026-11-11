"use client";
/**
 * THE DECISIONS PANEL (J, 2026-11-03): the coordinator's questions, above the
 * rings in the Agents dock, answered by a press beside what they are about.
 * Open ones first, each option with its picture (an image, or an html design
 * shown live in a sandboxed frame), the writer's pick marked, and an "Or
 * type" field. Answered ones fold to a line with "change".
 *
 * A press goes to the helper's one write route, `POST /lanes/answer {id,
 * answer}`, which sets that question's `answer` and `answeredAt` in
 * handovers/lanes.json; the coordinator reads the file each turn. Nothing
 * here is modal: Esc and a click away do nothing. With the helper down the
 * questions still show (the last feed read) and a press says why it wasn't
 * sent.
 *
 * Round 2 (J, 2026-11-03): a Details button on each question opens a strip
 * under it: the chat it belongs to and what it is doing, its latest change
 * with "Earlier" going back step by step to the chat's start, a picture of
 * the area being worked on, and "New options, because:", which goes to the
 * helper's `POST /lanes/ask {id, ask}` for the coordinator to answer with
 * new options.
 */
import * as React from "react";
import { Info } from "lucide-react";
import { HELPER_ORIGIN } from "./context";
import { setDockTab, useAgents } from "./store";
import { STATE_COLOUR, STATE_WORD, ageOf, agoOf, carriedWords, isOpen, pictureKind, pictureUrl, whenOf, type Decision, type DecisionOption, type LaneChat } from "./lanes";

export const ANSWER_URL = `${HELPER_ORIGIN}/lanes/answer`;
export const ASK_URL = `${HELPER_ORIGIN}/lanes/ask`;
/** The first-level blue (the Steer pill's). */
const BLUE = "oklch(0.85 0.17 205)";
/** The one Builder the helper takes answers from (its BUILDER_ORIGIN). */
const LIVE_BUILDER = "https://polio-two.vercel.app";
const SEND_WAIT_MS = 4000;
/** An html design is drawn at this size and shrunk to the card. */
const PAGE_W = 1200, PAGE_H = 800;
const SAY = {
  down: "Not sent: the helper isn't running. Start it from the Helper tab, then press again.",
  notLive: "Not sent: the helper isn't answering this Builder. It takes answers from the live Builder only, while it runs.",
  offline: "The helper isn't running, so a press can't be sent until it runs. These are the questions as last read.",
};

type Reply = { ok: true; at: string } | { ok: false; says: string };

/** An answer (`{id, answer}` to ANSWER_URL) or an ask for new options (`{id, ask}` to ASK_URL); the helper says when it wrote it. */
async function send(url: string, body: Record<string, string>, atKey: "answeredAt" | "askedAt"): Promise<Reply> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), SEND_WAIT_MS);
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: stop.signal });
    const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Record<string, unknown>) | null;
    if (r.ok && j?.ok) return { ok: true, at: typeof j[atKey] === "string" ? (j[atKey] as string) : new Date().toISOString() };
    return { ok: false, says: `Not sent: ${j?.error ?? `the helper answered ${r.status}`}.` };
  } catch {
    /* Refused, not running, or (off the live Builder) not let in: the browser can't tell these apart. */
    return { ok: false, says: window.location.origin === LIVE_BUILDER ? SAY.down : SAY.notLive };
  } finally { clearTimeout(timer); }
}

const mono = "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";

export function Decisions({ questions, chatsOf, base, readAt, now, onFocus, onAnswered, lit = null }: {
  questions: Decision[];
  /** The chats a question is about, for its name and colour and the orb that pulses. */
  chatsOf: (about: string) => LaneChat[];
  /** Where pictures are read: the same door as the feed. */
  base: string;
  /** When the feed was last read, in ms. */
  readAt: number;
  now: number;
  onFocus: (ids: string[]) => void;
  onAnswered: (d: Decision) => void;
  /** A press on an asking orb: this question, brought into view and lit (Orbs 2, piece B). */
  lit?: { id: string; at: number } | null;
}) {
  const reach = useAgents((s) => s.reach);
  /* What J pressed, shown at once and kept until the file says the same. */
  const [sent, setSent] = React.useState<Record<string, { answer: string; at: string }>>({});
  const [said, setSaid] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [changing, setChanging] = React.useState<Set<string>>(new Set());
  /* Round 2: which strips are open and how far back each timeline goes, kept while the panel is open. */
  const [details, setDetails] = React.useState<Set<string>>(new Set());
  const [steps, setSteps] = React.useState<Record<string, number>>({});
  /* An ask J sent, shown until the feed carries it (and gone once the coordinator clears it). */
  const [asked, setAsked] = React.useState<Record<string, string>>({});
  const [askSaid, setAskSaid] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    setAsked((x) => {
      const keep = Object.fromEntries(Object.entries(x).filter(([id]) => !questions.find((d) => d.id === id)?.ask));
      return Object.keys(keep).length === Object.keys(x).length ? x : keep;
    });
  }, [questions]);
  if (!questions.length) return null;

  const answerOf = (d: Decision) => {
    const s = sent[d.id];
    return s && !(d.answeredAt && d.answeredAt >= s.at) ? { answer: s.answer, at: s.at } : { answer: d.answer, at: d.answeredAt };
  };
  const press = async (d: Decision, answer: string) => {
    if (busy) return;
    setBusy(d.id);
    setSaid((x) => ({ ...x, [d.id]: "" }));
    const r = await send(ANSWER_URL, { id: d.id, answer }, "answeredAt");
    setBusy(null);
    if (!r.ok) { setSaid((x) => ({ ...x, [d.id]: r.says })); return; }
    setSent((x) => ({ ...x, [d.id]: { answer: answer.trim(), at: r.at } }));
    setChanging((x) => { const n = new Set(x); n.delete(d.id); return n; });
    onAnswered(d);
  };
  const ask = async (d: Decision, words: string) => {
    if (busy) return false;
    setBusy(d.id);
    setAskSaid((x) => ({ ...x, [d.id]: "" }));
    const r = await send(ASK_URL, { id: d.id, ask: words }, "askedAt");
    setBusy(null);
    if (!r.ok) { setAskSaid((x) => ({ ...x, [d.id]: r.says })); return false; }
    setAsked((x) => ({ ...x, [d.id]: words.trim() }));
    return true;
  };
  /* Each question is one line until opened (piece F); what is open is kept for this browser. A question opened from an orb, a moon or the pie opens here. */
  const [expanded, setExpanded] = React.useState<Set<string>>(() => readOpen());
  React.useEffect(() => { if (lit) setExpanded((x) => (x.has(lit.id) ? x : keepOpen(new Set(x).add(lit.id)))); }, [lit]);
  const flip = (id: string) => setExpanded((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return keepOpen(n); });
  const toggle = (id: string) => setDetails((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rows = questions.map((d) => ({ d, a: answerOf(d) }));
  const open = rows.filter((x) => !x.a.answer.trim() || changing.has(x.d.id));
  const done = rows.filter((x) => x.a.answer.trim() && !changing.has(x.d.id));
  const stale = now - readAt > 20_000 ? agoOf(readAt, now) : "";

  return (
    <section data-decisions="" aria-label="Decisions" className="flex flex-col gap-2.5 px-3 pt-3" style={{ fontFamily: mono }}>
      <h2 className="m-0 flex items-baseline justify-between text-[13px] font-bold" style={{ color: open.length ? STATE_COLOUR.need : STATE_COLOUR.done }}>
        <span data-decisions-count={open.length}>{open.length ? `${open.length} ${open.length === 1 ? "decision waits" : "decisions wait"} on you` : "Nothing waits on you"}</span>
        {stale ? <span className="text-[11px] font-normal" style={{ color: "#9fb8c8" }}>as read {stale}</span> : null}
      </h2>
      {reach === "down" ? (
        <p data-decisions-offline="" className="m-0 rounded-xl px-3 py-2 text-[12px] leading-snug" style={{ background: "rgba(255,77,77,.12)", color: "#ffd6d6" }}>
          {SAY.offline} <button type="button" className="underline" onClick={() => setDockTab("helper")}>Helper tab</button>
        </p>
      ) : null}
      {open.map(({ d, a }) => (
        <Question key={d.id} d={d} answer={a.answer} chats={chatsOf(d.about)} base={base} busy={busy === d.id} said={said[d.id] ?? ""} onPress={(x) => void press(d, x)} onFocus={onFocus}
          open={details.has(d.id)} onToggle={() => toggle(d.id)} shown={steps[d.id] ?? 1} onShown={(n) => setSteps((x) => ({ ...x, [d.id]: n }))}
          asked={d.ask || asked[d.id] || ""} askSaid={askSaid[d.id] ?? ""} onAsk={(w) => ask(d, w)} now={now} lit={lit?.id === d.id ? lit.at : 0}
          expanded={expanded.has(d.id)} onExpand={() => flip(d.id)} />
      ))}
      {done.map(({ d, a }) => {
        const o = d.options.find((x) => x.key === a.answer);
        return (
          <div key={d.id} data-decision={d.id} data-answered={a.answer} className="flex items-baseline gap-2 rounded-xl px-3 py-2 text-[12px]" style={{ background: "rgba(61,255,174,.07)", color: "#d8d0ee" }}
            onMouseEnter={() => onFocus(chatsOf(d.about).map((x) => x.id))} onMouseLeave={() => onFocus([])}>
            <span style={{ color: STATE_COLOUR.done }}>✓</span>
            <span className="min-w-0 flex-1">{d.question} <b style={{ color: "#fff" }}>{o ? `${o.key.toUpperCase()} · ${o.label}` : `“${a.answer}”`}</b>{a.at ? <span style={{ color: "#9fb8c8" }}> · {agoOf(a.at, now)}</span> : null}</span>
            <button type="button" data-decision-change={d.id} className="shrink-0 underline" style={{ color: "#9fd8ff" }} onClick={() => setChanging((x) => new Set(x).add(d.id))}>change</button>
          </div>
        );
      })}
    </section>
  );
}

const OPEN_KEY = "polio.decisions.open";
function readOpen(): Set<string> { try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]"); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); } }
function keepOpen(s: Set<string>): Set<string> { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...s])); } catch { /* not kept */ } return s; }

function Question({ d, answer, chats, base, busy, said, onPress, onFocus, open, onToggle, shown, onShown, asked, askSaid, onAsk, now, lit, expanded, onExpand }: {
  d: Decision; answer: string; chats: LaneChat[]; base: string; busy: boolean; said: string;
  onPress: (answer: string) => void; onFocus: (ids: string[]) => void;
  open: boolean; onToggle: () => void; shown: number; onShown: (n: number) => void;
  asked: string; askSaid: string; onAsk: (words: string) => Promise<boolean>; now: number;
  /** When an orb's press asked for this question (0: not lit). */
  lit: number;
  /** Open whole, or folded to one line. */
  expanded: boolean; onExpand: () => void;
}) {
  const [text, setText] = React.useState("");
  const me = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!lit || !expanded) return;
    me.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    me.current?.querySelector<HTMLButtonElement>("button[data-decision-press]")?.focus({ preventScroll: true });
  }, [lit, expanded]);
  const pictured = d.options.some((o) => o.picture);
  const who = chats[0];
  const colour = who ? STATE_COLOUR[who.state] : "#9fb8c8";
  return (
    <article
      ref={me}
      data-decision={d.id}
      data-about={d.about}
      data-decision-lit={lit ? "" : undefined}
      className="scroll-mt-2 rounded-2xl p-3"
      style={{ border: `2px solid ${colour}`, background: "oklch(0.15 0.05 300 / 0.92)", color: "#f2ecff", opacity: busy ? 0.7 : 1, boxShadow: lit ? `0 0 0 3px #fff, 0 0 24px ${colour}` : "none" }}
      onMouseEnter={() => onFocus(chats.map((x) => x.id))}
      onMouseLeave={() => onFocus([])}
    >
      {/* The one line it folds to: who, the question, how long it has waited. */}
      <button type="button" data-decision-head={d.id} aria-expanded={expanded} onClick={onExpand} className="flex w-full items-baseline gap-1.5 text-left">
        <span aria-hidden style={{ color: colour }}>{expanded ? "▾" : "▸"}</span>
        <span className="shrink-0 text-[11px] font-bold" style={{ color: colour }}>{who?.name ?? (d.about || "a chat")}</span>
        {expanded ? <span className="min-w-0 flex-1" /> : <span className="min-w-0 flex-1 truncate text-[12px] text-white">{d.question}</span>}
        {d.asked ? <span data-decision-age="" className="ml-auto shrink-0 text-[11px]" style={{ color: "#9fb8c8" }}>{ageOf(d.asked, now)}</span> : null}
      </button>
      {expanded ? <>
      <div className="mt-0.5 flex items-start gap-2">
        <h3 className="m-0 min-w-0 flex-1 text-[14px] font-bold leading-snug text-white">{d.question}</h3>
        <button type="button" data-decision-details={d.id} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details: ${d.question}`} title={open ? "Hide details" : "Details: the chat, its timeline, the area, new options"} onClick={onToggle}
          className="grid size-6 shrink-0 place-items-center rounded-full" style={{ color: "#021018", background: BLUE, boxShadow: open ? "0 0 0 2px #fff" : "none" }}>
          <Info className="size-3.5" />
        </button>
      </div>
      {asked ? <p data-decision-asked={d.id} className="m-0 mt-1 text-[12px] font-bold" style={{ color: BLUE }}>Asked for new options: <span className="font-normal" style={{ color: "#d8d0ee" }}>{asked}</span></p> : null}
      {/* What, Why, How (piece F), who asked and when, and where it went. */}
      <dl data-decision-whole={d.id} className="m-0 mt-1 grid grid-cols-[3.2em_1fr] gap-x-2 gap-y-0.5 text-[12px] leading-snug" style={{ color: "#d8d0ee" }}>
        {d.what ? <><dt className="font-bold text-white">What</dt><dd data-decision-what="" className="m-0">{d.what}</dd></> : null}
        {d.why ? <><dt className="font-bold text-white">Why</dt><dd className="m-0">{d.why}</dd></> : null}
        {d.how ? <><dt className="font-bold text-white">How</dt><dd data-decision-how="" className="m-0">{d.how}</dd></> : null}
      </dl>
      <p data-decision-asked-by={d.id} className="m-0 mt-1 text-[11px]" style={{ color: "#9fb8c8" }}>
        {carriedWords(d, who?.name ?? "") || `asked by ${who?.name ?? (d.about || "a chat")}`}{d.asked ? ` · ${whenOf(d.asked)} (${ageOf(d.asked, now)} ago)` : ""}{d.carried ? ` · moved ${ageOf(d.carried, now)} ago` : ""}
      </p>
      {d.context ? <details data-decision-context="" className="mt-1 text-[12px] leading-snug" style={{ color: "#d8d0ee" }}><summary className="cursor-pointer" style={{ color: BLUE }}>Background</summary><p className="m-0 mt-1 whitespace-pre-wrap">{d.context}</p></details> : null}
      {open ? <Details d={d} chat={who ?? null} base={base} busy={busy} shown={shown} onShown={onShown} askSaid={askSaid} onAsk={onAsk} now={now} /> : null}
      <div className={pictured ? "mt-2.5 grid grid-cols-2 gap-2" : "mt-2.5 flex flex-wrap gap-1.5"}>
        {d.options.map((o) => <Option key={o.key} o={o} base={base} picked={answer === o.key} busy={busy} pictured={pictured} onPress={() => onPress(o.key)} />)}
      </div>
      <form className="mt-2.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onPress(text); setText(""); } }}>
        <input
          data-decision-type={d.id}
          aria-label={`Or type an answer to: ${d.question}`}
          placeholder="Or type"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[12px]"
          style={{ border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: `12px ${mono}` }}
        />
        <button type="submit" data-decision-send={d.id} disabled={busy || !text.trim()} className="rounded-full px-3 text-[12px] font-bold" style={{ color: "#021018", background: "oklch(0.85 0.17 205)", opacity: busy || !text.trim() ? 0.5 : 1 }}>Send</button>
      </form>
      {said ? <p data-decision-said={d.id} role="status" className="m-0 mt-2 text-[12px] leading-snug" style={{ color: "#ffb4b4" }}>{said}</p> : null}
      </> : null}
    </article>
  );
}

/**
 * Under a question: the chat it belongs to, its latest shared change ("Earlier"
 * going back one step a press, "Collapse" folding to the latest; the helper
 * sends only the lines the coordinator marked public, so with none it says
 * "No shared timeline yet"), the area picture when there is one, and "New
 * options, because:".
 */
function Details({ d, chat, base, busy, shown, onShown, askSaid, onAsk, now }: {
  d: Decision; chat: LaneChat | null; base: string; busy: boolean; shown: number; onShown: (n: number) => void;
  askSaid: string; onAsk: (words: string) => Promise<boolean>; now: number;
}) {
  const [text, setText] = React.useState("");
  const newest = chat ? [...chat.history].reverse() : [];
  const n = Math.max(1, Math.min(shown, newest.length));
  const kind = pictureKind(d.area);
  const src = kind ? pictureUrl(base, d.area) : "";
  const seen = chat ? agoOf(chat.lastSeen || chat.sentAt, now) : "";
  return (
    <div data-decision-strip={d.id} className="mt-2 flex flex-col gap-2 rounded-xl p-2.5 text-[12px] leading-snug" style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)" }}>
      <div data-decision-chat={chat?.id ?? ""} className="flex items-baseline gap-1.5">
        {chat ? <>
          <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATE_COLOUR[chat.state] }} />
          <b className="text-white">{chat.name}</b>
          <span style={{ color: STATE_COLOUR[chat.state] }}>{STATE_WORD[chat.state]}</span>
          {seen ? <span className="ml-auto shrink-0" style={{ color: "#9fb8c8" }}>{seen}</span> : null}
        </> : <span style={{ color: "#9fb8c8" }}>No chat on the board goes by “{d.about}”.</span>}
      </div>
      {newest.length ? (
        <div>
          <ol data-decision-timeline={d.id} className="m-0 flex list-none flex-col gap-1.5 p-0">
            {newest.slice(0, n).map((h, i) => (
              <li key={i} data-decision-step={newest.length - 1 - i} className="flex gap-2">
                <span className="shrink-0 tabular-nums" style={{ color: "#9fb8c8" }}>{whenOf(h.at)}</span>
                <span style={{ color: i ? "#c8c0de" : "#f2ecff" }}>{h.text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-1 flex gap-3">
            {n < newest.length ? <button type="button" data-decision-earlier={d.id} className="underline" style={{ color: BLUE }} onClick={() => onShown(n + 1)}>Earlier</button> : null}
            {n > 1 ? <button type="button" data-decision-collapse={d.id} className="underline" style={{ color: BLUE }} onClick={() => onShown(1)}>Collapse</button> : null}
            {n === newest.length && newest.length > 1 ? <span style={{ color: "#9fb8c8" }}>the chat&apos;s start</span> : null}
          </div>
        </div>
      ) : chat ? <div data-decision-timeline-empty={d.id} style={{ color: "#9fb8c8" }}>No shared timeline yet</div> : null}
      {kind ? (
        <figure data-decision-area={d.id} className="m-0 flex flex-col gap-1">
          {kind === "image" ? (
            <img data-decision-area-picture="" src={src} alt={`The area ${chat?.name ?? d.about} works on`} loading="lazy" draggable={false} className="block w-full rounded-lg" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, objectFit: "contain", background: "#000" }} />
          ) : <PageFrame src={src} title={`The area ${chat?.name ?? d.about} works on, live`} k="area" />}
          <figcaption style={{ color: "#9fb8c8" }}>Where {chat?.name ?? d.about} is working</figcaption>
        </figure>
      ) : null}
      <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); const w = text.trim(); if (w) void onAsk(w).then((ok) => { if (ok) setText(""); }); }}>
        <label htmlFor={`ask-${d.id}`} className="font-bold" style={{ color: "#f2ecff" }}>New options, because:</label>
        <div className="flex gap-1.5">
          <input id={`ask-${d.id}`} data-decision-ask={d.id} value={text} onChange={(e) => setText(e.target.value)} placeholder="what should change"
            className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: `12px ${mono}` }} />
          <button type="submit" data-decision-ask-send={d.id} disabled={busy || !text.trim()} className="rounded-full px-3 font-bold" style={{ color: "#021018", background: BLUE, opacity: busy || !text.trim() ? 0.5 : 1 }}>Send</button>
        </div>
        {askSaid ? <p data-decision-ask-said={d.id} role="status" className="m-0" style={{ color: "#ffb4b4" }}>{askSaid}</p> : null}
      </form>
    </div>
  );
}

function Option({ o, base, picked, busy, pictured, onPress }: { o: DecisionOption; base: string; picked: boolean; busy: boolean; pictured: boolean; onPress: () => void }) {
  const kind = pictureKind(o.picture);
  const src = kind ? pictureUrl(base, o.picture) : "";
  const ring = picked ? `2px solid ${STATE_COLOUR.done}` : "1px solid rgba(255,255,255,.18)";
  const label = (
    <>
      <b>{o.key.toUpperCase()}</b> {o.label}
      {o.pick ? <span data-decision-pick="" className="ml-1 rounded-full px-1.5 text-[10px] font-bold" style={{ color: "#021018", background: STATE_COLOUR.done }}>pick</span> : null}
    </>
  );
  if (!pictured) {
    return (
      <button type="button" data-decision-option={o.key} data-decision-press={o.key} aria-pressed={picked} disabled={busy} title={o.desc || undefined} onClick={onPress}
        className={o.desc ? "flex min-h-[34px] w-full flex-col items-start rounded-xl px-3 py-1.5 text-left text-[12px]" : "min-h-[34px] rounded-full px-3 text-[12px]"} style={{ border: ring, background: picked ? "rgba(61,255,174,.15)" : "rgba(255,255,255,.06)", color: "#fff" }}>
        <span>{label}</span>
        {/* What it gives (piece F): enough to answer without the chat. */}
        {o.desc ? <span data-decision-gives="" className="text-[11px] leading-snug" style={{ color: "#c9bfe6" }}>{o.desc}</span> : null}
      </button>
    );
  }
  return (
    <div data-decision-option={o.key} className="flex min-w-0 flex-col gap-1 rounded-xl p-1.5" style={{ border: ring, background: picked ? "rgba(61,255,174,.1)" : "rgba(255,255,255,.04)" }}>
      {kind === "image" ? (
        <button type="button" aria-label={`Pick ${o.label}`} disabled={busy} onClick={onPress} className="block w-full overflow-hidden rounded-lg p-0" style={{ background: "#000" }}>
          <img data-decision-picture={o.key} src={src} alt={`${o.label}, as drawn`} loading="lazy" draggable={false} style={{ display: "block", width: "100%", aspectRatio: `${PAGE_W} / ${PAGE_H}`, objectFit: "contain" }} />
        </button>
      ) : kind === "page" ? <PageFrame src={src} title={`${o.label}, live`} k={o.key} /> : (
        <div className="grid place-items-center rounded-lg text-[11px]" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, background: "rgba(0,0,0,.4)", color: "#9fb8c8" }}>no picture</div>
      )}
      <button type="button" data-decision-press={o.key} aria-pressed={picked} disabled={busy} onClick={onPress} className="rounded-lg px-1.5 py-1 text-left text-[12px] text-white hover:bg-white/10">
        {label}
      </button>
      {o.desc ? <p className="m-0 px-1.5 text-[11px] leading-snug" style={{ color: "#c8c0de" }}>{o.desc}</p> : null}
      {src ? <a href={src} target="_blank" rel="noopener noreferrer" className="px-1.5 text-[11px] underline" style={{ color: "#9fd8ff" }}>open bigger</a> : null}
    </div>
  );
}

/** An html design, live, at a fixed size shrunk to the card. Sandboxed: its scripts run, but reach nothing of this page. */
export function PageFrame({ src, title, k }: { src: string; title: string; k: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, background: "#000" }}>
      {w ? (
        <iframe
          data-decision-picture={k}
          title={title}
          src={src}
          sandbox="allow-scripts"
          allow="local-network-access"
          referrerPolicy="no-referrer"
          loading="lazy"
          tabIndex={-1}
          style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, height: PAGE_H, border: 0, transform: `scale(${w / PAGE_W})`, transformOrigin: "0 0" }}
        />
      ) : null}
    </div>
  );
}

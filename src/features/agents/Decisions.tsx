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
 */
import * as React from "react";
import { HELPER_ORIGIN } from "./context";
import { setDockTab, useAgents } from "./store";
import { STATE_COLOUR, agoOf, isOpen, pictureKind, pictureUrl, type Decision, type DecisionOption, type LaneChat } from "./lanes";

export const ANSWER_URL = `${HELPER_ORIGIN}/lanes/answer`;
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

type Reply = { ok: true; answeredAt: string } | { ok: false; says: string };

async function sendAnswer(id: string, answer: string): Promise<Reply> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), SEND_WAIT_MS);
  try {
    const r = await fetch(ANSWER_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, answer }), cache: "no-store", signal: stop.signal });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; answeredAt?: string; error?: string } | null;
    if (r.ok && j?.ok) return { ok: true, answeredAt: j.answeredAt ?? new Date().toISOString() };
    return { ok: false, says: `Not sent: ${j?.error ?? `the helper answered ${r.status}`}.` };
  } catch {
    /* Refused, not running, or (off the live Builder) not let in: the browser can't tell these apart. */
    return { ok: false, says: window.location.origin === LIVE_BUILDER ? SAY.down : SAY.notLive };
  } finally { clearTimeout(timer); }
}

const mono = "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";

export function Decisions({ questions, chatsOf, base, readAt, now, onFocus, onAnswered }: {
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
}) {
  const reach = useAgents((s) => s.reach);
  /* What J pressed, shown at once and kept until the file says the same. */
  const [sent, setSent] = React.useState<Record<string, { answer: string; at: string }>>({});
  const [said, setSaid] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [changing, setChanging] = React.useState<Set<string>>(new Set());
  if (!questions.length) return null;

  const answerOf = (d: Decision) => {
    const s = sent[d.id];
    return s && !(d.answeredAt && d.answeredAt >= s.at) ? { answer: s.answer, at: s.at } : { answer: d.answer, at: d.answeredAt };
  };
  const press = async (d: Decision, answer: string) => {
    if (busy) return;
    setBusy(d.id);
    setSaid((x) => ({ ...x, [d.id]: "" }));
    const r = await sendAnswer(d.id, answer);
    setBusy(null);
    if (!r.ok) { setSaid((x) => ({ ...x, [d.id]: r.says })); return; }
    setSent((x) => ({ ...x, [d.id]: { answer: answer.trim(), at: r.answeredAt } }));
    setChanging((x) => { const n = new Set(x); n.delete(d.id); return n; });
    onAnswered(d);
  };
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
        <Question key={d.id} d={d} answer={a.answer} chats={chatsOf(d.about)} base={base} busy={busy === d.id} said={said[d.id] ?? ""} onPress={(x) => void press(d, x)} onFocus={onFocus} />
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

function Question({ d, answer, chats, base, busy, said, onPress, onFocus }: {
  d: Decision; answer: string; chats: LaneChat[]; base: string; busy: boolean; said: string;
  onPress: (answer: string) => void; onFocus: (ids: string[]) => void;
}) {
  const [text, setText] = React.useState("");
  const pictured = d.options.some((o) => o.picture);
  const who = chats[0];
  const colour = who ? STATE_COLOUR[who.state] : "#9fb8c8";
  return (
    <article
      data-decision={d.id}
      data-about={d.about}
      className="rounded-2xl p-3"
      style={{ border: `2px solid ${colour}`, background: "oklch(0.15 0.05 300 / 0.92)", color: "#f2ecff", opacity: busy ? 0.7 : 1 }}
      onMouseEnter={() => onFocus(chats.map((x) => x.id))}
      onMouseLeave={() => onFocus([])}
    >
      {who || d.about ? <div className="text-[11px] font-bold" style={{ color: colour }}>{who?.name ?? d.about}</div> : null}
      <h3 className="m-0 mt-0.5 text-[14px] font-bold leading-snug text-white">{d.question}</h3>
      {d.why ? <p className="m-0 mt-1 text-[12px] leading-snug" style={{ color: "#d8d0ee" }}>{d.why}</p> : null}
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
    </article>
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
        className="min-h-[34px] rounded-full px-3 text-[12px]" style={{ border: ring, background: picked ? "rgba(61,255,174,.15)" : "rgba(255,255,255,.06)", color: "#fff" }}>
        {label}
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
function PageFrame({ src, title, k }: { src: string; title: string; k: string }) {
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

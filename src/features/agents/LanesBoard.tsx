"use client";
/**
 * THE LANES BOARD (J, 2026-11-01/03): every chat working for J, in the Agents
 * dock's first tab. One ring per coordinator, one orb per chat, and no nucleus:
 * the finished chats are the middle (round B; J picked B1). `lanes.ts` says what
 * the feed means and where things sit; this keeps the moving state and draws
 * one frame at a time.
 *
 * Everything on the board is one flat, keyed list sorted by depth: every short
 * piece of every ring and every orb. So rings pass in front of and behind each
 * other and the orbs, and an orb crossing behind a ring is a move in the list,
 * not a new element that drops its hover. Soft light is gradients and stacked
 * strokes, never a blur filter: a filter on something that moves repaints every
 * frame on the CPU.
 */
import * as React from "react";
import { HELPER_ORIGIN } from "./context";
import { setDockTab } from "./store";
import {
  ANSWER_S, POLL_MS, ROUNDS, STATE_COLOUR, STATE_RGB, STATE_WORD, TUMBLE_S, VIEW, axisOf, centreAt, chatLink, doneOf, doneShare, driftShare, fanAngle, hashOf, lapAngle, lapPos, markOf, mixRgb, orbTarget,
  radiusOf, readFeed, restWobble, rgbText, ringLine, ringPoint, ringSegments, ringState, ringTarget, startTilt, thinkingShare, tumbleAt, tumbleSpeed, withBeats,
  type LaneBeat, type LaneChat, type LanesFeed, type Rgb, type Round, type Seen,
} from "./lanes";

/** J may drop the chat box's field and Send; the rest of the box stays. */
const CHAT_BOX_SEND = true;
const ORB_R = 24;
const FEED_WAIT_MS = 2500;
const HOW_CONTROLS = "Steer, Pause and Stop go through the chat: the desktop app takes them there. Only the helper's own agents have them here, in the Helper tab.";

type Feed = { feed: LanesFeed | null; reached: boolean };

async function ask(url: string): Promise<{ feed: unknown; beats?: LaneBeat[]; now?: number } | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), FEED_WAIT_MS);
  try {
    const r = await fetch(url, { cache: "no-store", signal: stop.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Every 5s while the board shows: the Builder's own route on this PC, else the helper. A failed read keeps the last good feed. */
function useLanesFeed(): Feed {
  const [state, setState] = React.useState<Feed>({ feed: null, reached: false });
  React.useEffect(() => {
    let live = true, viaHelper = false;
    const read = async () => {
      let got = viaHelper ? null : await ask("/api/lanes");
      if (!got?.feed) { const h = await ask(`${HELPER_ORIGIN}/lanes`); if (h) { got = h; viaHelper = true; } }
      if (!live) return;
      const feed = readFeed(got?.feed);
      if (feed) setState({ feed: withBeats(feed, got?.beats ?? [], got?.now ?? Date.now()), reached: true });
      else setState((s) => (s.feed ? s : { feed: null, reached: !!got }));
    };
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, []);
  return state;
}

/* The moving state, kept by chat and by ring across polls. */
type Lap = { share: number; dock: number; state: LaneChat["state"]; sentAt: number | null; sent: number | null; answered: number | null; from: number };
type Ring = { tilt: number; r: number };
type Sim = { t: number; last: number; drawn: number; rings: Map<string, Ring>; laps: Map<string, Lap>; cols: Map<string, Rgb>; still: boolean };

/** One lap per message: out at 5% when it is sent, round to the back while the chat thinks, home when it answers, all one ease. */
function stepLap(sim: Sim, x: LaneChat, dt: number): Lap {
  let L = sim.laps.get(x.id);
  if (!L) {
    /* First seen: a chat already thinking is somewhere on its way round; the rest are home. */
    const tau = 4 + (hashOf(x.id) % 40) / 10;
    L = { share: x.state === "work" ? thinkingShare(tau) : 1, dock: x.state === "done" ? 1 : 0, state: x.state, sentAt: x.sentAt, sent: x.state === "work" ? sim.t - tau : null, answered: null, from: 0 };
    sim.laps.set(x.id, L);
  }
  const startsThinking = x.state === "work" && L.state !== "work";
  const newMessage = x.sentAt !== null && x.sentAt !== L.sentAt;
  if (startsThinking || newMessage) { L.sent = sim.t; L.answered = null; L.share = 0; L.dock = 0; }
  else if (x.state !== "work" && L.state === "work" && L.sent !== null) { L.answered = sim.t; L.from = L.share; }
  L.state = x.state; L.sentAt = x.sentAt;
  if (L.sent !== null) {
    if (L.answered === null) L.share = Math.max(L.share, thinkingShare(sim.t - L.sent));
    else {
      const u = Math.min(1, (sim.t - L.answered) / ANSWER_S);
      L.share = L.from + (1 - L.from) * u * u * (3 - 2 * u);
      if (u >= 1) { L.share = 1; L.sent = null; L.answered = null; }
    }
  }
  const home = x.state === "done" && L.share >= 1 ? 1 : 0;
  L.dock += (home - L.dock) * (1 - Math.exp(-dt * 2.5));
  if (Math.abs(home - L.dock) < 0.001) L.dock = home;
  if (sim.still) { L.share = x.state === "work" ? 0.5 : 1; L.dock = x.state === "done" ? 1 : 0; }
  return L;
}

/** A colour that drifts towards where it is heading, never snapping. */
function drift(sim: Sim, key: string, target: Rgb, dt: number): Rgb {
  const was = sim.cols.get(key);
  const now = !was || sim.still ? target : mixRgb(was, target, driftShare(dt));
  sim.cols.set(key, now);
  return now;
}

type Item = { key: string; z: number; el: React.ReactNode };
const HALO = Object.keys(STATE_RGB) as (keyof typeof STATE_RGB)[];
const fmt = (n: number) => n.toFixed(1);

export function LanesBoard({ round = ROUNDS.B1 }: { round?: Round }) {
  const { feed, reached } = useLanesFeed();
  const simRef = React.useRef<Sim>({ t: 0, last: 0, drawn: 0, rings: new Map(), laps: new Map(), cols: new Map(), still: false });
  const spinStart = React.useRef(new Map<string, number>());
  const [, draw] = React.useReducer((n: number) => n + 1, 0);
  const [hover, setHover] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState("");
  const boxAt = React.useRef<{ id: string; x: number; y: number } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sim = simRef.current;
    sim.still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (sim.still) { draw(); return; }
    let raf = 0, shown = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      /* Rings tumble slowly and the middle turns, so 30 frames a second is plenty; a click's tumble gets every frame. */
      if (now - shown < (spinStart.current.size > 0 ? 0 : 33)) return;
      shown = now;
      const dt = sim.last ? Math.min(0.1, (now - sim.last) / 1000) : 0;
      sim.last = now; sim.t += dt;
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sim = simRef.current;
  const dt = sim.t - sim.drawn;
  sim.drawn = sim.t;
  const t = sim.t;

  const coords = feed?.coordinators ?? [];
  const pointer = hover ?? picked;
  const scene: Item[] = [], glows: React.ReactNode[] = [], rest: React.ReactNode[] = [];
  const middle: { chat: LaneChat; from: Seen; dock: number }[] = [];
  const speeds = new Map<string, number>();
  let hoverChat: { chat: LaneChat; x: number; y: number } | null = null;

  const orb = (x: LaneChat, p: Seen, share: number) => {
    const eon = pointer === x.id;
    /* -1 far, +1 near: the far side is smaller and dimmer, easing through so nothing pops. */
    const depth = Math.max(-1, Math.min(1, p.z / 40));
    const scale = eon ? 1.3 : 0.91 + 0.09 * depth;
    const colour = rgbText(drift(sim, x.id, orbTarget(x.state, t, x.name.length), dt));
    if (hover === x.id) hoverChat = { chat: x, x: p.x, y: p.y };
    scene.push({
      key: x.id,
      z: p.z,
      el: (
        <g
          key={x.id}
          data-lanes-orb={x.id}
          data-state={x.state}
          data-target={STATE_COLOUR[x.state]}
          data-colour={colour}
          data-z={p.z.toFixed(2)}
          data-scale={scale.toFixed(3)}
          data-share={share.toFixed(3)}
          data-x={p.x.toFixed(1)}
          data-y={p.y.toFixed(1)}
          role="button"
          tabIndex={0}
          aria-label={`${x.name}, ${STATE_WORD[x.state]}`}
          transform={`translate(${fmt(p.x)} ${fmt(p.y)}) scale(${scale.toFixed(3)})`}
          opacity={(0.8 + 0.2 * depth).toFixed(2)}
          style={{ cursor: "pointer", outline: "none" }}
          onMouseEnter={() => setHover(x.id)}
          onFocus={() => setHover(x.id)}
          onClick={() => setPicked(x.id)}
        >
          <circle r={eon ? 50 : 38} fill={`url(#lanes-halo-${x.state})`} />
          <circle r={ORB_R} fill={colour} />
          <circle r={ORB_R} fill="url(#lanes-sphere)" />
          <circle r={ORB_R} fill="none" stroke="#ffffff" strokeOpacity={eon ? 0.9 : 0.45} strokeWidth={2} />
          <text y={6} textAnchor="middle" fill="#061018" style={{ font: "800 15px ui-monospace, Menlo, Consolas, monospace", pointerEvents: "none" }}>{markOf(x.name)}</text>
        </g>
      ),
    });
  };

  coords.forEach((c, i) => {
    const state = ringState(c), key = c.id, done = doneShare(c);
    let ring = sim.rings.get(key);
    if (!ring) { ring = { tilt: sim.still ? 0 : startTilt(i), r: radiusOf(done, i) }; sim.rings.set(key, ring); }
    /* A ring grows outward as its chats finish, eased, never snapping. */
    const wantR = radiusOf(done, i);
    ring.r += (wantR - ring.r) * (sim.still ? 1 : 1 - Math.exp(-dt / 0.6));
    /* It tumbles slowly end over end while its coordinator works; once all is done it settles flat on the nearest whole turn. */
    const speed = sim.still ? 0 : tumbleSpeed(done, i);
    speeds.set(key, speed);
    if (speed > 0.01) ring.tilt += speed * dt;
    else ring.tilt += (Math.round(ring.tilt / 360) * 360 - ring.tilt) * (sim.still ? 1 : driftShare(dt) * 0.75);
    const atRest = speed <= 0.01, wob = atRest && !sim.still ? restWobble(t, i) : { tilt: 0, axis: 0, float: 0 };

    /* A click's tumble: three whole turns, so at its end it is simply over. */
    const from = spinStart.current.get(key);
    let spin = 0;
    if (from !== undefined) {
      const u = (t - from) / TUMBLE_S;
      if (u >= 1) spinStart.current.delete(key); else spin = tumbleAt(u);
    }
    const tilt = ring.tilt + spin + wob.tilt, axis = axisOf(i) + wob.axis, R = ring.r;
    const colour = rgbText(drift(sim, key, ringTarget(state, t, i), dt));
    const on = pointer === key;
    const segs = ringSegments(R, tilt, axis, wob.float);
    const line = ringLine(R, tilt, axis, wob.float);
    glows.push(
      <g key={key} style={{ pointerEvents: "none" }}>
        <path d={line} fill="none" stroke={colour} strokeOpacity={0.1} strokeWidth={on ? 36 : 28} />
        <path d={line} fill="none" stroke={colour} strokeOpacity={0.16} strokeWidth={on ? 22 : 17} />
      </g>,
    );
    /* What the tests and the keyboard read: the ring as a whole. Its pieces are in the scene. */
    rest.push(
      <g
        key={key}
        data-lanes-ring={key}
        data-state={state}
        data-target={STATE_COLOUR[state]}
        data-colour={colour}
        data-r={R.toFixed(1)}
        data-tilt={(((ring.tilt % 360) + 540) % 360 - 180).toFixed(1)}
        data-speed={speed.toFixed(2)}
        data-spin={spin.toFixed(0)}
      />,
    );
    segs.forEach((s, k) => scene.push({
      key: `${key}:${k}`,
      z: s.z,
      el: (
        <g key={`${key}:${k}`} data-ring-seg={key} data-z={s.z.toFixed(2)} onMouseEnter={() => setHover(key)} onClick={() => tumble(key)} style={{ cursor: "pointer" }}>
          <path d={s.d} fill="none" stroke={colour} strokeOpacity={on ? 1 : 0.9} strokeWidth={on ? 14 : 9} strokeLinecap="round" />
          <path d={s.d} fill="none" stroke="transparent" strokeWidth={24} style={{ pointerEvents: "stroke" }} />
        </g>
      ),
    }));

    /* The chats still on the ring gather at the front, fanned out; the done ones go to the middle. */
    const fanned = c.chats.filter((x) => x.state !== "done" && (sim.laps.get(x.id)?.share ?? 1) >= 1);
    for (const x of c.chats) {
      const L = stepLap(sim, x, dt);
      const slot = fanned.indexOf(x);
      const a = L.share >= 1 ? lapAngle(1) + (slot < 0 ? 0 : fanAngle(slot, fanned.length, R)) : lapAngle(lapPos(L.share));
      const p = ringPoint(R, a, tilt, axis, wob.float);
      if (x.state === "done") middle.push({ chat: x, from: p, dock: L.dock });
      else orb(x, p, L.share);
    }
  });

  /* The middle: the finished chats themselves, in their formation, coming in from their rings. */
  middle.forEach(({ chat, from, dock }, k) => {
    const to = centreAt(round, k, middle.length, sim.still ? 0 : t);
    const e = dock * dock * (3 - 2 * dock);
    orb(chat, { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z + (to.z - from.z) * e }, 1);
  });

  scene.sort((a, b) => a.z - b.z);

  function tumble(key: string) {
    setPicked(key);
    if (sim.still) return;
    if (!spinStart.current.has(key)) spinStart.current.set(key, sim.t);
  }

  const decisions = feed?.decisions ?? 0;
  /* The menu: what the pointer is on, else what was picked, else the first coordinator. */
  const chatOf = (id: string | null) => { for (const c of coords) for (const x of c.chats) if (x.id === id) return x; return null; };
  const pick = chatOf(pointer), coord = coords.find((c) => c.id === pointer) ?? (pick ? null : coords[0] ?? null);
  const menu = pick
    ? { name: pick.name, colour: rgbText(sim.cols.get(pick.id) ?? STATE_RGB[pick.state]), state: STATE_WORD[pick.state] + (pick.state === "done" ? " · in the middle" : ""), note: pick.note, target: pick.id, helper: pick.helper }
    : coord
      ? { name: coord.name, colour: rgbText(sim.cols.get(coord.id) ?? STATE_RGB[ringState(coord)]), state: `coordinator · ${doneOf(coord)} of ${coord.chats.length} chats done · ${(speeds.get(coord.id) ?? 0) > 0.01 ? `tumbling, ${(speeds.get(coord.id) ?? 0).toFixed(1)}°/s` : "flat"}`, note: coord.note, target: coord.id, helper: false }
      : { name: "Chats", colour: STATE_COLOUR.park, state: "", note: "", target: null as string | null, helper: false };

  /* The box stays where it opened: an orb on its way mustn't drag the field being typed in. */
  const hc = hoverChat as { chat: LaneChat; x: number; y: number } | null;
  if (!hc) boxAt.current = null;
  else if (boxAt.current?.id !== hc.chat.id) boxAt.current = { id: hc.chat.id, x: hc.x, y: hc.y };
  const bx = boxAt.current ? ((boxAt.current.x - VIEW.x) / VIEW.w) * 100 : 0;
  const by = boxAt.current ? ((boxAt.current.y - VIEW.y + 28) / VIEW.h) * 100 : 0;

  return (
    <div data-lanes-board="" className="absolute inset-0 z-10 flex flex-wrap items-center justify-center gap-4 overflow-auto p-4" style={{ background: "#020104", color: "#fff" }}>
      <LanesMenu {...menu} decisions={decisions} />
      <div
        className="relative min-w-0 flex-[1_1_480px]"
        onMouseLeave={() => { if (!box.current?.contains(document.activeElement)) setHover(null); }}
      >
        {/* The rings by keyboard: one button each, named, the same hover and click. */}
        <div className="sr-only">
          {coords.map((c) => <button key={c.id} type="button" onFocus={() => setHover(c.id)} onClick={() => tumble(c.id)}>{c.name}</button>)}
        </div>
        <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Chats as orbs on their coordinator's ring; finished chats gather in the middle" style={{ display: "block", width: "100%", height: "auto", maxHeight: "calc(100vh - var(--topbar-h) - 72px)" }}>
          <defs>
            <radialGradient id="lanes-sphere" cx="0.33" cy="0.28" r="0.8">
              <stop offset="0" stopColor="#ffffff" /><stop offset="0.18" stopColor="#ffffff" stopOpacity="0.85" /><stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" /><stop offset="0.86" stopColor="#000000" stopOpacity="0.25" /><stop offset="1" stopColor="#000000" stopOpacity="0.6" />
            </radialGradient>
            {HALO.map((s) => (
              <radialGradient key={s} id={`lanes-halo-${s}`}>
                <stop offset="0.55" stopColor={STATE_COLOUR[s]} stopOpacity="0.6" /><stop offset="1" stopColor={STATE_COLOUR[s]} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {glows}
          {scene.map((it) => <React.Fragment key={it.key}>{it.el}</React.Fragment>)}
          {rest}
        </svg>
        {!feed ? (
          <p data-lanes-empty="" className="absolute inset-x-0 top-[62%] mx-auto max-w-sm text-center text-small" style={{ color: "#d8d0ee" }}>
            {reached ? "No chats yet: the helper has no lanes.json on this PC." : "The chats are listed on your PC, and the helper isn't answering. Start it from the Helper tab."}
          </p>
        ) : null}
        {hc && boxAt.current ? <ChatBox ref={box} key={hc.chat.id} chat={hc.chat} left={bx} top={by} said={said} onSaid={setSaid} /> : null}
      </div>
    </div>
  );
}

/** Rounded card, a lit border in the picked thing's colour, scanlines, pills (H3). */
function LanesMenu({ name, colour, state, note, target, helper, decisions }: { name: string; colour: string; state: string; note: string; target: string | null; helper: boolean; decisions: number }) {
  const link = target ? chatLink(target) : null;
  const pill = "inline-flex min-h-[38px] items-center rounded-full border-0 px-3.5 font-bold no-underline";
  const go = (word: string, cls: string, style: React.CSSProperties) => {
    const tell = { "data-lanes-control": word.toLowerCase() };
    /* The helper's own agent is controlled in the helper's own page; a desktop chat, in its chat. */
    if (helper) return <button key={word} {...tell} className={pill + cls} style={style} onClick={() => setDockTab("helper")}>{word}</button>;
    if (link) return <a key={word} {...tell} href={link} className={pill + cls} style={style}>{word}</a>;
    return <button key={word} {...tell} disabled className={pill + cls} style={{ ...style, opacity: 0.45 }}>{word}</button>;
  };
  return (
    <section
      data-lanes-menu={name}
      className="w-[280px] shrink-0 self-center"
      style={{
        boxSizing: "border-box", borderRadius: 28, padding: 22, border: `3px solid ${colour}`, fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
        backgroundColor: "oklch(0.13 0.05 300)", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px), radial-gradient(circle at 85% 0%, oklch(0.42 0.2 320 / 0.6), transparent 60%)",
      }}
    >
      <h2 data-lanes-menu-name="" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>{name}</h2>
      <p style={{ margin: "4px 0 0", color: colour, fontSize: 13, fontWeight: 700 }}>{state}</p>
      <p style={{ margin: "14px 0 16px", fontSize: 13, lineHeight: 1.5, color: "#f2ecff" }}>{note}</p>
      <div className="flex flex-wrap gap-1.5 text-[13px]">
        {go("Steer", "", { color: "#021018", background: "oklch(0.85 0.17 205)" })}
        {go("Pause", "", { color: "#1a1204", background: "oklch(0.87 0.17 85)" })}
        {go("Stop", "", { color: "#fff", background: "oklch(0.55 0.23 27)" })}
        {go("Open chat", " font-normal", { color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,0.6)" })}
      </div>
      <p data-lanes-decisions={decisions} style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, color: decisions ? STATE_COLOUR.need : STATE_COLOUR.done }}>{decisions ? `${decisions} ${decisions === 1 ? "decision waits" : "decisions wait"} on you` : "Nothing waits on you"}</p>
      <p data-lanes-how="" style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: "#9fb8c8" }}>{HOW_CONTROLS}</p>
    </section>
  );
}

/**
 * Hovering a chat. Nothing on this page can reach a desktop chat, so Send is
 * honest about what it does: it copies the words and opens the chat to paste
 * them. The orb's lap starts when the chat really gets them (its heartbeat).
 */
const ChatBox = React.forwardRef<HTMLDivElement, { chat: LaneChat; left: number; top: number; said: string; onSaid: (s: string) => void }>(function ChatBox({ chat, left, top, said, onSaid }, ref) {
  const [text, setText] = React.useState("");
  const colour = STATE_COLOUR[chat.state];
  const link = chatLink(chat.id);
  const send = async () => {
    const words = text.trim();
    if (!words) return;
    if (chat.helper) { setDockTab("helper"); return; }
    let copied = true;
    try { await navigator.clipboard.writeText(words); } catch { copied = false; }
    onSaid(copied ? "Copied. Paste it in the chat that just opened." : "Couldn't copy it: the chat opened, type it there.");
    if (link) window.location.href = link;
    setText("");
  };
  return (
    <div
      ref={ref}
      data-lanes-box={chat.id}
      className="absolute w-[250px]"
      style={{ left: `${Math.max(16, Math.min(84, left))}%`, top: `${Math.min(78, top)}%`, transform: "translate(-50%, 12px)", boxSizing: "border-box", borderRadius: 18, padding: "12px 14px", border: `2px solid ${colour}`, background: "oklch(0.16 0.05 300 / 0.96)", color: "#f2ecff", font: "13px/1.45 ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace", boxShadow: "0 10px 30px rgba(0,0,0,.6)" }}
    >
      <div style={{ fontWeight: 700, color: colour }}>{chat.name} · {STATE_WORD[chat.state]}</div>
      <div style={{ marginTop: 4, color: "#d8d0ee" }}>{chat.note}</div>
      {chat.last ? <div data-lanes-last="" style={{ marginTop: 6, fontSize: 12, color: "#9fb8c8" }}>{chat.last}</div> : null}
      {CHAT_BOX_SEND ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input data-lanes-say="" aria-label={`Say something to ${chat.name}`} placeholder={`Say something to ${chat.name}`} value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "#fff", font: "inherit" }} />
          <button data-lanes-send="" type="submit" style={{ marginTop: 8, font: "inherit", fontWeight: 700, minHeight: 32, padding: "0 12px", color: "#021018", background: "oklch(0.85 0.17 205)", border: 0, borderRadius: 999 }}>Send</button>
          {said ? <div data-lanes-said="" style={{ marginTop: 6, fontSize: 12, color: "#9fb8c8" }}>{said}</div> : null}
        </form>
      ) : null}
    </div>
  );
});

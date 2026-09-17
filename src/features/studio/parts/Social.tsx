"use client";
/**
 * People and their traces. These keep their state for the session only —
 * a posted comment lives until the page reloads. What has to be stored for
 * real is named in the blueprint's backend section instead of faked here.
 */
import * as React from "react";
import { Btn, Fill, useTicker } from "./primitives";
import { hash, rng, sample, unwritten } from "./sample";
import { cardStyle, items, titled, type Theme } from "./theme";
import type { PartProps } from "./types";

function Avatar({ t, who, size = 2.2 }: { t: Theme; who: { name: string; initials: string }; size?: number }) {
  const hue = hash(who.name) % 360;
  return (
    <span
      aria-hidden
      style={{
        width: t.fontPx * size, height: t.fontPx * size, borderRadius: 999, flexShrink: 0,
        background: `linear-gradient(140deg, oklch(0.62 0.13 ${hue}), oklch(0.5 0.13 ${(hue + 60) % 360}))`,
        color: "oklch(0.98 0 0)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: t.fontPx * size * 0.36, fontWeight: 700, letterSpacing: 0.3,
      }}
    >
      {who.initials}
    </span>
  );
}

const inputStyle = (t: Theme): React.CSSProperties => ({
  flex: 1, minWidth: 0, padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.7}px`,
  borderRadius: Math.min(t.radius, 999), border: `1px solid ${t.line}`,
  background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.88, outline: "none",
});

/* --------------------------------------------------------------- profile */

/** A public identity page. */
export function Profile({ id, content, theme: t, mode, emit }: PartProps) {
  const [nameLine, ...rest] = items(content, ["Ada Okafor: Builds things that stay built."]);
  const { title: name, body: bio } = titled(nameLine!);
  const who = { name, initials: name.split(" ").map((x) => x[0]).join("").slice(0, 2) };
  const [following, setFollowing] = React.useState(false);
  const r = rng(hash(id + content));
  const stats = rest.length ? rest : [`${sample.int(r, 12, 400)} posts`, `${sample.int(r, 200, 9000)} followers`, `${sample.int(r, 40, 900)} following`];

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: "32%", minHeight: t.fontPx * 3, background: `linear-gradient(120deg, ${t.accent}55, ${t.highlight}33)` }} />
      <div style={{ flex: 1, padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, marginTop: -t.fontPx * 1.6, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <span style={{ borderRadius: 999, border: `3px solid ${t.surface}` }}><Avatar t={t} who={who} size={3.2} /></span>
          <span style={{ marginLeft: "auto" }}>
            <Btn
              t={t}
              label={following ? "Following" : "Follow"}
              primary={!following}
              onClick={() => { setFollowing((v) => !v); emit?.({ type: "toast", text: following ? `Unfollowed ${name}` : `Following ${name}` }); }}
            />
          </span>
        </div>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.2 }}>{name}</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>{bio ?? unwritten(mode, () => sample.sentence(r, 9), "Bio", t.published)}</span>
        <div style={{ display: "flex", gap: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.82, marginTop: "auto" }}>
          {stats.map((s) => <span key={s}>{s}</span>)}
        </div>
      </div>
    </Fill>
  );
}

/* -------------------------------------------------------------- comments */

/** Threaded discussion, and the flat guestbook that shares its shape. */
export function Comments({ id, content, theme: t, mode, emit }: PartProps) {
  const guestbook = id === "guestbook";
  const seed = items(content, guestbook ? ["Was here.", "Lovely site."] : ["Does this work on phones?", "Yes, try it."]);
  const people = sample.people(seed.length + 1, id + content);
  const [thread, setThread] = React.useState(() => seed.map((text, i) => ({ id: i, text, who: people[i] ?? people[0]!, depth: guestbook ? 0 : Math.min(i, 1) })));
  const [draft, setDraft] = React.useState("");
  const next = React.useRef(seed.length);

  const post = () => {
    const text = draft.trim();
    if (!text) return;
    setThread((xs) => [...xs, { id: next.current++, text, who: { name: "You", role: "", initials: "You".slice(0, 2) }, depth: 0 }]);
    setDraft("");
    emit?.({ type: "toast", text: guestbook ? "Signed" : "Posted", level: "success" });
  };

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, overflow: "auto", minHeight: 0 }}>
        {thread.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, marginLeft: c.depth * t.fontPx * 1.6 }}>
            <Avatar t={t} who={c.who} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <strong style={{ fontSize: t.fontPx * 0.88, fontWeight: 600 }}>{c.who.name}</strong>
                <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>just now</span>
              </div>
              <div style={{ color: t.muted, fontSize: t.fontPx * 0.88 }}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          aria-label={guestbook ? "Sign the guestbook" : "Add a comment"}
          placeholder={guestbook ? "Leave a mark…" : "Add a comment…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") post(); }}
          style={inputStyle(t)}
        />
        <Btn t={t} label={guestbook ? "Sign" : "Post"} onClick={post} />
      </div>
    </Fill>
  );
}

/** Lightweight response to content. */
export function Reactions({ id, content, theme: t, mode }: PartProps) {
  const emoji = items(content, ["👍", "❤️", "🎉", "👀", "🤔"]);
  const r = rng(hash(id + content));
  const [counts, setCounts] = React.useState(() => emoji.map(() => sample.int(r, 0, 42)));
  const [mine, setMine] = React.useState<Record<number, boolean>>({});
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {emoji.map((e, i) => (
        <button
          key={e + i}
          type="button"
          aria-label={`React ${e}`}
          aria-pressed={!!mine[i]}
          onClick={() => {
            setMine((m) => ({ ...m, [i]: !m[i] }));
            setCounts((c) => c.map((v, j) => (j === i ? v + (mine[i] ? -1 : 1) : v)));
          }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, cursor: mode === "live" ? "pointer" : "default",
            padding: `${t.fontPx * 0.25}px ${t.fontPx * 0.6}px`, borderRadius: 999, font: "inherit", fontSize: t.fontPx * 0.85,
            border: `1px solid ${mine[i] ? t.accent : t.line}`, background: mine[i] ? `${t.accent}1e` : "transparent", color: t.text,
          }}
        >
          <span aria-hidden>{e}</span>
          <span style={{ color: t.muted, fontVariantNumeric: "tabular-nums" }}>{counts[i]}</span>
        </button>
      ))}
    </Fill>
  );
}

/** Share to platforms, or copy the link. */
export function ShareSheet({ id, content, theme: t, emit }: PartProps) {
  const where = items(content, ["Mastodon", "Bluesky", "Email", "WhatsApp"]);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Share</strong>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {where.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => emit?.({ type: "toast", text: `Shared to ${w}` })}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: t.fontPx * 0.4, border: "none", background: "transparent", cursor: "pointer", font: "inherit", color: t.text }}
          >
            <span aria-hidden style={{ width: t.fontPx * 2.2, height: t.fontPx * 2.2, borderRadius: Math.min(t.radius, 12), background: `${t.accent}22`, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.accent, fontWeight: 700 }}>{w[0]}</span>
            <span style={{ fontSize: t.fontPx * 0.7, color: t.muted }}>{w}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.6}px`, borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.line}`, fontSize: t.fontPx * 0.8, fontFamily: "ui-monospace, monospace", color: t.muted }}>
          https://example.com/this-page
        </code>
        <Btn t={t} label="Copy" primary={false} onClick={() => { void navigator.clipboard?.writeText("https://example.com/this-page"); emit?.({ type: "toast", text: "Link copied", level: "success" }); }} />
      </div>
    </Fill>
  );
}

/** What people are doing, with repeats folded together. */
export function ActivityFeed({ id, content, theme: t }: PartProps) {
  const verbs = items(content, ["published a page", "left a comment", "joined", "updated the brief"]);
  const people = sample.people(6, id + content);
  const r = rng(hash(id + content));
  const rows = verbs.map((verb, i) => {
    const others = sample.int(r, 0, 3);
    return { verb, who: people[i % people.length]!, others, when: `${sample.int(r, 2, 58)}m ago` };
  });
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.4}px 0`, borderBottom: `1px solid ${t.line}`, fontSize: t.fontPx * 0.88 }}>
          <Avatar t={t} who={row.who} size={1.9} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <strong style={{ fontWeight: 600 }}>{row.who.name}</strong>
            {row.others ? <span style={{ color: t.muted }}> and {row.others} others</span> : null}
            <span style={{ color: t.muted }}> {row.verb}</span>
          </span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.72, whiteSpace: "nowrap" }}>{row.when}</span>
        </div>
      ))}
    </Fill>
  );
}

/** Real-time conversation. Sending gets an answer back in live mode. */
export function Chat({ id, content, options, theme: t, mode, emit }: PartProps) {
  const opener = items(content, ["Hey, is this thing on?"]);
  const [messages, setMessages] = React.useState(() => opener.map((text, i) => ({ id: i, text, mine: i % 2 === 1 })));
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const next = React.useRef(opener.length);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length, typing]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((xs) => [...xs, { id: next.current++, text, mine: true }]);
    setDraft("");
    if (mode !== "live") return;
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((xs) => [...xs, { id: next.current++, text: sample.answer(text), mine: false }]);
      emit?.({ type: "toast", text: "New message" });
    }, 900);
  };

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflow: "auto", minHeight: 0 }}>
        {messages.map((m) => (
          <span
            key={m.id}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "78%",
              padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.7}px`, borderRadius: t.fontPx * 0.9,
              background: m.mine ? t.accent : `${t.muted}26`, color: m.mine ? t.accentText : t.text,
              fontSize: t.fontPx * 0.88,
            }}
          >
            {m.text}
          </span>
        ))}
        {typing ? <span style={{ alignSelf: "flex-start", color: t.muted, fontSize: t.fontPx * 0.8 }}>typing…</span> : null}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          aria-label="Message"
          placeholder={options.placeholder || "Type a message…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          style={inputStyle(t)}
        />
        <Btn t={t} label="Send" onClick={send} />
      </div>
    </Fill>
  );
}

/** Typing @ or # opens a picker that really inserts. */
export function Mentions({ id, content, theme: t, mode }: PartProps) {
  const people = items(content, sample.people(5, id + content).map((p) => p.name));
  const [value, setValue] = React.useState("");
  const token = /(^|\s)([@#])(\w*)$/.exec(value);
  const matches = token ? people.filter((p) => p.toLowerCase().replace(/\s/g, "").includes(token[3]!.toLowerCase())).slice(0, 4) : [];
  const insert = (name: string) => setValue((v) => v.replace(/(^|\s)([@#])(\w*)$/, `$1$2${name.replace(/\s/g, "")} `));

  return (
    <Fill t={t} data-part={id} overflow="visible" style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>Type @ to mention someone, # for a topic</span>
      <div style={{ position: "relative" }}>
        <input aria-label="Write something" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Nice work @…" style={{ ...inputStyle(t), width: "100%", boxSizing: "border-box", borderRadius: Math.min(t.radius, 10) }} />
        {matches.length && mode === "live" ? (
          <ul role="listbox" aria-label="Mentions" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 3, listStyle: "none", padding: 4, ...cardStyle(t), boxShadow: "0 10px 30px oklch(0 0 0 / .35)" }}>
            {matches.map((m) => (
              <li key={m}>
                <button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); insert(m); }} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.5}px`, color: t.text, font: "inherit", fontSize: t.fontPx * 0.85, cursor: "pointer", borderRadius: 6 }}>
                  {token?.[2]}{m}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Fill>
  );
}

/** Report, hide, block — a queue that actually empties. */
export function Moderation({ id, content, theme: t, emit }: PartProps) {
  const reports = items(content, ["Spam link in a comment", "Off-topic reply", "Reported: harassment"]);
  const [queue, setQueue] = React.useState(() => reports.map((text, i) => ({ id: i, text, who: sample.people(reports.length, id + content)[i]! })));
  const act = (itemId: number, what: string) => {
    setQueue((xs) => xs.filter((x) => x.id !== itemId));
    emit?.({ type: "toast", text: what, level: "success" });
  };
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Reports</strong>
        <span style={{ marginLeft: "auto", color: t.muted, fontSize: t.fontPx * 0.78 }}>{queue.length} waiting</span>
      </div>
      {queue.length === 0 ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.88 }}>Nothing left in the queue.</span> : null}
      {queue.map((r) => (
        <div key={r.id} style={{ ...cardStyle(t), background: `${t.muted}10`, padding: t.fontPx * 0.55, display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.85 }}>
          <Avatar t={t} who={r.who} size={1.8} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.text}</span>
          <Btn t={t} label="Allow" primary={false} onClick={() => act(r.id, "Allowed")} style={{ fontSize: t.fontPx * 0.72, padding: `${t.fontPx * 0.2}px ${t.fontPx * 0.5}px` }} />
          <Btn t={t} label="Hide" onClick={() => act(r.id, "Hidden")} style={{ fontSize: t.fontPx * 0.72, padding: `${t.fontPx * 0.2}px ${t.fontPx * 0.5}px` }} />
        </div>
      ))}
    </Fill>
  );
}

/** Earned status markers, with the ones still to come. */
export function Badges({ id, content, theme: t, w }: PartProps) {
  const badges = items(content, ["First post", "Ten replies", "Early bird", "Helper", "Streak"]).map(titled);
  const earned = Math.ceil(badges.length / 2);
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(2, Math.min(5, Math.floor(w / 110)))}, 1fr)`, gap: t.fontPx * 0.5, overflow: "auto" }}>
      {badges.map((b, i) => {
        const got = i < earned;
        return (
          <div key={b.title} style={{ ...cardStyle(t), padding: t.fontPx * 0.6, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center", opacity: got ? 1 : 0.45, minHeight: 0 }}>
            <span aria-hidden style={{ width: t.fontPx * 2.4, height: t.fontPx * 2.4, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: t.fontPx * 1.1, background: got ? `radial-gradient(circle at 35% 30%, ${t.highlight}, ${t.accent})` : `${t.muted}22`, color: got ? t.accentText : t.muted }}>
              {got ? "★" : "🔒"}
            </span>
            <span style={{ fontSize: t.fontPx * 0.78, fontWeight: 600 }}>{b.title}</span>
            <span style={{ fontSize: t.fontPx * 0.68, color: t.muted }}>{b.body ?? (got ? "Earned" : "Locked")}</span>
          </div>
        );
      })}
    </Fill>
  );
}

/** Topic-first discussion. */
export function Forum({ id, content, theme: t, onNavigate, mode }: PartProps) {
  const topics = items(content, ["How do you organise pages?", "Show your board", "Bug: resize on phones", "Feature requests"]);
  const r = rng(hash(id + content));
  const rows = topics.map((title) => ({ title, replies: sample.int(r, 0, 84), who: sample.name(r), when: `${sample.int(r, 1, 22)}h` }));
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", overflow: "auto" }}>
      {rows.map((row, i) => (
        <button
          key={row.title}
          type="button"
          onClick={() => (mode === "live" ? onNavigate?.({ kind: "page", target: row.title }) : undefined)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: t.fontPx * 0.6, background: "none", borderWidth: i < rows.length - 1 ? "0 0 1px 0" : 0, borderStyle: "solid", borderColor: t.line, borderRadius: 0, textAlign: "left", color: t.text, font: "inherit", cursor: mode === "live" ? "pointer" : "default" }}
        >
          <span aria-hidden style={{ color: t.accent, fontSize: t.fontPx * 0.9 }}>#</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: t.fontPx * 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</span>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{row.who} · {row.when} ago</span>
          </span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.8, whiteSpace: "nowrap" }}>{row.replies} replies</span>
        </button>
      ))}
    </Fill>
  );
}

/** Other people's cursors, drifting where they are working. */
export function CollabCursors({ id, content, theme: t, mode }: PartProps) {
  const names = items(content, ["Ravi", "Mina", "Theo"]);
  const [tick, setTick] = React.useState(0);
  useTicker(mode, 1400, () => setTick((v) => v + 1));
  const cursors = names.map((name, i) => {
    const r = rng(hash(name + id) + tick * 7919 + i);
    return { name, x: 12 + r() * 70, y: 14 + r() * 66, hue: hash(name) % 360 };
  });
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), background: `${t.muted}0d`, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.8 }}>
        {names.length} people here
      </div>
      {cursors.map((c) => (
        <span key={c.name} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, display: "flex", alignItems: "flex-start", gap: 2, transition: mode === "live" ? "left 1.2s ease-in-out, top 1.2s ease-in-out" : undefined, pointerEvents: "none" }}>
          <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
            <path d="M1 1 L1 13 L4.5 10 L6.8 15 L9 14 L6.7 9.2 L11.5 9 Z" fill={`oklch(0.68 0.17 ${c.hue})`} stroke={t.bg} strokeWidth="1" />
          </svg>
          <span style={{ background: `oklch(0.68 0.17 ${c.hue})`, color: "oklch(0.14 0 0)", borderRadius: 4, padding: "0 5px", fontSize: t.fontPx * 0.65, fontWeight: 700, whiteSpace: "nowrap" }}>{c.name}</span>
        </span>
      ))}
    </Fill>
  );
}

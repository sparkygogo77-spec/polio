"use client";
/**
 * Model-powered surfaces. None of these call a model — they show the shape of
 * the interaction truthfully (streaming text, a confidence score, a transcript)
 * so the flow can be judged, and the blueprint says which model, with what
 * prompt and what grounding, the generator has to wire up.
 */
import * as React from "react";
import { Btn, Fill, Placeholder, useTicker } from "./primitives";
import { hash, rng, sample, unwritten } from "./sample";
import { cardStyle, items, titled, type Theme } from "./theme";
import type { PartProps } from "./types";

/** A little "made by a model" mark, so a reader always knows. */
function Mark({ t, label = "AI" }: { t: Theme; label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${t.highlight}22`, color: t.highlight, borderRadius: 999, padding: "1px 7px", fontSize: t.fontPx * 0.68, fontWeight: 700, letterSpacing: 0.3, flexShrink: 0 }}>
      <span aria-hidden>✦</span>
      {label}
    </span>
  );
}

/** Text that arrives a word at a time, the way a model answers. */
function useStream(mode: PartProps["mode"], text: string, running: boolean) {
  const words = React.useMemo(() => text.split(" "), [text]);
  const [n, setN] = React.useState(0);
  React.useEffect(() => { setN(running && mode === "live" ? 0 : words.length); }, [running, mode, words.length]);
  useTicker(mode, 60, () => setN((v) => Math.min(words.length, v + 1)), running && n < words.length);
  return { shown: words.slice(0, n).join(" "), done: n >= words.length };
}

/* ------------------------------------------------------------ prompt box */

/** One input that makes something. In live mode the answer streams in. */
export function PromptBox({ id, content, options, theme: t, mode, emit }: PartProps) {
  const region = id === "ai-generate-content";
  const asks = items(content, region ? ["A short section about what this site is for"] : ["Write a headline for a site about…"]);
  const [prompt, setPrompt] = React.useState(region ? asks[0]! : "");
  const [running, setRunning] = React.useState(false);
  const answer = React.useMemo(() => sample.sentence(rng(hash(prompt || asks[0]!)), region ? 34 : 18), [prompt, asks, region]);
  const { shown, done } = useStream(mode, answer, running);

  React.useEffect(() => { if (running && done) { setRunning(false); emit?.({ type: "toast", text: "Done", level: "success" }); } }, [running, done, emit]);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mark t={t} label={region ? "Written by AI" : "AI"} />
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.78, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {options.hint || (region ? "Regenerate to try another angle" : "Say what you want")}
        </span>
      </div>
      {region ? null : (
        <textarea
          aria-label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={asks[0]}
          rows={2}
          style={{ resize: "none", padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.7}px`, borderRadius: Math.min(t.radius, 10), border: `1px solid ${t.line}`, background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.9, outline: "none" }}
        />
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", color: shown ? t.text : t.muted, fontSize: t.fontPx * 0.92 }}>
        {shown || (running ? "…" : "Nothing generated yet.")}
        {running && !done ? <span style={{ color: t.accent }}>▍</span> : null}
      </div>
      <Btn t={t} label={running ? "Generating…" : region ? "Regenerate" : "Generate"} onClick={() => setRunning(true)} style={{ alignSelf: "flex-start" }} />
    </Fill>
  );
}

/** A chat that knows this site. Suggestions get you started. */
export function AiChat({ id, content, options, theme: t, mode }: PartProps) {
  const suggestions = items(content, ["What is this site for?", "Show me the pricing", "How do I get started?"]);
  const [messages, setMessages] = React.useState<{ id: number; text: string; mine: boolean }[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const next = React.useRef(0);
  const { shown, done } = useStream(mode, pending ? sample.answer(pending) : "", pending !== null);

  React.useEffect(() => {
    if (pending === null || !done || !shown) return;
    const text = shown;
    setPending(null);
    setMessages((xs) => [...xs, { id: next.current++, text, mine: false }]);
  }, [pending, done, shown]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    setMessages((xs) => [...xs, { id: next.current++, text, mine: true }]);
    setDraft("");
    setPending(text);
  };

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mark t={t} />
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>Answers come from this site&rsquo;s own pages</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflow: "auto", minHeight: 0 }}>
        {messages.map((m) => (
          <span key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "80%", padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.7}px`, borderRadius: t.fontPx * 0.9, background: m.mine ? t.accent : `${t.muted}26`, color: m.mine ? t.accentText : t.text, fontSize: t.fontPx * 0.88 }}>
            {m.text}
          </span>
        ))}
        {pending !== null ? (
          <span style={{ alignSelf: "flex-start", maxWidth: "80%", padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.7}px`, borderRadius: t.fontPx * 0.9, background: `${t.muted}26`, fontSize: t.fontPx * 0.88 }}>
            {shown || "…"}<span style={{ color: t.accent }}>▍</span>
          </span>
        ) : null}
        {messages.length === 0 && pending === null ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} style={{ padding: `${t.fontPx * 0.3}px ${t.fontPx * 0.65}px`, borderRadius: 999, border: `1px solid ${t.line}`, background: "transparent", color: t.muted, font: "inherit", fontSize: t.fontPx * 0.8, cursor: mode === "live" ? "pointer" : "default" }}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          aria-label="Ask anything"
          placeholder={options.placeholder || "Ask anything…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(draft); }}
          style={{ flex: 1, minWidth: 0, padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.7}px`, borderRadius: 999, border: `1px solid ${t.line}`, background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.88, outline: "none" }}
        />
        <Btn t={t} label="Ask" onClick={() => ask(draft)} />
      </div>
    </Fill>
  );
}

/** Condense or translate a passage in place, and put it back. */
export function AiAction({ id, content, theme: t, mode, emit }: PartProps) {
  const translate = id === "ai-translate";
  const source = items(content, [unwritten(mode, () => sample.sentence(rng(hash(id)), 28))])[0]!;
  const langs = ["English", "Español", "Français", "日本語"];
  const [lang, setLang] = React.useState(langs[0]!);
  const [applied, setApplied] = React.useState(false);
  const result = translate
    ? `${source.split(" ").slice(0, 12).join(" ")}, [${lang}]`
    : source.split(". ")[0] + ".";

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Mark t={t} label={translate ? "Translated" : "Summary"} />
        {translate ? (
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => { setLang(e.target.value); setApplied(true); }}
            style={{ background: "transparent", color: t.text, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 8), padding: "2px 6px", font: "inherit", fontSize: t.fontPx * 0.8 }}
          >
            {langs.map((l) => <option key={l} value={l} style={{ color: "#000" }}>{l}</option>)}
          </select>
        ) : null}
        <span style={{ marginLeft: "auto" }}>
          <Btn
            t={t}
            label={applied ? "Show original" : translate ? "Translate" : "Summarise"}
            primary={!applied}
            onClick={() => { setApplied((v) => !v); emit?.({ type: "toast", text: applied ? "Original restored" : translate ? `Translated to ${lang}` : "Summarised" }); }}
            style={{ fontSize: t.fontPx * 0.8 }}
          />
        </span>
      </div>
      <p style={{ margin: 0, flex: 1, overflow: "auto", minHeight: 0, fontSize: t.fontPx * 0.92, color: applied ? t.text : t.muted, maxWidth: t.measurePx }}>
        {applied ? result : source}
      </p>
    </Fill>
  );
}

/** What to look at next, and why. */
export function AiRecommend({ id, content, theme: t, mode, onNavigate, w }: PartProps) {
  const picks = items(content, ["A related guide", "Something popular", "Because you looked at pricing"]).map(titled);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mark t={t} label="Suggested for you" />
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>based on what you have read</span>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${w < 520 ? 1 : Math.min(3, picks.length)}, 1fr)`, gap: t.fontPx * 0.6, minHeight: 0 }}>
        {picks.map((p) => (
          <button
            key={p.title}
            type="button"
            onClick={() => (mode === "live" ? onNavigate?.({ kind: "page", target: p.title }) : undefined)}
            style={{ ...cardStyle(t), padding: t.fontPx * 0.6, display: "flex", flexDirection: "column", gap: 5, textAlign: "left", color: t.text, font: "inherit", cursor: mode === "live" ? "pointer" : "default", minHeight: 0, overflow: "hidden" }}
          >
            <span style={{ flex: 1, minHeight: t.fontPx * 2 }}><Placeholder t={t} /></span>
            <span style={{ fontWeight: 600, fontSize: t.fontPx * 0.9 }}>{p.title}</span>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{p.body ?? "Because of what you read"}</span>
          </button>
        ))}
      </div>
    </Fill>
  );
}

/** Screening, with the score shown and a human able to overrule it. */
export function AiModeration({ id, content, theme: t, emit }: PartProps) {
  const queue = items(content, ["Buy cheap followers here!!!", "Great write-up, thanks.", "You are all idiots"]);
  const [items_, setItems] = React.useState(() =>
    queue.map((text, i) => {
      const r = rng(hash(text));
      return { id: i, text, score: Math.round((0.15 + r() * 0.8) * 100), decided: null as string | null };
    }),
  );
  const decide = (itemId: number, what: string) => {
    setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, decided: what } : x)));
    emit?.({ type: "toast", text: what, level: "success" });
  };
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mark t={t} label="Screened" />
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>a person can always overrule</span>
      </div>
      {items_.map((x) => {
        const risky = x.score > 55;
        return (
          <div key={x.id} style={{ ...cardStyle(t), background: `${t.muted}10`, padding: t.fontPx * 0.55, display: "flex", flexDirection: "column", gap: 5, fontSize: t.fontPx * 0.85, opacity: x.decided ? 0.5 : 1 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.text}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, height: 5, borderRadius: 999, background: `${t.muted}28`, overflow: "hidden" }}>
                <span style={{ display: "block", width: `${x.score}%`, height: "100%", background: risky ? "oklch(0.68 0.19 25)" : t.accent }} />
              </span>
              <span style={{ color: risky ? "oklch(0.72 0.18 25)" : t.accent, fontSize: t.fontPx * 0.72, whiteSpace: "nowrap" }}>{x.score}% {risky ? "risk" : "clear"}</span>
              {x.decided ? (
                <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>{x.decided}</span>
              ) : (
                <>
                  <Btn t={t} label="Keep" primary={false} onClick={() => decide(x.id, "Kept")} style={{ fontSize: t.fontPx * 0.7, padding: `${t.fontPx * 0.18}px ${t.fontPx * 0.45}px` }} />
                  <Btn t={t} label="Remove" onClick={() => decide(x.id, "Removed")} style={{ fontSize: t.fontPx * 0.7, padding: `${t.fontPx * 0.18}px ${t.fontPx * 0.45}px` }} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </Fill>
  );
}

/** Talk instead of typing. The bars move while it is listening. */
export function AiVoice({ id, content, theme: t, mode, emit }: PartProps) {
  const phrase = items(content, ["Show me the pricing page"])[0]!;
  const [listening, setListening] = React.useState(false);
  const [level, setLevel] = React.useState<number[]>(() => Array.from({ length: 12 }, (_, i) => 20 + ((i * 37) % 60)));
  const { shown, done } = useStream(mode, phrase, listening);
  useTicker(mode, 120, () => setLevel((xs) => xs.map(() => 12 + Math.random() * 80)), listening);

  React.useEffect(() => {
    if (listening && done) { setListening(false); emit?.({ type: "toast", text: `Heard: ${phrase}`, level: "success" }); }
  }, [listening, done, phrase, emit]);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", alignItems: "center", gap: t.fontPx * 0.8 }}>
      <button
        type="button"
        aria-label={listening ? "Stop listening" : "Start listening"}
        aria-pressed={listening}
        onClick={() => setListening((v) => !v)}
        style={{ width: t.fontPx * 2.8, height: t.fontPx * 2.8, borderRadius: 999, flexShrink: 0, border: "none", cursor: mode === "live" ? "pointer" : "default", background: listening ? "oklch(0.65 0.2 25)" : t.accent, color: t.accentText, fontSize: t.fontPx * 1.1 }}
      >
        ●
      </button>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 3, height: t.fontPx * 1.6 }}>
          {level.map((v, i) => (
            <span key={i} style={{ flex: 1, height: `${listening ? v : 14}%`, minHeight: 3, borderRadius: 999, background: listening ? t.accent : `${t.muted}55`, transition: "height 120ms linear" }} />
          ))}
        </div>
        <span aria-live="polite" style={{ color: shown ? t.text : t.muted, fontSize: t.fontPx * 0.88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shown || (listening ? "Listening…" : "Press to speak")}
        </span>
      </div>
    </Fill>
  );
}

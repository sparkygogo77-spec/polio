"use client";
/**
 * The backend, as a place you work rather than a dialog you visit.
 *
 * WHAT THIS REPLACES. Talking to the model was seven fixed modes behind a
 * button in `BriefDialog`, and measured against what J asked for, two of
 * five things existed:
 *
 *   · a system box — no. `SYSTEM` was a constant in the route, so the
 *     instructions the model works under were the one part of the call
 *     nobody using the Builder could see, let alone change.
 *   · a prompt box — yes, one per mode.
 *   · the output — yes, in the same dialog.
 *   · an effort setting — no. `effort: mode === "ideas" ? "medium" : "high"`,
 *     decided in the route and never asked.
 *   · the conversation — no. Every ask was one-shot, which is why "no, the
 *     other one" had nowhere to go.
 *
 * So the three that were missing are here, and the two that existed are
 * here in a surface you can leave open rather than a dialog that closes
 * over the work.
 *
 * WHAT IS DELIBERATELY NOT OFFERED. The system box *adds to* the house
 * system prompt; it does not replace it. The rules about how to read a
 * blueprint are what make the answers usable at all, and a surface for
 * talking to the backend is not a door for turning them off. The route
 * enforces that, not this file — a browser can send anything.
 *
 * The key is untouched by any of it: it rides in the header `keyHeader()`
 * has always set, from the server or the person's own keys panel, and nothing
 * here reads it, shows it or stores it.
 */
import * as React from "react";
import { Eraser, Send, SlidersHorizontal, Square } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { askClaude } from "./agent";
import { EFFORT_KEY } from "./effort";
import { useCompiledBrief } from "./BriefDialog";
import { specToMarkdown } from "./spec";
import { FIELD } from "./TimelineDetail";
import { cn } from "@/core/lib/cn";

/** One thing said, by one side. */
export interface Turn {
  role: "user" | "assistant";
  text: string;
  /** Milliseconds the answer took, for the ones that came back. */
  took?: number;
}

const EFFORTS = [
  { id: "low", label: "Low", blurb: "Fast and cheap. Good for a name, a line, a yes or no." },
  { id: "medium", label: "Medium", blurb: "The middle. Where most asks belong." },
  { id: "high", label: "High", blurb: "Slow and thorough. Worth it for a plan or a build." },
] as const;
type Effort = (typeof EFFORTS)[number]["id"];

/** Kept across a close: the system and the effort are settings, not state. */
const SYSTEM_KEY = "builder.backend.system";
const held = (k: string, fallback = "") => {
  try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; }
};
const hold = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* a private window; the setting is just not kept */ }
};

export function Backend() {
  /* The site as it stands, compiled the same way every other ask compiles
     it. It rides with every turn, so "why is the hero fighting the nav" is
     a question about this site rather than about websites. */
  const spec = useCompiledBrief();
  const markdown = React.useMemo(() => specToMarkdown(spec), [spec]);
  const [system, setSystem] = React.useState("");
  const [effort, setEffort] = React.useState<Effort>("high");
  const [prompt, setPrompt] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [openSystem, setOpenSystem] = React.useState(false);
  const stop = React.useRef<AbortController | null>(null);
  const foot = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSystem(held(SYSTEM_KEY));
    const e = held(EFFORT_KEY, "high");
    if (EFFORTS.some((x) => x.id === e)) setEffort(e as Effort);
  }, []);

  /* The newest thing said is the thing you want to read. */
  React.useEffect(() => { foot.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);

  const send = async () => {
    const said = prompt.trim();
    if (!said || busy) return;
    setError(null);
    setBusy(true);
    /* On the list before the answer, so the thread reads in the order it
       happened even while the answer is still coming. */
    const before = turns;
    setTurns([...before, { role: "user", text: said }]);
    setPrompt("");
    const ctl = new AbortController();
    stop.current = ctl;
    const began = Date.now();
    try {
      const r = await askClaude(
        {
          markdown,
          mode: "ask",
          prompt: said,
          system: system.trim() || undefined,
          effort,
          /* What was said before this, which is the whole point of it being
             a conversation: an answer can be argued with. */
          turns: before.map((t) => ({ role: t.role, text: t.text })),
        },
        { signal: ctl.signal },
      );
      if (r.ok) setTurns((t) => [...t, { role: "assistant", text: r.text, took: Date.now() - began }]);
      else setError(r.message ?? "That did not come back.");
    } catch (e) {
      setError(e instanceof DOMException && e.name === "AbortError" ? "Stopped." : "That did not come back.");
    } finally {
      setBusy(false);
      stop.current = null;
    }
  };

  return (
    <div data-backend="" className="flex h-full flex-col gap-2 p-2" style={{ color: FIELD.text }}>
      {/* ------------------------------------------------ the conversation */}
      <div data-backend-thread="" className="min-h-0 flex-1 overflow-y-auto rounded-md border px-2 py-1.5" style={{ borderColor: FIELD.rim, background: FIELD.raised }}>
        {turns.length === 0 && !busy ? (
          <p className="p-4 text-center text-plain" style={{ color: FIELD.dim }}>
            Nothing said yet. The site as it stands goes with every ask, so you can point at it
            — “why is the hero fighting the nav” — and argue with the answer.
          </p>
        ) : null}
        {turns.map((t, i) => (
          <div key={i} data-turn={t.role} className="border-b py-1.5 last:border-0" style={{ borderColor: FIELD.rim }}>
            <div className="mb-0.5 flex items-center gap-2 text-small uppercase tracking-wide" style={{ color: FIELD.dim }}>
              <span>{t.role === "user" ? "You" : "Claude"}</span>
              {t.took ? <span className="num">{(t.took / 1000).toFixed(1)}s</span> : null}
            </div>
            <p className="whitespace-pre-wrap text-large leading-snug">{t.text}</p>
          </div>
        ))}
        {busy ? <p className="py-2 text-plain" style={{ color: FIELD.dim }}>Thinking at {effort} effort…</p> : null}
        {error ? <p data-backend-error="" className="py-2 text-plain" style={{ color: "oklch(0.72 0.17 25)" }}>{error}</p> : null}
        <div ref={foot} />
      </div>

      {/* ------------------------------------------------- the system box */}
      <div className="shrink-0">
        <button
          type="button"
          data-backend-system-toggle=""
          className="tactile flex items-center gap-1.5 rounded px-1 text-small uppercase tracking-wide"
          style={{ color: FIELD.dim }}
          onClick={() => { play("select"); setOpenSystem((v) => !v); }}
        >
          <SlidersHorizontal className="size-3" />
          {openSystem ? "Hide the system prompt" : system.trim() ? "System prompt · set" : "System prompt"}
        </button>
        {openSystem ? (
          <>
            <textarea
              data-backend-system=""
              value={system}
              onChange={(e) => { setSystem(e.target.value); hold(SYSTEM_KEY, e.target.value); }}
              rows={3}
              placeholder="Anything to add to how it should answer. Added to the Builder's own instructions, not in place of them."
              className="mt-1 w-full resize-y rounded-md border bg-transparent p-1.5 text-plain leading-snug outline-none"
              style={{ borderColor: FIELD.rim, color: FIELD.text }}
            />
            <p className="px-1 pt-0.5 text-small" style={{ color: FIELD.dim }}>
              Added to the Builder&rsquo;s own instructions. The rules for reading a blueprint are what make the answers usable, so they stay.
            </p>
          </>
        ) : null}
      </div>

      {/* --------------------------------------- the effort and the prompt */}
      <div className="flex shrink-0 items-center gap-1">
        {EFFORTS.map((e) => (
          <button
            key={e.id}
            type="button"
            data-backend-effort={e.id}
            aria-pressed={effort === e.id}
            title={e.blurb}
            className={cn("tactile rounded px-2 py-1 text-small uppercase tracking-wide")}
            style={effort === e.id
              ? { background: FIELD.lit, color: "oklch(0.15 0.04 152)" }
              : { border: `1px solid ${FIELD.rim}`, color: FIELD.dim }}
            onClick={() => { play("select"); setEffort(e.id); hold(EFFORT_KEY, e.id); }}
          >
            {e.label}
          </button>
        ))}
        <span className="flex-1" />
        {turns.length ? (
          <Button size="sm" variant="ghost" onClick={() => { play("close"); setTurns([]); setError(null); }}>
            <Eraser /> Clear
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-end gap-1.5">
        <textarea
          data-backend-prompt=""
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
          rows={2}
          placeholder="Ask it something about this site. ⌘↵ sends."
          className="min-h-0 flex-1 resize-y rounded-md border bg-transparent p-1.5 text-large leading-snug outline-none"
          style={{ borderColor: FIELD.rim, color: FIELD.text }}
        />
        {busy ? (
          <Button size="sm" variant="outline" data-backend-stop="" onClick={() => { stop.current?.abort(); play("close"); }}>
            <Square /> Stop
          </Button>
        ) : (
          <Button size="sm" data-backend-send="" disabled={!prompt.trim()} onClick={() => void send()}>
            <Send /> Send
          </Button>
        )}
      </div>
    </div>
  );
}

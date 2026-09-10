"use client";
/**
 * What is under the timeline: one iteration, read step by step.
 *
 * The timeline says almost nothing — that is its job. Everything an
 * iteration actually holds is here, in the section under it, laid out the
 * way the parts shelf is: a row of steps you walk in from, then the thing
 * itself. One box at a time, never all of them: a wall of every prompt and
 * every answer at once is what this replaced.
 *
 * Three parts to it:
 *
 * - **The stages.** Asked, came back, what changed, the critique, and what
 *   came next. A row across the top; pick one and the rest gets out of the
 *   way. The prompt stays above the preview, small, because it is the
 *   question you are reading the answer against.
 * - **What to do with it.** A menu down the side: take the findings, stand
 *   the board on it, write the code, publish. Converting a generation into
 *   something is the point of having kept it.
 * - **The book.** The brief, the JSON and the ask, unchanged and in their
 *   own tab, with their own menu — the timeline's menu is about *this*
 *   iteration and the book's is about the whole site, and mixing them was
 *   the thing that made the old dialog hard to read.
 */
import * as React from "react";
import { ArrowRight, BookOpen, Check, Copy, ListChecks, MapPin, MessageSquare, Pin, PinOff, Repeat, Sparkles, Wand2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { useActions } from "@/core/actions";
import { screenFace, SCREEN } from "@/core/ui/void";
import { IterationBook } from "./BriefDialog";
import { headlineOf } from "./Timeline";
import { diffDocs, threadTitle, type Thread } from "./threads";
import { useStudio } from "./store";

type Stage = "asked" | "answer" | "changed" | "critique" | "next";

const STAGES: { id: Stage; label: string; icon: React.ReactNode; blurb: string }[] = [
  { id: "asked", label: "Asked", icon: <MessageSquare className="size-3.5" />, blurb: "The prompt, as it went." },
  { id: "answer", label: "Came back", icon: <Sparkles className="size-3.5" />, blurb: "What Claude answered, whole." },
  { id: "changed", label: "Changed", icon: <Wand2 className="size-3.5" />, blurb: "What it did to the board." },
  { id: "critique", label: "Critique", icon: <ListChecks className="size-3.5" />, blurb: "What was found, and the prompt that settles it." },
  { id: "next", label: "What came next", icon: <ArrowRight className="size-3.5" />, blurb: "The iterations that hang off this one." },
];

/** Emerald, quieter than the boxes: this is a page, not a light. */
const FIELD = {
  face: "oklch(0.17 0.035 158)",
  rim: "oklch(0.34 0.06 158)",
  text: "oklch(0.9 0.04 158)",
  dim: "oklch(0.66 0.06 158)",
  lit: "oklch(0.8 0.16 158)",
};

export function TimelineDetail() {
  const [tab, setTab] = React.useState<"iteration" | "book">("iteration");
  const openId = useStudio((s) => s.openThreadId);
  const threads = useStudio((s) => s.threads);
  const open = threads.find((t) => t.id === openId) ?? null;

  // The loop starter on a strand opens the pair here, on the critique step.
  const [loop, setLoop] = React.useState<{ from: string; to: string } | null>(null);
  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ from: string; to: string }>).detail;
      setLoop(d);
      setTab("iteration");
    };
    const toBook = () => setTab("book");
    window.addEventListener("studio:loop", on);
    window.addEventListener("studio:book", toBook);
    return () => {
      window.removeEventListener("studio:loop", on);
      window.removeEventListener("studio:book", toBook);
    };
  }, []);

  return (
    <section
      data-timeline-detail=""
      className="flex h-full w-full flex-col overflow-hidden border-t"
      style={{ background: FIELD.face, borderColor: FIELD.rim }}
    >
      {/* Two menus, side by side and separate: this iteration, and the site. */}
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: FIELD.rim }}>
        <Tab on={tab === "iteration"} onClick={() => { play("select"); setTab("iteration"); }} icon={<Repeat className="size-3.5" />}>
          {open ? "This iteration" : "No iteration open"}
        </Tab>
        <Tab on={tab === "book"} onClick={() => { play("select"); setTab("book"); }} icon={<BookOpen className="size-3.5" />}>
          The iteration book
        </Tab>
        <span className="flex-1" />
        {open ? (
          <span className="truncate pr-1 text-[10px]" style={{ color: FIELD.dim }}>
            {threadTitle(open)}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "book" ? (
          // Unchanged, and in its own tab: same fields, same screen face,
          // same words. Only where it lives has moved.
          <IterationBook />
        ) : open ? (
          <Iteration thread={open} loop={loop} />
        ) : (
          <p className="p-6 text-center text-[12px]" style={{ color: FIELD.dim }}>
            Click an iteration above to read it here — the prompt, what came back, what it changed, and what it led to.
          </p>
        )}
      </div>
    </section>
  );
}

function Tab({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="tactile flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px]"
      style={{
        background: on ? "oklch(0.24 0.06 158)" : "transparent",
        borderColor: on ? "oklch(0.5 0.12 158)" : "transparent",
        color: on ? FIELD.text : FIELD.dim,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One iteration, step by step                                         */
/* ------------------------------------------------------------------ */

function Iteration({ thread, loop }: { thread: Thread; loop: { from: string; to: string } | null }) {
  const [stage, setStage] = React.useState<Stage>("asked");
  const threads = useStudio((s) => s.threads);
  const trail = useStudio((s) => s.trail);
  const pinned = useStudio((s) => s.pinnedThreads.includes(thread.id));
  const live = useStudio((s) => s.liveThreadId === thread.id);
  const ctx = useActions();
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  const children = threads.filter((t) => t.parentId === thread.id);
  const findings = trail.filter((e) => e.threadId === thread.id && e.stage === "critique");
  const changed = React.useMemo(() => diffDocs(parent?.doc, thread.doc), [parent, thread]);

  // Arriving from a loop starter: the pair is what is being looked at, so
  // the critique between them is the step that matters.
  React.useEffect(() => {
    if (loop && loop.to === thread.id) setStage("critique");
  }, [loop, thread.id]);

  return (
    <div className="flex min-h-0 flex-col gap-2 p-3 lg:flex-row">
      {/* The stages, and the reading. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div data-stages="" className="flex flex-wrap items-center gap-1">
          {STAGES.map((s, i) => {
            const on = stage === s.id;
            const count = s.id === "critique" ? findings.length : s.id === "next" ? children.length : s.id === "changed" ? changed.length : 0;
            return (
              <React.Fragment key={s.id}>
                {i ? <span className="text-[10px]" style={{ color: "oklch(0.4 0.06 158)" }}>›</span> : null}
                <button
                  type="button"
                  onClick={() => { play("select"); setStage(s.id); }}
                  aria-pressed={on}
                  className="tactile flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px]"
                  style={{
                    background: on ? "oklch(0.26 0.07 158)" : "transparent",
                    borderColor: on ? "oklch(0.56 0.13 158)" : "oklch(0.3 0.05 158)",
                    color: on ? FIELD.text : FIELD.dim,
                  }}
                >
                  {s.icon}
                  {s.label}
                  {count ? <span className="num text-[9px] opacity-70">{count}</span> : null}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* The prompt stays above whatever is being read, and small. */}
        <div className="rounded-md border p-2" style={{ borderColor: FIELD.rim, background: "oklch(0.2 0.04 158)" }}>
          <p className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em]" style={{ color: FIELD.dim }}>
            <MessageSquare className="size-3" /> the prompt
            <span className="flex-1" />
            <button type="button" className="tactile rounded px-1 hover:underline" onClick={() => void ctx.copy(thread.ask, "the prompt")}>copy</button>
          </p>
          <p className="line-clamp-2 whitespace-pre-wrap text-[11px] leading-snug" style={{ color: FIELD.text }}>{thread.ask || "—"}</p>
        </div>

        <Preview stage={stage} thread={thread} changed={changed} findings={findings} children={children} loop={loop} parent={parent} />
      </div>

      {/* What to do with this generation. */}
      <aside className="flex w-full shrink-0 flex-col gap-1 lg:w-64">
        <p className="px-1 text-[9px] uppercase tracking-[0.16em]" style={{ color: FIELD.dim }}>turn this into</p>
        <Convert label="Take every finding" icon={<Check className="size-3.5" />} blurb={`${findings.filter((f) => !f.applied).length} prompts to write onto their parts`} disabled={!findings.some((f) => !f.applied)}
          onClick={() => { play("confirm"); for (const f of findings) if (!f.applied) useStudio.getState().applyRevision(f.id); }} />
        <Convert label={live ? "The board is on this" : "Stand the board on it"} icon={<MapPin className="size-3.5" />} blurb="Put every part back the way this iteration left it" disabled={live || !thread.doc}
          onClick={() => { play("confirm"); useStudio.getState().standOn(thread.id); }} />
        <Convert label={pinned ? "Unpin it" : "Pin it to the top"} icon={pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />} blurb="Keep it in view while the next ask is written"
          onClick={() => { play(pinned ? "close" : "confirm"); useStudio.getState().togglePinnedThread(thread.id); }} />
        <Convert label="Copy what came back" icon={<Copy className="size-3.5" />} blurb={`${thread.answer.length} characters, as it was written`}
          onClick={() => void ctx.copy(thread.answer, "the answer")} />
        <Convert label="Ask the next thing" icon={<Sparkles className="size-3.5" />} blurb="The book, with this iteration live under it"
          onClick={() => { play("confirm"); useStudio.getState().standOn(thread.id); window.dispatchEvent(new CustomEvent("studio:book")); }} />
        {thread.usage ? (
          <p className="px-1 pt-1 text-[9px]" style={{ color: FIELD.dim }}>
            {thread.usage.sent} pieces sent{thread.usage.skipped ? `, ${thread.usage.skipped} unchanged` : ""}
            {thread.usage.cached ? ` · ${thread.usage.cached.toLocaleString()} tokens read from the cache` : ""}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function Convert({ label, icon, blurb, onClick, disabled }: { label: string; icon: React.ReactNode; blurb: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("tactile flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left disabled:opacity-45")}
      style={{ borderColor: FIELD.rim, background: "oklch(0.2 0.04 158)" }}
    >
      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: FIELD.text }}>{icon}{label}</span>
      <span className="text-[10px] leading-snug" style={{ color: FIELD.dim }}>{blurb}</span>
    </button>
  );
}

/** The step being read. A screen, like everywhere else words are read here. */
function Preview({
  stage, thread, changed, findings, children, loop, parent,
}: {
  stage: Stage;
  thread: Thread;
  changed: string[];
  findings: { id: string; text: string; prompt?: string; applied?: boolean; target: { label: string } }[];
  children: Thread[];
  loop: { from: string; to: string } | null;
  parent: Thread | null;
}) {
  const openThread = useStudio((s) => s.openThread);
  const applyRevision = useStudio((s) => s.applyRevision);
  const box = (children: React.ReactNode) => (
    <div className="min-h-[46vh] rounded-md p-3 text-[11px] leading-relaxed" style={{ ...screenFace, color: SCREEN.ink }}>
      {children}
    </div>
  );
  if (stage === "asked") {
    return box(
      <div className="space-y-2">
        <p className="whitespace-pre-wrap">{thread.ask || "—"}</p>
        {parent ? <p className="text-[10px] opacity-70">It was asked with the board as “{headlineOf(parent)}” left it.</p> : null}
      </div>,
    );
  }
  if (stage === "answer") return box(<pre className="max-h-[38vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[10.5px]">{thread.answer || "—"}</pre>);
  if (stage === "changed") {
    return box(
      changed.length ? (
        <ul className="space-y-0.5 font-mono text-[10.5px]">{changed.map((l, i) => <li key={i}>{l}</li>)}</ul>
      ) : (
        <p className="opacity-70">Nothing on the board changed with this iteration.</p>
      ),
    );
  }
  if (stage === "critique") {
    return box(
      <div className="space-y-2">
        {loop && loop.to === thread.id ? (
          <p className="rounded border border-[oklch(0.5_0.12_158)] bg-[oklch(0.2_0.06_158)] p-2 text-[11px] text-[oklch(0.88_0.08_158)]">
            <Repeat className="mr-1 inline size-3" />
            The loop between these two: what the one before produced, what was found in it, and what this one did about it.
          </p>
        ) : null}
        {findings.length ? (
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <li key={f.id} className="rounded border border-[oklch(0.34_0.06_158)] p-2">
                <p className="text-[11px]">{f.target.label}: {f.text}</p>
                {f.prompt ? (
                  <div className="mt-1 flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[10px] italic opacity-80">{f.prompt}</p>
                    <Button variant="outline" size="xs" disabled={f.applied} onClick={() => applyRevision(f.id)}>{f.applied ? "Taken" : "Take it"}</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="opacity-70">No findings came out of this one. A critique or a finish ask is what produces them.</p>
        )}
      </div>,
    );
  }
  return box(
    children.length ? (
      <ul className="space-y-1">
        {children.map((c) => (
          <li key={c.id}>
            <button type="button" className="tactile w-full rounded border border-[oklch(0.34_0.06_158)] p-2 text-left hover:border-[oklch(0.5_0.12_158)]" onClick={() => { play("select"); openThread(c.id); }}>
              <span className="text-[11px]">{headlineOf(c)}</span>
              <span className="ml-2 num text-[9px] opacity-70">{c.mode}</span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="opacity-70">Nothing has hung off this iteration yet. Ask the next thing and it will.</p>
    ),
  );
}

/** The one thing the detail section writes back: a prompt for the next ask. */
export function NextAsk({ onAsk }: { onAsk: (text: string) => void }) {
  const [text, setText] = React.useState("");
  return (
    <div className="flex items-end gap-2 p-2">
      <Textarea autoGrow rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the next thing…" aria-label="The next ask" />
      <Button variant="primary" size="sm" disabled={!text.trim()} onClick={() => { onAsk(text.trim()); setText(""); }}>
        <Sparkles /> Ask
      </Button>
    </div>
  );
}

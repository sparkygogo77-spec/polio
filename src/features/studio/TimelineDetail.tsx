"use client";
/**
 * What is under the timeline: the prompt, and what to do with what it made.
 *
 * The iteration's own contents moved out of here and onto the timeline: a
 * card grows out of the box itself now, the ask above it and the answer
 * below. What stays is the part you keep looking at while you work.
 *
 * - **The prompt, pinned.** Sticky to the top of the section and larger
 *   than anything else in it, at every zoom and every window size, because
 *   it is the question every other thing here is an answer to. It scrolled
 *   away before, which made the section a page of text with no subject.
 * - **What to do with it.** Take the findings, stand the board on it, pin
 *   it, copy what came back, ask the next thing: turning a generation into
 *   something is the point of having kept it. The controls wear the
 *   iteration boxes' own colours, so the section reads as the same place
 *   as the timeline above rather than a codebase underneath it.
 * - **The book**, in its own tab with its own menu: the brief, the JSON,
 *   the ask and publishing, about the whole site rather than this one
 *   iteration.
 */
import * as React from "react";
import { ArrowRight, BookOpen, Brush, Check, Copy, Flag, ListChecks, MapPin, MessageSquare, Pin, PinOff, Repeat, Sparkles, Wand2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { useActions } from "@/core/actions";
import { IterationBook } from "./BriefDialog";
import { headlineOf, Drawn } from "./Timeline";
import { diffDocs, threadTitle, type Thread } from "./threads";
import { sayBill } from "./spend";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { moltenClass, moltenSeed, type MoltenKind } from "@/core/ui/molten";
import { drawOnPart, writeOnPart } from "./RadialMenu";

/**
 * The section's colours: the iteration boards' own, one step quieter.
 *
 * It read as a codebase — grey chrome under a lit timeline — and the two
 * halves of one screen should not look like two applications. So it is the
 * green an iteration is made of; an element prompt's section wears the red
 * its drawing does, below.
 */
export const FIELD = {
  face: "oklch(0.175 0.042 152)",
  raised: "oklch(0.23 0.066 152)",
  rim: "oklch(0.36 0.091 152)",
  lit: "oklch(0.66 0.17 152)",
  text: "oklch(0.93 0.053 152)",
  dim: "oklch(0.7 0.091 152)",
};

/** A drawing's section wears the red its own board does. */
const PURPLE = {
  face: "oklch(0.19 0.053 18)",
  raised: "oklch(0.26 0.091 18)",
  rim: "oklch(0.42 0.131 18)",
  lit: "oklch(0.76 0.17 18)",
  text: "oklch(0.94 0.053 18)",
  dim: "oklch(0.74 0.106 18)",
};

export function TimelineDetail() {
  const [tab, setTab] = React.useState<"iteration" | "book">("iteration");
  const openId = useStudio((s) => s.openThreadId);
  const currentId = useStudio((s) => s.currentThreadId);
  const threads = useStudio((s) => s.threads);
  /*
   * What is read here is what is open, and what is open falls back to the
   * one being worked in. So the flag on a box is not only a marker: the
   * section and the prompt in it follow it, and they still follow it after
   * a reload, when nothing is explicitly open.
   */
  const open = threads.find((t) => t.id === openId) ?? threads.find((t) => t.id === currentId) ?? null;

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
          {open ? "This update" : "No update open"}
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
            Click an iteration above to read it here, the prompt, what came back, what it changed, and what it led to. Press "this iteration" on a box to work in it, and this follows it.
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
      className="tactile flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px]"
      style={{
        background: on ? FIELD.raised : "transparent",
        borderColor: on ? FIELD.lit : "transparent",
        color: on ? FIELD.text : FIELD.dim,
        boxShadow: on ? "0 0 0 1px oklch(0.66 0.17 152 / 0.25)" : undefined,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One iteration: the prompt, pinned, and what it can become           */
/* ------------------------------------------------------------------ */

function Iteration({ thread, loop }: { thread: Thread; loop: { from: string; to: string } | null }) {
  const threads = useStudio((s) => s.threads);
  const trail = useStudio((s) => s.trail);
  const pinned = useStudio((s) => s.pinnedThreads.includes(thread.id));
  const live = useStudio((s) => s.liveThreadId === thread.id);
  const current = useStudio((s) => s.currentThreadId === thread.id);
  const ctx = useActions();
  const element = thread.mode === "drawing";
  const skin = element ? PURPLE : FIELD;
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  const children = threads.filter((t) => t.parentId === thread.id);
  const findings = trail.filter((e) => e.threadId === thread.id && e.stage === "critique");
  const changed = React.useMemo(() => diffDocs(parent?.doc, thread.doc), [parent, thread]);
  const loopHere = loop && (loop.to === thread.id || loop.from === thread.id);
  /*
   * What this iteration cost, in one line.
   *
   * Both halves are a real bill now — Claude per token and the renderer per
   * press — so the dollars, the wait and who was paid sit at the end of the
   * same line rather than in a place of their own: an iteration that drew
   * something says so where an iteration that only wrote says how much of it
   * came out of the cache.
   */
  /*
   * The part this iteration made, if it is still on the board.
   *
   * Still on the board is the condition: an iteration whose part has since
   * been deleted has nothing to change, and offering it would be offering to
   * make a new one — which is the thing being fixed.
   */
  const nodes = useStudio((s) => s.nodes);
  const made = React.useMemo(
    () => (thread.madeId ? nodes.find((n) => n.id === thread.madeId) ?? null : null),
    [nodes, thread.madeId],
  );
  const madeLabel = made?.label ?? "it";
  const changeMade = React.useCallback((how: "draw" | "write") => {
    if (!made) return;
    const s = useStudio.getState();
    // Back to the board, on the part, with it picked — then the board opens
    // on that part rather than on empty space.
    s.setMode("design");
    s.setActivePage(made.pageId);
    s.setSelection([made.id]);
    // Next frame: the board has to exist before the wheel can be put over it.
    window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-node-id="${made.id}"]`);
      const box = el?.getBoundingClientRect();
      const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
      const y = box ? box.top + box.height / 2 : window.innerHeight / 2;
      if (how === "draw") drawOnPart(made.id, x, y);
      else writeOnPart(made.id, x, y);
    });
  }, [made]);

  const usage = React.useMemo(() => {
    const u = thread.usage;
    if (!u) return "";
    return [
      u.sent ? `${u.sent} pieces sent${u.skipped ? `, ${u.skipped} unchanged` : ""}` : "",
      u.cached ? `${u.cached.toLocaleString()} tokens read from the cache` : "",
      // The bill, in the same words the card uses: what, how long, to whom.
      sayBill({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0, claude: u.claude, renderer: u.renderer }),
    ].filter(Boolean).join(" · ");
  }, [thread.usage]);

  return (
    <div className="flex min-h-0 flex-col">
      {/*
        The prompt, pinned to the top of the section and bigger than
        anything else in it. Sticky rather than merely first: it is the
        subject, and a subject that scrolls away leaves a page of answers
        to nothing.
      */}
      <div
        data-pinned-prompt=""
        className="sticky top-0 z-10 border-b px-3 py-2.5 backdrop-blur-sm"
        style={{ background: skin.face, borderColor: skin.rim }}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
            style={{ borderColor: skin.rim, background: skin.raised, color: skin.dim }}>
            {element ? <Brush className="size-3.5" /> : <MessageSquare className="size-3.5" />}
            {element ? "element prompt" : "the prompt"}
          </span>
          {/* The flag again, where the prompt is written, so the two are
              never out of step with one another. */}
          {current ? (
            <span data-working-here="" className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
              style={{ background: skin.lit, color: skin.face }}>
              <Flag className="size-3" />
              working here
            </span>
          ) : null}
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] font-medium leading-snug" style={{ color: skin.text }}>
            {thread.ask || "nothing was typed with this one"}
          </p>
          <Button variant="ghost" size="xs" onClick={() => void ctx.copy(thread.ask, "the prompt")} style={{ color: skin.dim }}>
            <Copy className="size-3" /> copy
          </Button>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]" style={{ color: skin.dim }}>
          {/* No clock: the chain says what came after what, and the first box
              says where it began. */}
          <span>{thread.mode}</span>
          {thread.model ? <span className="truncate">{thread.model}</span> : null}
          {live ? <span style={{ color: skin.lit }}>the board stands on this</span> : null}
          {loopHere ? <span style={{ color: skin.lit }}><Repeat className="mr-1 inline size-3" />in the loop you opened</span> : null}
          <span className="flex-1" />
          <span>the answer and what changed are on the card above, growing out of the box</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 p-3 lg:flex-row">
        {/* What it came to, in one line each. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Row skin={skin} kind={element ? "ember" : "verdant"} seed={`${thread.id}-changed`} icon={<Wand2 className="size-3.5" />} title={`What it changed${changed.length ? ` · ${changed.length}` : ""}`}>
            {changed.length ? (
              <ul className="space-y-0.5 font-mono text-[10.5px]">{changed.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}</ul>
            ) : thread.changes.length ? (
              <ul className="space-y-0.5 text-[11px]">{thread.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            ) : (
              <p className="text-[11px]" style={{ color: skin.dim }}>nothing on the board changed with this one</p>
            )}
          </Row>
          <Row skin={skin} kind={element ? "ember" : "verdant"} seed={`${thread.id}-findings`} icon={<ListChecks className="size-3.5" />} title={`Findings${findings.length ? ` · ${findings.length}` : ""}`}>
            {findings.length ? (
              <ul className="space-y-1.5">
                {findings.map((f) => (
                  <li key={f.id} className="rounded-md border p-2" style={{ borderColor: skin.rim, background: skin.raised }}>
                    <p className="text-[11px]" style={{ color: skin.text }}>{f.target.label}: {f.text}</p>
                    {f.prompt ? (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-[10px] italic" style={{ color: skin.dim }}>{f.prompt}</p>
                        <Button variant="outline" size="xs" disabled={f.applied} onClick={() => useStudio.getState().applyRevision(f.id)}>{f.applied ? "taken" : "take it"}</Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px]" style={{ color: skin.dim }}>no findings came out of this one</p>
            )}
          </Row>
          {children.length ? (
            <Row skin={skin} kind={element ? "ember" : "verdant"} seed={`${thread.id}-next`} icon={<ArrowRight className="size-3.5" />} title={`What came next · ${children.length}`}>
              <ul className="flex flex-wrap gap-1.5">
                {children.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="tactile rounded-md border px-2 py-1 text-[11px]"
                      style={{ borderColor: skin.rim, background: skin.raised, color: skin.text }}
                      onClick={() => { play("select"); useStudio.getState().openThread(c.id); }}
                    >
                      {headlineOf(c)}
                    </button>
                  </li>
                ))}
              </ul>
            </Row>
          ) : null}
        </div>

        {/* What to do with it. */}
        <aside className="flex w-full shrink-0 flex-col gap-1 lg:w-72">
          <p className="px-1 text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>turn this into</p>
          <Convert skin={skin} label="Take every finding" icon={<Check className="size-3.5" />} blurb={`${findings.filter((f) => !f.applied).length} prompts to write onto their parts`} disabled={!findings.some((f) => !f.applied)}
            onClick={() => { play("confirm"); for (const f of findings) if (!f.applied) useStudio.getState().applyRevision(f.id); }} />
          <Convert skin={skin} label={live ? "The board is on this" : "Stand the board on it"} icon={<MapPin className="size-3.5" />} blurb="Put every part back the way this update left it" disabled={live || !thread.doc}
            onClick={() => { play("confirm"); useStudio.getState().standOn(thread.id); }} />
          <Convert skin={skin} label={pinned ? "Unpin it" : "Pin it to the top"} icon={pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />} blurb="Keep it in view while the next ask is written"
            onClick={() => { play(pinned ? "close" : "confirm"); useStudio.getState().togglePinnedThread(thread.id); }} />
          <Convert skin={skin} label="Copy what came back" icon={<Copy className="size-3.5" />} blurb={`${thread.answer.length} characters, as it was written`}
            onClick={() => void ctx.copy(thread.answer, "the answer")} />
          {/*
            Change the thing this iteration made, rather than making another.
            
            Going back to a drawing and drawing again produced a second part,
            because nothing said which part on the board the iteration was
            about. It does now (`madeId`), so these two go straight to that
            part — the drawing board opens on it, and what comes back
            reshapes it. The board is put back the way this iteration left it
            first, so what is drawn on is what was drawn before.
          */}
          {made ? (
            <>
              <Convert skin={skin} label="Draw more on it" icon={<Brush className="size-3.5" />} blurb={`Change ${madeLabel} itself, not a new one`}
                onClick={() => { play("confirm"); changeMade("draw"); }} />
              <Convert skin={skin} label="Write more about it" icon={<MessageSquare className="size-3.5" />} blurb={`Add to what ${madeLabel} is meant to be`}
                onClick={() => { play("confirm"); changeMade("write"); }} />
            </>
          ) : null}
          <Convert skin={skin} label="Ask the next thing" icon={<Sparkles className="size-3.5" />} blurb="The book, with this update live under it"
            onClick={() => { play("confirm"); useStudio.getState().standOn(thread.id); window.dispatchEvent(new CustomEvent("studio:book")); }} />
          {usage ? (
            <p className="px-1 pt-1 text-[9px]" style={{ color: skin.dim }}>{usage}</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export type Skin = typeof FIELD;

/** One band of the section, in the timeline's own colours. */
export function Row({ skin, icon, title, kind = "verdant", seed = "row", children }: {
  skin: Skin;
  icon: React.ReactNode;
  title: string;
  /** Green under an iteration, red under a drawing: the same rule as above. */
  kind?: MoltenKind;
  /** Its own offset into the shared drift, so a column of them is not one sheet. */
  seed?: string;
  children: React.ReactNode;
}) {
  return (
    /*
     * The same matter the boards are made of.
     *
     * These were flat panels with a border, under a timeline made of light,
     * which is two materials on one screen. They are constructs now: the
     * colour varies across each one the way a plate of the stuff does — dark
     * through to lit, some of it glowing and some of it falling away — and
     * none of it repeats, because it is clouds over a lit ground rather than
     * a pattern stamped into a surface.
     */
    <section
      className={cn(moltenClass(kind), "rounded-lg p-2.5")}
      style={{ ...moltenSeed(seed), boxShadow: `0 2px 10px oklch(0 0 0 / 0.35)` }}
    >
      <span data-molten="" />
      <p className="mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>
        {icon} {title}
      </p>
      {children}
    </section>
  );
}

function Convert({ skin, label, icon, blurb, onClick, disabled }: { skin: Skin; label: string; icon: React.ReactNode; blurb: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="tactile flex w-full flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-[border-color,background] disabled:opacity-45"
      style={{ borderColor: skin.rim, background: skin.raised, color: skin.text }}
    >
      <span className="flex items-center gap-1.5 text-[11px]">{icon}{label}</span>
      <span className="text-[10px] leading-snug" style={{ color: skin.dim }}>{blurb}</span>
    </button>
  );
}

/**
 * The side panel's face of the timeline: the card you clicked, and only it.
 *
 * The panel used to leave when the timeline opened, which took away the one
 * place a person reads what went into a thing. It stays now, and in the
 * timeline it is this: the open card's own Input, its own Output, its
 * drawing when it has one, and what it cost — that card's, not the goes
 * before it and not the one being worked in. Click another card and this
 * is that one instead.
 */
export function TimelinePanel() {
  const openId = useStudio((s) => s.openThreadId);
  const threads = useStudio((s) => s.threads);
  const open = threads.find((t) => t.id === openId) ?? null;
  const ctx = useActions();
  if (!open) {
    return (
      <div data-timeline-panel="" data-timeline-panel-empty="" className="p-3">
        <p className="text-[11px] leading-relaxed" style={{ color: FIELD.dim }}>
          Click a card on the timeline to read exactly what went into it and what came out.
        </p>
      </div>
    );
  }
  const element = open.mode === "drawing";
  const skin = element ? PURPLE : FIELD;
  const u = open.usage;
  const bill = u ? sayBill({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0, claude: u.claude, renderer: u.renderer }) : "";
  const Block = ({ head, text, what }: { head: "Input" | "Output"; text: string; what: string }) => (
    <section data-panel-block={head.toLowerCase()} className="border-b px-3 py-2.5" style={{ borderColor: skin.rim }}>
      <div className="mb-1 flex items-center">
        <span className="text-[9px] font-medium uppercase tracking-[0.18em]" style={{ color: skin.dim }}>{head}</span>
        <span className="flex-1" />
        <Button variant="ghost" size="xs" onClick={() => void ctx.copy(text, what)} style={{ color: skin.dim }}>
          <Copy className="size-3" />
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-[12px] leading-snug" style={{ color: skin.text }}>
        {text || `nothing ${head === "Input" ? "was typed with this one" : "came back"}`}
      </p>
    </section>
  );
  return (
    <div data-timeline-panel="" data-timeline-panel-of={open.id} className="flex min-h-0 flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: skin.rim, background: skin.raised }}>
        <p className="line-clamp-2 text-[12px] font-medium leading-snug" style={{ color: skin.text }}>{threadTitle(open)}</p>
        <p className="mt-0.5 text-[10px]" style={{ color: skin.dim }}>{open.mode}</p>
      </div>
      {open.sketch?.strokes?.length ? (
        <div className="flex items-center justify-center border-b py-2" style={{ borderColor: skin.rim }}>
          <Drawn sketch={open.sketch} size={72} tone={skin.lit} />
        </div>
      ) : null}
      <Block head="Input" text={open.ask} what="the prompt" />
      <Block head="Output" text={open.answer} what="the answer" />
      {bill ? (
        <p className="num px-3 py-2 text-[10px]" style={{ color: skin.dim }}>{bill}</p>
      ) : null}
    </div>
  );
}

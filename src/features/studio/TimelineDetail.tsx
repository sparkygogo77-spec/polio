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
import { ArrowRight, BookOpen, Brush, Check, Copy, Flag, ListChecks, MapPin, MessageSquare, Pin, PinOff, Repeat, Sparkles, Terminal, Wand2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { useActions } from "@/core/actions";
import { IterationBook } from "./BriefDialog";
import { headlineOf, Drawn, Made } from "./Timeline";
import { diffDocs, threadTitle, type Thread } from "./threads";
import { sayBill } from "./spend";
import { money, RENDER_COST } from "./renderer";
import { useStudio, type StudioNode } from "./store";
import { AuditPanel, AuditReadout } from "./AuditPanel";
import { Backend } from "./Backend";
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
/*
 * `dim` is the second voice, and it was dim in the wrong sense.
 *
 * At 0.7 lightness it measured 4.4:1 through the middle of a construct's
 * face and 3.6:1 at its worst pixel — under the bar for text that size
 * everywhere, and under it on the flat panel too, where the same colour does
 * the same job against a face of 0.175. So it goes up and its chroma comes
 * down a little: it stays the quieter voice by being less coloured and
 * smaller than `text`, not by being harder to read. Measured on the boxes,
 * the worst pixel of a title goes 3.58 to 6.4.
 */
export const FIELD = {
  face: "oklch(0.175 0.042 152)",
  raised: "oklch(0.23 0.066 152)",
  rim: "oklch(0.36 0.091 152)",
  lit: "oklch(0.66 0.17 152)",
  text: "oklch(0.93 0.053 152)",
  dim: "oklch(0.86 0.07 152)",
};

/** A drawing's section wears the red its own board does. */
const PURPLE = {
  face: "oklch(0.19 0.053 18)",
  raised: "oklch(0.26 0.091 18)",
  rim: "oklch(0.42 0.131 18)",
  lit: "oklch(0.76 0.17 18)",
  text: "oklch(0.94 0.053 18)",
  dim: "oklch(0.88 0.08 18)",
};

/**
 * Which of the band's tabs is up, for the one thing outside it that needs
 * to know: how tall the band should be.
 *
 * Two of the three are a page of text and fit the strip. The backend is a
 * surface you work at — a transcript, a system box, an effort row and a
 * prompt — and in a 248px strip the transcript came out 80px tall with the
 * prompt box and the Send key below the fold entirely, at y 1087 and 1106
 * in a 1000px window. A working surface you have to scroll to type into is
 * not one, so the band grows for it and shrinks back after.
 */
let onTab: Tabs = "iteration";
const tabWatchers = new Set<() => void>();
type Tabs = "iteration" | "book" | "backend";
function setOnTab(t: Tabs) {
  onTab = t;
  tabWatchers.forEach((w) => w());
}
export function useDetailTab(): Tabs {
  return React.useSyncExternalStore(
    (w) => { tabWatchers.add(w); return () => { tabWatchers.delete(w); }; },
    () => onTab,
    () => "iteration" as Tabs,
  );
}

export function TimelineDetail() {
  const [tab, setTabState] = React.useState<Tabs>(onTab);
  const setTab = React.useCallback((t: Tabs) => { setTabState(t); setOnTab(t); }, []);
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

  /*
   * The small green node that used to sit mid-strand is gone, and with it
   * the event it fired: it opened the pair here on the critique step, which
   * pressing either box already does, and J did not know what it was. What
   * a vine carries now is its cut line and nothing else.
   */
  React.useEffect(() => {
    const toBook = () => setTab("book");
    window.addEventListener("studio:book", toBook);
    return () => window.removeEventListener("studio:book", toBook);
  }, []);

  return (
    <section
      data-timeline-detail=""
      /* As tall as the band it stands in: under the backend the band has a
         height of its own, and a section only as tall as its tabs left the
         transcript 61px of a 540px band (`tests/backend-surface.mjs`). In the
         ordinary band, which is as tall as what it holds, this is auto. */
      className="flex h-full w-full flex-col border-t"
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
        {/* The third: the backend as somewhere you work, rather than seven
            fixed modes behind a button in a dialog that closes over the
            board. See `Backend.tsx` for what was missing and what is not. */}
        <Tab on={tab === "backend"} onClick={() => { play("select"); setTab("backend"); }} icon={<Terminal className="size-3.5" />}>
          The backend
        </Tab>
        <span className="flex-1" />
        {open ? (
          <span className="truncate pr-1 text-small" style={{ color: FIELD.dim }}>
            {threadTitle(open)}
          </span>
        ) : null}
      </div>

      {/*
        NO SCROLLER IN HERE.

        HIS WORDS: "just make it so the contents are always full size and show
        fully and scrolling down i can go down and see them without a scroll
        bar bothering the side of the screen, away from the timeline, and
        scrolling back up the timeline comes back into full view as it is
        currently."

        This was a fixed-height band with `overflow-y-auto` inside it, which
        is the small box he had to scroll for every point, with its bar down
        the edge of the screen. The contents stand at their full height now
        and the band is as tall as they are; the one wheel that already runs
        from the board into the categories carries on from the timeline into
        them, and back up brings the timeline whole again because nothing
        under it ever took the wheel.

        The backend is the exception and keeps a surface of its own: it is a
        live transcript rather than a page of text, and standing it at full
        height would put the prompt box a screen away from the thread.
      */}
      {tab === "backend" ? (
        <div className="min-h-0 flex-1">
          <Backend />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          {tab === "book" ? (
            // Unchanged, and in its own tab: same fields, same screen face,
            // same words. Only where it lives has moved.
            <IterationBook />
          ) : open ? (
            <Iteration thread={open} />
          ) : (
            <p className="p-6 text-center text-large" style={{ color: FIELD.dim }}>
              Click an iteration above to read it here, the prompt, what came back, what it changed, and what it led to. Press "this iteration" on a box to work in it, and this follows it.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Tab({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="tactile flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-plain"
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

function Iteration({ thread }: { thread: Thread }) {
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
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-small uppercase tracking-[0.14em]"
            style={{ borderColor: skin.rim, background: skin.raised, color: skin.dim }}>
            {element ? <Brush className="size-3.5" /> : <MessageSquare className="size-3.5" />}
            {element ? "element prompt" : "the prompt"}
          </span>
          {/* The flag again, where the prompt is written, so the two are
              never out of step with one another. */}
          {current ? (
            <span data-working-here="" className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-small uppercase tracking-[0.14em]"
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
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-small" style={{ color: skin.dim }}>
          {/* No clock: the chain says what came after what, and the first box
              says where it began. */}
          <span>{thread.mode}</span>
          {thread.model ? <span className="truncate">{thread.model}</span> : null}
          {live ? <span style={{ color: skin.lit }}>the board stands on this</span> : null}
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
              <ul className="space-y-0.5 text-plain">{thread.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            ) : (
              <p className="text-plain" style={{ color: skin.dim }}>nothing on the board changed with this one</p>
            )}
          </Row>
          <Row skin={skin} kind={element ? "ember" : "verdant"} seed={`${thread.id}-findings`} icon={<ListChecks className="size-3.5" />} title={`Findings${findings.length ? ` · ${findings.length}` : ""}`}>
            {findings.length ? (
              <ul className="space-y-1.5">
                {findings.map((f) => (
                  <li key={f.id} className="rounded-md border p-2" style={{ borderColor: skin.rim, background: skin.raised }}>
                    <p className="text-plain" style={{ color: skin.text }}>{f.target.label}: {f.text}</p>
                    {f.prompt ? (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-small italic" style={{ color: skin.dim }}>{f.prompt}</p>
                        <Button variant="outline" size="xs" disabled={f.applied} onClick={() => useStudio.getState().applyRevision(f.id)}>{f.applied ? "taken" : "take it"}</Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-plain" style={{ color: skin.dim }}>no findings came out of this one</p>
            )}
          </Row>
          {children.length ? (
            <Row skin={skin} kind={element ? "ember" : "verdant"} seed={`${thread.id}-next`} icon={<ArrowRight className="size-3.5" />} title={`What came next · ${children.length}`}>
              <ul className="flex flex-wrap gap-1.5">
                {children.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="tactile rounded-md border px-2 py-1 text-plain"
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
          <p className="px-1 text-fine uppercase tracking-[0.16em]" style={{ color: skin.dim }}>turn this into</p>
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
            <p className="px-1 pt-1 text-fine" style={{ color: skin.dim }}>{usage}</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export type Skin = typeof FIELD;

/** One band of the section, in the timeline's own colours. */
export function Row({ skin, icon, title, kind = "verdant", seed, at, children }: {
  skin: Skin;
  icon: React.ReactNode;
  title: string;
  /** Green under an iteration, red under a drawing: the same rule as above. */
  kind?: MoltenKind;
  /*
   * Its own share of the drift, and it is required now.
   *
   * It defaulted to the string "row", which meant every caller that did not
   * think about it got the *same* share — and the panel that did that had
   * two neighbours measuring 0.99 correlation between their motion, which is
   * not "alike", it is the same animation on two boxes. A default that makes
   * a column of constructs one sheet is worse than a compile error.
   */
  seed: string;
  /** Where in the list it sits, so consecutive boxes are guaranteed to run
      opposite ways rather than merely likely to. */
  at?: number;
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
      style={{ ...moltenSeed(seed, at), boxShadow: `0 2px 10px oklch(0 0 0 / 0.35)` }}
    >
      <span data-molten="" />
      {/* Slightly more of it, as asked: half a pixel bigger and a weight up,
          which is as far as a label over a headline can go before it starts
          competing with the thing it labels. */}
      <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.16em]" style={{ color: skin.dim }}>
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
      <span className="flex items-center gap-1.5 text-plain">{icon}{label}</span>
      <span className="text-small leading-snug" style={{ color: skin.dim }}>{blurb}</span>
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
/**
 * One of his three lines, as a block.
 *
 * Numbered on screen because he asked for one place to complete step 1 2 and
 * 3, and a step with no number is a section: the count is the thing that says
 * this is a route through, not a list of panels.
 */
function Step({ mark, n, says, skin, children }: { mark: "say" | "make" | "take"; n: number; says: string; skin: Skin; children: React.ReactNode }) {
  return (
    <section data-panel-block={mark} className="border-b px-3 py-2.5" style={{ borderColor: skin.rim }}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="num grid size-4 shrink-0 place-items-center rounded-full text-fine font-semibold"
          style={{ background: skin.lit, color: skin.face }}
        >
          {n}
        </span>
        <span className="text-fine font-medium uppercase tracking-[0.18em]" style={{ color: skin.dim }}>{says}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * What the next run will cost, said before the press.
 *
 * A real number when the part's own plan names models that charge by the
 * press; otherwise the honest answer, which is that nothing here spends until
 * a model that charges is chosen.
 */
function priceAhead(made: StudioNode | null): string {
  const steps = made?.plan?.steps?.length ?? 0;
  if (!steps) return "Nothing is spent until you pick something that charges.";
  return `About ${money(RENDER_COST.raster * steps)} on your own key, for ${steps} pass${steps === 1 ? "" : "es"}.`;
}

export function TimelinePanel() {
  const openId = useStudio((s) => s.openThreadId);
  const threads = useStudio((s) => s.threads);
  const nodes = useStudio((s) => s.nodes);
  const open = threads.find((t) => t.id === openId) ?? null;
  const ctx = useActions();
  if (!open) {
    return (
      <div data-timeline-panel="" data-timeline-panel-empty="" className="p-3">
        <p className="text-plain leading-relaxed" style={{ color: FIELD.dim }}>
          Click a card on the timeline to read exactly what went into it and what came out.
        </p>
      </div>
    );
  }
  const element = open.mode === "drawing";
  const skin = element ? PURPLE : FIELD;
  /* The part this update made, if it made one and it is still on the board. */
  const made = open.madeId ? (nodes.find((n) => n.id === open.madeId) ?? null) : null;
  const u = open.usage;
  const bill = u ? sayBill({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0, claude: u.claude, renderer: u.renderer }) : "";
  return (
    <div data-timeline-panel="" data-timeline-panel-of={open.id} className="flex min-h-0 flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: skin.rim, background: skin.raised }}>
        <p className="line-clamp-2 text-large font-medium leading-snug" style={{ color: skin.text }}>{threadTitle(open)}</p>
        <p className="mt-0.5 text-small" style={{ color: skin.dim }}>{open.mode}</p>
      </div>

      {/*
        HIS THREE LINES, READ BACK TO HIM AND APPROVED, IN HIS OWN WORDS:

          say what this thing should be, and show me the drawing if i drew one
          pick what makes it, and tell me what it costs before i press anything
          press make, and when it comes back put it on the page

        And nothing else in here. What went: a second copy of the route
        choice, which used to live both here and under the timeline writing
        the same setting, so the same question was asked twice on one screen;
        the bill line, because what a thing cost after the fact is not what he
        needs when he is deciding whether to press; and the book, which is
        about the whole site rather than this one thing.
      */}

      {/* ONE. Say what this thing should be. */}
      <Step mark="say" n={1} says="Say what this should be" skin={skin}>
        {open.sketch?.strokes?.length ? (
          <span className="mb-1.5 flex items-center justify-center"><Drawn sketch={open.sketch} size={72} tone={skin.lit} /></span>
        ) : null}
        <p className="whitespace-pre-wrap text-large leading-snug" style={{ color: skin.text }}>
          {open.ask || "nothing was typed with this one"}
        </p>
      </Step>

      {/* TWO. Pick what makes it, and what that costs, before anything is pressed. */}
      <Step mark="make" n={2} says="Pick what makes it" skin={skin}>
        {made ? (
          <AuditPanel node={made} />
        ) : (
          <AuditReadout
            subject={element ? "this drawing" : "an update like this"}
            planned={{ label: threadTitle(open), prompt: open.ask, featureId: "custom-idea", w: 600, h: 320, role: null, outline: null, content: "" }}
          />
        )}
        {/*
          The price BEFORE the press, which is his rule and the money rule
          both: it is his credit, so what a run will cost is on screen while
          he is deciding, not after it is spent.
        */}
        <p data-panel-price="" className="num mt-1.5 text-small" style={{ color: skin.dim }}>
          {priceAhead(made)}
        </p>
      </Step>

      {/* THREE. Press make, and put what came back on the page. */}
      <Step mark="take" n={3} says="Make it, and put it on the page" skin={skin}>
        <div className="flex items-center gap-1.5">
          <Button
            data-panel-make=""
            variant="primary"
            size="sm"
            onClick={(e) => {
              play("confirm");
              /* Opened where the button is, so the wheel arrives under his
                 hand rather than in a corner. */
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (made) drawOnPart(made.id, r.left + r.width / 2, r.top);
            }}
            disabled={!made}
          >
            <Sparkles className="size-3" />
            Make it
          </Button>
          {made ? (
            <Button
              data-panel-take=""
              variant="subtle"
              size="sm"
              onClick={() => { play("select"); useStudio.getState().setSelection([made.id]); useStudio.getState().setMode("design"); }}
            >
              <ArrowRight className="size-3" />
              Put it on the page
            </Button>
          ) : null}
        </div>
        {open.answer ? (
          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-plain leading-snug" style={{ color: skin.dim }}>{open.answer}</p>
        ) : null}
      </Step>
    </div>
  );
}

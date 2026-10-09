"use client";
import { uid } from "@/core/lib/ids";
import { takeDoc } from "../../docTake";
import { formatDefaults } from "../../format";
import { defaultRoll, emptyLook } from "../../look";
import { buildStarter, isStarter } from "../../starterPage";
import { liveAfterPrune, pruneThread as cutThread, THREAD_LIMIT, type ThreadDoc } from "../../loop";
import { QUEUED } from "../../formation";
import { trimQueue } from "../../loop";
import { GetStudio, SetStudio, TRAIL_LIMIT, docPatch, promptOf, reformed, resolveTarget, snapshot, starterDoc } from "./history";
import { StudioNode } from "./model";
import type { StudioState } from "./state";

/** The threads actions of the studio store; spread into `useStudio` by create.ts. */
export function threadsActions(set: SetStudio, get: GetStudio, push: () => void, pushEdit: (key: string) => void): Pick<StudioState, "setBrief" | "recordAsk" | "noteSpend" | "noteProgress" | "notePass" | "markThread" | "noteMade" | "setCurrentThread" | "landThread" | "pruneThread" | "moveThread" | "toggleDraftPiece" | "clearDraft" | "recordSent" | "resetThreadSpots" | "togglePinnedThread" | "setBookPinned" | "openThread" | "enqueueDraw" | "updateJob" | "answerJob" | "clearFinishedJobs" | "noteThread" | "standOn" | "applyRevision" | "clearPage" | "resetAll" | "applyTheme" | "loadDoc"> {
  void pushEdit;
  return {
    setBrief: (patch) => {
      push();
      set((s) => ({ brief: { ...s.brief, ...patch } }));
    },

    recordAsk: ({ mode, model, revisions }) => {
      if (!revisions.length) return;
      set((s) => {
        const now = Date.now();
        const entries = [...s.trail];
        for (const r of revisions) {
          const target = resolveTarget(s, r.target);
          const text = promptOf(s, target);
          // The prompt as it stood when it was sent, kept once; a later ask
          // on the same unchanged words joins the same account.
          let author = [...entries].reverse().find((e) => e.stage !== "critique" && e.target.kind === target.kind && e.target.id === target.id && e.text === text);
          if (!author) {
            author = { id: uid("t"), at: now, stage: "author", target, text, parentId: null };
            entries.push(author);
          }
          entries.push({
            id: uid("t"), at: now, stage: "critique", target, text: r.finding.trim(), prompt: r.prompt.trim(),
            kind: r.kind, mode, model, parentId: author.id, applied: false, threadId: s.liveThreadId ?? undefined,
          });
        }
        return { trail: entries.slice(-TRAIL_LIMIT) };
      });
    },

    noteSpend: (spend, on) =>
      set((s) => {
        // Named when it was fired, not when it came back: a second pass
        // that takes ten seconds must charge the iteration that asked
        // for it, not whichever one is live when it lands.
        const id = on ?? s.liveThreadId;
        if (!id) return {};
        if (!spend.dollars && !spend.ms && !spend.calls) return {};
        return {
          threads: s.threads.map((t) => {
            if (t.id !== id) return t;
            const had = t.usage;
            // Kept to the tenth of a cent, not the cent: a four-tenths
            // call rounded to two places reads as free and is not.
            const money = (a = 0, b = 0) => Math.round((a + b) * 10000) / 10000;
            const claude = money(had?.claude, spend.claude);
            const renderer = money(had?.renderer, spend.renderer);
            return {
              ...t,
              form: reformed(t),
              usage: {
                sent: 0,
                skipped: 0,
                ...(had ?? {}),
                cost: money(had?.cost, spend.dollars),
                ms: (had?.ms ?? 0) + spend.ms,
                calls: (had?.calls ?? 0) + spend.calls,
                ...(claude ? { claude } : {}),
                ...(renderer ? { renderer } : {}),
              },
            };
          }),
        };
      }),
    noteProgress: (threadId, p) =>
      set((s) => {
        if (!threadId || p === null) return {};
        return {
          threads: s.threads.map((t) => {
            if (t.id !== threadId) return t;
            const had = t.form ?? { p: t.state === "running" ? 0.15 : 1, gen: 0 };
            // Only ever climbs: a later step that maps lower is a step the
            // work took after a higher one, not the work going backwards.
            const next = Math.max(had.p, Math.min(1, p));
            return next === had.p ? t : { ...t, form: { ...had, p: next } };
          }),
        };
      }),

    notePass: (line, on) =>
      set((s) => {
        // Named when the pass was fired, not when it answered: a second
        // pass that takes ten seconds belongs to the iteration that
        // asked for it.
        const id = on ?? s.liveThreadId;
        const said = line.trim();
        if (!id || !said) return {};
        return {
          threads: s.threads.map((t) => {
            if (t.id !== id) return t;
            const had = t.usage?.passes ?? [];
            if (had.includes(said)) return t;
            return { ...t, usage: { sent: 0, skipped: 0, ...(t.usage ?? {}), passes: [...had, said] }, form: reformed(t) };
          }),
        };
      }),

    markThread: (id, state) =>
      set((s) => ({
        threads: s.threads.map((t) => {
          if (t.id !== id) return t;
          // Landed: it has finished forming, whatever step it was on.
          const form = state === "done" ? { ...(t.form ?? { p: 0, gen: 0 }), p: 1 } : t.form;
          return { ...t, state, ...(form ? { form } : {}) };
        }),
      })),

    noteMade: (threadId, madeId) =>
      set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, madeId } : t)) })),

    setCurrentThread: (id) =>
      set((s) => (s.threads.some((t) => t.id === id) || id === null ? { currentThreadId: id, openThreadId: id } : {})),

    landThread: ({ mode, model, ask, answer, changes, sketch, state, madeId, id: fill }) => {
      /*
       * Filling one in rather than making a second.
       *
       * A drawing's iteration is landed the moment it is queued, so that
       * the box exists while the work happens rather than after it. When
       * the work comes back it fills that one in — keeping when it began,
       * what it hangs off, and how far it has formed — and only a thread
       * with no id of its own is a new one.
       */
      if (fill && get().threads.some((t) => t.id === fill)) {
        set((s) => ({
          threads: s.threads.map((t) => (t.id === fill
            ? {
              ...t,
              mode, model, state: state ?? "done",
              ask: ask.trim(), answer: answer.trim(), changes: changes ?? t.changes,
              ...(sketch ? { sketch } : {}),
              ...(madeId ? { madeId } : {}),
              doc: { ...snapshot(s), taken: undefined } as ThreadDoc,
              form: (state ?? "done") === "done" ? { ...(t.form ?? { p: 0, gen: 1 }), p: 1 } : t.form,
            }
            : t)),
          liveThreadId: fill,
        }));
        return fill;
      }
      const id = uid("th");
      set((s) => ({
        threads: [
          ...s.threads,
          {
            /*
             * It hangs off the one being worked in when there is one,
             * off whatever landed last when there is not, and failing
             * both off the newest thread there is — because there is
             * always something it was founded on unless it is the first
             * thing that ever happened. A thread with no parent is a
             * piece floating loose on the timeline.
             */
            id,
            parentId: s.currentThreadId ?? s.liveThreadId ?? (s.threads.length ? s.threads[s.threads.length - 1]!.id : null),
            at: Date.now(), mode, model, state: state ?? "done",
            // A thread landing still running has been read and is forming
            // from there; one landing done formed as it arrived.
            form: { p: (state ?? "done") === "running" ? 0.15 : 1, gen: 1 },
            ask: ask.trim(), answer: answer.trim(), changes: changes ?? [],
            ...(sketch ? { sketch } : {}),
            ...(madeId ? { madeId } : {}),
            doc: { ...snapshot(s), taken: undefined } as ThreadDoc,
            // What was vined to the call is what the thread was about.
            pieces: [...s.draftPieces],
          },
        ].slice(-THREAD_LIMIT),
        liveThreadId: id,
      }));
      /*
       * Dropping the oldest threads orphans whoever hung off them, so
       * the survivors are re-hung on the oldest thread that is left
       * rather than pointing at something that is gone.
       */
      set((s) => {
        const here = new Set(s.threads.map((t) => t.id));
        const eldest = s.threads[0]?.id ?? null;
        if (s.threads.every((t) => !t.parentId || here.has(t.parentId))) return {};
        return {
          threads: s.threads.map((t, i) =>
            t.parentId && !here.has(t.parentId) ? { ...t, parentId: i > 0 ? eldest : null } : t,
          ),
        };
      });
      return id;
    },

    /**
     * Cut one thread. Its children re-hang from its parent — they
     * happened, and removing the step underneath them does not unhappen
     * them — and the board goes back to whatever is live after the cut.
     */
    pruneThread: (id) => {
      const s = get();
      if (!s.threads.some((t) => t.id === id)) return;
      const threads = cutThread(s.threads, id);
      const live = liveAfterPrune(s.threads, id, s.liveThreadId);
      const stand = threads.find((t) => t.id === live);
      push();
      const spots = { ...s.threadSpots };
      delete spots[id];
      set(() => ({
        threads,
        liveThreadId: live,
        pinnedThreads: s.pinnedThreads.filter((x) => x !== id),
        openThreadId: s.openThreadId === id ? null : s.openThreadId,
        currentThreadId: s.currentThreadId === id ? null : s.currentThreadId,
        threadSpots: spots,
        trail: s.trail.filter((e) => e.threadId !== id),
        ...docPatch(stand?.doc),
        selection: [],
      }));
    },

    moveThread: (id, x, y) => set((s) => ({ threadSpots: { ...s.threadSpots, [id]: { x: Math.round(x), y: Math.round(y) } } })),

    toggleDraftPiece: (id) =>
      set((s) => ({ draftPieces: s.draftPieces.includes(id) ? s.draftPieces.filter((x) => x !== id) : [...s.draftPieces, id] })),

    clearDraft: () => set({ draftPieces: [] }),

    recordSent: (threadId, sent, usage) =>
      set((s) => ({
        sentPieces: { ...s.sentPieces, ...sent },
        // Merged, not replaced: the money and the wait were already
        // noted against this thread and a call that also sent pieces
        // must not wipe its own bill.
        threads: s.threads.map((t) => (t.id === threadId ? { ...t, usage: { ...(t.usage ?? {}), ...usage } } : t)),
      })),

    resetThreadSpots: () => set({ threadSpots: {} }),

    togglePinnedThread: (id) =>
      set((s) => ({
        pinnedThreads: s.pinnedThreads.includes(id) ? s.pinnedThreads.filter((x) => x !== id) : [...s.pinnedThreads, id],
      })),

    setBookPinned: (v) => set({ bookPinned: v }),

    openThread: (id) => set({ openThreadId: id }),

    enqueueDraw: (job) => {
      const id = uid("job");
      /*
       * The iteration begins here, not when the read comes back.
       *
       * A box lands on the timeline at the press of Make real, running
       * and formed from nothing, and the job carries its id so every
       * step of the work climbs *this* box. It reaches complete when the
       * job does. Before this the thread was made when Claude answered,
       * which is why a box appeared already finished and then played its
       * formation afterwards.
       */
      const threadId = get().landThread({
        mode: "drawing",
        state: "running",
        ask: job.sketch.words.trim(),
        answer: "",
        changes: [],
        sketch: { strokes: job.sketch.strokes as [number, number][][], words: job.sketch.words },
        ...(job.nodeId ? { madeId: job.nodeId } : {}),
      });
      // Queued is the very start of the vine: begun, and nothing more.
      set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, form: { p: QUEUED, gen: 1 } } : t)) }));
      set((s) => ({ queue: trimQueue([...s.queue, { ...job, id, threadId, status: "waiting" as const, queued: Date.now() }]) }));
      return id;
    },

    updateJob: (id, patch) => set((s) => ({ queue: s.queue.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),

    answerJob: (id, answer) =>
      set((s) => ({
        queue: s.queue.map((j) => (j.id === id && j.question ? { ...j, status: "waiting" as const, question: { ...j.question, answer } } : j)),
      })),

    clearFinishedJobs: () => set((s) => ({ queue: s.queue.filter((j) => j.status === "waiting" || j.status === "running") })),

    noteThread: (lines, on) =>
      set((s) => {
        const id = on ?? s.liveThreadId;
        const add = lines.map((l) => l.trim()).filter(Boolean);
        if (!id || !add.length) return {};
        return {
          threads: s.threads.map((t) =>
            t.id === id ? { ...t, changes: [...t.changes, ...add.filter((l) => !t.changes.includes(l))], form: reformed(t) } : t,
          ),
        };
      }),

    standOn: (id) => {
      const s = get();
      const t = s.threads.find((x) => x.id === id);
      if (!t?.doc) return;
      push();
      set({ ...docPatch(t.doc), liveThreadId: id, selection: [] });
    },

    applyRevision: (entryId) => {
      const s = get();
      const e = s.trail.find((x) => x.id === entryId);
      if (!e || e.stage !== "critique" || !e.prompt || e.applied) return;
      const t = e.target;
      const prompt = e.prompt;
      push();
      set((st) => {
        const patch: Partial<StudioState> =
          t.kind === "site" ? { brief: { ...st.brief, master: prompt } }
          : t.kind === "page" ? { pages: st.pages.map((p) => (p.id === t.id ? { ...p, prompt } : p)) }
          : t.kind === "node" ? { nodes: st.nodes.map((n) => (n.id === t.id ? { ...n, prompt } : n)) }
          : t.kind === "group" ? { groups: st.groups.map((g) => (g.id === t.id ? { ...g, prompt } : g)) }
          : {};
        return {
          ...patch,
          trail: [
            ...st.trail.map((x) => (x.id === entryId ? { ...x, applied: true } : x)),
            { id: uid("t"), at: Date.now(), stage: "final" as const, target: t, text: prompt, parentId: entryId },
          ].slice(-TRAIL_LIMIT),
          // Taking a finding is the thread doing something, so the thread
          // says so and keeps the board it produced.
          threads: st.threads.map((x) =>
            x.id === (e.threadId ?? st.liveThreadId)
              ? { ...x, changes: [...x.changes, `took the prompt for ${t.label}`], doc: { ...(x.doc ?? {}), ...patch, nodes: (patch.nodes ?? st.nodes), pages: (patch.pages ?? st.pages), brief: (patch.brief ?? st.brief) } as ThreadDoc }
              : x,
          ),
        };
      });
    },


    clearPage: (pageId) => {
      push();
      set((s) => ({
        nodes: s.nodes.filter((n) => n.pageId !== pageId),
        groups: s.groups.filter((g) => g.pageId !== pageId),
        shapes: s.shapes.filter((sh) => sh.pageId !== pageId),
        spaces: s.spaces.filter((sp) => sp.pageId !== pageId),
        selection: [],
      }));
    },

    resetAll: () => {
      push();
      set({ ...starterDoc(), activePageId: "page_home", selection: [], trail: [], threads: [], liveThreadId: null, pinnedThreads: [], threadSpots: {}, draftPieces: [], sentPieces: {} });
    },

    applyTheme: (theme, opts = {}) => {
      push();
      set((s) => {
        const pageId = s.activePageId;
        const fresh = !!opts.fresh || !s.look.theme;
        const prev = s.nodes.filter((n) => n.pageId === pageId && isStarter(n.id));
        // What the last theme built and the page no longer has, he deleted: it stays deleted.
        const here = new Set(prev.map((n) => n.id));
        const before = !fresh && s.look.theme ? buildStarter(s.look.theme, { pageId, frameWidth: s.frameWidth, siteName: opts.siteName ?? s.brief.name }).nodes.map((n) => n.id) : [];
        const built = buildStarter(theme, {
          pageId, frameWidth: s.frameWidth, siteName: opts.siteName ?? s.brief.name,
          tryThese: opts.tryThese ?? [],
          prev: fresh ? null : prev.filter((n) => !n.id.startsWith("st_try")),
          deleted: new Set(before.filter((id) => !here.has(id) && !id.startsWith("st_try"))),
        });
        // The parts to try are the roll's own: they come and go with it.
        const keep = s.nodes.filter((n) => !(n.pageId === pageId && isStarter(n.id)));
        return {
          nodes: [...keep, ...built.nodes] as unknown as StudioNode[],
          look: { ...s.look, palette: built.palette, theme, themeRoll: { ...defaultRoll(), ...s.look.themeRoll, ...opts.settings } },
          format: { ...s.format, ...built.format },
          selection: [],
        };
      });
    },

    loadDoc: (doc) => {
      push();
      // What the document brings, the width included: see `docTake.ts`.
      /* A new document starts as it opens: states switched on for the last one (a hidden group a pick showed, a preview) would draw its parts over this one's every preview (J, 2026-10-09: the tour over Match after a reimport). */
      set((s) => ({ ...(takeDoc(s, doc, { format: formatDefaults, look: emptyLook }) as unknown as Partial<StudioState>), statesOn: (doc as { statesOn?: string[] }).statesOn ?? [] }));
      /* Every import comes through here: the learned library reads what it brought (`library/useLearned.ts`). */
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("studio:doc-loaded", { detail: { behaviours: (doc as { behaviours?: unknown }).behaviours ?? null } }));
    },

  };
}

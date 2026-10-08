"use client";
import { create } from "zustand";
import { persist, createJSONStorage, type PersistStorage, type StorageValue } from "zustand/middleware";
import { readDoc, writeDoc } from "../../docStore";
import { afterRelease, isHeld } from "./hold";
import { uid } from "@/core/lib/ids";
import { type ThreadDoc } from "../../loop";
import { activeRepo } from "@/features/builds/store";
import { boardActions } from "./board";
import { FRAME_WIDTHS } from "./frame";
import { EDIT_RUN_MS, HISTORY_LIMIT, edited, pen, shelve, snapshot, starterDoc } from "./history";
import { ZOOM_MIN } from "./model";
import { nodesActions } from "./nodes";
import { docOnly, mergeDoc } from "./persist";
import type { StudioState } from "./state";
import { threadsActions } from "./threads";
import { viewActions } from "./view";

/*
 * ONLY A CHANGED DOCUMENT IS WRITTEN.
 *
 * The persister saves on every change of state, and most changes are not to
 * the document: a pan writes `pan` on every pointer move, and `pan` is not
 * saved. Each of those still turned the whole document into text and wrote
 * it to localStorage — for an imported site of 700 parts, 2 MB a move, and
 * the bulk of what made panning lag (`tests/pan-no-save.mjs`). What is saved
 * is `docOnly`, a list of the store's own slices, so a change that touched
 * none of them hands over the same references: compared one by one, and
 * nothing written when every one is the one written last.
 */
/*
 * …AND A PART UNDER THE HAND IS SAVED WHEN IT IS LET GO.
 *
 * A drag or a resize does change the document, on every move, so the check
 * above lets each one through: for a 700-part import, 2 MB written forty
 * times in one short drag, and frames held up to half a second. While the
 * board holds the saves (`hold.ts#holdSaves`, set by the board for the length
 * of a drag), only the latest is kept, and it is written the moment the hand
 * comes up (`tests/drag-saves-once.mjs`).
 */
function keptOnly<S>(inner: PersistStorage<S>): PersistStorage<S> {
  let last: { key: string; version: number | undefined; state: Record<string, unknown> } | null = null;
  let pending: { key: string; value: StorageValue<S> } | null = null;
  const flush = () => { const p = pending; pending = null; if (p && pen.read && !pen.swapping) void write(p.key, p.value); };
  const write = (key: string, value: StorageValue<S>) => {
    const state = value.state as Record<string, unknown>;
    if (last && last.key === key && last.version === value.version && sameSlices(last.state, state)) return;
    last = { key, version: value.version, state };
    return inner.setItem(key, value);
  };
  return {
    getItem: inner.getItem,
    setItem: (key, value) => {
      if (!pen.read || pen.swapping) return;
      if (isHeld()) { pending = { key, value }; afterRelease(flush); return; }
      return write(key, value);
    },
    removeItem: (key) => { last = null; pending = null; return inner.removeItem(key); },
  };
}
function sameSlices(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** How many undo checkpoints have been taken, ever: `oneStepSince` counts from it. */
      let pushes = 0;
      /** Push the pre-mutation document onto the undo stack. */
      /**
       * The first thing anyone does makes iteration one.
       *
       * Nothing seeded the timeline. Threads were landed by an ask coming
       * back and by a drawing being made real, and nothing else, so a
       * person who had spent an hour laying out a board opened the
       * timeline and found it empty — which reads as broken rather than as
       * "nothing has happened yet", because plenty had.
       *
       * The honest fix is not to invent history. It is to mark the
       * beginning: the first real change to the document lands one
       * iteration holding the board as it was before that change, so there
       * is a place to stand and something to hang the next one off. Every
       * iteration after it is what it always was, an ask or a drawing.
       *
       * It hangs off `push`, which is the undo checkpoint every genuine
       * mutation already takes, so "a real action" needs no second
       * definition and no action has to remember to do this.
       */
      const seed = () => {
        const s = get();
        if (s.threads.length) return;
        const parts = s.nodes.length;
        const pages = s.pages.length;
        set((st) => ({
          threads: [{
            id: uid("th"),
            parentId: null,
            at: Date.now(),
            mode: "start",
            ask: "",
            answer: parts
              ? `${parts} part${parts === 1 ? "" : "s"} on ${pages} page${pages === 1 ? "" : "s"}, before the first change`
              : "an empty site",
            /* A green card *is* the site now — the preview as that update left
               it — so the line under it says where the site was, not what the
               board was called. It used to read "the board as you started it"
               beside a silhouette of grey rectangles. */
            changes: ["the site before the first change"],
            doc: { ...snapshot(st), taken: undefined } as ThreadDoc,
            state: "done" as const,
            pieces: [],
          }, ...st.threads],
          liveThreadId: st.liveThreadId,
        }));
      };

      const push = () => {
        seed();
        run = null;
        pushes++;
        edited();
        set((s) => ({
          past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
          future: [],
          /* THE BRANCH OPENS THE MOMENT HE STARTS EDITING. An undo checkpoint
             is an edit by definition, so this is where a site with a
             repository and no open branch takes one. Named by the site and
             the day, so two sites and two days never collide. */
          ...(activeRepo() && !s.siteBranch ? { siteBranch: `edit/${(s.brief?.name || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site"}-${new Date().toISOString().slice(0, 10)}` } : {}),
        }));
      };
      /*
       * One undo takes back an edit, not a letter.
       *
       * Typing writes the document a keystroke at a time, and each write
       * used to push its own undo entry, so taking back a word was eleven
       * presses. A run of writes to the same field within `EDIT_RUN_MS` of
       * each other is one edit: the first write pushes, the rest ride on
       * it, and anything else that pushes (a move, a different field, an
       * undo) ends the run. The snapshot kept is the one from before the
       * first letter, which is what "before this edit" means.
       */
      let run: { key: string; at: number } | null = null;
      const pushEdit = (key: string) => {
        const now = Date.now();
        if (run && run.key === key && now - run.at < EDIT_RUN_MS) { run.at = now; edited(); return; }
        push();
        run = { key, at: now };
      };

      return {
        ...starterDoc(),
        frameWidth: FRAME_WIDTHS.desktop,
        menuShape: "square",
        view: "desktop",
        placingLight: false,
        placedLight: null,
        lightCarry: null,
        menuSpin: 0,
        recentColours: [],
        fitNonce: 0,
        activePageId: "page_home",
        selection: [],
        pickedFace: null,
        handling: null,
        wanted: null,
        queueSeenAt: 0,
        tool: "select",
        inkHue: 265,
        inkWidth: 3,
        drawKind: "part",
        siteBranch: null,
        zoom: 1,
        fitAt: ZOOM_MIN,
        pan: { x: 0, y: 0 },
        showAllFormat: false,
        showWires: true,
        statesOn: [],
        hiddenFeatures: [],
        brought: [],
        broughtParts: [],
        taken: null,
        mode: "design",
        companion: { device: "phone", x: -18, y: -18, open: false },
        trail: [],
        threads: [],
        liveThreadId: null,
        pinnedThreads: [],
        bookPinned: false,
        openThreadId: null,
        currentThreadId: null,
        queue: [],
        threadSpots: {},
        draftPieces: [],
        sentPieces: {},
        past: [],
        future: [],

        ...nodesActions(set, get, push, pushEdit),
        ...boardActions(set, get, push, pushEdit),
        ...viewActions(set, get, push, pushEdit),
        ...threadsActions(set, get, push, pushEdit),

        historyMark: () => pushes,
        oneStepSince: (mark) => {
          /* Every checkpoint taken since `mark` after the first is folded into
             the first: what one undo takes back is the board before it began. */
          const extra = pushes - mark - 1;
          if (extra <= 0) return;
          pushes -= extra;
          set((s) => ({ past: s.past.slice(0, Math.max(0, s.past.length - extra)), future: [] }));
        },

        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return {};
            edited();
            // Whatever was being typed is over: the next letter is a new edit.
            run = null;
            return {
              ...prev,
              past: s.past.slice(0, -1),
              future: [snapshot(s), ...s.future].slice(0, HISTORY_LIMIT),
              selection: [],
              activePageId: prev.pages.some((p) => p.id === s.activePageId) ? s.activePageId : prev.pages[0]!.id,
            };
          }),

        redo: () =>
          set((s) => {
            const next = s.future[0];
            if (!next) return {};
            edited();
            run = null;
            return {
              ...next,
              past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
              future: s.future.slice(1),
              selection: [],
              activePageId: next.pages.some((p) => p.id === s.activePageId) ? s.activePageId : next.pages[0]!.id,
            };
          }),

        travel: (steps) =>
          set((s) => {
            if (!steps || (steps < 0 ? !s.past.length : !s.future.length)) return {};
            run = null;
            edited();
            const doc = snapshot(s);
            if (steps < 0) {
              const n = Math.min(-steps, s.past.length);
              if (!n) return {};
              const to = s.past[s.past.length - n]!;
              /* The documents stepped over go onto redo in order: nearest first. */
              const over = [...s.past.slice(s.past.length - n + 1), doc];
              return {
                ...to,
                past: s.past.slice(0, s.past.length - n),
                future: [...over, ...s.future].slice(0, HISTORY_LIMIT),
                selection: [],
                activePageId: to.pages.some((p) => p.id === s.activePageId) ? s.activePageId : to.pages[0]!.id,
              };
            }
            const n = Math.min(steps, s.future.length);
            if (!n) return {};
            const to = s.future[n - 1]!;
            return {
              ...to,
              past: [...s.past, doc, ...s.future.slice(0, n - 1)].slice(-HISTORY_LIMIT),
              future: s.future.slice(n),
              selection: [],
              activePageId: to.pages.some((p) => p.id === s.activePageId) ? s.activePageId : to.pages[0]!.id,
            };
          }),

        /** Checkpoint the current document — used at the end of a drag. */
        commit: () => push(),
      };
    },
    {
      name: "builder.studio",
      /*
       * Nothing is written until something has been read.
       *
       * `skipHydration` below means the saved document is only fetched when a
       * Builder surface asks for it. What it does not stop is the writing:
       * the middleware subscribes at once, so the FIRST change of state after
       * the store is built — any change, because the whole partialized shape
       * goes out on every one — saves the empty default over whatever was
       * there. And something does change state that early.
       *
       * Measured rather than reasoned about, because it sounds too big to be
       * true: a trace of every `builder.studio` read and write on a load of
       * the Builder, with the stored document seeded to five parts, came back
       *
       *   +343ms  SET nodes=0
       *   +343ms  SET nodes=0
       *   +343ms  get  nodes=0
       *
       * — written twice before it was read once. And the same thing with no
       * test rig at all: set the frame to Tablet on the bar, which is
       * persisted, and reload. 834 before, 1440 after. Nothing a person did
       * in the Builder survived a reload, on any surface, and had not for as
       * long as `skipHydration` has been here.
       *
       * So the store holds the pen until it has read. Every write before
       * hydration is a write of the defaults by definition — there is nothing
       * else in the store yet — so refusing them loses nothing and saves the
       * document.
       */
      /*
       * THE DOCUMENT LIVES IN INDEXEDDB (docStore.ts), with localStorage
       * beside it: a mirror of what fits, a pointer for what does not.
       * share.xyz's three pages are 8.5 MB, past localStorage's quota; the
       * save threw inside the import, which stopped before its pictures
       * were kept. A document already in localStorage is read from there
       * and carried across, so what was on the board before this stays.
       */
      storage: keptOnly(createJSONStorage(() => ({
        getItem: (k) => readDoc(k),
        setItem: (k, v) => { writeDoc(k, v); },
        removeItem: (k) => { writeDoc(k, null); },
      }))!),
      merge: (persisted, current) => mergeDoc(persisted, current as StudioState),
      partialize: docOnly,
      skipHydration: true,
      /*
       * A thread left running is a thread whose process is gone.
       *
       * Nothing survives a reload except the document, so anything still
       * marked running when the store comes back was abandoned: the tab
       * closed, the job died, the run was stopped. Both of those read red,
       * which is what makes one mark enough for two states.
       */
      onRehydrateStorage: () => (state) => {
        /* Read at last, whether or not there was anything there: a first-ever
           visit has nothing saved and must still be allowed to save. */
        pen.read = true;
        if (!state) return;
        /* A saved document may already carry repositories: put their
           elements back on the shelf before anything reads it. A document
           from before this existed has neither, hence the defaults. */
        state.brought ??= [];
        state.broughtParts ??= [];
        shelve(state.brought, state.broughtParts);
        /*
         * WHOSE BOXES ARE THESE, ON A DOCUMENT THAT PREDATES THE QUESTION.
         *
         * Nothing saved before `byHand` carries it, so without this every
         * board that already exists would be treated as the machine's and
         * healed — including one he laid out entirely by hand, where two
         * parts deliberately over each other is a design and not a fault.
         *
         * So the document is asked once whether it came off a page at all. A
         * repository or site brought into it, a part carrying the element it
         * was read from, or a box carrying a layout, a padding, an edge or a
         * way its words are set — those four are written by a capture and by
         * nothing else in the app. No sign of any of it and the board is his:
         * every part is marked and nothing will ever move.
         *
         * A board that DID come off a page heals, and its parts are left
         * unmarked even if he moved some of them before today, because
         * nothing recorded that he did. That is the one place this cannot
         * keep its promise, and it is bounded: the healing only ever moves a
         * part DOWN, to clear what is above it. It cannot put a part back
         * where the capture had it, and from now on every move he makes is
         * marked as his.
         */
        {
          const cameOffAPage = (state.brought?.length ?? 0) > 0
            || (state.nodes ?? []).some((n) => n.from || n.layout || n.pad || n.edge || n.text);
          if (!cameOffAPage) for (const n of state.nodes ?? []) if (n.byHand === undefined) n.byHand = true;
        }
        const stuck = state.threads.some((t) => t.state === "running");
        if (stuck) state.threads = state.threads.map((t) => (t.state === "running" ? { ...t, state: "cut" as const } : t));
      },
    },
  ),
);

/**
 * The document a site with nothing saved has.
 *
 * Taken once, from the store's own initial state, before anything can have
 * hydrated — `skipHydration` is what makes that safe. Deep-copied, so a
 * later edit to the live document can never reach back and change what
 * "empty" means.
 */
export const PRISTINE: ReturnType<typeof docOnly> = JSON.parse(JSON.stringify(docOnly(useStudio.getState())));

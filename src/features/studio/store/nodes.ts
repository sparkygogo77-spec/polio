"use client";
import { uid } from "@/core/lib/ids";
import { getFeature } from "../catalog";
import { emptyCube } from "../parts/cubeFaces";
import { plain } from "../parts/spans";
import { emptyWrappers, saysWhat, sentences, slimSays, slimWrappers, SWEEP, type Frag, type Slimming } from "../reassemble";
import { paintSays, repaintActive } from "../repaint";
import { twins, twinSays } from "../twins";
import { grownSays, grownTo, type Read } from "../owns";
import { newTour, siteFaces } from "../tour";
import { placeInFrame } from "./frame";
import { groupTwins } from "../stateEdits";
import { GetStudio, HUES, SetStudio, TYPED_FIELDS, inherit, withFits, withGrown, withJoins, withPaint, withoutTwins } from "./history";
import { ShapeKind, ShapeRelation, StudioNode } from "./model";
import type { StudioState } from "./state";

/** The nodes actions of the studio store; spread into `useStudio` by create.ts. */
export function nodesActions(set: SetStudio, get: GetStudio, push: () => void, pushEdit: (key: string) => void): Pick<StudioState, "addNode" | "updateNode" | "updateNodeQuiet" | "updateNodes" | "fitToWords" | "settleToWords" | "joinSentences" | "fitWrappers" | "sweepDocument" | "raiseNode" | "lowerNode" | "removeNodes" | "duplicateNodes" | "setCubeFace" | "pickFace" | "hold" | "want" | "markQueueSeen" | "setCubeTurn" | "setMeshTurn" | "applyDrawnKind" | "groupSelection" | "ungroup" | "updateGroup"> {
  void pushEdit;
  return {
    /**
     * Every way a part comes into being goes through here — the library,
     * the add disc, paste, the drawing board, "drop an idea here" — so
     * this is the one place that has to keep a new part inside the page.
     *
     * It did not, and nothing else did either: the coordinates were
     * rounded and stored as given, so a part added near an edge sat half
     * off the page and every later path inherited the same habit. A part
     * may still be *dragged* out afterwards, because dragging is someone
     * saying where they want it; arriving outside the page is nobody
     * saying anything.
     */
    addNode: (featureId, x, y, patch) => {
      const feature = getFeature(featureId);
      /*
       * A part brought in from a repository is a preset of a real one:
       * it names the part that draws in `basedOn` and carries what was
       * measured off the page in `preset`. Unfolded here, once, so
       * every door into the board — the shelf, the wheel, search,
       * "add here" — puts down an ordinary node and nothing else in
       * the app had to learn what a brought part is.
       */
      const real = feature?.basedOn ?? featureId;
      const pre = feature?.preset;
      if (pre) {
        patch = {
          label: pre.label ?? feature?.name,
          content: pre.content ?? "",
          options: pre.options ?? {},
          prompt: pre.prompt ?? "",
          ...(pre.colour ? { colour: pre.colour as StudioNode["colour"] } : {}),
          ...(pre.font ? { font: pre.font as StudioNode["font"] } : {}),
          ...patch,
        };
      }
      featureId = real;
      const id = uid("n");
      push();
      set((s) => {
        /* Whose box this is. Everything added through the library, the
           wheel or "add here" is his; only a part carrying the page it
           was read off is the machine's, and only those are healed. */
        const mine = !patch?.from;
        const w = patch?.w ?? feature?.w ?? 132;
        const h = patch?.h ?? feature?.h ?? 76;
        const home = placeInFrame(x, y, w, s.frameWidth);
        return ({
        nodes: [
          ...s.nodes,
          {
            id,
            pageId: s.activePageId,
            featureId,
            label: feature?.name ?? "Element",
            prompt: "",
            content: "",
            data: "",
            colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
            shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
            w,
            h,
            groupId: null,
            options: {},
            ...(mine ? { byHand: true } : {}),
            priority: "must",
            custom: featureId === "custom-idea",
            glyph: null,
            hue: null,
            locked: false,
            link: null,
            /* A "What's new" card arrives with its tour, the feature that shows it on a page, and the site's own faces. */
            ...(featureId === "whats-new" ? { tour: newTour(), work: { id: "whats-new", inputs: {} }, options: siteFaces(s.nodes, s.activePageId) } : null),
            ...patch,
            // A patch may carry its own size, but never a place outside
            // the page: the clamp above is computed from the final size.
            ...(patch?.x != null || patch?.y != null
              ? placeInFrame(patch.x ?? home.x, patch.y ?? home.y, w, s.frameWidth)
              : home),
            /*
             * A part that lands inside an open black hole is made the
             * way that space is made.
             *
             * Decided here rather than at each door, and by geometry
             * rather than by a pointer, so it holds however the part
             * arrived: a drawing made real inside the space, a part
             * dropped from the shelf, a paste. A person who has steered
             * a space should not have to say the same thing again for
             * every element they put in it. Anything the part carries
             * of its own wins, because it is the more particular.
             */
            ...inherit(s, patch?.x != null || patch?.y != null
              ? placeInFrame(patch.x ?? home.x, patch.y ?? home.y, w, s.frameWidth)
              : home, w, h, patch),
          },
        ],
        selection: [id],
      });
      });
      return id;
    },

    updateNode: (id, patch) => {
      // Words typed into a part's own fields are one edit per run of
      // typing; anything else is its own step, as it always was.
      const keys = Object.keys(patch);
      if (keys.length && keys.every((k) => TYPED_FIELDS.has(k))) pushEdit(`node:${id}:${keys.join(",")}`);
      else push();
      /* A style group is edited once: its other parts take the same look (`stateEdits.ts#groupTwins`). */
      const twins = groupTwins(get().nodes, id, patch as Record<string, unknown>);
      const also = new Set(twins?.ids ?? []);
      set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : also.has(n.id) ? { ...n, ...twins!.patch } : n)) }));
    },

    updateNodeQuiet: (id, patch) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

    updateNodes: (ids, patch) => {
      push();
      const set_ = new Set(ids);
      set((s) => ({ nodes: s.nodes.map((n) => (set_.has(n.id) ? { ...n, ...patch } : n)) }));
    },

    /*
     * The second half of "captured geometry is a starting size": the
     * boxes have already grown on screen, because the part draws at the
     * size its words need, and this writes those heights down and moves
     * the page under them so nothing overlaps.
     *
     * A convenience, NOT the guarantee. These numbers are measured
     * against whatever face resolved at the moment of the import; the
     * thing that keeps words visible afterwards is the CSS floor in
     * `parts/primitives.tsx`, which cannot go stale. Nothing downstream
     * should read a stored height as the truth about how tall a box has
     * to be.
     */
    fitToWords: (fitted) => {
      if (!fitted.length) return;
      push();
      const by = new Map(fitted.map((f) => [f.id, f]));
      set((s) => ({ nodes: s.nodes.map((n) => { const f = by.get(n.id); return f ? { ...n, h: f.h, y: f.y } : n; }) }));
    },

    settleToWords: (fitted) => {
      if (!fitted.length) return;
      const by = new Map(fitted.map((f) => [f.id, f]));
      set((s) => {
        /* A scene, an overlay or a part's state draws another moment's words and boxes: what the board measures then is that moment, never the page's own geometry. */
        if ((s.statesOn ?? []).some((k) => /^(screen|top|step):/.test(k))) return {};
        let moved = false;
        const nodes = s.nodes.map((n) => {
          const f = by.get(n.id);
          if (!f || (f.h === n.h && f.y === n.y)) return n;
          moved = true;
          return { ...n, h: f.h, y: f.y };
        });
        // Nothing to say is said by changing nothing: a new array here
        // would re-render the board and be measured again for ever.
        return moved ? { nodes } : {};
      });
    },

    joinSentences: () => {
      const done = sentences(get().nodes as unknown as Frag[]);
      if (!done.length) return [];
      /* One checkpoint for the lot: it is one rebuild, and his to undo
         if he does not like what it did to a line he had arranged. */
      push();
      set((s) => ({ nodes: withJoins(s.nodes, done) }));
      return done;
    },

    fitWrappers: () => {
      const done = slimWrappers(get().nodes as unknown as Frag[]);
      if (!done.length) return [];
      push();
      set((s) => ({ nodes: withFits(s.nodes, done) }));
      return done;
    },

    /*
     * THE WHOLE DOCUMENT, ONCE, WHEN IT IS OPENED.
     *
     * HIS WORDS about boxes coming out wrong: "it should be done
     * automatically properly". The two rebuilds above are correct and
     * reach a stored board, but only when a person presses them — so a
     * board captured before they existed sat unchanged, and the only
     * cheap fix on offer was two commands per page across nine pages,
     * which is a chore rather than a fix.
     *
     * Three things this must be, and every one of them is a promise to
     * somebody whose document is being rewritten without being asked:
     *
     *  - EVERY PAGE, not the one on screen. That is the entire reason it
     *    is worth having; `sentences` already groups per page and
     *    `slimWrappers` already keeps containment within a page, so the
     *    work is to hand them the whole document and never a slice.
     *  - ONE CHECKPOINT for the lot. Removing parts automatically is
     *    only acceptable if a single undo puts every one of them back,
     *    so the checkpoint is taken once, before either pass, and
     *    neither pass takes its own.
     *  - ONCE PER DOCUMENT. A board already swept is left alone on every
     *    later open, marked with the version of the rules it went
     *    through (`SWEEP`), so bumping that number is the whole of
     *    "sweep them all again".
     *
     * The safeguards under it are the passes' own and are not relaxed
     * here: nothing his hand placed is touched, a wrapper showing a
     * surface of its own is never removed, and only a box's bottom moves.
     *
     * The joins run FIRST, because a join removes parts and resizes the
     * one that stays. The repaint runs last and cannot disagree with
     * either: it only ever changes paint. Nothing here fits a box to what
     * it holds any more — see the note where the fitting used to run.
     */
    sweepDocument: (force) => {
      const s0 = get();
      /*
       * AT OR PAST these rules, and it is left alone. Written as `>=`
       * rather than `===` because a document a NEWER build has swept must
       * not be swept again by an older one: an exact match reads a mark
       * it does not recognise as "never swept" and runs the whole thing
       * over a board that has already been past it.
       */
      if (!force && (s0.swept ?? 0) >= SWEEP) return null;
      /*
       * A BOARD NOBODY CAPTURED IS NOT SWEPT, and is marked so it is
       * never asked again. The same question `onRehydrateStorage` asks
       * about whose boxes these are: a repository or site brought in, or
       * a part carrying the element it was read from, its layout, its
       * padding, its edge or the way its words are set. None of those and
       * the board is his, drawn and placed, and nothing here applies. A
       * part placed by hand that carries them (a theme's sample page,
       * `starterPage.ts`) is his too: it says nothing about a capture.
       */
      const captured = (s0.brought?.length ?? 0) > 0
        || s0.nodes.some((n) => n.from || (!n.byHand && (n.layout || n.pad || n.edge || n.text)));
      if (!captured) { set({ swept: SWEEP }); return null; }

      /* The page as it opens: a part a press shows (`state`) sits where the part it stands in for does, and is neither joined, grown round, nor a twin of it. It is kept as it is. */
      const pressed = s0.nodes.filter((n) => n.state);
      const opens = pressed.length ? s0.nodes.filter((n) => !n.state) : s0.nodes;
      const joined = sentences(opens as unknown as Frag[]);
      const afterJoin = joined.length ? withJoins(opens, joined) : opens;
      /*
       * A WRAPPER PUT BACK ROUND THE PARTS IT OWNS, read off the DOM path
       * the capture recorded rather than off geometry (`owns.ts`).
       *
       * Read from the document AS SAVED, like the dedupe, because the
       * capture is the authority on what owns what. It only ever lifts
       * or grows a box, never shrinks one: a deletion may only ever be
       * justified by something the capture said, and so may a box made
       * smaller.
       */
      const grew = grownTo(opens as unknown as (Frag & Read)[])
        .filter((g) => afterJoin.some((n) => n.id === g.id));
      const afterGrow = grew.length ? withGrown(afterJoin, grew) : afterJoin;

      /*
       * AND NOTHING IS FITTED. Measured on sink's document: of the 56
       * boxes the fitting shrank, all 56 were as tall as the capture said
       * for a reason the capture records — a fixed rail's viewport height,
       * a column's min-height, a row's stretch, a sized button centring
       * its icon, a line's line-height — and not one held dead space. On
       * his board it took the sidebar rail from 1281 to the 440 of the nav
       * inside it. Shrinking a captured box undoes a measurement, the same
       * error as replacing a wrapper with its contents' box (29 of 31
       * flags there were padding). The fitting stays a command a person
       * runs on purpose; the sweep does not run it for him.
       */
      const fitted: Slimming[] = [];
      const afterFit = afterGrow;
      /* Reported, never removed: both of the empty wrappers on his home
         page are real surfaces that slid below their own contents. */
      const empty = emptyWrappers(afterFit as unknown as Frag[]);
      /*
       * AND THE SAME BOX EMITTED TWICE. A separate pass from the wrapper
       * one above, and separate on purpose: a duplicate may be removed
       * because its twin remains, which is a test; an empty wrapper may
       * not be removed at all. `offered` no longer emits the pair, which
       * reaches a new capture; this is the retrofit for a board already
       * written down.
       */
      /*
       * READ OFF THE DOCUMENT AS IT WAS SAVED, not off the result of the
       * passes above — and that is not tidiness, it is the difference
       * between safe and not. Fitting a wrapper CHANGES A HEIGHT, and two
       * boxes the capture recorded 97px apart can be left the same height
       * by it. A dedupe reading that result would see a twin the page
       * never had and delete a node on the strength of a size WE chose.
       * A box may only be removed for something the CAPTURE said, never
       * for a consequence of our own editing — the same rule that keeps
       * the wrapper pass to one pass.
       */
      const doubled = twins(opens as unknown as Frag[])
        .filter((t) => afterFit.some((n) => n.id === t.id) && afterFit.some((n) => n.id === t.keeps));
      /*
       * AND THE PAINT THE CAPTURE DROPPED. The other lane taught the
       * converter to read `oklab()`, which reaches a new capture and
       * nothing at all on a board already written down — so on his the
       * whole correction is a colour and a variant, worked out from what
       * the document still holds (`repaint.ts`).
       *
       * The page's own background goes in with it, because his docs
       * sidebar has NO painted box anywhere behind its entries — the tint
       * went straight onto the page, and without this the correction
       * would be skipped there in silence.
       */
      const painted = repaintActive(afterFit as unknown as Frag[], s0.look?.palette?.bg ?? null);
      if (!joined.length && !grew.length && !fitted.length && !painted.length && !empty.length && !doubled.length) { set({ swept: SWEEP }); return null; }

      /* The one checkpoint, taken before anything moves. */
      push();
      set({
        nodes: [...withoutTwins(painted.length ? withPaint(afterFit, painted) : afterFit, doubled), ...pressed],
        swept: SWEEP,
        /* Said out loud, because a board that quietly loses six parts
           between one visit and the next is worse than one that never
           lost them — and the line is how he knows there is an undo. */
        sweepNote: `${[joined.length ? saysWhat(joined) : "", grew.length ? grownSays(grew) : "", fitted.length || empty.length ? slimSays(fitted, empty) : "", painted.length ? paintSays(painted) : "", doubled.length ? twinSays(doubled) : ""].filter(Boolean).join(" ")} One undo takes all of it back.`,
      });
      return { joined, grew, fitted, painted, empty, doubled };
    },

    raiseNode: (id, toTop) => {
      push();
      set((s) => {
        const i = s.nodes.findIndex((n) => n.id === id);
        if (i < 0 || i === s.nodes.length - 1) return {};
        const nodes = [...s.nodes];
        const [n] = nodes.splice(i, 1);
        nodes.splice(toTop ? nodes.length : i + 1, 0, n!);
        return { nodes };
      });
    },
    lowerNode: (id, toBottom) => {
      push();
      set((s) => {
        const i = s.nodes.findIndex((n) => n.id === id);
        if (i <= 0) return {};
        const nodes = [...s.nodes];
        const [n] = nodes.splice(i, 1);
        nodes.splice(toBottom ? 0 : i - 1, 0, n!);
        return { nodes };
      });
    },

    removeNodes: (ids) => {
      push();
      const set_ = new Set(ids);
      set((s) => {
        const nodes = s.nodes.filter((n) => !set_.has(n.id));
        const liveGroups = new Set(nodes.map((n) => n.groupId).filter(Boolean) as string[]);
        return {
          nodes,
          groups: s.groups.filter((g) => liveGroups.has(g.id)),
          shapes: s.shapes.map((sh) =>
            set_.has(sh.fromNodeId ?? "") || set_.has(sh.toNodeId ?? "")
              ? { ...sh, fromNodeId: set_.has(sh.fromNodeId ?? "") ? null : sh.fromNodeId, toNodeId: set_.has(sh.toNodeId ?? "") ? null : sh.toNodeId }
              : sh,
          ),
          selection: s.selection.filter((id) => !set_.has(id)),
        };
      });
    },

    duplicateNodes: (ids) => {
      push();
      set((s) => {
        const set_ = new Set(ids);
        const copies = s.nodes
          .filter((n) => set_.has(n.id))
          .map((n) => ({ ...n, id: uid("n"), x: n.x + 24, y: n.y + 24, groupId: null }));
        return { nodes: [...s.nodes, ...copies], selection: copies.map((c) => c.id) };
      });
    },

    setCubeFace: (nodeId, index, patch) => {
      // Words on a face are the document, so they are undone like words
      // anywhere else on it: one edit per run of typing on one field.
      if (patch === null) push();
      else pushEdit(`face:${nodeId}:${index}:${Object.keys(patch).join(",")}`);
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId || index < 0 || index > 5) return n;
          const cube = n.cube ?? emptyCube();
          const faces = cube.faces.map((f, i) =>
            i !== index ? f : patch === null ? { heading: "", body: "", colour: "" } : { ...f, ...patch },
          );
          return { ...n, cube: { ...cube, faces } };
        }),
      }));
    },

    pickFace: (nodeId, side) => set({ pickedFace: side ? { nodeId, side } : null }),

    hold: (nodeId) => set({ handling: nodeId }),
    want: (w) => set({ wanted: w ? { ...w, at: Date.now() } : null }),

    markQueueSeen: () => set({ queueSeenAt: Date.now() }),

    setCubeTurn: (nodeId, turn) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, cube: { ...(n.cube ?? emptyCube()), turn } } : n)),
      })),

    setMeshTurn: (nodeId, turn) =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === nodeId && n.mesh ? { ...n, mesh: { ...n.mesh, turn } } : n)),
      })),

    applyDrawnKind: (nodeId, role, said = "", opts = {}) => {
      const s0 = get();
      const node = s0.nodes.find((n) => n.id === nodeId);
      if (!node) return { kind: role.kind, did: "" };
      const inside = (n: StudioNode) =>
        n.id !== node.id && n.pageId === node.pageId &&
        n.x >= node.x - 4 && n.y >= node.y - 4 && n.x + n.w <= node.x + node.w + 4 && n.y + n.h <= node.y + node.h + 4;

      if (role.kind === "container") {
        const held = s0.nodes.filter(inside);
        if (held.length) {
          const gid = uid("g");
          set((s) => ({
            groups: [...s.groups, { id: gid, pageId: node.pageId, label: node.label, prompt: "", hue: HUES[s.groups.length % HUES.length]! }],
            nodes: s.nodes.map((n) => (n.id === node.id || held.some((h) => h.id === n.id) ? { ...n, kind: n.id === node.id ? "container" : n.kind, groupId: gid } : n)),
          }));
          return { kind: "container", did: `a container holding ${held.length} part${held.length === 1 ? "" : "s"}` };
        }
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "container" } : n)) }));
        return { kind: "container", did: "a container, with nothing in it yet" };
      }

      if (role.kind === "connector" && !opts.fresh) {
        /* A part that was here before the line: never removed, only marked. */
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "connector" } : n)) }));
        return { kind: "connector", did: "" };
      }
      if (role.kind === "connector") {
        // The two parts nearest each end. The drawing's box is the
        // part's box, so the ends are two corners of it, and which two
        // depends on which way the line runs.
        const flat = node.w >= node.h;
        const mid = { x: node.x + node.w / 2, y: node.y + node.h / 2 };
        const others = s0.nodes.filter((n) => n.id !== node.id && n.pageId === node.pageId);
        const near = (before: boolean) =>
          others
            .map((n) => ({ n, cx: n.x + n.w / 2, cy: n.y + n.h / 2 }))
            .filter((o) => (flat ? (before ? o.cx < mid.x : o.cx > mid.x) : before ? o.cy < mid.y : o.cy > mid.y))
            .sort((a, b) => Math.hypot(a.cx - mid.x, a.cy - mid.y) - Math.hypot(b.cx - mid.x, b.cy - mid.y))[0]?.n ?? null;
        const from = near(true);
        const to = near(false);
        if (from && to && from.id !== to.id) {
          const sid = uid("sh");
          set((s) => ({
            shapes: [
              ...s.shapes,
              {
                id: sid, pageId: node.pageId, kind: "arrow" as ShapeKind,
                points: [[from.x + from.w / 2, from.y + from.h / 2], [to.x + to.w / 2, to.y + to.h / 2]] as [number, number][],
                hue: HUES[0]!, width: 2, label: "", prompt: "", fromNodeId: from.id, toNodeId: to.id, relation: "flow" as ShapeRelation,
              },
            ],
            // The line was the join, not a thing on the page.
            nodes: s.nodes.filter((n) => n.id !== node.id),
            selection: s.selection.filter((id) => id !== node.id),
          }));
          return { kind: "connector", did: `a chain from ${from.label} to ${to.label}` };
        }
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "connector" } : n)) }));
        return { kind: "connector", did: "a connector with nothing at its ends yet" };
      }

      if (role.kind === "list") {
        const rows = Math.max(2, Math.min(12, role.rows ?? 3));
        const content = plain(node.content).trim() || Array.from({ length: rows }, (_, i) => `Row ${i + 1}`).join(", ");
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "list", content } : n)) }));
        return { kind: "list", did: `a list of ${rows} rows` };
      }

      set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: role.kind } : n)) }));
      return { kind: role.kind, did: role.kind === "surface" ? "a surface that holds what is placed on it" : "" };
    },

    groupSelection: (label) => {
      const s0 = get();
      const ids = s0.selection.filter((id) => s0.nodes.some((n) => n.id === id));
      if (ids.length < 2) return;
      push();
      const gid = uid("g");
      set((s) => ({
        groups: [
          ...s.groups,
          {
            id: gid,
            pageId: s.activePageId,
            label: label ?? `Group ${s.groups.length + 1}`,
            prompt: "",
            hue: HUES[s.groups.length % HUES.length]!,
          },
        ],
        nodes: s.nodes.map((n) => (ids.includes(n.id) ? { ...n, groupId: gid } : n)),
      }));
    },

    ungroup: (groupId) => {
      push();
      set((s) => ({
        groups: s.groups.filter((g) => g.id !== groupId),
        nodes: s.nodes.map((n) => (n.groupId === groupId ? { ...n, groupId: null } : n)),
      }));
    },

    updateGroup: (id, patch) => {
      push();
      set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
    },

  };
}

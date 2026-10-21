"use client";
import { unpackFrom } from "../../docStore";
import { pictureLayersOff } from "../../docTake";
import { defaultLight, delayMs, emptyLook, speedK } from "../../look";
import { newMotion, SLEEVES } from "../../motion";
import { normaliseSketch, type OutlineClip } from "../../pictures";
import type { Worn } from "../../wornModel";
import type { PartCode } from "../../snippet";
import type { Picture } from "../../pictures";
import type { StudioState } from "./state";
import { checkedIn } from "../../states";

/* ------------------------------------------------------------------ */
/* Loading a document                                                  */
/* ------------------------------------------------------------------ */

/**
 * The part of the store that IS the document.
 *
 * Named rather than inline because two things need it and they must never
 * drift: the persister, which writes it out, and `PRISTINE`, which is what a
 * site with nothing saved has to be loaded as. A key added here is saved and
 * blanked by the same edit.
 */
/**
 * THE BOARD AS IT GOES OUT (builder audit, 2026-10-11). A state worn on the
 * board ("This state only", the Panels page's state on show) is a way of
 * editing that state, not the document. So whatever sends the site away reads
 * the parts checked in, as the save does: Go live's pages, document and
 * contract, Export for code and the pictures they carry. With nothing worn,
 * the board itself.
 */
export function sentBoard(s: StudioState): StudioState {
  const nodes = checkedIn(s.nodes);
  return nodes === s.nodes ? s : { ...s, nodes };
}

/** One empty list, so an unchanged document hands over the same value every time (`create.ts#keptOnly`). */
const NO_STATES: string[] = [];
export function docOnly(s: StudioState) {
  return {
        pages: s.pages,
        /* Checked in: a state worn on the board is saved as that state's look, never the part's own (`states/stateEdits.ts`). */
        nodes: checkedIn(s.nodes),
        /* His drawings survive leaving the tab, which is the whole point of them. */
        draws: s.draws,
        /* When he last opened the timeline, so a finished action's green bar
           waits for him rather than for a reload. Per site, like the rest of
           the document: each site has its own timeline. */
        queueSeenAt: s.queueSeenAt,
        groups: s.groups,
        shapes: s.shapes,
        spaces: s.spaces,
        learn: s.learn,
        standIn: s.standIn ?? null,
        format: s.format,
        brief: s.brief,
        look: s.look,
        motion: s.motion,
        activePageId: s.activePageId,
        /* Saved, because "once per document" is a promise that has to
           survive the reload it is protecting against. */
        swept: s.swept,
        /* The record a later "keep my changes" import reads; part of the site, like the sweep's mark. */
        taken: s.taken ?? null,
        showAllFormat: s.showAllFormat,
        showWires: s.showWires,
        statesOn: s.statesOn ?? NO_STATES,
        hiddenFeatures: s.hiddenFeatures,
        brought: s.brought,
        broughtParts: s.broughtParts,
        trail: s.trail,
        threads: s.threads,
        liveThreadId: s.liveThreadId,
        pinnedThreads: s.pinnedThreads,
        bookPinned: s.bookPinned,
        openThreadId: s.openThreadId,
        currentThreadId: s.currentThreadId,
        threadSpots: s.threadSpots,
        draftPieces: s.draftPieces,
        sentPieces: s.sentPieces,
        companion: s.companion,
        menuShape: s.menuShape,
        view: s.view,
        menuSpin: s.menuSpin,
        recentColours: s.recentColours,
        frameWidth: s.frameWidth,
        /* The open edit branch is part of the site, not part of where
           somebody is looking, so it is saved with the document. Which
           repository it belongs to is the builds store's, not this one's. */
        siteBranch: s.siteBranch,
  };
}

/**
 * A saved document, read onto a base.
 *
 * Named for the same reason. The persister hands it the live store as the
 * base; `swapDoc` hands it a pristine one, which is the difference between
 * "fill in what this document does not mention" and "let the last site's
 * work show through the gaps".
 */
export function mergeDoc(persisted: unknown, current: StudioState): StudioState {
        const { siteRepo: was, ...p } = (persisted ?? {}) as Partial<StudioState> & { siteRepo?: unknown };
        /* A document saved before the builds store held the repository still
           names one. Kept aside for the builds store to copy across, and
           never spread into the state, where nothing reads it any more. */
        carried = typeof was === "string" && was.trim() ? was.trim() : null;
        return {
          ...current,
          ...p,
          nodes: (p.nodes ?? current.nodes).map((n) => ({
            ...n, content: n.content ?? "", link: n.link ?? null,
            /* A path packed for the localStorage mirror (docStore.ts) is the path it was. */
            from: n.from ? unpackFrom(n.from as { selector?: string; sel?: string } & Record<string, unknown>) as typeof n.from : n.from, data: n.data ?? "", colour: n.colour ?? null, font: n.font ?? null, anim: n.anim ?? null,
            // Speed and delay were words once; a saved board still has them.
            animSpeed: speedK(n.animSpeed as number | string | undefined), animDelay: delayMs(n.animDelay as number | string | undefined), animEase: n.animEase ?? "smooth",
            shape: n.shape ?? null,
            /* A drawn shape's record, checked: an outline of fewer than three points draws nothing. */
            worn: n.worn && typeof n.worn === "object" && Array.isArray((n.worn as Worn).pts) && (n.worn as Worn).pts.length >= ((n.worn as Worn).open ? 2 : 3) && (n.worn as Worn).kit ? (n.worn as Worn) : null,
            outline: n.outline && typeof n.outline === "object" && typeof (n.outline as OutlineClip).cut === "string" ? (n.outline as OutlineClip) : null,
            code: n.code && typeof n.code === "object" && typeof (n.code as PartCode).html === "string" ? (n.code as PartCode) : null,
            aura: n.aura ?? null, auraSize: Number.isFinite(n.auraSize) ? n.auraSize : 1, auraStyle: n.auraStyle ?? "glow", texture: n.texture ?? null,
            sketch: normaliseSketch(n.sketch),
            /* A reference, checked rather than trusted: a picture whose
               record is half a record cannot be looked for or published,
               and a part that thinks it has one draws a hole. */
            picture: n.picture && typeof n.picture === "object" && typeof (n.picture as Picture).id === "string" && typeof (n.picture as Picture).path === "string"
              ? (n.picture as Picture)
              : null,
            lookPicture: n.lookPicture && typeof n.lookPicture === "object" && typeof n.lookPicture.picture?.id === "string" && typeof n.lookPicture.picture?.path === "string"
              ? n.lookPicture
              : null,
            pictureVersions: Array.isArray(n.pictureVersions)
              ? (n.pictureVersions as Picture[]).filter((v) => v && typeof v.id === "string" && typeof v.path === "string")
              : null,
          })),
          recentColours: Array.isArray(p.recentColours) ? p.recentColours : [],
          shapes: (p.shapes ?? current.shapes).map((sh) => ({ ...sh, relation: sh.relation ?? "flow" })),
          // A board saved before spaces existed has none; a broken entry is dropped rather than drawn.
          /* A board saved before spaces existed has none; a broken entry is
             dropped rather than drawn. One saved while spaces still had a
             kind comes across as what it always was underneath: a hole,
             consuming from when it was drawn. */
          spaces: Array.isArray(p.spaces)
            ? p.spaces
                .filter((sp) => sp && Array.isArray(sp.boundary) && sp.boundary.length >= 4)
                .map((sp) => ({ ...sp, since: sp.since ?? sp.at ?? Date.now() }))
            : [],
          hiddenFeatures: p.hiddenFeatures ?? [],
          trail: Array.isArray(p.trail) ? p.trail : [],
          threads: Array.isArray(p.threads) ? p.threads : [],
          liveThreadId: typeof p.liveThreadId === "string" ? p.liveThreadId : null,
          pinnedThreads: Array.isArray(p.pinnedThreads) ? p.pinnedThreads : [],
          openThreadId: typeof p.openThreadId === "string" ? p.openThreadId : null,
          bookPinned: !!p.bookPinned,
          threadSpots: p.threadSpots && typeof p.threadSpots === "object" ? (p.threadSpots as Record<string, { x: number; y: number }>) : {},
          draftPieces: Array.isArray(p.draftPieces) ? p.draftPieces : [],
          sentPieces: p.sentPieces && typeof p.sentPieces === "object" ? (p.sentPieces as Record<string, string>) : {},
          look: (() => {
            const look = { ...emptyLook(), ...(p.look ?? {}) };
            // The target used to be one switch for the whole stack; each layer
            // owns it now, so anything saved before inherits what was set.
            return {
              ...look,
              light: { ...defaultLight(), ...(look.light ?? {}) },
              // A layer a picture wears is the picture's, not the page's (`docTake.ts`).
              texture: pictureLayersOff(p.nodes ?? current.nodes, look.texture.map((l) => ({ ...l, target: l.target ?? look.target ?? "page" }))),
            };
          })(),
          companion: { ...current.companion, ...(p.companion ?? {}) },
          menuSpin: Number.isFinite(p.menuSpin) ? (p.menuSpin as number) : 0,
          // A crate saved before a setting existed still has to open.
          motion: (p.motion ?? []).map((m) => ({
            ...newMotion(m.name),
            ...m,
            frames: Array.from({ length: SLEEVES }, (_, i) => m.frames?.[i] ?? null),
          })),
        };
}

/**
 * The repository a document named for itself, before the builds store was
 * the one place for it. Set by every load, read once by the builds store's
 * copy across, and gone after that.
 */
export let carried: string | null = null;
export function takeCarriedRepo(): string | null {
  const it = carried;
  carried = null;
  return it;
}

"use client";
import { type LearnState } from "../../learn";
import type { StandIn } from "../../standIn";
import type { Taken } from "../../bring-in";
import { type ColourUse, type FaceTo } from "../../look";
import type { Palette } from "../../look";
import type { CarriedFont } from "../../look";
import { type ThemeRollSettings, type Light, type Look, type TextureLayer } from "../../look";
import { type MotionAsset } from "../../motion";
import type { Spend } from "../../spend";
import type { SiteTheme } from "../../siteTheme";
import { type TryItem } from "../../starterPage";
import type { DrawnKind, DrawnRole } from "../../shapeKind";
import type { DrawKind } from "../../drawKinds";
import { type CubeFace, type CubeSide } from "../../shelf";
import type { Picture } from "../../pictures";
import { type Thread } from "../../threads";
import { type DrawJob } from "../../queue";
import type { Locked, Placed, Plan, Space } from "../../space";
import { type Frag, type Reassembly, type Slimming } from "../../reassemble";
import { type Painted } from "../../repaint";
import { type Twin } from "../../twins";
import { type Grown } from "../../owns";
import { BoardMode, BroughtPart, BroughtRepo, Doc, Revision, ShapeRelation, StudioBrief, StudioGroup, StudioNode, StudioPage, StudioShape, Tool, TrailEntry } from "./model";

export interface StudioState extends Doc {
  /** Width of the page frame drawn on the board. */
  frameWidth: number;
  /** Bumped to ask the board to fit the frame into view. */
  fitNonce: number;
  activePageId: string;
  selection: string[];
  tool: Tool;
  inkHue: number;
  inkWidth: number;
  /**
   * WHAT HE IS DRAWING, chosen BEFORE he draws it.
   *
   * His words: "when i click the color i can adjust it and beside it the
   * buttons become preselect options for 'button' 'surface' 'icon' or
   * whatever options i can draw". The saying-what-it-is moves earlier; it
   * does not disappear, which is what `part` is for — the one that still
   * works it out from the drawing, the way everything did before this.
   *
   * Every one of these is wired to something real. A chip that fell through
   * to the model would be a preselect that does not preselect, which is the
   * same disease as a dead control.
   */
  drawKind: DrawKind;
  /*
   * WHICH REPOSITORY THIS SITE POINTS AT is not held here.
   *
   * It was, as `siteRepo`, and that was the bug: the GitHub control wrote
   * the choice here while the Sites list, the Builds page, Publish and the
   * Brief all read `project.repo` on the builds store, which only a publish
   * wrote. A site connected and never published showed "no repository"
   * however many times it was connected. The builds store is the one place
   * now; read it with `activeRepo()` or `useSiteRepo()`, and the old value
   * a saved document still carries is copied across once, on load.
   */
  /**
   * The branch this site's edits go to while it has a repository.
   *
   * HIS DESIGN, in his words: "would editing my own website create a
   * paradox? i think it should create a branchfirst and there should be a
   * seperate merge button". Not a paradox, but editing live is dangerous, so
   * the moment a site that points at a repository is edited it takes a
   * branch, every Publish goes there, and main does not move until he
   * presses Merge himself. Null means no branch is open: the next edit opens
   * one. Saved with the document, because it is part of the site.
   */
  siteBranch: string | null;
  setSiteBranch: (b: string | null) => void;
  zoom: number;
  pan: { x: number; y: number };
  /**
   * How far the *site* is scrolled inside its frame.
   *
   * The frame is one screen of the website now, not the whole of it: the page
   * scrolls inside it the way it will in a browser, so what you are looking
   * at is what a visitor sees, at the size they see it. The board's own pan
   * moves the frame about the workspace; this moves the page behind the
   * frame's edge. Never persisted — where you had scrolled to is not part of
   * the site.
   */
  showAllFormat: boolean;
  /** Wires between parts can be hidden so the board reads as the page. */
  showWires: boolean;
  /**
   * The page's hidden states shown on the board (`boardStates.ts`): groups
   * by key (`hidden:match-panel`) and preview screens (`screen:mid-match`).
   * The board's alone: the parts keep their state, so the page still opens
   * with them hidden.
   */
  statesOn: string[];
  /** Parts removed from the library. Nothing is deleted; they can come back. */
  hiddenFeatures: string[];
  /** The repositories brought onto this board, and the shelf categories they own. */
  brought: BroughtRepo[];
  /** Their elements: presets of real parts, droppable like anything else in the shelf. */
  broughtParts: BroughtPart[];
  /**
   * Keep what a repository's page was made of, as a category of its own.
   *
   * Bringing the same repository in again replaces what it left rather
   * than piling a second copy beside it, so reading a site twice gives one
   * category and not two.
   */
  bringIn: (repo: BroughtRepo, parts: BroughtPart[]) => void;
  /** Let a repository go: its category and its elements leave the shelf. Parts already on the board stay. */
  sendBack: (repoId: string) => void;
  /** Design surface, or the live site in the same place on screen. */
  mode: BoardMode;
  /**
   * The part menu's outer edge: cut to a square, or swept round like its
   * inner edge. A draft toggle sits on the menu itself so the two can be
   * compared live.
   */
  menuShape: "square" | "round";
  /**
   * Which page the board shows: the desktop, or the page on a tablet or a
   * phone (`live/small.ts`). Separate from `frameWidth`, which is the width
   * the page is designed at: Tablet and Phone used to set that, so the
   * desktop's boxes were drawn in a narrower frame and cut off.
   */
  view: "desktop" | "tablet" | "phone";
  setView: (v: "desktop" | "tablet" | "phone") => void;
  /** What a part does at one width, merged into its rule there; null takes the rule away. One step of undo. */
  setSmallRule: (id: string, device: "tablet" | "phone", patch: Partial<import("../../live/small").DeviceRule> | null) => void;
  /**
   * Placing the page's lamp by hand: the board dims everywhere but the page,
   * the pointer becomes the light, and the next press puts it down.
   *
   * A moment, not a setting, so it is not written down and does not come back
   * with the site. `placedLight` is what the lamp was before the moment
   * started, so a press outside the page can put it back.
   */
  placingLight: boolean;
  placedLight: Light | null;
  /** Where the light is while it is being carried out of the menu, or nothing. */
  lightCarry: { x: number; y: number } | null;
  /**
   * How far the part menu is turned, in turns (0..1).
   *
   * The menu used to face the middle of the screen, which meant it was a
   * different shape every time you opened it and your hand never learned
   * where anything was. It is locked now — Delete is always bottom-left,
   * Looks always bottom-right — and this is the one way it moves: hold the
   * right button and drag to turn the whole wheel to wherever suits you. It
   * is remembered, because a menu you rearranged once should stay that way.
   */
  menuSpin: number;
  /**
   * The colours picked off a spectrum lately, newest first.
   *
   * The aura's chips offer them, so a colour chosen for one part's background
   * is one press away for another part's glow. Kept short: past a dozen it is
   * a palette nobody chose.
   */
  recentColours: string[];
  /** The phone/tablet companion: which device, where it sits, whether it is open.
   * Closed to start: it floats over the board, and a panel that covers a resize
   * handle you cannot see is worse than one click to open it. `hidden` takes it
   * off the board (its eye; the eye beside the device switch brings it back);
   * `placed` once he has dragged it, so his place wins over the lift. */
  companion: { device: "phone" | "tablet"; x: number; y: number; open: boolean; hidden?: boolean; placed?: boolean };
  /** Every prompt as written, critiqued and revised. Not part of undo: it is the record of the document, not the document. */
  trail: TrailEntry[];
  /**
   * Every prompt that reached Claude and landed, as a tree. A thread is an
   * iteration, not an update: it holds what was asked, what came back, what
   * it put on the board, and the board as it stood when it landed.
   */
  threads: Thread[];
  /** The thread the board is standing on. */
  liveThreadId: string | null;
  /**
   * Threads pinned to stay in view in the iteration book.
   *
   * A thread scrolls away the moment the trail grows past it, and the one
   * you are working against is the one you need on screen while you ask the
   * next thing. Pinned, it and its answer sit at the top of the book until
   * they are unpinned.
   */
  pinnedThreads: string[];
  /** The book is held open beside the board as a panel, rather than being a dialog you dismiss. */
  bookPinned: boolean;
  /**
   * The iteration open in the timeline's section below it.
   *
   * Not the live thread: standing on a thread puts the board back to it,
   * and reading one is not standing on it. One at a time, on purpose —
   * everything at once is the wall the timeline replaced.
   */
  openThreadId: string | null;
  /** The iteration being worked in: the flag, kept across reloads. */
  currentThreadId: string | null;
  /**
   * Drawings waiting to be made real, and the ones that have been.
   *
   * Not persisted: a job in flight when the tab closed was never going to
   * finish, and a queue that comes back full of jobs nobody is running is
   * worse than an empty one.
   */
  queue: DrawJob[];
  /**
   * Where a thread or a piece has been dragged to on the trail, when it has
   * been. Anything not in here sits where the staircase puts it.
   */
  threadSpots: Record<string, { x: number; y: number }>;
  /**
   * The pieces vined to the next call: what will be sent with it, beside the
   * brief. Empty means the whole blueprint goes, the way it always did.
   */
  draftPieces: string[];
  /**
   * What has already gone up this thread, piece by piece, as the fingerprint
   * it had when it went. A piece whose fingerprint has not moved is not
   * resent: the model has it from the turn before.
   */
  sentPieces: Record<string, string>;
  past: Doc[];
  future: Doc[];

  /* nodes */
  addNode: (featureId: string, x: number, y: number, patch?: Partial<StudioNode>) => string;
  updateNode: (id: string, patch: Partial<StudioNode>) => void;
  /**
   * A write that is part of an edit already in the undo history, not an
   * edit of its own: a drawing's traced body arriving after the drawing
   * landed (`reshapeRun.ts`). No checkpoint, so one undo still takes the
   * whole drawing back.
   */
  updateNodeQuiet: (id: string, patch: Partial<StudioNode>) => void;
  updateNodes: (ids: string[], patch: Partial<StudioNode>) => void;
  /**
   * Give boxes the heights their words drew at, and move what is under
   * them down by the growth. One checkpoint for the lot: it is one tidy,
   * not one per box, and the import it follows is undone as it always was.
   */
  fitToWords: (fitted: { id: string; h: number; y: number }[]) => void;
  /**
   * The same repair, kept up rather than done once, and NOT a checkpoint.
   *
   * `fitToWords` is an edit: it follows an import, it is his to undo, and it
   * pushes one. This is the board noticing that a box is drawing taller than
   * the document says it is and writing down what is already on screen —
   * restoring the invariant rather than changing the page. Pushing a
   * checkpoint for each of those would fill the undo stack with steps that
   * undo nothing a person did, and one of them would put the overlap back.
   */
  settleToWords: (fitted: { id: string; h: number; y: number }[]) => void;
  /**
   * Put the sentences a capture broke into parts back together.
   *
   * Run when a document is taken in, and offered as a command for a board
   * that is already open. Returns what it joined so the caller can say it
   * out loud — his ruling is that a part he moved by hand IS merged inside a
   * sentence, and that every one taken is named. See `reassemble.ts`.
   */
  joinSentences: () => Reassembly[];
  /**
   * Fit every captured wrapper to what it actually holds, and drop the ones
   * holding nothing. See `slimWrappers`: the claim count and the geometry
   * disagree in both directions on his page, so only the geometry is read.
   */
  fitWrappers: () => Slimming[];
  /**
   * Which version of the rebuild rules this document has been through, or
   * absent for one that has been through none. The sweep on open reads it,
   * so a board is put right once rather than rewritten every time it opens.
   */
  swept?: number | null;
  /**
   * THE BOARD AS IT WAS BROUGHT IN, as hashes (`reimport.ts#fingerprint`):
   * recorded at the end of every import, after the sweep and the palette,
   * so bringing the site in again can tell what the owner changed since
   * from what the machine wrote, and keep his. Null on a board nobody
   * brought in, or one brought in before this was kept.
   */
  taken?: Taken | null;
  /**
   * WHAT THE SWEEP ON OPEN DID, IN WORDS, UNTIL SOMEBODY HAS SAID IT.
   *
   * Nothing in this file can publish a line of news, and hydration may
   * resolve after a Builder surface's own effects have run — so the sentence
   * is put here and watched for, rather than handed back from the hook.
   * Never saved: it belongs to this visit, and a board that announced itself
   * once must not announce itself again on the next reload.
   */
  sweepNote?: string | null;
  /**
   * Put the WHOLE document right: both rebuilds, every page, one checkpoint,
   * once. `force` runs it again on a board already marked. Returns what it
   * did, or null when there was nothing to do or the board was never
   * captured. See the action for the three promises it keeps.
   */
  sweepDocument: (force?: boolean) => { joined: Reassembly[]; grew: Grown[]; fitted: Slimming[]; painted: Painted[]; empty: Frag[]; doubled: Twin[] } | null;
  /** Parts draw in list order, so later is on top: one place along is one step forward or back. */
  raiseNode: (id: string, toTop?: boolean) => void;
  lowerNode: (id: string, toBottom?: boolean) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNodes: (ids: string[]) => void;

  /**
   * Give a drawn part the behaviour its shape asks for.
   *
   * The clip is already on it and is not touched. This is the second half:
   * a ring adopts what falls inside it, a list is given one row per stroke,
   * a connector becomes a chain between the two parts at its ends and stops
   * being a part at all, and a surface is marked as one so the blueprint
   * and Build know it holds what is placed on it.
   */
  /**
   * What the drawn shape does. `fresh`: the part was made by this drawing a
   * moment ago. Only a fresh part may be replaced by the chain a line
   * draws; a part that was on the page before is never removed by a
   * drawing (`tests/draw-line-keeps-part.mjs`).
   */
  applyDrawnKind: (nodeId: string, role: DrawnRole, said?: string, opts?: { fresh?: boolean }) => { kind: DrawnKind; did: string };
  /**
   * Change one face of a cube: its words, its colour, or clear it.
   *
   * Editable means editable after it exists. Everything a face is lives on
   * the node, so this is the whole of it: no re-run, no model, and the
   * board, the live page and the published site all change together.
   */
  setCubeFace: (nodeId: string, index: number, patch: Partial<CubeFace> | null) => void;
  /** Where a cube is left standing, so the board draws the angle it was turned to. */
  setCubeTurn: (nodeId: string, turn: { x: number; y: number }) => void;
  /**
   * The face of a cube the person is pointing at, or none.
   *
   * A face is picked the way a part is: pressed on the board, or named in
   * the panel, and then the panel and the wheel edit that face's words.
   * It is transient, exactly as the selection is, and lets go when the
   * selection moves off the cube.
   */
  pickedFace: { nodeId: string; side: CubeSide } | null;
  pickFace: (nodeId: string, side: CubeSide | null) => void;
  /**
   * The one part that has been OPENED, or none.
   *
   * HIS WORDS: "also once i selected something i have to click off and then
   * clicck and hold to drag."
   *
   * Two parts on the board are handled rather than looked at — the cube and
   * the mesh — and they used to take the pointer the moment they were
   * selected, so the press that would have moved them turned them instead.
   * Selecting a part is now only selecting it: it drags like every other
   * part on the board. Taking hold of one is a second, deliberate press, and
   * this is the part that press opened. Transient like the selection, and
   * let go of the moment the selection moves off it.
   */
  handling: string | null;
  /**
   * WHAT THE BOARD ASKS A PANEL TO SHOW. Two presses on a text part want
   * the Element panel open on its words with the caret in them; Add page
   * wants the Pages panel open on the new page's name. The panel that
   * answers clears it.
   */
  wanted: { panel: "inspector" | "pages" | "look" | "motion" | "pictures"; focus?: "words" | "name"; id?: string; at: number } | null;
  want: (w: { panel: "inspector" | "pages" | "look" | "motion" | "pictures"; focus?: "words" | "name"; id?: string } | null) => void;
  hold: (nodeId: string | null) => void;
  /**
   * When he last opened the timeline.
   *
   * HIS WORDS: "green ones stay until timeline is opened." A finished action's
   * bar is the only thing that says the work landed, so it is not taken away
   * the instant it lands — it waits where he can see it until he goes to the
   * place that shows what happened. Persisted, because a reload is not him
   * looking.
   *
   * Zero means he has never opened it, and the strip reads that as "since
   * this page loaded" rather than as 1970: an old board would otherwise come
   * back with every iteration it has ever run sitting green in the header.
   */
  queueSeenAt: number;
  markQueueSeen: () => void;
  /** …and the same for a solid, which is turned the same way. */
  setMeshTurn: (nodeId: string, turn: { x: number; y: number }) => void;

  /* groups */
  groupSelection: (label?: string) => void;
  ungroup: (groupId: string) => void;
  updateGroup: (id: string, patch: Partial<StudioGroup>) => void;

  /* shapes */
  addShape: (shape: Omit<StudioShape, "id">) => string;
  updateShape: (id: string, patch: Partial<StudioShape>) => void;
  /** Marking a wire as a data link fills the target part's data box. */
  setShapeRelation: (id: string, relation: ShapeRelation) => void;
  removeShapes: (ids: string[]) => void;

  /* spaces */
  /** A closed line becomes a space, and starts consuming its area at once. Returns its id. */
  addSpace: (space: Omit<Space, "id" | "at" | "since"> & Partial<Pick<Space, "since">>) => string;
  /**
   * A repository somebody asked for from the GitHub control, and the surface
   * it is to land on.
   *
   * The importer lives on a space's own panel, so the only way to reach it
   * was to draw a space first. This is how the control on the top bar hands
   * one over: it makes the surface, names the repository, and the panel that
   * opens on that surface picks it up and starts. Not persisted \u2014 it is a
   * handover, not a setting, and a reload should not re-import anything.
   */
  /**
   * Everything the Draw panel has made, newest first.
   *
   * HIS WORDS: "stepping out of the tab resets the tab completely while below
   * i would want my previous works to continue as well as the option for a
   * new image", and "tweakable iterations and save each iteration". So the
   * panel keeps nothing of its own \u2014 the work lives here, is persisted, and
   * the panel is a view of it. Leaving the tab and coming back shows what was
   * there.
   */
  draws: {
    id: string;
    /** The iteration this picture landed as, when it was made from the panel. */
    threadId?: string;
    /** Exactly what he typed. Nothing is added to it. */
    prompt: string;
    model: string;
    ratio?: string;
    quality?: string;
    effort?: string;
    format?: string;
    /** The picture it was drawn from, when there was one. */
    reference?: string;
    /**
     * The drawing itself, as a file in the browser's picture store: the
     * document holds its path and never its bytes (`pictures.ts`), because
     * forty drawings in the document were forty pictures in the browser's
     * small storage beside his board, and in every publish.
     */
    picture?: Picture;
    /** A drawing kept before that, as the bytes themselves. Read, never written. */
    image?: string;
    cost: number | null;
    at: number;
  }[];
  addDraw: (d: Omit<StudioState["draws"][number], "id" | "at">) => void;
  removeDraw: (id: string) => void;
  /** `keep`: bring it in over the board keeping what the owner changed (`reimport.ts`). */
  bringRepo: { space: string; repo: string; pageId?: string; keep?: boolean } | null;
  /** Learn on click: the presses a capture held back and the ones asked for (`learn.ts`). Kept with the board, never published. */
  learn: LearnState;
  setLearn: (next: LearnState | ((was: LearnState) => LearnState)) => void;
  /** The reads a capture recorded, with their samples (`standIn.ts`): answered by a built or published site only with the Build option Stand-in server on. */
  standIn: StandIn | null;
  setBringRepo: (v: { space: string; repo: string; pageId?: string; keep?: boolean } | null) => void;
  /**
   * Make the surface: lock every element in it where it was drawn, and set
   * it forming. The layout is the specification, so this is where it stops
   * being a set of coordinates and becomes a proportion.
   */
  lockSpace: (id: string, placed: readonly Placed[]) => Locked[];
  /** How far a surface has formed, on the timeline's own driver. */
  formSpace: (id: string, p: number) => void;
  /** Move or resize a surface: its boundary and everything locked in it go together. */
  resizeSpace: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  updateSpace: (id: string, patch: Partial<Space>) => void;
  removeSpaces: (ids: string[]) => void;
  /** The model and step order for one part, or null to let the route decide. */
  setPlan: (nodeId: string, plan: Plan | null) => void;

  /* pages */
  addPage: (name?: string) => string;
  removePage: (id: string) => void;
  updatePage: (id: string, patch: Partial<StudioPage>) => void;
  setActivePage: (id: string) => void;
  movePage: (id: string, delta: number) => void;

  /* selection + view */
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** The page's background: picked like a part, cut, and put back. */
  selectBackground: () => void;
  cutBackground: () => boolean;
  pasteBackground: () => boolean;
  /** Cut takes what is selected — parts or the background — and paste puts back whatever was cut last. */
  cutNodes: (ids: string[]) => boolean;
  /** Hold a copy of these parts for paste, leaving them where they are. */
  copyNodes: (ids: string[]) => boolean;
  pasteNodes: () => boolean;
  /**
   * Parts from elsewhere (another site's board: Remix) put on the open page
   * as they are given, each with a new id, as one undo step; held together
   * as a group when there is more than one and `group` names it; the faces
   * they are set in added to the site's carried fonts. Returns the new ids,
   * which are picked.
   */
  placeNodes: (nodes: StudioNode[], opts?: { group?: string; fonts?: CarriedFont[]; keyframes?: { name: string; frames: unknown[] }[] }) => string[];
  cut: () => boolean;
  paste: () => boolean;
  setTool: (t: Tool) => void;
  setInk: (patch: { hue?: number; width?: number }) => void;
  setDrawKind: (kind: DrawKind) => void;
  setZoom: (z: number) => void;
  /** Set by the board's fit only: floored at `FIT_MIN`, not `ZOOM_MIN`. */
  setFitZoom: (z: number) => void;
  /** What the board's fit last asked for. The zoom keys never go above it. */
  fitAt: number;
  setPan: (p: { x: number; y: number }) => void;
  setFrameWidth: (w: number) => void;
  requestFit: () => void;
  /** Absolute positions during a drag; no history entry (commit() first). */
  setPositions: (positions: Record<string, { x: number; y: number }>) => void;

  /* document */
  setFormat: (id: string, value: string | number | boolean) => void;
  resetFormat: () => void;
  setShowAllFormat: (v: boolean) => void;
  setShowWires: (v: boolean) => void;
  setStatesOn: (keys: string[]) => void;
  setMode: (m: BoardMode) => void;
  setMenuShape: (v: "square" | "round") => void;
  /** Start placing the lamp, or stop: `true` remembers the lamp to fall back to. */
  setPlacingLight: (v: boolean) => void;
  /** Give up on placing it and put the lamp back where it was. */
  cancelPlacingLight: () => void;
  /** The light, mid-air between the menu and the page. */
  setLightCarry: (at: { x: number; y: number } | null) => void;
  setMenuSpin: (turns: number) => void;
  rememberColour: (colour: string) => void;
  setCompanion: (patch: Partial<StudioState["companion"]>) => void;
  hideFeature: (id: string) => void;
  restoreFeature: (id: string) => void;
  restoreAllFeatures: () => void;
  setBrief: (patch: Partial<StudioBrief>) => void;
  setLook: (patch: Partial<Look>) => void;
  /**
   * A theme put on the site (`siteTheme.ts`), as one undo step named for it:
   * the palette, the Format fields it drives, and the sample page's parts
   * restyled (`starterPage.ts`), words and links kept. `fresh` builds the
   * whole sample page, for a new site.
   */
  applyTheme: (theme: SiteTheme, opts?: { tryThese?: TryItem[]; fresh?: boolean; siteName?: string; settings?: Partial<ThemeRollSettings> }) => void;
  /**
   * An import is one undo step (tests/bring-again.mjs). `historyMark` before
   * it starts; `oneStepSince(mark)` once it has landed folds every
   * checkpoint it took into the first, so one Ctrl+Z is the board before it.
   */
  historyMark: () => number;
  oneStepSince: (mark: number) => void;
  /**
   * Swap-all (`siteColours.ts`): recolour exactly the spots that wear `from`
   * — for one use, or every use — and the page when it wore it. One undo.
   * `palette` is the resolved one, so a part naming a role is read as what
   * it shows. Returns the parts it touched.
   */
  swapColourAll: (from: string, to: string, palette: Palette, opts?: { use?: ColourUse; only?: string[] }) => string[];
  /** Swap-all for a face: every part (and run) set in `from` set in `to`. One undo. */
  swapFontAll: (from: string, to: FaceTo, only?: string[], patch?: Record<string, number>) => string[];
  /** Each of these parts patched by its own function, as one undo: an edit made to a whole selection. */
  patchNodes: (ids: string[], fn: (n: StudioNode) => Partial<StudioNode>) => void;
  addMotion: () => string;
  updateMotion: (id: string, patch: Partial<MotionAsset>) => void;
  removeMotion: (id: string) => void;
  setMotionFrame: (id: string, at: number, src: string | null) => void;
  moveMotionFrame: (id: string, at: number, delta: number) => void;
  /** Put a crate on a part, where it plays as the part's picture; null takes it off. */
  attachMotion: (id: string, part: string | null) => void;
  addTexture: (layer: TextureLayer) => void;
  updateTexture: (id: string, patch: Partial<TextureLayer>) => void;
  removeTexture: (id: string) => void;
  moveTexture: (id: string, delta: number) => void;
  mergeTexture: (id: string, src: string) => void;
  clearPage: (pageId: string) => void;
  /** Keep what Claude found, each finding beside the prompt it was about. */
  recordAsk: (input: { mode: string; model?: string; revisions: Revision[] }) => void;
  /** An API call came back: hang a thread off the live one and stand on it. */
  landThread: (input: { mode: string; model?: string; ask: string; answer: string; changes?: string[]; sketch?: { strokes: [number, number][][]; words: string }; state?: "running" | "done" | "cut"; madeId?: string; id?: string }) => string;
  /** Say which part an iteration made, once it is known. */
  noteMade: (threadId: string, madeId: string) => void;
  /** How the process behind one iteration ended: still going, done, or given up on. */
  markThread: (id: string, state: "running" | "done" | "cut") => void;
  /**
   * The iteration being worked in.
   *
   * Distinct from the live one, which is whatever landed last, and from the
   * open one, which is whatever is being read below. This is the one the
   * person has put their flag in: the section follows it, the next ask
   * hangs off it, and it survives a reload, because "where was I" is the
   * question a timeline exists to answer.
   */
  setCurrentThread: (id: string | null) => void;
  /** Cut one thread; its children re-hang from its parent and the board goes to whatever is live after. */
  pruneThread: (id: string) => void;
  /** Put the board back on a thread. */
  standOn: (id: string) => void;
  /** Keep a thread and its answer in view at the top of the book, or let it go. */
  togglePinnedThread: (id: string) => void;
  /** Hold the book open as a panel beside the board, or let it be a dialog again. */
  setBookPinned: (v: boolean) => void;
  /** Open one iteration in the section under the timeline, or close it. */
  openThread: (id: string | null) => void;
  /** Put a drawing on the make-real queue. The board closes; the queue works. */
  enqueueDraw: (job: Omit<DrawJob, "id" | "status" | "queued">) => string;
  /** How a job is getting on. */
  updateJob: (id: string, patch: Partial<DrawJob>) => void;
  /** The person's answer to the one question a job asked; the job goes back on the queue with it. */
  answerJob: (id: string, answer: string) => void;
  /** Forget the jobs that are over. */
  clearFinishedJobs: () => void;
  /**
   * Add to what the live thread did.
   *
   * A thread lands with what Claude changed, but the work an answer leads to
   * — the files pushed, the site built on Vercel — happens after it. That is
   * still what this iteration did, so it is written on the same card.
   */
  /** Lines onto an iteration's card. `on` when the answer may outlive the live one. */
  noteThread: (lines: string[], on?: string) => void;
  /**
   * Add to what this iteration spent at the renderer.
   *
   * Token counts are an estimate of a bill; a renderer call is the bill. It
   * accumulates, because one drawing can reach the renderer more than once.
   */
  /**
   * Add what a call cost, how long it took and who was paid.
   *
   * Every paid call goes through here — Claude per token and the renderer
   * per press — so an iteration carries one honest bill rather than a
   * number the bench knew and nobody else did.
   */
  /** What a call cost, onto an iteration. `on` when the answer may outlive the live one. */
  noteSpend: (spend: Spend, on?: string) => void;
  /** One pass's own line on the bill: what ran, how long, what it cost. */
  notePass: (line: string, on?: string) => void;
  /** The real progress of the work behind an iteration, 0..1. Only ever climbs. */
  noteProgress: (threadId: string | null | undefined, p: number | null) => void;
  /** Move one thread or piece on the trail. Only that one moves. */
  moveThread: (id: string, x: number, y: number) => void;
  /** Vine a piece to the next call, or cut it loose. */
  toggleDraftPiece: (id: string) => void;
  /** Nothing is vined to the next call. */
  clearDraft: () => void;
  /** These strokes are one drawing, whatever the guess says. */
  joinInk: (ids: string[]) => void;
  /** These strokes are each their own drawing again. */
  splitInk: (ids: string[]) => void;
  /** After a call: what went, and what it cost. */
  recordSent: (threadId: string, sent: Record<string, string>, usage: { sent: number; skipped: number; cached?: number; input?: number }) => void;
  /** Put the trail back on its staircase. */
  resetThreadSpots: () => void;
  /** Take a critique's proposed prompt as the prompt, and note that it was taken. */
  applyRevision: (entryId: string) => void;
  resetAll: () => void;
  loadDoc: (doc: Partial<Doc> & { frameWidth?: number }) => void;
  undo: () => void;
  redo: () => void;
  /**
   * Go back (negative) or forward (positive) this many steps at once, as one
   * change of state: the history list's press. Fifty undos in a row would be
   * fifty saves of the whole document.
   */
  travel: (steps: number) => void;
  commit: () => void;
}

/**
 * WHAT A PRESS ON THE BOARD STARTS, AS A TABLE.
 *
 * Which drag you get is decided by what is under the hand, not by a mode
 * chosen in the bar. This file holds that decision and nothing else: plain
 * facts about the press go in (`PressFacts`, read off the board by
 * `pressRead.ts`), and the first rule whose `when` holds names what the press
 * does. The board (`canvas/DesktopCanvas.tsx`) carries the rule out.
 *
 * So a part that will not move is a fix in one place: find the row it lands
 * on. Each row has its own test (`tests/press-rules.mjs`).
 *
 * No imports that run: the table is pure, so a test can load it bare.
 */

export type Tool = "select" | "erase" | (string & {});

/** The part a fact describes: the one under the hand, or the one a press picks. */
export type PartFacts = {
  /** A solid: turned by hand once opened (`helpers.ts#HANDS_ON`). */
  handsOn: boolean;
  /** A button, link or tab (`control.ts`). */
  control: boolean;
  /** A component grabbed whole: a button, badge, tab, copy bar or card (`components.ts#GRABBED`). */
  whole: boolean;
  /** Holds other parts (`holds.ts#ownsOthers`). */
  holds: boolean;
  /** A smaller part lies under the hand inside it (`boardStates.ts#partUnder`). Read on a second press only. */
  inner: boolean;
  /** Has words of its own, or is picked alone and its kind carries content. */
  words: boolean;
  /** Points somewhere and reads its own link (`parts#isLinkable`). */
  link: boolean;
  locked: boolean;
};

export type PressFacts = {
  /** 0 main, 1 middle, 2 right. */
  button: number;
  tool: Tool;
  alt: boolean;
  shift: boolean;
  /** Ctrl, or ⌘ on a Mac. */
  mod: boolean;
  /** On a locked group's own resize handle. */
  groupHandle: boolean;
  /** On a part's resize handle. */
  resizeHandle: boolean;
  /** On a part (`[data-node-id]`). */
  onPart: boolean;
  /** Inside the page (`[data-frame]`). */
  onPage: boolean;
  /** On a drawing, region or wire (`[data-shape-id]`, not the live stroke). */
  onShape: boolean;
  /** The second press on the same part, soon and close (`DOUBLE_MS`, `DOUBLE_SLOP`). */
  twice: boolean;
  /** The part under the hand. */
  hit: PartFacts | null;
  /** What one press picks: the control that owns the hit (`owner.ts`), or the hit itself. */
  picks: (PartFacts & {
    /** The pick is an owner, not the part under the hand. */
    owner: boolean;
    /** It is the only part picked once this press has picked. */
    alone: boolean;
  }) | null;
};

export type PressKind =
  | "ignore" | "group-resize" | "pan" | "resize" | "go-in" | "open-words"
  | "marquee-across" | "hold-solid" | "follow-link" | "move"
  | "pick-shape" | "marquee" | "erase" | "draw";

type Rule = { does: PressKind; when: (f: PressFacts) => boolean };

const select = (f: PressFacts) => f.tool === "select";

/** In order: the first that holds wins. */
export const PRESS_RULES: readonly Rule[] = [
  /* The right button opens the menu (`RadialMenu.tsx`); the board takes nothing. */
  { does: "ignore", when: (f) => f.button === 2 },

  /* A locked group's own handle: the group is resized as one thing (`groupScale.ts`). */
  { does: "group-resize", when: (f) => f.groupHandle && select(f) && f.button === 0 },

  /*
   * The cursor pans, so there is no pan tool. The bare ground outside the
   * page pushes the view; the nebula is the ground you push, the page the
   * surface you select on. Alt-drag and the middle button pan from anywhere,
   * over the page too, for the times the rule is not what you wanted.
   *
   * A wire or a drawing is on the page even though it is a sibling of
   * `[data-frame]`, not a child: without `onShape` a press on one would be
   * bare ground and start a pan instead of reaching the shape.
   */
  { does: "pan", when: (f) => f.button === 1 || (select(f) && f.alt) || (select(f) && !f.onPart && !f.onPage && !f.onShape) },

  /* A resize handle wins only while you are pointing at things: with the pen in hand, a handle under the stroke's first pixel is not an instruction. */
  { does: "resize", when: (f) => f.resizeHandle && f.onPart && select(f) },

  /* TWO PRESSES ON A PART THAT HOLDS OTHERS GO IN: the smallest part under the hand, inside it, even one it covers. Escape climbs back out. */
  { does: "go-in", when: (f) => select(f) && !!f.hit && f.twice && !f.shift && !f.hit.handsOn && !f.hit.control && f.hit.holds && f.hit.inner },

  /*
   * TWO PRESSES ON WORDS OPEN THE WORDS, ON THE CANVAS (`WordsInPlace.tsx`),
   * even when the first press picked the button that owns them; in the
   * panel's WORDS box where they are not drawn as one piece of text. A part
   * that points somewhere goes there instead (below); its words are Enter
   * away. When nothing opens, the press is decided again as a first press
   * (`afterWordsDeclined`).
   */
  { does: "open-words", when: (f) => select(f) && !!f.hit && f.twice && !f.hit.link && !f.shift && !f.hit.handsOn && f.hit.words },

  /*
   * A PART THAT HOLDS OTHERS MOVES ON A PLAIN DRAG (J, 2026-10-06: "Always
   * moves"); Ctrl or ⌘ draws the box across it instead. A control, or a
   * component grabbed whole, is always grabbed. Released without a drag, the
   * part is picked as any part is.
   */
  { does: "marquee-across", when: (f) => select(f) && !!f.picks && !f.twice && !f.shift && f.mod && !f.picks.control && !f.picks.whole && f.picks.holds },

  /*
   * THE SECOND PRESS OPENS A SOLID FOR TURNING. Turning is a drag across it,
   * the same gesture that moves every other part, so the two are told apart
   * by how many presses start them: one selects and moves, two say "I am
   * turning this one".
   */
  { does: "hold-solid", when: (f) => select(f) && !!f.picks && f.twice && !f.picks.owner && !f.picks.locked && f.picks.handsOn && f.picks.alone },

  /*
   * A BUTTON IN THE BUILDER IS PRESSABLE IN THE BUILDER: two presses on a
   * part that reads its own link go where it points (`tests/press-in-builder.mjs`).
   * The same gesture as opening a solid, deliberately.
   */
  { does: "follow-link", when: (f) => select(f) && !!f.picks && f.twice && !f.picks.owner && !f.picks.locked && f.picks.alone && f.picks.link },

  /*
   * ONE PRESS PICKS THE CONTROL THAT OWNS WHAT WAS PRESSED, and a drag moves
   * it with everything it holds (`owner.ts`). Shift, and a press on something
   * already picked, take exactly what is under the hand. A face as big as its
   * frame moves the frame (`stateFrames.ts#liftToFrame`).
   */
  { does: "move", when: (f) => select(f) && f.onPart },

  /* Drawings, regions and wires pick on a press too, not only by marquee. */
  { does: "pick-shape", when: (f) => select(f) && f.onShape },

  /* Empty space inside the page: picks the page's background, and a drag draws a marquee. */
  { does: "marquee", when: select },

  /* A press erases what is under it, then the hold sweeps; the whole sweep is one undo. */
  { does: "erase", when: (f) => f.tool === "erase" },

  /* Any other tool is a pen. */
  { does: "draw", when: () => true },
];

/** What a press does: the first rule that holds. */
export function pressRule(f: PressFacts): PressKind {
  return PRESS_RULES.find((r) => r.when(f))!.does;
}

/** When two presses found no words to open, the press is decided again as a first one. */
export const afterWordsDeclined = (f: PressFacts): PressFacts => ({ ...f, twice: false });

/** The selection after a press picks `id`: Shift toggles it, a picked part keeps the selection, else its group or itself. */
export function picksAfter(selection: readonly string[], id: string, group: readonly string[] | null, shift: boolean): string[] {
  if (shift) return selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
  if (selection.includes(id)) return [...selection];
  return group?.length ? [...group] : [id];
}

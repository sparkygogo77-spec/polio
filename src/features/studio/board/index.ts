/* The board module's pure door: the press rules (what a press on the board starts). No React, no store, every import ends in .ts, so node tests load it.
 * The store is behind ./store.ts, the board's screens behind ./ui.ts, and what the board reads off states behind ./reads.ts. See README.md. */
export { PRESS_RULES, afterWordsDeclined, picksAfter, pressRule } from "./press.ts";
export type { PartFacts, PressFacts, PressKind, Tool } from "./press.ts";

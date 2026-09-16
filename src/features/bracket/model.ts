/**
 * The bracket: what the latest box on the timeline could become next.
 *
 * One typed structure, read by the page and by nothing else, so that the
 * day the sample content is swapped for something live is a change of
 * source and not a rewrite. Everything a box shows is derived here from
 * the item's own numbers, in one direction, so the colours cannot
 * disagree with each other:
 *
 *   difficulty  ->  model and effort
 *   model + tokens  ->  cost
 *   cost  ->  the band, green, yellow or red
 *
 * The band is the one thing that colours a box. Time is printed as a
 * figure and never as a colour, because it is the one number that varies
 * on its own. This file imports nothing, so the checks in
 * `tests/bracket.mjs` can read it straight off the disk.
 */

/** A lane is a row of the bracket. Each box shows one item of its lane at a time. */
export interface Lane {
  id: string;
  /** What the lane is for, in a word or two: the box's label. */
  label: string;
  items: Item[];
}

/** One thing the latest box could turn into. */
export interface Item {
  id: string;
  /** A fix prints what failed, in mono. A step prints a recommendation. */
  kind: "fix" | "step";
  /** One line: what this would do. */
  title: string;
  /** For a fix, the error or failing measurement as it was seen. For a step, the recommendation. */
  detail: string;
  /** 1 to 5. Picks the model and the effort, and nothing else. */
  difficulty: Difficulty;
  /** Estimated tokens for the whole job. With the model, these give the cost. */
  tokens: { in: number; out: number };
  /** Estimated minutes, wall clock. Printed as a figure. */
  minutes: number;
}

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** What the bracket grows from: the latest box on the timeline. */
export interface Generation {
  /** The box it sprouts from. */
  from: { id: string; label: string; made: string };
  /** The three rows, top to bottom. */
  lanes: [Lane, Lane, Lane];
}

/* ------------------------------------------------------------------ */
/* Difficulty picks the model                                           */
/* ------------------------------------------------------------------ */

export type ModelId = "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5";
export type Effort = "low" | "medium" | "high" | "xhigh";

export interface Choice {
  model: ModelId;
  /** The name a person reads along the bottom edge. */
  name: string;
  effort: Effort;
}

/** The model and effort for a difficulty. One table, one direction. */
export const PICKS: Record<Difficulty, Choice> = {
  1: { model: "claude-haiku-4-5", name: "Haiku 4.5", effort: "low" },
  2: { model: "claude-haiku-4-5", name: "Haiku 4.5", effort: "medium" },
  3: { model: "claude-sonnet-5", name: "Sonnet 5", effort: "high" },
  4: { model: "claude-opus-5", name: "Opus 5", effort: "high" },
  5: { model: "claude-opus-5", name: "Opus 5", effort: "xhigh" },
};

export const pickFor = (difficulty: Difficulty): Choice => PICKS[difficulty];

/* ------------------------------------------------------------------ */
/* Model and tokens give the cost                                       */
/* ------------------------------------------------------------------ */

/** Dollars per million tokens, in and out. The first-party list prices, as read on 2026-06-24. */
export const RATES: Record<ModelId, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-opus-5": { in: 5, out: 25 },
};

/** The estimated cost of an item, in dollars. */
export function costOf(item: Pick<Item, "difficulty" | "tokens">): number {
  const rate = RATES[pickFor(item.difficulty).model];
  return (item.tokens.in * rate.in + item.tokens.out * rate.out) / 1_000_000;
}

/* ------------------------------------------------------------------ */
/* Cost sets the colour                                                 */
/* ------------------------------------------------------------------ */

export type Band = "green" | "yellow" | "red";

/** Where green ends and where yellow ends, in dollars. */
export const BANDS = { green: 0.05, yellow: 0.5 } as const;

export const bandOf = (cost: number): Band => (cost < BANDS.green ? "green" : cost < BANDS.yellow ? "yellow" : "red");

/** The one line inside the rim: the cost band's colour. */
export const BAND_COLOUR: Record<Band, string> = {
  green: "oklch(0.76 0.17 148)",
  yellow: "oklch(0.83 0.16 92)",
  red: "oklch(0.66 0.2 27)",
};

/** The outer rim every box of a generation wears: the menu's blue, hue 205. */
export const RIM = "oklch(0.72 0.15 205)";

/* ------------------------------------------------------------------ */
/* What a box prints                                                    */
/* ------------------------------------------------------------------ */

/** Everything a box shows, derived once from the item. */
export interface Shown {
  item: Item;
  pick: Choice;
  cost: number;
  band: Band;
  /** "$0.03", "$1.20": two decimals, and a cent floor so nothing reads as free. */
  costSaid: string;
  /** "4 min", "1 h 10 min": the figure, never a colour. */
  timeSaid: string;
}

export function shown(item: Item): Shown {
  const pick = pickFor(item.difficulty);
  const cost = costOf(item);
  return { item, pick, cost, band: bandOf(cost), costSaid: saidCost(cost), timeSaid: saidMinutes(item.minutes) };
}

export const saidCost = (dollars: number): string => `$${Math.max(0.01, dollars).toFixed(2)}`;

export function saidMinutes(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** The item after this one in its lane, round the end: what Refresh swaps in. Never the same item, unless the lane has one. */
export function nextIn(lane: Lane, id: string): Item {
  const i = lane.items.findIndex((it) => it.id === id);
  return lane.items[(i + 1) % lane.items.length]!;
}

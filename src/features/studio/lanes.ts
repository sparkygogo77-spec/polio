/**
 * The lanes: three offers hanging off the end of the timeline.
 *
 * They are not part of the history and nobody places them. They sit past
 * the last real box, anticipating work that nobody has created yet, and
 * when a box is added they move along and stay at the end. Each lane
 * offers one item at a time, an update or an improvement, with a Refresh
 * that swaps in another from the same lane. When a lane's work is carried
 * out it becomes a blue iteration box in the normal run of boxes, and the
 * lanes move out past it again.
 *
 * One typed structure, read by the lanes and by nothing else, so that the
 * day the sample content is swapped for something live is a change of
 * source and not a rewrite. Everything a lane box shows is derived here
 * from the item's own numbers, in one direction, so the colours cannot
 * disagree with each other:
 *
 *   difficulty  ->  model and effort
 *   model + tokens  ->  cost
 *   cost  ->  the band, green, yellow or red
 *
 * The band is the one thing that colours a lane box's inner line. Time is
 * printed as a figure and never as a colour, because it is the one number
 * that varies on its own. This file imports nothing, so the checks in
 * `tests/lanes.mjs` can read it straight off the disk.
 */

/** A lane is one row of offers. It shows one item at a time. */
export interface Lane {
  id: string;
  /** What the lane is for, in a word or two: the box's label. */
  label: string;
  /** The band every item in it falls in: the lane's colour, and its vine's. */
  band: Band;
  items: Item[];
}

/** One offer: an update (a fix) or an improvement (a step). */
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
  /**
   * What carrying this out actually changed on the site, written from the
   * work itself and not from a template. It becomes the blue box's own
   * content. Absent until the work has really been done, and the lane's
   * key says so rather than inventing one.
   */
  did?: string;
}

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * The three lanes, top to bottom: green, yellow, red. His words: green
 * always at the top, yellow in the middle, red at the bottom, each lane's
 * vine and the line inside its rim in that colour. So the lanes are not
 * kinds of work but bands of it, and an item's own band, which its cost
 * gives it, says which lane it is in. Nothing can put a red item in the
 * green lane.
 */
export type Lanes = [Lane, Lane, Lane];

/** The band of each lane, top to bottom. */
export const LANE_BANDS: [Band, Band, Band] = ["green", "yellow", "red"];

/** What a lane is called, on its box: the size of the work in it, in a word. */
export const LANE_LABEL: Record<Band, string> = { green: "Small", yellow: "Middling", red: "Big" };

/**
 * The three lanes from a flat list of offers: each item goes to the lane of
 * its own band, in the order given. The one way lanes are made, so the
 * source that replaces the sample hands over items and never lanes.
 */
export function lanesOf(items: Item[]): Lanes {
  return LANE_BANDS.map((band) => ({
    id: band,
    label: LANE_LABEL[band],
    band,
    items: items.filter((it) => shown(it).band === band),
  })) as Lanes;
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

/* ------------------------------------------------------------------ */
/* What a lane box prints                                               */
/* ------------------------------------------------------------------ */

/** Everything a lane box shows, derived once from the item. */
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

/** The item after this one in its lane, round the end: what Refresh swaps in. Never the same item, unless the lane has one; nothing, if the lane is empty. */
export function nextIn(lane: Lane, id: string): Item | undefined {
  if (!lane.items.length) return undefined;
  const i = lane.items.findIndex((it) => it.id === id);
  return lane.items[(i + 1) % lane.items.length];
}

/* ------------------------------------------------------------------ */
/* Where they hang                                                      */
/* ------------------------------------------------------------------ */

/** A box on the timeline, in the plot's own coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The mode a lane's work lands as. The timeline reads it to colour the box blue. */
export const LANE_MODE = "lane";

/**
 * Where the three lane boxes stand, from his drawing: a fan off the
 * latest box to its right, centred on that box. The middle lane is
 * beside it, level, its vertical centre the latest box's own. The top
 * lane is diagonally above, up and to the right; the bottom lane
 * diagonally below, down and to the right. One above the centre line,
 * one on it, one under it. Every lane is as tall as the box it hangs
 * off, so the middle's centre is the latest's centre to the pixel. With
 * no box at all they hang off where the first box would be.
 *
 * Diagonal is a real step to the right, three tenths of a box, so the
 * three read as a fan and not as a column. When the chain has wrapped
 * and the row above the latest box has a box in the next column, the top
 * lane stands over part of it: that is where his drawing puts it, and the
 * lane sits under the real box rather than covering it.
 *
 * The lanes stand three gaps past the latest box, not one: the vines
 * into them are the timeline's own ribbon, and at one gap the level
 * vine into the middle lane was a stub twenty pixels long with no run
 * to be a vine in. Sixty gives it one. The stagger of the top and
 * bottom lanes against the middle is unchanged.
 */
export const DIAGONAL = 0.3;
export const REACH = 3;
export function laneRects(from: Rect | null, size: { w: number; h: number }, gap: { x: number; y: number }): [Rect, Rect, Rect] {
  const h = from ? from.h : size.h;
  const x = from ? from.x + from.w + gap.x * REACH : 140;
  const cy = from ? from.y + from.h / 2 : 130 + h / 2;
  const step = h + gap.y;
  const diag = Math.round(size.w * DIAGONAL);
  return [
    { x: x + diag, y: cy - step - h / 2, w: size.w, h },
    { x, y: cy - h / 2, w: size.w, h },
    { x: x + diag, y: cy + step - h / 2, w: size.w, h },
  ];
}

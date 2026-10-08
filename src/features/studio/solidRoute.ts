/**
 * Where a box goes when it is made a solid: the pure half of `solidRun.ts`.
 *
 * Nothing here fetches or reads a key. It is the words that route a box to
 * the object cell of the two-axis table and the model that cell holds,
 * kept apart from the run so a test can read them without a browser.
 */
import { route, type ImageModel } from "./pictures/index.ts";

/** The words that route a box to the object cell. `saysSolid` reads "3d" and "solid" off them. */
export const SOLID_WORDS = "a 3d solid of this box, from its four sides";

/** The model the table routes a box to, from the same table the route reads. */
export function solidModel(): ImageModel | null {
  return route({ making: "object", step: "first", fromImage: true }).model;
}

/** The four views the model takes, in the order its fields name them. */
export const VIEWS = ["front", "back", "left", "right"] as const;
export type View = (typeof VIEWS)[number];

/**
 * What a carried page says about itself: which route read it, and what did
 * and did not travel. Pure, so `tests/repo-import.mjs` can hold it.
 *
 * ONE ORDER OF PRECEDENCE, said once and read the same way every time:
 *   1. a repository made here, carrying its document: copied whole;
 *   2. any other repository deployed at an address: read there, because
 *      that is the site as it renders, and carried exactly;
 *   3. no address: read from its files, carried exactly as they are;
 *   4. none of those: said plainly, with what would give it an address.
 * The panel names which one ran, every time, in his words.
 */
import type { CarryNotes } from "./siteRead";

export type Route =
  | { kind: "document" }
  | { kind: "address"; url: string; ownPage: boolean }
  | { kind: "files"; entry: string; addressFailed?: string | null }
  | { kind: "zip"; name: string }
  | { kind: "typed"; url: string };

/** The route, named. It starts the line on the panel so he can see which one ran. */
export function routeSays(route: Route): string {
  switch (route.kind) {
    case "document": return "Its own document:";
    case "address": return route.ownPage ? `Its own page, ${route.url}:` : `From its address, ${route.url}:`;
    case "files": return route.addressFailed ? `Its address could not be read (${route.addressFailed}), so from its files, ${route.entry}:` : `From its files, ${route.entry}:`;
    case "zip": return `From the zip, ${route.name}:`;
    case "typed": return `From ${route.url}:`;
  }
}

export const NO_NOTES: CarryNotes = { scripts: 0, hover: 0, motion: 0, fonts: 0, hidden: 0, images: 0, imagesLeft: 0 };

export function sumNotes(all: readonly CarryNotes[]): CarryNotes {
  return all.reduce((n, c) => ({
    scripts: n.scripts + c.scripts, hover: n.hover + c.hover, motion: n.motion + c.motion, fonts: n.fonts + c.fonts,
    hidden: n.hidden + c.hidden, images: n.images + c.images, imagesLeft: n.imagesLeft + c.imagesLeft,
  }), { ...NO_NOTES });
}

/**
 * What came in exactly and what could not, in one line.
 *
 * Carried: markup, styles as the page computed them, pictures, hidden
 * pieces as they were, hover and keyframes that matched. Not carried,
 * always named: scripts and handlers, and anything past the width and
 * height read. Fonts travel by their own address, which is said as such.
 */
export function carriedSays(n: number, notes: CarryNotes, read: { width: number; height: number }): string {
  if (!n) return "nothing could be carried.";
  const got: string[] = [`${n} block${n === 1 ? "" : "s"} carried exactly: markup and styles as the page had them`];
  if (notes.images) got.push(`${notes.images} picture${notes.images === 1 ? "" : "s"}`);
  if (notes.hidden) got.push(`${notes.hidden} hidden piece${notes.hidden === 1 ? "" : "s"} kept hidden as ${notes.hidden === 1 ? "it was" : "they were"}`);
  if (notes.hover) got.push(`${notes.hover} hover rule${notes.hover === 1 ? "" : "s"}`);
  if (notes.motion) got.push(`${notes.motion} keyframe set${notes.motion === 1 ? "" : "s"}, so motion can run again`);
  if (notes.fonts) got.push(`${notes.fonts} font face${notes.fonts === 1 ? "" : "s"}, loading from ${notes.fonts === 1 ? "its" : "their"} own address`);
  const not: string[] = [];
  not.push(notes.scripts ? `${notes.scripts} script${notes.scripts === 1 ? "" : "s"} or handler${notes.scripts === 1 ? "" : "s"}, so behaviour` : "behaviour: no scripts ran");
  if (notes.imagesLeft) not.push(`${notes.imagesLeft} picture${notes.imagesLeft === 1 ? "" : "s"} too large to keep, left as ${notes.imagesLeft === 1 ? "its" : "their"} address`);
  not.push(`anything past the ${read.width}×${read.height} read`);
  return `${got.join(", ")}. Not carried: ${not.join("; ")}.`;
}

/** Bytes one carried block may put into the document. Past this it is a picture of itself, and says so. */
export const CARRY_MAX_BYTES = 240 * 1024;

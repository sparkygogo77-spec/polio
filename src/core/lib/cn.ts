import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * THE FOUR NAMED SIZES HAVE TO BE DECLARED HERE, or half of them vanish.
 *
 * `tailwind-merge` knows Tailwind's own scale and nothing else, so a custom
 * `text-*` name is read as a TEXT COLOUR: `cn("text-plain", "text-fg-muted")`
 * came out as `text-fg-muted` alone, the size dropped as a duplicate, and the
 * words fell back to the 13px they inherited. Silently, in every component
 * that sets a size and a colour in one `cn` call.
 *
 * It is the failure mode a rename like this has, and the only reason it was
 * caught is that the sweep was measured rather than eyeballed: a census of
 * every rendered font size in the Builder, before and against after, which
 * showed 9, 10 and 11px counts falling and 13px rising by the same number.
 * `tests/type-scale.mjs` holds it now.
 *
 * An arbitrary value never had the problem — `text-[11px]` can only be a
 * size — which is why nothing was wrong until the names arrived.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": ["text-fine", "text-small", "text-plain", "text-large"] } },
});

/** Merge Tailwind classes safely (later classes win). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

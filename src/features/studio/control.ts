/**
 * Is this part a CONTROL, as against scenery?
 *
 * One answer for the whole Builder, so the rules that must tell the two apart
 * ask the same question. A control is something a visitor presses: one of the
 * button parts, anything carrying a link, or anything the capture recorded as
 * a button or a link (the browser's own role, which a capture writes at the
 * head of `data`: "button, named …", "link, …"). Everything else — a box, a
 * panel, a banner, a wrapper, a paragraph — is scenery.
 *
 * WHY IT EXISTS. The marquee rule starts a marquee on a part that holds
 * others, so a captured board's panels and wrappers are drawn ACROSS rather
 * than dragged. All eight sidebar buttons on his home page hold their icon
 * (n_ctaprimary_59 holds n_drawnicon_60, and so on), and the thirteen on his
 * docs page hold nothing: under the holding rule alone the same control
 * dragged on one page and drew a marquee on the other. A control is always
 * grabbed, whatever it holds.
 *
 * The same distinction as "keep the control over the container that merely
 * repeats it" when two copies of one thing are reduced to one; a pass that
 * needs it should ask this rather than grow its own.
 */

/** The parts that are buttons in their own right: the same three the board already dresses with an icon. */
export const CONTROL_PARTS: ReadonlySet<string> = new Set(["cta-primary", "quick-action", "follow"]);

export interface ControlLike {
  featureId: string;
  link?: unknown;
  data?: string | null;
}

export function isControl(n: ControlLike): boolean {
  if (CONTROL_PARTS.has(n.featureId)) return true;
  if (n.link) return true;
  return /^\s*(button|link)\b/i.test(n.data ?? "");
}

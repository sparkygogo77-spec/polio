/**
 * What's new: one line per feature a person can find on screen.
 *
 * J (2026-10-25): a feature that lands should be pointed out the first time
 * he opens the Builder after the update that brings it. Every feature PR adds
 * its line here (AGENTS.md says so). An entry whose control is not on screen
 * is skipped quietly, and shown later when its panel opens.
 *
 * Pure: no React, no store, so `tests/whats-new.mjs` imports it directly.
 */

export interface WhatsNewEntry {
  /** Stable for ever: a browser remembers it has seen this id. */
  id: string;
  /** The control to point at: a selector, or a function that finds it. */
  find: string | (() => Element | null | undefined);
  /** One short line in J's words, said after "New: ". */
  text: string;
  /** The PR (or commit) that brought it. */
  since: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "parts-bind",
    find: "[data-instance-row]",
    text: "A part that is a component says so: edit the component and they all follow, or change just this one",
    since: "parts-bind",
  },
  {
    id: "export",
    find: () => [...document.querySelectorAll("[cmdk-item]")].find((el) => el.textContent?.includes("Export…")),
    text: "Export: the site as a Next.js + Tailwind app, exact look or clean code, as a zip or to its repo",
    since: "#412",
  },
  {
    id: "variations",
    find: "[data-variations-open]",
    text: "Make variations: better versions of this site, each a copy, beside the original",
    since: "#411",
  },
  {
    id: "idea",
    find: "[data-offer-idea]",
    text: "Start from an idea: say what the site is, and Claude plans it from catalogue parts",
    since: "#406",
  },
  {
    id: "system-tab",
    find: '[data-side-panel] [aria-label="System"]',
    text: "The System tab: this site's tokens and components in one place",
    since: "#398",
  },
  {
    id: "house-style",
    find: "[data-house-toggle]",
    text: "House style: one look every site can share; a change here reaches them all",
    since: "#408",
  },
  {
    id: "move",
    find: () => document.querySelector("[data-side-panel] [data-move-up]")?.parentElement,
    text: "Move up and Move down: trade places with the part beside it, what it holds with it",
    since: "#393",
  },
  {
    id: "hover",
    find: '[data-part-section="hover"] > [data-section-head]',
    text: "Hover: what this part does under the pointer, captured or set by you",
    since: "#395",
  },
  {
    id: "wheel-move-hover",
    find: () => document.querySelector('[data-tray-item="move-up"]')?.closest("[data-tray]"),
    text: "Move and Hover are on the wheel too, in its tray",
    since: "#402",
  },
  {
    id: "builds-start",
    find: "[data-start-row]",
    text: "Start something: import a site, start from an idea, make variations, a blank site, or the agents, from Builds",
    since: "builds-home",
  },
  {
    id: "builds-status",
    find: "[data-site-status]",
    text: "Each site's card says where it is live, its last export, which style it uses, its copies, and the agents on it",
    since: "builds-home",
  },
  /* The PR number is not known when the branch is pushed: "agents-entry" stands in for it. */
  {
    id: "agents",
    find: "[data-agents-button]",
    text: "Agents: ask for a change and watch the agents work, in a dock on the right",
    since: "agents-entry",
  },
  {
    id: "ask-agents",
    find: '[data-tray-item="ask-agents"]',
    text: "Ask agents about this part: change it, suggest features, check security, build its backend, explain",
    since: "agents-entry",
  },
];

/**
 * The entry's control, if it is on screen: there, drawn, and inside the
 * window. Never throws: a bad selector or a finder that breaks is a control
 * that is not here.
 */
export function onScreen(entry: Pick<WhatsNewEntry, "find">, root: Pick<Document, "querySelector"> = document): Element | null {
  let el: Element | null | undefined = null;
  try {
    el = typeof entry.find === "string" ? root.querySelector(entry.find) : entry.find();
  } catch {
    return null;
  }
  if (!el || typeof (el as Element).getBoundingClientRect !== "function") return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) return null;
  const seen = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true });
  return seen === false ? null : el;
}

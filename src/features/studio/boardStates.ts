/**
 * THE PAGE'S HIDDEN STATES, SHOWN ON THE BOARD TO DESIGN THEM.
 *
 * A page brought in from code starts most of itself hidden: PonsStars' play
 * page has its match panel, chart, result and pop-ups behind `hidden`, 375
 * of its 620 parts. They come in as parts of a state group
 * (`StudioNode.state`, `hidden:<hook>`, `pageParts.ts`) and are not drawn
 * where the page opens, so they took no room on the board, could not be
 * seen or arranged, and picking the chart panned to empty space.
 *
 * The States control on the page strip (`StatesChip`) switches them on for
 * the board alone (`statesOn`): a group by its hook (`hidden:match-panel`),
 * or a preview screen of the repository (`screen:mid-match`), which shows
 * exactly the parts that screen shows (read off the page as its own code
 * builds it, at import: `styleSource.screens`) and hides the rest of its
 * page. Nothing else changes: the parts keep their state, so the published
 * and exported page is hidden by default as the code expects, and a style
 * made while a state is on is a style on that part, which the style layer
 * writes under its hook (`styleLayer.ts`).
 *
 * Pure: `tests/board-states.mjs` holds it on PonsStars.
 */

/** One preview screen, as read at import: its page and the hooks it shows. */
export interface ScreenRead {
  name: string;
  label?: string;
  /** The page file it is a state of (`web/index.html`). */
  page: string;
  /** Every hook drawn on that page in this screen. */
  shows: string[];
}

export interface StateNode {
  id?: string;
  pageId: string;
  hooks?: Record<string, string> | null;
  state?: { group: string; option: number } | null;
}

/** A group's own hook: `hidden:match-panel` is match-panel; a template's group names its template. */
export const groupHook = (group: string): string => group.replace(/^hidden:(template:)?/, "");

/** The key a screen is switched on by. */
export const screenKey = (name: string) => `screen:${name}`;

/**
 * What the board draws, with these states on. `pageOf` turns a screen's page
 * file into the board's page id.
 */
export function boardShows(on: readonly string[], screens: readonly ScreenRead[] | null | undefined, pageOf: (file: string) => string | null) {
  const groups = new Set(on.filter((k) => !k.startsWith("screen:")));
  const byPage = new Map<string, Set<string>[]>();
  for (const s of screens ?? []) {
    if (!on.includes(screenKey(s.name))) continue;
    const page = pageOf(s.page);
    if (!page) continue;
    const list = byPage.get(page) ?? [];
    list.push(new Set(s.shows));
    byPage.set(page, list);
  }
  return (n: StateNode): boolean => {
    if (n.state && groups.has(n.state.group)) return true;
    const shown = byPage.get(n.pageId);
    if (!shown) return !n.state;
    const hook = n.hooks?.["data-hook"];
    if (hook) return shown.some((s) => s.has(hook));
    /* A part with no hook of its own goes with its group, or stays as the page opens. */
    return n.state ? shown.some((s) => s.has(groupHook(n.state!.group))) : true;
  };
}

/** The hidden groups on one page, by hook, with their part counts: templates last. */
export function hiddenGroups(nodes: readonly StateNode[], pageId: string): { group: string; hook: string; parts: number; template: boolean }[] {
  const count = new Map<string, number>();
  for (const n of nodes) if (n.pageId === pageId && n.state?.group?.startsWith("hidden:")) count.set(n.state.group, (count.get(n.state.group) ?? 0) + 1);
  return [...count].map(([group, parts]) => ({ group, hook: groupHook(group), parts, template: group.startsWith("hidden:template:") }))
    .sort((a, b) => Number(a.template) - Number(b.template) || b.parts - a.parts || a.hook.localeCompare(b.hook));
}

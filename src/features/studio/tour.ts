/**
 * What's new: the card a site shows a visitor about what it has, step by step.
 *
 * The owner's ask, from the update cards on trading sites: a centred card
 * with the real thing playing on top, a title, two or three plain lines, an
 * optional "where to find it" path with a switch, one action button, dots,
 * Back / Next / Finish, and "See previous updates". Each step points at a
 * feature the site really has (`tourChoices`), and the card draws that part,
 * live, scaled into it (`LiveSite`'s `partView`), never a screenshot.
 *
 * Pure: types, the empty tour, the list the owner picks from, and the edits.
 * The card is `parts/WhatsNew.tsx`; what it does on a page is the
 * `whats-new` feature (`library/tour.ts`), the same script in the Preview
 * and on the published site.
 */
import { partList, type ListPart } from "./partList";
import { kindOf, wordsOf } from "./partNames";
import { hoverHost, type MotionNode } from "./parts/capturedMotion";

export const MAX_STEPS = 6;

/** What the step's one button does. */
export type TourActionKind = "scroll" | "open" | "option" | "link" | "none";

export interface TourStep {
  /** The part the step is about, drawn live on top of the card. Null: a step with words only. */
  target: string | null;
  title: string;
  /** Two or three short lines, one per line. */
  lines: string;
  /** Where to find it on the site ("Menu › Settings › Alerts"); empty for none. */
  path: string;
  action: TourActionKind;
  /** The button's words ("Turn it on", "Open the watchlist"). */
  button: string;
  /** "option": which site option the button and the path's switch turn on. */
  option: string;
  /** "link": a page of this site, or a part of a page (link rules: never off the site). */
  link: { kind: "page" | "node"; target: string } | null;
}

/** One update: its steps, and when it was marked. */
export interface TourUpdate {
  /** Counts up: a visitor who has seen this one is not shown it again. */
  id: number;
  /** When the owner marked it, as a day ("2026-10-01"). */
  date: string;
  steps: TourStep[];
}

export type TourWhen = "first" | "update" | "link";

export interface Tour {
  /** First visit only, each new update, or only from a "What's new" link. */
  when: TourWhen;
  /** The update a visitor is shown now. */
  current: TourUpdate;
  /** Older updates, newest first: "See previous updates". */
  past: TourUpdate[];
  /** The step drawn on the board (the one being edited). */
  at?: number;
}

export const WHEN_WORDS: Record<TourWhen, string> = {
  first: "First visit",
  update: "Each update",
  link: "Link only",
};

export const ACTION_WORDS: Record<TourActionKind, string> = {
  scroll: "Scroll to it",
  open: "Open it",
  option: "Turn an option on",
  link: "Go to a page",
  none: "No button",
};

/**
 * Options a visitor can turn on, that the published site carries out.
 * Only what the site can do is offered; the rest says what is missing.
 */
export const SITE_OPTIONS: { id: string; name: string; does: string }[] = [
  { id: "calm", name: "Less motion", does: "stops the page's animations and moving parts, remembered for this visitor" },
];

export const today = () => new Date().toISOString().slice(0, 10);

export function blankStep(): TourStep {
  return { target: null, title: "", lines: "", path: "", action: "scroll", button: "Show me", option: "", link: null };
}

/**
 * The site's own faces for the card: the one its big words are set in most
 * (titles), and the one its running words are set in most (the lines).
 * Put on the card when it is placed, as plain options the owner can change.
 */
export function siteFaces(nodes: readonly { pageId?: string; content?: unknown; font?: { face?: string | null; stack?: string | null; px?: number | null } | null }[], pageId?: string): { titleFont?: string; bodyFont?: string } {
  const big = new Map<string, number>(), small = new Map<string, number>();
  for (const n of nodes) {
    const f = n.font;
    if (!f?.face || (pageId && n.pageId !== pageId)) continue;
    const name = (f.stack || `'${f.face}'`).trim();
    const px = Number(f.px ?? 0);
    /* Titles by how many big lines wear the face; running words by how many words it sets. */
    if (px >= 28) big.set(name, (big.get(name) ?? 0) + 1);
    else if (px > 0 && px < 24) small.set(name, (small.get(name) ?? 0) + wordsOf(n as never).split(" ").filter(Boolean).length);
  }
  const most = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  const out: { titleFont?: string; bodyFont?: string } = {};
  const title = most(big), body = most(small);
  if (title) out.titleFont = title;
  if (body) out.bodyFont = body;
  return out;
}

export function newTour(): Tour {
  return { when: "update", current: { id: 1, date: today(), steps: [] }, past: [], at: 0 };
}

/** The tour a part carries, or a fresh one: a part placed before it was edited has none. */
export const tourOf = (n: { tour?: Tour | null }): Tour => n.tour ?? newTour();

/** A step for this choice, its words from the part's own name. */
export function stepFor(choice: TourChoice): TourStep {
  const s = blankStep();
  s.target = choice.id || null;
  s.title = choice.title;
  s.lines = choice.lines;
  s.action = choice.action;
  s.button = choice.button;
  return s;
}

/** Marks a new update: what is shown now goes to "previous updates", and every visitor sees the new one once. */
export function markUpdate(t: Tour): Tour {
  const old = t.current;
  return {
    ...t,
    past: old.steps.length ? [old, ...t.past].slice(0, 20) : t.past,
    current: { id: old.id + 1, date: today(), steps: old.steps.map((s) => ({ ...s })) },
    at: 0,
  };
}

export function withSteps(t: Tour, steps: TourStep[]): Tour {
  return { ...t, current: { ...t.current, steps: steps.slice(0, MAX_STEPS) } };
}

/* ------------------------------------------------------------------ */
/* What the owner picks a step from                                    */
/* ------------------------------------------------------------------ */

export interface TourChoice {
  /** The part's id; empty for a missing one. */
  id: string;
  group: "On this page" | "Features" | "Sections" | "Needs a backend";
  name: string;
  where: string | null;
  /** Suggested words for a new step about it. */
  title: string;
  lines: string;
  action: TourActionKind;
  button: string;
  /** Why it cannot be picked, in plain words. */
  missing?: string;
}

interface ChoiceNode extends ListPart {
  featureId: string;
  pageId: string;
}

/** The features a backend carries, by the shelf part that stands for each. */
const BACKEND: { featureId: string; name: string; lines: string }[] = [
  { featureId: "auth", name: "Accounts and sign in", lines: "Sign in to keep your things across devices." },
  { featureId: "database", name: "Saved data", lines: "What you set up here is kept for you." },
  { featureId: "email", name: "Automatic emails", lines: "Get an email when something you follow changes." },
];

/** The kinds of feature a visitor uses, from the library's categories; the page's own motion is not one. */
const USED = new Set(["interact", "data", "media"]);

const lead = (name: string) => name.replace(/^[A-Z][a-z ]+: /, "");

/**
 * Everything on the site a step can be about: the parts on the page (each
 * as the Element list names it), the features working on them, its
 * sections, and the backend features the site has, or what is missing.
 */
export function tourChoices(
  nodes: readonly ChoiceNode[],
  opts: { pageId: string; self?: string; siteName?: string; featureName?: (id: string) => string | undefined; workName?: (id: string) => string | undefined; workKind?: (id: string) => string | undefined },
): TourChoice[] {
  const page = nodes.filter((n) => n.pageId === opts.pageId && n.id !== opts.self && n.featureId !== "whats-new");
  const out: TourChoice[] = [];
  const rows = partList(page, { siteName: opts.siteName, featureName: opts.featureName }).filter((r) => !r.after);
  for (const r of rows) {
    const control = r.kind === "Button" || r.kind === "Link" || r.kind === "Copy bar";
    out.push({
      id: r.id,
      group: "On this page",
      name: r.name,
      where: r.where,
      title: lead(r.name) === r.name ? r.name : lead(r.name),
      lines: "",
      action: control ? "open" : "scroll",
      button: r.kind === "Copy bar" ? "Copy it" : control ? "Try it" : "Show me",
    });
  }
  /* A feature a visitor uses (a copy, a press that shows a panel, a live price), named where it works; not the page's motion. */
  const named = new Map(rows.flatMap((r) => r.ids.map((id) => [id, r.name] as const)));
  const seen = new Set<string>();
  for (const n of page) {
    const uses = n.work ? [n.work, ...(n.work.also ?? [])].filter((u) => u && !u.off) : [];
    for (const u of uses) {
      const kind = opts.workKind?.(u.id);
      if (kind && !USED.has(kind)) continue;
      if (seen.has(`${n.id}|${u.id}`)) continue;
      seen.add(`${n.id}|${u.id}`);
      const what = opts.workName?.(u.id) ?? u.id;
      const on = named.get(n.id) ?? page.filter((m) => m !== n && m.x >= n.x && m.y >= n.y && m.x + m.w <= n.x + n.w && m.y + m.h <= n.y + n.h).map((m) => named.get(m.id)).find(Boolean);
      out.push({ id: n.id, group: "Features", name: what, where: on ? `on ${on}` : null, title: what, lines: "", action: "open", button: "Try it" });
    }
  }
  /*
   * A part that answers the pointer or a press with motion of its own (the
   * TV whose knobs turn when it is pointed at): the part that is pointed at,
   * drawn whole in the step, knobs and all, and moving as on the page.
   */
  const hosts = new Map<string, "pointed at" | "pressed">();
  for (const n of page as unknown as MotionNode[]) {
    const m = n.motion;
    if (!m || m.off) continue;
    for (const [kind, list] of [["pointed at", m.hover], ["pressed", m.active]] as const) {
      for (const r of list ?? []) {
        const host = r.self !== false ? n : hoverHost(n, r, page as unknown as MotionNode[]);
        if (host && !hosts.has(host.id)) hosts.set(host.id, kind);
      }
    }
  }
  const rowIds = new Set(rows.map((r) => r.id));
  for (const [id, kind] of hosts) {
    if (rowIds.has(id)) continue;
    const n = page.find((x) => x.id === id);
    if (!n) continue;
    const on = page.filter((m) => m !== n && m.x >= n.x && m.y >= n.y && m.x + m.w <= n.x + n.w && m.y + m.h <= n.y + n.h).map((m) => named.get(m.id)).find(Boolean);
    out.push({ id, group: "Features", name: `Moves when ${kind}`, where: on ? `with ${on}` : null, title: on ? lead(on) : "Point at it", lines: "", action: "scroll", button: "Show me" });
  }

  /* A section, by its own first heading: where a step's button can take a visitor. */
  const inside = (a: ChoiceNode, b: ChoiceNode) => b.x >= a.x - 1 && b.y >= a.y - 1 && b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1;
  for (const n of page) {
    if (n.state || kindOf(n, opts.featureName) !== "Section") continue;
    const h = page.filter((m) => m !== n && !m.state && inside(n, m) && kindOf(m, opts.featureName) === "Heading" && wordsOf(m)).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    if (!h) continue;
    const heading = wordsOf(h).slice(0, 40);
    out.push({ id: n.id, group: "Sections", name: `Section: ${heading}`, where: null, title: heading, lines: "", action: "scroll", button: "Take me there" });
  }
  for (const b of BACKEND) {
    const has = nodes.find((n) => n.featureId === b.featureId);
    out.push(
      has
        ? { id: has.id, group: "Needs a backend", name: b.name, where: null, title: b.name, lines: b.lines, action: "open", button: "Open it" }
        : { id: "", group: "Needs a backend", name: b.name, where: null, title: b.name, lines: b.lines, action: "none", button: "", missing: `This site has no ${b.name.toLowerCase()} yet: put “${opts.featureName?.(b.featureId) ?? b.name}” on a page from the shelf's Engine group first.` },
    );
  }
  return out;
}

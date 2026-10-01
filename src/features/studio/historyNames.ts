/**
 * WHAT ONE UNDO WILL TAKE BACK, IN WORDS.
 *
 * The undo key said "Undo" and nothing else, so a person pressing it was
 * guessing what would change; and there was no list of the steps behind it.
 * Every step in the history is a pair of documents, the one before and the
 * one after, so a step is named by reading what differs between them rather
 * than by asking each of the hundred actions that take a checkpoint to
 * remember to say what they are. That is what makes the rule hold for every
 * kind of edit, including one added next month: whatever it changes, the
 * difference is here to read. `tests/undo-history.mjs`.
 *
 * Cheap: a checkpoint shares every part it did not change with the one
 * before it, so almost every comparison is two references, and a name is
 * kept per pair once it has been worked out.
 *
 * Pure: no store, no React, so a test and the store can both read it.
 */
import { partName, type Named } from "./partNames";

/** The fields of a document a step can change: what `snapshot` keeps in `past`. */
export interface StepDoc {
  pages: readonly { id: string; name?: string; path?: string }[];
  nodes: readonly (Named & Record<string, unknown>)[];
  groups: readonly { id: string; label?: string }[];
  shapes: readonly { id: string; kind?: string; label?: string }[];
  spaces: readonly { id: string; label?: string }[];
  format: Record<string, unknown>;
  brief: Record<string, unknown>;
  look: Record<string, unknown>;
  motion: readonly { id?: string; name?: string }[];
  taken?: unknown;
}

export interface NameHelp {
  /** A catalogue part's plain name, by feature id. */
  featureName?: (id: string) => string | undefined;
  /** A Format option's plain name, by its key. */
  formatName?: (key: string) => string | undefined;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const quoted = (s: string | undefined, fallback: string) => (s && s.trim() ? `“${s.trim().slice(0, 40)}”` : fallback);

/* What a change to each field of a part is called, most telling first: a write that moved and retyped a part is named for the words. */
const NODE_FIELDS: [RegExp, string][] = [
  [/^(content|label)$/, "edit the words of"],
  [/^prompt$/, "edit the prompt of"],
  [/^(picture|crop|fit)$/, "change the picture of"],
  [/^link$/, "change the link of"],
  [/^(colour|hue|glyph|aura|fill|surface)$/, "recolour"],
  [/^font$/, "change the font of"],
  [/^(anim|animSpeed|animDelay|animEase|behaviour|behaviours|motion|crate|crates)/, "change the animation of"],
  [/^options$/, "change the options of"],
  [/^groupId$/, "change the group of"],
  [/^pageId$/, "move to another page"],
  [/^(shape|path|outline)$/, "reshape"],
  [/^(edge|radius|art|texture|opacity|worn|text)$/, "restyle"],
  [/^priority$/, "change the priority of"],
  [/^data$/, "edit the data of"],
];

/** Which fields of a part differ between two versions of it. */
function changedFields(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) if (a[k] !== b[k] && JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k);
  return out;
}

/** The verb for a change to one part, from the fields that changed. */
function nodeVerb(fields: string[], before: Record<string, unknown>, after: Record<string, unknown>): string {
  const has = (re: RegExp) => fields.some((f) => re.test(f));
  if (fields.length === 1 && fields[0] === "locked") return after.locked ? "lock" : "unlock";
  if (fields.length === 1 && fields[0] === "hidden") return after.hidden ? "hide" : "show";
  void before;
  for (const [re, verb] of NODE_FIELDS) if (has(re)) return verb;
  if (has(/^(w|h)$/)) return "resize";
  if (has(/^(x|y)$/)) return "move";
  if (has(/^(z|order|layer)$/)) return "bring forward or back";
  return "edit";
}

/** How a set of records by id changed: what arrived, what went, what was changed. */
function byId<T extends { id: string }>(a: readonly T[], b: readonly T[]) {
  if (a === b) return { added: [] as T[], removed: [] as T[], changed: [] as [T, T][] };
  const was = new Map(a.map((x) => [x.id, x]));
  const now = new Map(b.map((x) => [x.id, x]));
  const added = b.filter((x) => !was.has(x.id));
  const removed = a.filter((x) => !now.has(x.id));
  const changed: [T, T][] = [];
  for (const x of b) {
    const old = was.get(x.id);
    if (old && old !== x) changed.push([old, x]);
  }
  return { added, removed, changed };
}

/** A key whose value differs, named for a person. */
function keysChanged(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): string[] {
  if (a === b) return [];
  return changedFields(a ?? {}, b ?? {});
}

/**
 * The name of the step from `before` to `after`: "move “COPY CA”", "add
 * 3 parts", "change Format: Corners". Lower case, so it reads after
 * "Undo: " and on its own in the list alike. Never empty: a step whose
 * difference is not one of the kinds below is "an edit", which is still a
 * step a person can go back to.
 */
export function stepName(before: StepDoc, after: StepDoc, help: NameHelp = {}): string {
  const all = [...after.nodes, ...before.nodes] as Named[];
  /* A part by its own name, bare, as the owner reads it: "move COPY CA". */
  const name = (n: Named) => partName(n, all, help.featureName).trim() || "a part";

  /* A site brought in is the biggest thing a step can be, and says so rather than counting its parts. */
  if (before.taken !== after.taken && after.taken) return "bring in a site";

  /* A theme rolled for the site is named for itself: "randomize theme: warm triadic, hard shadows" (`siteTheme.ts`). */
  const themeOf = (d: StepDoc) => (d.look as { theme?: { seed?: number; name?: string } | null }).theme ?? null;
  const tb = themeOf(before), ta = themeOf(after);
  if (ta && (ta.seed !== tb?.seed || ta.name !== tb?.name)) return tb ? `randomize theme: ${ta.name}` : `start a new site: ${ta.name}`;

  const pages = byId(before.pages, after.pages);
  if (pages.added.length) return pages.added.length === 1 ? `add the page ${quoted(pages.added[0]!.name, "")}`.trim() : `add ${plural(pages.added.length, "page")}`;
  if (pages.removed.length) return pages.removed.length === 1 ? `delete the page ${quoted(pages.removed[0]!.name, "")}`.trim() : `delete ${plural(pages.removed.length, "page")}`;

  const nodes = byId(before.nodes, after.nodes);
  if (nodes.added.length && nodes.removed.length) return `replace ${plural(nodes.removed.length, "part")} with ${plural(nodes.added.length, "part")}`;
  if (nodes.added.length) return nodes.added.length === 1 ? `add ${name(nodes.added[0]!)}` : `add ${plural(nodes.added.length, "part")}`;
  if (nodes.removed.length) return nodes.removed.length === 1 ? `delete ${name(nodes.removed[0]!)}` : `delete ${plural(nodes.removed.length, "part")}`;
  if (nodes.changed.length) {
    const verbs = nodes.changed.map(([a, b]) => nodeVerb(changedFields(a, b), a, b));
    const verb = verbs.find((v) => v !== "move" && v !== "resize") ?? (verbs.includes("resize") ? "resize" : verbs[0]!);
    if (nodes.changed.length === 1) {
      const n = nodes.changed[0]![1];
      return verb === "move to another page" ? `move ${name(n)} to another page` : `${verb} ${name(n)}`;
    }
    const many = plural(nodes.changed.length, "part");
    return verb === "move to another page" ? `move ${many} to another page` : `${verb} ${many}`;
  }

  const groups = byId(before.groups, after.groups);
  if (groups.added.length) return `group ${plural(groups.added.length, "set", "sets")} of parts`;
  if (groups.removed.length) return "ungroup parts";
  if (groups.changed.length) return `change the group ${quoted(groups.changed[0]![1].label, "")}`.trim();

  const shapes = byId(before.shapes, after.shapes);
  const shapeWord = (s: { kind?: string }) => (s.kind === "arrow" ? "a wire" : s.kind === "frame" ? "a frame" : "a drawing");
  if (shapes.added.length) return shapes.added.length === 1 ? `draw ${shapeWord(shapes.added[0]!)}` : `draw ${plural(shapes.added.length, "line")}`;
  if (shapes.removed.length) return shapes.removed.length === 1 ? `erase ${shapeWord(shapes.removed[0]!)}` : `erase ${plural(shapes.removed.length, "line")}`;
  if (shapes.changed.length) return `change ${shapeWord(shapes.changed[0]![1])}`;

  const spaces = byId(before.spaces, after.spaces);
  if (spaces.added.length) return `draw the space ${quoted(spaces.added[0]!.label, "")}`.trim();
  if (spaces.removed.length) return `delete the space ${quoted(spaces.removed[0]!.label, "")}`.trim();
  if (spaces.changed.length) return `change the space ${quoted(spaces.changed[0]![1].label, "")}`.trim();

  if (pages.changed.length) {
    const [a, b] = pages.changed[0]!;
    return a.name !== b.name ? `rename the page ${quoted(a.name, "")} to ${quoted(b.name, "")}` : `change the page ${quoted(b.name, "")}`;
  }

  const format = keysChanged(before.format, after.format);
  if (format.length) {
    const names = format.map((k) => help.formatName?.(k) ?? k.replace(/[._-]+/g, " "));
    return format.length === 1 ? `change Format: ${names[0]}` : `change ${plural(format.length, "Format setting")}`;
  }

  const look = keysChanged(before.look, after.look);
  if (look.length) {
    if (look.includes("palette")) return "change the colours";
    if (look.includes("texture") || look.includes("target")) return "change the texture";
    if (look.includes("light")) return "move the light";
    if (look.includes("veil")) return "change the veil";
    if (look.includes("fonts") || look.includes("faces")) return "change the fonts";
    return "change the look";
  }

  const brief = keysChanged(before.brief, after.brief);
  if (brief.length) {
    if (brief.includes("name")) return "rename the site";
    if (brief.includes("head")) return "edit the link preview";
    if (brief.includes("description")) return "edit the site's description";
    return "edit the brief";
  }

  if (before.motion !== after.motion) {
    const m = byId(before.motion.map((x, i) => ({ ...x, id: x.id ?? String(i) })), after.motion.map((x, i) => ({ ...x, id: x.id ?? String(i) })));
    if (m.added.length) return `add the animation ${quoted(m.added[0]!.name, "")}`.trim();
    if (m.removed.length) return `delete the animation ${quoted(m.removed[0]!.name, "")}`.trim();
    return "change an animation";
  }
  if (before.taken !== after.taken) return "forget the site brought in";
  return "an edit";
}

/*
 * One name per pair, kept: the list of fifty is drawn from the same pairs
 * every time it opens, and the part it names has to be looked up in every
 * part on the board.
 */
const kept = new WeakMap<object, { after: StepDoc; name: string }>();

/** `stepName`, remembered for this `before` while its `after` is the same document. */
export function stepNameKept(before: StepDoc, after: StepDoc, help: NameHelp = {}): string {
  const had = kept.get(before);
  const same = had && (Object.keys(after) as (keyof StepDoc)[]).every((k) => had.after[k] === after[k]);
  if (had && same) return had.name;
  const name = stepName(before, after, help);
  kept.set(before, { after, name });
  return name;
}

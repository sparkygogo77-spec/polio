/**
 * POLIO.md: WHAT THE SITE IS, AND WHAT STILL NEEDS CODE.
 *
 * Every Go live writes this at the root of the published repository, in the
 * same push as the pages (`goLive.ts`, `collectFiles`). A code chat opened on
 * that repository later reads it first: the site's colours, faces, radii and
 * spacing (a superset of Stitch's DESIGN.md), each page and its main parts
 * with the file and selector each lives at, every behaviour the capture
 * recorded and which part carries it, what the capture could not take (its
 * "Functions not captured" hand-off, a button that goes nowhere, a form with
 * no action), and the repository, branch and commit it was brought in from.
 *
 * Rules it keeps:
 *   · deterministic: the same document writes the same bytes. Nothing reads
 *     the clock, and every list is sorted;
 *   · nothing secret: no token, no email, nothing shaped like a key (`scrub`);
 *     a font's bytes and a site's scripts are never copied in, only named.
 *
 * Pure: no store, no DOM. `captureNotes` is what `docTake.ts` keeps of a
 * capture's `behaviours` (which it otherwise drops once attached), so the
 * record reaches this at Go live.
 */
import { tallyColours, tallyFonts } from "./siteColours.ts";
import { homeFor, type Routed } from "./homePage.ts";
import { usesOf, type WorkUse } from "./library/works.ts";
import { ROLES, toHex, parseColor, paletteFromHue, type Palette } from "./look.ts";

export const POLIO_MD = "POLIO.md";

/* ------------------------------------------------------------------ */
/* What a capture leaves for this                                      */
/* ------------------------------------------------------------------ */

/** The part a record names when the capture tied it to none. */
export const NO_PART = "@none";
/** One behaviour the capture recorded, as sink named it, on the part it was recorded on. */
export interface CapturedBehaviour { kind: string; part: string; what: string }
/** A Show on press: pressing `part` shows some parts and hides others. */
export interface PressState { page: string; name: string; part: string; group: string; shows: number; hides: number }
/** Where the site was brought in from. */
export interface SourceNote { repo: string; dir?: string | null; branch?: string | null; commit?: string | null }
/** What `docTake.ts` keeps on the look of a captured document. */
export interface CaptureNotes {
  behaviours: CapturedBehaviour[];
  presses: PressState[];
  /** The capture's "Functions not captured" hand-off, as written (markdown), when its source has one. */
  handoff?: string | null;
  source?: SourceNote | null;
}

type Rec = Record<string, unknown>;
/** Code-point order, never the locale's: the file is the same bytes wherever it is written. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** A few words on one record: its name, kind, class and timings, whichever it has. */
function whatOf(r: Rec): string {
  const bits: string[] = [];
  for (const k of ["name", "kind", "class", "direction", "axis", "prop", "pseudo"]) {
    const v = text(r[k]);
    if (v && !bits.includes(v)) bits.push(k === "class" ? `.${v}` : v);
  }
  for (const [k, unit] of [["duration", "ms"], ["period", "ms"], ["delay", "ms"], ["speed", "px/s"], ["at", "px"], ["travel", "px"], ["lift", "px"]] as const) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v) && v !== 0) bits.push(`${k} ${Math.round(v * 100) / 100}${unit}`);
  }
  if (typeof r.easing === "string" && r.easing) bits.push(r.easing);
  if (r.css === true || r.via === "css") bits.push("CSS");
  return bits.join(", ");
}

/**
 * What a capture's `doc.behaviours` says, kept small: each record's kind,
 * part and a few words, and each Show on press. Sorted, so the same capture
 * keeps the same notes.
 */
export function captureNotes(behaviours: unknown, extra?: { handoff?: string | null; source?: SourceNote | null }): CaptureNotes | null {
  const list: CapturedBehaviour[] = [];
  const presses: PressState[] = [];
  const take = (kind: string, v: unknown) => {
    if (!Array.isArray(v)) return;
    for (const r of v) {
      /* A canvas laid over a box is recorded on the box it covers (`host`). */
      if (!isRec(r)) continue;
      /* One the capture tied to no part (a rule it saw run on nothing it kept) is still listed, as `@none`. */
      const part = typeof r.part === "string" ? r.part : typeof r.host === "string" ? r.host : kind === "states" ? null : NO_PART;
      if (!part) continue;
      if (kind === "states") {
        presses.push({
          page: text(r.page),
          name: text(r.name) || "press",
          part,
          group: text(r.group),
          shows: Array.isArray(r.shows) ? r.shows.length : 0,
          hides: Array.isArray(r.hides) ? r.hides.length : 0,
        });
        continue;
      }
      list.push({ kind, part, what: whatOf(r) });
    }
  };
  if (isRec(behaviours)) {
    for (const [k, v] of Object.entries(behaviours)) {
      if (k === "motion" && isRec(v)) for (const [mk, mv] of Object.entries(v)) take(mk === "canvases" ? "canvas" : mk, mv);
      else if (k === "loader" && isRec(v)) list.push({ kind: "loader", part: text(v.part) || "@page", what: v.covers ? "covers the page while it loads" : "" });
      else take(k, v);
    }
  }
  const handoff = extra?.handoff?.trim() || null;
  const source = extra?.source ?? null;
  if (!list.length && !presses.length && !handoff && !source) return null;
  /* A record taken twice (the same rule on two sheets) is one line. */
  const seen = new Set<string>();
  const kept = list.filter((b) => { const k = `${b.kind}\u0000${b.part}\u0000${b.what}`; if (seen.has(k)) return false; seen.add(k); return true; });
  kept.sort((a, b) => cmp(a.kind, b.kind) || cmp(a.part, b.part) || cmp(a.what, b.what));
  presses.sort((a, b) => cmp(a.page, b.page) || cmp(a.group, b.group) || cmp(a.part, b.part) || cmp(a.name, b.name));
  return { behaviours: kept, presses, ...(handoff ? { handoff } : {}), ...(source ? { source } : {}) };
}

/** A source as a document carries it, or null when it is not one. */
export function sourceNote(v: unknown): SourceNote | null {
  if (!isRec(v) || typeof v.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(v.repo)) return null;
  const commit = typeof v.commit === "string" && /^[0-9a-f]{40}$/.test(v.commit) ? v.commit : null;
  return { repo: v.repo, dir: text(v.dir) || null, branch: text(v.branch) || null, commit };
}

/**
 * The "Functions not captured" section of a capture's fidelity report
 * (sink `docs/fidelity/<site>.md`): from its heading to the next heading of
 * the same level, heading dropped. Null when the report has none.
 */
export function handoffFrom(report: string | null | undefined): string | null {
  if (!report) return null;
  const lines = report.replace(/\r\n?/g, "\n").split("\n");
  const at = lines.findIndex((l) => /^##\s+Functions not captured/i.test(l));
  if (at < 0) return null;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) if (/^##\s/.test(lines[i]!)) { end = i; break; }
  return lines.slice(at + 1, end).join("\n").trim() || null;
}

/* ------------------------------------------------------------------ */
/* Nothing secret                                                      */
/* ------------------------------------------------------------------ */

const SECRET: RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, // an email
  /\b(?:gh[pousr]_|github_pat_|sk-|sk_live_|pk_live_|rk_live_|xox[abpr]-|AKIA|AIza|glpat-|npm_)[A-Za-z0-9_\-]{8,}/g, // a known key's prefix
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // a JSON web token
  /\b(Bearer|Basic|token)\s+[A-Za-z0-9._~+/=-]{16,}/gi, // a credential in a header
  /\bdata:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, // bytes
  /(?<![A-Za-z0-9/._-])[A-Za-z0-9+/_-]{32,}={0,2}(?![A-Za-z0-9/._-])/g, // anything long and key-shaped
];

/** A line with anything that could be a secret taken out. A commit hash is kept: it is forty hex and nothing more. */
export function scrub(s: string): string {
  let out = s;
  for (const re of SECRET) {
    out = out.replace(re, (m) => (/^[0-9a-f]{40}$/.test(m) ? m : "[removed]"));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The file                                                            */
/* ------------------------------------------------------------------ */

interface Page extends Routed { id: string; name: string; path?: string }
interface Font { id?: string; family: string; weight?: string; style?: string; unicodeRange?: string; source?: { kind: string; url?: string; href?: string; format?: string }; from?: { url?: string; sheet?: string | null }; carried?: boolean; bytes?: number }
interface Part {
  id: string;
  pageId?: string;
  featureId?: string;
  label?: string;
  content?: unknown;
  x?: number; y?: number; w?: number; h?: number;
  link?: { kind?: string; target?: string } | null;
  task?: string | null;
  work?: WorkUse | null;
  from?: { url?: string; host?: string; selector?: string; at?: number } | null;
  motion?: { animation?: { name?: string; duration?: string; timing?: string; iterations?: string }[]; transition?: { property?: string }[]; hover?: unknown[]; active?: unknown[]; focus?: unknown[] } | null;
  state?: { group?: string; option?: number } | null;
  radius?: number | null;
  radii?: number[] | null;
  pad?: { top?: number; right?: number; bottom?: number; left?: number } | null;
  colour?: Partial<Record<string, string>> | null;
  font?: { face?: string; family?: string; size?: number; px?: number; weight?: number } | null;
  inert?: boolean;
  picture?: { path?: string; type?: string } | null;
  /** A captured canvas world (parts/World.tsx): its characters and the dialogs they open. */
  world?: { chars?: { key?: string; name?: string; dialog?: number; href?: string }[]; dialogs?: { html?: string }[] } | null;
}
export interface PolioSite {
  brief?: { name?: string; description?: string } | null;
  pages: readonly Page[];
  nodes: readonly Part[];
  format?: Record<string, unknown> | null;
  look?: { palette?: Partial<Palette>; fonts?: readonly Font[]; keyframes?: readonly { name?: string }[]; capture?: CaptureNotes | null } | null;
  frameWidth?: number;
  /** Where the site was brought in from, when the document itself does not say (the Builds page's record). */
  source?: SourceNote | null;
  /** The address it goes live at, when known. */
  address?: string | null;
}

const one = (s: string) => s.replace(/\s+/g, " ").trim();
/** A table cell: one line, no pipes, nothing secret, not too long. */
const cell = (s: string, most = 80) => {
  const t = scrub(one(s)).replace(/\|/g, "\\|").replace(/`/g, "'");
  return t.length > most ? `${t.slice(0, most - 1)}…` : t;
};
const code = (s: string) => `\`${s.replace(/`/g, "'")}\``;
function wordsOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((s) => (isRec(s) ? text(s.text) : "")).join("");
  return "";
}
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** A colour as hex when it is opaque and readable; as written otherwise (a tint keeps its alpha). */
const hex = (v: string) => { const c = /rgba|hsla|\/|transparent|var\(/i.test(v) ? null : parseColor(v); return c ? toHex(c) : v; };
const inputsLine = (inputs: Record<string, string>) => Object.keys(inputs).sort().map((k) => `${k} ${inputs[k]}`).join(", ");
const countOf = <T,>(xs: readonly T[], key: (x: T) => string | null) => {
  const m = new Map<string, number>();
  for (const x of xs) { const k = key(x); if (k !== null) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
};

/** What a part is, in a few words: its words, else its label, else its kind. */
const partSays = (n: Part) => cell(wordsOf(n.content) || n.label || n.featureId || "part", 48);

/** Parts that are pressed by the visitor: buttons and links as the catalog makes them. */
const PRESSED = /^(cta-|button|nav-link|link)/;
/** The catalog's forms: things a visitor types into and sends. */
const FORMS = new Set(["contact-form", "multi-step-form", "newsletter", "booking", "survey", "checkout", "file-upload", "search-autocomplete", "subscription", "discount"]);

function linkGoes(n: Part, pages: readonly Page[], ids: Set<string>): boolean {
  const l = n.link;
  const t = l?.target?.trim() ?? "";
  if (!l || !t) return false;
  if (l.kind === "url") return !/^javascript:/i.test(t) && t !== "#";
  if (l.kind === "node") return ids.has(t);
  if (l.kind === "page") {
    const want = t.toLowerCase().replace(/^\/+|\/+$/g, "");
    return pages.some((p) => p.id === t || (p.path ?? "").toLowerCase().replace(/^\/+|\/+$/g, "") === want || p.name.toLowerCase() === want);
  }
  return false;
}

/** How deep a captured part sat in its page: `body > main > section` is 3. */
const depthOf = (n: Part) => (n.from?.selector ? n.from.selector.split(">").length : 0);
const MAIN_DEPTH = 4;
const MOST_PARTS = 60;
const MOST_COLOURS = 24;

export function polioMd(site: PolioSite): string {
  const pages = [...site.pages];
  const nodes = [...site.nodes].sort(byId);
  const home = homeFor(pages);
  const ids = new Set(nodes.map((n) => n.id));
  const pageOf = new Map(pages.map((p) => [p.id, p]));
  const fileOf = (pageId?: string) => { const p = pageId ? pageOf.get(pageId) : undefined; return p ? home.file(p) : "index.html"; };
  const where = (n: Part) => `${code(fileOf(n.pageId))} ${code(`#${n.id}`)}`;
  const look = site.look ?? {};
  const capture = look.capture ?? null;
  const name = one(site.brief?.name ?? "") || "This site";
  const out: string[] = [];
  const say = (...lines: string[]) => out.push(...lines);

  say(
    `# POLIO.md — ${cell(name, 120)}`,
    "",
    "The hand-off for a code chat opened on this repository. The Builder writes it at every Go live, from the site as it was pressed; the same site writes the same file. Read it first: what the site is, where each part lives, what already moves, and what still needs code.",
    "",
    "Every part is an element whose `id` is the part's id, so `document.getElementById(\"<id>\")` finds it on its page. The pages are static HTML; the site's stylesheet is `assets/site.css`, and the features it runs are `assets/features/*.js`. TASKS.md lists the owner's own asks; AGENTS.md says how to add a feature so the Builder can take it back.",
    "",
  );

  /* ---------------------------------------------------------- 1. Style */
  say("## 1. Style", "");
  const f = site.format ?? {};
  const hue = Number(f["palette.accentHue"] ?? 265);
  const mode = String(f["palette.mode"] ?? "dark");
  const base = paletteFromHue(Number.isFinite(hue) ? hue : 265, mode === "light" || mode === "both");
  const palette = { ...base, ...Object.fromEntries(Object.entries(look.palette ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) } as Palette;
  say("### Colours", "", "The six roles, written in `assets/site.css` as `var(--<role>)`:", "", "| Role | Colour | CSS |", "|---|---|---|");
  for (const r of ROLES) say(`| ${r} | ${code(hex(palette[r]))} | ${code(`var(--${r})`)} |`);
  const { all } = tallyColours(nodes as Parameters<typeof tallyColours>[0], palette);
  if (all.length) {
    say("", "Every colour the parts wear, most used first:", "", "| Colour | Parts | Text | Fill | Border | Shadow |", "|---|---|---|---|---|---|");
    for (const c of all.slice(0, MOST_COLOURS)) say(`| ${code(hex(c.value))} | ${c.parts} | ${c.by.text} | ${c.by.fill} | ${c.by.border} | ${c.by.shadow} |`);
    if (all.length > MOST_COLOURS) say("", `And ${all.length - MOST_COLOURS} more, each on fewer parts.`);
  }
  const fonts = [...(look.fonts ?? [])].sort((a, b) => cmp(a.family, b.family) || cmp(a.weight ?? "", b.weight ?? "") || cmp(a.style ?? "", b.style ?? "") || cmp(a.unicodeRange ?? "", b.unicodeRange ?? ""));
  say("", "### Fonts", "");
  if (fonts.length) {
    say("The faces the site was drawn in. A carried face's bytes are declared in `assets/site.css` as `@font-face`; the stylesheet it came from is named for reference.", "", "| Family | Weight | Style | File | Unicode range | Came from |", "|---|---|---|---|---|---|");
    for (const ft of fonts) {
      const s = ft.source;
      const file = s?.kind === "data" ? `assets/site.css (${s.format ?? "font"}, carried${typeof ft.bytes === "number" ? `, ${Math.round(ft.bytes / 1024)} KB` : ""})` : s?.kind === "url" ? text(s.url) : s?.kind === "link" ? `linked: ${text(s.href)}` : "not carried";
      say(`| ${cell(ft.family)} | ${cell(ft.weight ?? "400")} | ${cell(ft.style ?? "normal")} | ${cell(file, 120)} | ${cell(ft.unicodeRange ?? "all", 160)} | ${cell(ft.from?.sheet ?? ft.from?.url ?? "", 120)} |`);
    }
  } else say("No faces carried: the site sets words in the Builder's own families.");
  const faces = tallyFonts(nodes as Parameters<typeof tallyFonts>[0]);
  if (faces.length) {
    say("", "Faces setting words, by parts:", "", "| Face | Parts | Sizes (px) | Weights |", "|---|---|---|---|");
    const partOf = new Map(nodes.map((n) => [n.id, n]));
    for (const t of faces) {
      const px = [...new Set(t.ids.map((id) => partOf.get(id)?.font?.px).filter((v): v is number => typeof v === "number" && Number.isFinite(v)).map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
      say(`| ${cell(t.key || "the site's own type")} | ${t.parts} | ${px.join(", ") || "—"} | ${[...t.weights].sort((a, b) => a - b).join(", ") || "—"} |`);
    }
  }
  say("", "### Radii", "");
  const radii = countOf(nodes, (n) => {
    if (Array.isArray(n.radii) && n.radii.length && n.radii.some((v) => v)) return n.radii.map((v) => `${v}px`).join(" ");
    return typeof n.radius === "number" && n.radius > 0 ? `${n.radius}px` : null;
  });
  if (typeof f["layout.radius"] === "number") say(`The site's corner radius: ${code(`${f["layout.radius"]}px`)}.`, "");
  if (radii.length) { say("| Radius | Parts |", "|---|---|"); for (const [r, n] of radii) say(`| ${code(r)} | ${n} |`); }
  else say("Every part is square-cornered.");
  say("", "### Spacing", "");
  if (site.frameWidth) say(`The page is drawn at ${site.frameWidth}px wide and stretched to the window.`, "");
  const pads = countOf(nodes, (n) => {
    const p = n.pad;
    if (!p) return null;
    const v = [p.top ?? 0, p.right ?? 0, p.bottom ?? 0, p.left ?? 0];
    return v.some((x) => x) ? v.map((x) => `${x}px`).join(" ") : null;
  });
  if (pads.length) {
    say("Padding (top right bottom left), most used first:", "", "| Padding | Parts |", "|---|---|");
    for (const [p, n] of pads.slice(0, 16)) say(`| ${code(p)} | ${n} |`);
    if (pads.length > 16) say("", `And ${pads.length - 16} more.`);
  } else say("No part carries padding of its own.");

  /* ---------------------------------------------------------- 2. Pages */
  say("", "## 2. Pages", "");
  for (const p of pages) {
    const on = nodes.filter((n) => n.pageId === p.id && !n.inert);
    const captured = on.some((n) => n.from?.selector);
    const main = (captured ? on.filter((n) => depthOf(n) > 0 && depthOf(n) <= MAIN_DEPTH) : on)
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0) || cmp(a.id, b.id));
    say(`### ${cell(p.name || p.id)}`, "", `- Path: ${code(p.path?.trim() || "/")}`, `- File: ${code(home.file(p))}`, `- Parts: ${on.length}${captured ? `, of which ${main.length} sit ${MAIN_DEPTH} or fewer levels deep in the captured page and are listed here` : ""}`, "");
    if (!main.length) { say("No parts.", ""); continue; }
    say("| Part id | Kind | Shows | Selector | Captured as |", "|---|---|---|---|---|");
    for (const n of main.slice(0, MOST_PARTS)) say(`| ${code(n.id)} | ${cell(n.featureId ?? "part", 24)} | ${partSays(n)} | ${code(`#${n.id}`)} | ${n.from?.selector ? code(cell(n.from.selector, 120)) : "—"} |`);
    if (main.length > MOST_PARTS) say("", `And ${main.length - MOST_PARTS} more; each is ${code("#<part id>")} in ${code(home.file(p))}.`);
    say("");
  }

  /* ---------------------------------------------------------- 3. Captured behaviour */
  say("## 3. Captured behaviour", "");
  const nodeOf = new Map(nodes.map((n) => [n.id, n]));
  const partWhere = (id: string) => { const n = nodeOf.get(id); return n ? where(n) : id === "@page" ? "every page" : id === NO_PART ? "tied to no part" : `${code(`#${id}`)} (not on the board)`; };
  const recorded = capture?.behaviours ?? [];
  if (recorded.length) {
    say("What the captured page's scripts and stylesheets did, as the capture recorded it, and the part each is on:", "", "| Behaviour | Part | Where | Recorded |", "|---|---|---|---|");
    for (const b of recorded) say(`| ${cell(b.kind, 24)} | ${code(b.part)} | ${partWhere(b.part)} | ${cell(b.what, 100) || "—"} |`);
    say("");
  }
  const presses = capture?.presses ?? [];
  const stateParts = nodes.filter((n) => n.state?.group);
  /* The site's own presses: each part carrying Show on press (`press-shows`, library/behaviours.ts), whatever made it. */
  const idList = (v: string | undefined) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const running = nodes.flatMap((n) => usesOf(n.work).filter((u) => u.id === "press-shows").map((u) => ({ n, u, shows: idList(u.inputs.shows), hides: idList(u.inputs.hides), group: (u.inputs.group ?? "").trim() })))
    .sort((a, b) => cmp(a.group, b.group) || cmp(a.n.id, b.n.id));
  if (presses.length || stateParts.length || running.length) {
    say("### Show on press", "", "Pressing the part shows one state of its group and hides the others. The export shows each group's first state; the pressed states are on the board as parts of their own.", "");
    if (running.length) {
      say("The presses the site runs (`press-shows`, in `assets/features/`):", "", "| Part | Where | Shows | Group | Parts shown | In place of |", "|---|---|---|---|---|---|");
      const list = (xs: string[]) => (xs.length ? `${xs.length}: ${[...xs].sort(cmp).slice(0, 8).map(code).join(", ")}${xs.length > 8 ? `, and ${xs.length - 8} more` : ""}` : "—");
      for (const r of running) say(`| ${code(r.n.id)}${r.u.off ? " (off)" : ""} | ${where(r.n)} | ${partSays(r.n)} | ${code(r.group || "its own")} | ${list(r.shows)} | ${list(r.hides)} |`);
      say("");
    }
    if (presses.length) {
      say("As the capture recorded them:", "", "| Press | Part | Where | Group | Shows | Hides |", "|---|---|---|---|---|---|");
      for (const s of presses) say(`| ${cell(s.name, 40)} | ${code(s.part)} | ${partWhere(s.part)} | ${code(s.group || "—")} | ${s.shows} | ${s.hides} |`);
    }
    const groups = countOf(stateParts, (n) => `${n.state!.group}\u0000${n.state!.option ?? 0}`);
    if (groups.length) {
      say("", "Parts belonging to each state:", "", "| Group | State | Parts |", "|---|---|---|");
      for (const [k, n] of [...groups].sort((a, b) => cmp(a[0], b[0]))) { const [g, o] = k.split("\u0000"); say(`| ${code(g!)} | ${o} | ${n} |`); }
    }
    say("");
  }
  /*
   * FLIPBOOKS: a canvas that drew frames, carried as one animated svg (sink's
   * converter labels the part `canvas-frames`). Shown by a press it plays from
   * the press (`press-shows` asks for it again); otherwise it plays as the page opens.
   */
  const shownBy = new Map<string, string[]>();
  for (const r of running) for (const id of r.shows) shownBy.set(id, [...(shownBy.get(id) ?? []), r.n.id]);
  const shownIn = (n: Part): string[] => {
    const direct = shownBy.get(n.id);
    if (direct) return direct;
    /* A picture laid over a shown part: shown with it, when the shown part holds its box and its state. */
    const out: string[] = [];
    for (const [id, by] of shownBy) {
      const h = nodeOf.get(id);
      if (!h || h.pageId !== n.pageId || !n.state || h.state?.group !== n.state.group || h.state?.option !== n.state.option) continue;
      if ((n.x ?? 0) >= (h.x ?? 0) && (n.y ?? 0) >= (h.y ?? 0) && (n.x ?? 0) + (n.w ?? 0) <= (h.x ?? 0) + (h.w ?? 0) && (n.y ?? 0) + (n.h ?? 0) <= (h.y ?? 0) + (h.h ?? 0)) out.push(...by);
    }
    return [...new Set(out)].sort(cmp);
  };
  const flipbooks = nodes.filter((n) => /^canvas-frames\b/.test(n.label ?? "") && /svg/i.test(`${n.picture?.type ?? ""} ${n.picture?.path ?? ""}`));
  if (flipbooks.length) {
    say("### Flipbooks", "", "A canvas that drew frames, carried as one animated svg picture that plays once and holds. One a press shows plays from that press.", "", "| Part | Where | Picture | Played by |", "|---|---|---|---|");
    for (const n of flipbooks) {
      const by = [...new Set(shownIn(n))].sort(cmp);
      say(`| ${code(n.id)} | ${where(n)} | ${n.picture?.path ? code(cell(n.picture.path, 100)) : "—"} | ${by.length ? `the press on ${by.slice(0, 6).map(code).join(", ")}${by.length > 6 ? `, and ${by.length - 6} more` : ""}` : "the page opening"} |`);
    }
    say("");
  }
  /*
   * CHARACTERS IN A CANVAS WORLD: each opens the dialog the page opened for
   * it. Its buttons and fields are there with their words and attributes and
   * do nothing yet; this is the list of them a backend wires, by the name
   * each carries in `data-world-control`, with the page's own attributes.
   */
  const worlds = nodes.filter((n) => n.world && Array.isArray(n.world.chars) && n.world.chars.length);
  if (worlds.length) {
    say("### Characters in canvas worlds", "", "A canvas the page walked characters on. Each character has a press area that follows it through the flipbook's frames and opens the dialog the page opened for it (feature `world-dialogs`): close by its close button, Escape or a press outside. Every button and field in a dialog is kept as it was, with its words and the page's own attributes: find it by `data-world-control` inside `dialog[data-world-dialog]` (the character is `data-world-key`). A page of the site is always a link; an address off it is a link only where the site's list allows (Format › Links off the site, `links.offsite`), else an inert control with the address in `data-world-offsite`.", "", "| Part | Where | Characters | Dialogs |", "|---|---|---|---|");
    for (const n of worlds) {
      const cs = n.world!.chars!;
      const on = cs.filter((c) => c.href).length, off = cs.filter((c) => (c as { offsite?: string }).offsite).length;
      say(`| ${code(n.id)} | ${where(n)} | ${cs.length}${on ? `, ${on} going to a page of the site` : ""}${off ? `, ${off} going off it (inert)` : ""} | ${n.world!.dialogs?.length ?? 0} |`);
    }
    const controls = new Map<string, { tag: string; attrs: Set<string>; n: number; does: string }>();
    for (const n of worlds) for (const d of n.world!.dialogs ?? []) {
      for (const m of String(d.html ?? "").matchAll(/<([a-z]+)\b([^>]*\bdata-world-control="([^"]+)"[^>]*)>/g)) {
        const name = m[3]!;
        /* What pressing it did on the page (sink): replayed, or what a backend has to do. */
        const get = (k: string) => (new RegExp(`\\s${k}="([^"]*)"`).exec(m[2]!) ?? [])[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&") ?? "";
        const does = get("data-world-does"), hook = get("data-world-hook"), off = get("data-world-offsite");
        const said = does === "hook" ? `hook: ${hook}${off ? ` (${(() => { try { return new URL(off).host; } catch { return off; } })()})` : ""}` : does === "link" ? `link to ${get("data-world-href")}` : does || (m[1] === "a" && /\shref="\//.test(m[2]!) ? "link within the site" : "");
        const c = controls.get(name) ?? { tag: m[1]!, attrs: new Set<string>(), n: 0, does: said };
        c.n++;
        for (const a of m[2]!.matchAll(/\s(data-(?!world-)[a-z0-9-]+)/g)) c.attrs.add(a[1]!);
        controls.set(name, c);
      }
    }
    if (controls.size) {
      say("", "Controls in the dialogs. What pressing each did on the page is done again (`data-world-does`: `link` within the site, `copy`, `ui`, `close`, `native`); a `hook` needs a wallet or a server, or went off the site, and is what a backend wires, by `data-world-control`, where `data-world-hook` and `data-world-offsite` say what was seen:", "", "| `data-world-control` | Element | Does | The page's own attributes | In dialogs |", "|---|---|---|---|---|");
      for (const [name, c] of [...controls].sort((a, b) => b[1].n - a[1].n || cmp(a[0], b[0])).slice(0, 60)) say(`| ${code(name)} | ${c.tag} | ${cell(c.does, 120) || "—"} | ${[...c.attrs].sort(cmp).map(code).join(", ") || "—"} | ${c.n} |`);
      if (controls.size > 60) say(`| … | | | | ${controls.size - 60} more |`);
    }
    say("");
  }
  const attached = nodes.flatMap((n) => usesOf(n.work).map((u) => ({ n, u })));
  if (attached.length) {
    say("### Features the site runs", "", "Each captured behaviour the Builder could redo is a feature attached to its part, in `assets/features/`. Switched-off ones are kept and not shipped.", "", "| Feature | Part | Where | Settings |", "|---|---|---|---|");
    for (const { n, u } of attached.sort((a, b) => cmp(a.u.id, b.u.id) || cmp(a.n.id, b.n.id))) say(`| ${code(u.id)}${u.off ? " (off)" : ""} | ${code(n.id)} | ${where(n)} | ${cell(inputsLine(u.inputs), 120) || "—"} |`);
    say("");
  }
  /* Focus alone is the page's one focus ring on everything: not motion. */
  const styled = nodes.filter((n) => n.motion && ((n.motion.animation?.length ?? 0) + (n.motion.transition?.length ?? 0) + (n.motion.hover?.length ?? 0) + (n.motion.active?.length ?? 0)) > 0);
  if (styled.length) {
    say("### Motion and hover from the stylesheet", "", "Written into `assets/site.css` against each part's id; the keyframes are prefixed `cap-`. Parts moving the same way are one row.", "", "| Animation | Transition | Hover / press / focus | Parts |", "|---|---|---|---|");
    const rows = new Map<string, { anim: string; tr: string; hv: string; ids: string[] }>();
    for (const n of styled) {
      const m = n.motion!;
      const anim = (m.animation ?? []).map((a) => [a.name, a.duration, a.timing, a.iterations === "infinite" ? "loops" : ""].filter(Boolean).join(" ")).join("; ");
      const tr = (m.transition ?? []).map((t) => t.property ?? "").filter(Boolean).join(", ");
      const hv = [(m.hover?.length ?? 0) ? "hover" : "", (m.active?.length ?? 0) ? "press" : "", (m.focus?.length ?? 0) ? "focus" : ""].filter(Boolean).join(", ");
      const k = `${anim}\u0000${tr}\u0000${hv}`;
      const row = rows.get(k) ?? { anim, tr, hv, ids: [] };
      row.ids.push(n.id);
      rows.set(k, row);
    }
    for (const r of [...rows.values()].sort((x, y) => y.ids.length - x.ids.length || cmp(x.anim, y.anim) || cmp(x.tr, y.tr) || cmp(x.hv, y.hv))) {
      const shown = r.ids.slice(0, 12).map(code).join(", ");
      say(`| ${cell(r.anim, 100) || "—"} | ${cell(r.tr, 60) || "—"} | ${r.hv || "—"} | ${r.ids.length}: ${shown}${r.ids.length > 12 ? `, and ${r.ids.length - 12} more` : ""} |`);
    }
    say("");
  }
  if (!recorded.length && !presses.length && !attached.length && !styled.length) say("Nothing moves: no behaviour was captured or attached.", "");

  /* ---------------------------------------------------------- 4. Not captured */
  say("## 4. Not captured, for the backend", "");
  if (capture?.handoff) {
    say("### Functions not captured (the capture's hand-off)", "", "Carried over from the capture's own report: the function, its inputs and states, the calls it makes and the parts to attach it to.", "");
    say(...scrub(capture.handoff).split("\n").map((l) => (/^#{1,5}\s/.test(l) ? `#${l}` : l)), "");
  }
  const tasks = nodes.filter((n) => n.task?.trim());
  if (tasks.length) {
    say("### The owner's asks", "", "Written in TASKS.md with the owner's words; listed here by part.", "", "| Part | Where | Shows |", "|---|---|---|");
    for (const n of tasks) say(`| ${code(n.id)} | ${where(n)} | ${partSays(n)} |`);
    say("");
  }
  const pressedParts = new Set(presses.map((s) => s.part));
  const nowhere = nodes.filter((n) => PRESSED.test(n.featureId ?? "") && !n.inert && !linkGoes(n, pages, ids) && !pressedParts.has(n.id) && !usesOf(n.work).length && !n.task?.trim());
  if (nowhere.length) {
    say("### Buttons that go nowhere", "", "Nothing happens when these are pressed: no link, and nothing attached.", "", "| Part | Where | Shows |", "|---|---|---|");
    for (const n of nowhere) say(`| ${code(n.id)} | ${where(n)} | ${partSays(n)} |`);
    say("");
  }
  const forms = nodes.filter((n) => FORMS.has(n.featureId ?? "") && !usesOf(n.work).length);
  if (forms.length) {
    say("### Forms with no action", "", "What is typed here is sent nowhere: each needs an endpoint and what to do with the answer.", "", "| Part | Kind | Where |", "|---|---|---|");
    for (const n of forms) say(`| ${code(n.id)} | ${cell(n.featureId ?? "form", 24)} | ${where(n)} |`);
    say("");
  }
  if (!capture?.handoff && !tasks.length && !nowhere.length && !forms.length) say("Nothing is waiting on code: every button goes somewhere and there is no form.", "");

  /* ---------------------------------------------------------- 5. Source */
  say("## 5. Source", "");
  const src = capture?.source ?? site.source ?? null;
  const hosts = [...new Set(nodes.map((n) => n.from?.url ? n.from.url : "").filter(Boolean))].sort();
  const taken = nodes.map((n) => n.from?.at).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (src) {
    say(`- Repository: ${code(cell(src.repo, 120))}`);
    if (src.dir) say(`- Folder: ${code(cell(src.dir, 120))}`);
    say(`- Branch: ${code(cell(src.branch || "the default branch", 120))}`);
    say(`- Commit: ${src.commit ? code(src.commit) : "not recorded"}`);
  } else say("- Made in the Builder: not brought in from a repository.");
  if (hosts.length) say(`- Captured from: ${hosts.slice(0, 8).map((h) => cell(h, 120)).join(", ")}${hosts.length > 8 ? `, and ${hosts.length - 8} more addresses` : ""}`);
  if (taken.length) say(`- Captured on: ${new Date(Math.min(...taken)).toISOString().slice(0, 10)}`);
  if (site.address) say(`- Live at: ${cell(site.address, 120)}`);
  say("");
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

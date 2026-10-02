/**
 * A page read element by element (`PARTS`, siteRead.ts), as parts on the board.
 *
 * WHY. PST's test page — plain HTML, no styles of its own, its screens
 * filled in by scripts — came in through Bring it in as seven "bands of
 * words": every section folded into one part, its headings flattened into
 * its paragraphs, its buttons and fields gone, and its hidden panels read
 * as tall blank boxes (the Balance block 1422x507, mostly empty). The
 * reading was by block (`CANDIDATES`, `MEASURE`); a page like that has
 * nothing a block reading can keep.
 *
 * WHAT IT IS NOW, in the shape a capture lands in (sink's document): a box
 * for each section, and inside it a part for each heading, paragraph, line,
 * button, link, field, checkbox and picture, at the place, size, words,
 * ink and type the browser computed — the page's own rules, or the
 * browser's defaults where it has none. Every part keeps the id and data-*
 * attributes the page's code finds it by (`hooks`), on the real element it
 * draws (a field's input, a button's box), and a value the code writes into
 * the middle of a sentence keeps its hook on its run. What is hidden as the
 * page opens is kept as a hidden part (`state`) that takes no room: on the
 * board, in the Preview and on the published page, as the page had it.
 *
 * Each other page of the repository beside it comes in as a page of its
 * own, and a link to one of them goes to that page.
 *
 * Pure: no store, no browser. `tests/plain-page.mjs` holds it.
 */
import type { PagePart, PageRead, PartRun } from "./siteRead.ts";
import type { Span } from "./parts/spans.ts";
import { familyOf } from "./recreate.ts";
import { lookOf, type LayerNode, type StyleSource } from "./styleLayer.ts";
import type { PageSource } from "./sourceHooks.ts";
import { codeIndex, type CodeIndex, type Wanted } from "./codeRefs.ts";

/** A page of the site, as the store keeps one. */
export interface LandedPage { id: string; name: string; path: string; prompt: string; scroll: string }

/** What the board is handed: pages and their parts, in a document's shape. */
export interface LandedDoc {
  pages: LandedPage[];
  nodes: Record<string, unknown>[];
  frameWidth: number;
  /** The entry page's own ground and ink, as the browser drew its body: what the palette's page colour and text are taken from. */
  ground: { bg: string; text: string };
  /** What the pages' code is written against, for the style layer (`styleLayer.ts`); the repository is filled in by whoever knows it. */
  styleSource: Omit<StyleSource, "repo" | "ref" | "dir">;
}

/** What came, counted honestly, for the line he reads. */
export interface PageReport {
  pages: { name: string; file: string; parts: number; hidden: number }[];
  /** Parts by kind, across every page: sections, headings, words, buttons, links, fields, checkboxes, pictures. */
  kinds: Record<string, number>;
  hidden: number;
  hooks: number;
  pictures: number;
  /** Parts no style of the page's own reaches (a sheet or a style attribute): they wear the browser's defaults. */
  unstyled: number;
  /** Pages none of whose parts any style of its own reaches. */
  bare: string[];
  truncated: string[];
}

/** One HTML file, read. */
export interface FileRead { file: string; read: PageRead; /** What its code is written against, when its source was read beside it. */ source?: PageSource }

/** The catalogue part each kind becomes. */
const FEATURE: Record<PagePart["kind"], string> = {
  section: "box",
  slot: "box",
  heading: "prose",
  text: "prose",
  code: "code-block",
  button: "cta-primary",
  link: "prose",
  field: "field",
  check: "checkbox",
  picture: "picture",
};

/** A kind in words, for the count he reads. */
export const KIND_WORDS: Record<PagePart["kind"], [string, string]> = {
  section: ["section", "sections"],
  slot: ["empty place its code fills", "empty places its code fills"],
  heading: ["heading", "headings"],
  text: ["line of words", "lines of words"],
  code: ["code block", "code blocks"],
  button: ["button", "buttons"],
  link: ["link", "links"],
  field: ["field", "fields"],
  check: ["checkbox", "checkboxes"],
  picture: ["picture", "pictures"],
};

const fine = (v: number) => Math.round(v * 100) / 100;
const slug = (t: string) => t.toLowerCase().replace(/\.html?$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The page's name: its title with the site's shared words taken off, else its file. */
function pageName(file: string, title: string, first: boolean): string {
  if (first) return "Home";
  const base = file.split("/").pop()!.replace(/\.html?$/i, "");
  return base ? base.charAt(0).toUpperCase() + base.slice(1).replace(/[-_]+/g, " ") : title || "Page";
}

/** A link's address, as a page of this site when it names one of the files read. */
export function pageLink(href: string, pagesByFile: ReadonlyMap<string, string>, dir: string): { kind: "page" | "url"; target: string } | null {
  const h = (href ?? "").trim();
  if (!h || h === "#" || /^javascript:/i.test(h)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) && !/^https?:\/\/zip\.invalid\//i.test(h)) return { kind: "url", target: h };
  const bare = h.replace(/^https?:\/\/zip\.invalid\//i, "/").split(/[?#]/)[0]!;
  if (!bare && h.startsWith("#")) return null;
  const rel = bare.startsWith("/") ? bare.slice(1) : `${dir}${bare}`;
  const file = rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
  for (const cand of [file, `${dir}${file}`, file.replace(/^\.\//, "")]) {
    const id = pagesByFile.get(cand.toLowerCase());
    if (id) return { kind: "page", target: id };
  }
  return { kind: "url", target: h };
}

/** The runs of a part's words, as the board keeps them. */
function spansFrom(runs: PartRun[] | undefined, words: string, link: (href: string) => { kind: "page" | "url"; target: string } | null): string | Span[] {
  if (!runs?.length) return words;
  const out: Span[] = [];
  for (const r of runs) {
    const s: Span & { hooks?: Record<string, string> } = { text: r.text };
    if (r.weight !== undefined && r.weight !== 400) s.weight = r.weight;
    if (r.italic) s.italic = true;
    if (r.mono) s.face = "monospace";
    const to = r.href !== undefined ? link(r.href) : null;
    if (to) s.link = to;
    if (r.hooks && Object.keys(r.hooks).length) s.hooks = r.hooks;
    /* A place the page's code writes into, with nothing in it yet, still carries its hook: a zero-width run. */
    if (!s.text && s.hooks) s.text = "​";
    if (s.text) out.push(s);
  }
  return out.length ? out : words;
}

/** One page's parts, as nodes. */
/** Every name a part's code may find it by: its hooks, the hooks of values inside its words, its classes. */
function namesOf(p: PagePart): Wanted[] {
  const out: Wanted[] = [];
  if (p.hooks["data-hook"]) out.push({ attr: "data-hook", value: p.hooks["data-hook"] });
  if (p.hooks.id) out.push({ attr: "id", value: p.hooks.id });
  for (const r of p.runs ?? []) {
    if (r.hooks?.["data-hook"]) out.push({ attr: "data-hook", value: r.hooks["data-hook"] });
    if (r.hooks?.id) out.push({ attr: "id", value: r.hooks.id });
  }
  for (const c of p.classes ?? []) out.push({ attr: "class", value: c });
  return out;
}

/** A part's ties to its code: markup, CSS rules, and every script reference, with what builds it if anything does. */
function codeOf(p: PagePart, file: string, index: CodeIndex | null): import("./styleLayer.ts").PartCode {
  const refs = index ? namesOf(p).flatMap((w) => index.refs.get(`${w.attr}=${w.value}`) ?? []) : [];
  const seen = new Set<string>();
  const uniq = refs.filter((r) => { const k = `${r.file}:${r.line}:${r.via}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const own = p.hooks["data-hook"] ? `data-hook=${p.hooks["data-hook"]}` : p.hooks.id ? `id=${p.hooks.id}` : null;
  /* Filled at run time: an empty place its code fills, or one a script writes or builds into. */
  const writer = uniq.find((r) => (r.kind === "builds" || r.kind === "writes") && (!own || r.via === own || p.kind === "slot"));
  return {
    markup: { file, ...(p.line ? { line: p.line } : {}) },
    css: p.css ?? [],
    refs: uniq,
    built: writer ?? null,
    from: !index ? "none" : uniq.some((r) => index.listed.has(r.via)) ? "hooks.json" : "scan",
  };
}

function nodesOf(fr: FileRead, pageId: string, link: (href: string) => { kind: "page" | "url"; target: string } | null, at: number, index: CodeIndex | null = null): Record<string, unknown>[] {
  const { read } = fr;
  const url = `zip:${fr.file}`;
  const base = read.px || 16;
  const out: Record<string, unknown>[] = [];
  read.parts.forEach((p, i) => {
    const featureId = FEATURE[p.kind];
    const id = `n_${pageId.replace(/^page_/, "")}_${p.kind}_${i + 1}`;
    const s = p.style;
    const font = { stack: s.family, ...(familyOf(s.family) ? { family: familyOf(s.family) } : {}), size: fine(s.px / base), px: s.px, weight: s.weight, leading: fine(s.leading / Math.max(1, s.px)) };
    const colour: Record<string, string> = { text: s.colour };
    if (s.bg) colour.bg = s.bg;
    if (s.border && (p.kind === "button" || p.kind === "field")) colour.accent = s.border.colour;
    const pad = { top: s.pad[0], right: s.pad[1], bottom: s.pad[2], left: s.pad[3] };
    const padded = s.pad.some((v) => v > 0);
    const edgeStyle = s.border ? (/^(solid|dashed|dotted|double)$/.test(s.border.style) ? s.border.style : "solid") : null;
    const edge = s.border ? { width: s.border.w, style: edgeStyle, colour: s.border.colour } : null;
    const align = /^(center|right|end|justify)$/.test(s.align) ? { align: s.align } : null;
    const transform = /^(uppercase|lowercase|capitalize)$/.test(s.transform) ? { transform: s.transform } : null;
    const text = align || transform ? { ...(align ?? {}), ...(transform ?? {}) } : null;
    const linkTo = p.kind === "link" && p.href !== undefined ? link(p.href) : null;
    const content = p.kind === "link"
      ? (p.words ? [{ text: p.words, ...(linkTo ? { link: linkTo } : {}) }] : "")
      : p.kind === "section" || p.kind === "slot" || p.kind === "picture" ? "" : spansFrom(p.runs, p.words, link);
    const what = p.kind === "section" ? `${p.tag} section` : p.kind === "slot" ? `empty ${p.tag} its code fills` : p.kind === "field" ? `${p.control?.type ?? "text"} field${p.label ? `, “${p.label}”` : ""}` : p.kind === "check" ? `${p.control?.type ?? "checkbox"}${p.words ? `, “${p.words}”` : ""}` : `${p.tag}${p.words ? `, “${p.words.slice(0, 60)}”` : ""}`;
    const hookSays = p.hooks["data-hook"] ? ` Its code finds it as data-hook “${p.hooks["data-hook"]}”.` : p.hooks.id ? ` Its code finds it as #${p.hooks.id}.` : "";
    const node: Record<string, unknown> = {
      id,
      pageId,
      featureId,
      label: p.kind === "section" || p.kind === "slot" ? (p.hooks["data-hook"] || p.hooks.id || p.tag) : (p.words || p.label || p.hooks["data-hook"] || p.tag).slice(0, 80),
      prompt: `Read from ${fr.file} as ${p.selector}: ${what}. The box, the words, the colours and the type are the ones the browser drew${p.hidden ? `; hidden as the page opens (${p.hidden})` : ""}.${hookSays}`,
      content,
      data: p.kind === "field" || p.kind === "check" || p.kind === "button" ? what : "",
      x: Math.max(0, p.box.x),
      y: Math.max(0, p.box.y),
      w: Math.max(1, p.box.w),
      h: Math.max(1, p.box.h),
      groupId: null,
      options: p.kind === "button"
        ? { shape: s.radius >= 999 ? "pill" : s.radius > 2 ? "rounded" : "square", variant: "outline", size: "medium" }
        : p.kind === "field" || p.kind === "check"
          ? { kind: p.control?.type ?? (p.kind === "check" ? "checkbox" : "text"), ...(p.label ? { label: p.label } : {}), ...(p.control?.placeholder ? { placeholder: p.control.placeholder } : {}), ...(p.control?.value !== undefined && p.kind === "field" ? { value: p.control.value } : {}), ...(p.control?.checked ? { checked: "yes" } : {}), ...(p.control?.disabled ? { disabled: "yes" } : {}), ...(p.control?.options ? { choices: p.control.options.map((o) => `${o.selected ? "* " : ""}${o.text}${o.value !== o.text ? ` = ${o.value}` : ""}`).join("\n") } : {}), ...(p.control?.rows ? { rows: String(p.control.rows) } : {}) }
          : {},
      priority: "must",
      custom: false,
      glyph: null,
      hue: null,
      locked: false,
      link: null,
      colour,
      font: p.kind === "section" || p.kind === "slot" || p.kind === "picture" ? null : font,
      anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
      shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null,
      aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
      from: { url, host: fr.file, selector: p.selector, at },
      ...(Object.keys(p.hooks).length ? { hooks: p.hooks } : {}),
      ...(p.hidden ? { state: { group: `hidden:${p.hidden}`, option: 1 } } : {}),
      ...(padded ? { pad } : {}),
      ...(edge ? { edge } : {}),
      ...(s.radius > 0 ? { radius: s.radius } : {}),
      /* Rounded to half its side, a square picture is a circle, and is drawn as one at any size. */
      ...(p.kind === "picture" && p.box.w === p.box.h && s.radius * 2 >= p.box.w ? { shape: "circle" } : {}),
      ...(text ? { text } : p.kind === "button" ? { text: { align: "center" } } : {}),
      ...(p.kind === "picture" && p.alt ? { data: `picture, “${p.alt}”` } : {}),
    };
    /* Where it is in its source, and how it looked as it came in: the style layer writes only what changes from this. */
    const hook = p.hooks["data-hook"] ? { attr: "data-hook" as const, value: p.hooks["data-hook"] } : p.hooks.id ? { attr: "id" as const, value: p.hooks.id } : null;
    const staticWords = (p.kind === "text" || p.kind === "heading" || p.kind === "link" || p.kind === "code") && !hook && !p.runs?.some((r) => r.hooks);
    const code = codeOf(p, fr.file, index);
    /* Words its code writes are not static, whatever the HTML holds. */
    const written = !!code.built;
    node.source = { file: fr.file, ...(p.line ? { line: p.line } : {}), hook, staticWords: staticWords && !written, was: lookOf(node as unknown as LayerNode, null, { base }), code };
    out.push(node);
  });
  /* What holds what is read off the paths, as a capture's is (`partTree.ts`): each part's continues its section's. */
  return out;
}

/**
 * Every file read, as one document: the entry is Home, each other page is
 * a page of its own at a path off its file name, and the board is as wide
 * as the window the entry was read at.
 */
export function pagesToDoc(files: FileRead[], opts: { at?: number; code?: { path: string; text: string }[] } = {}): { doc: LandedDoc; report: PageReport } {
  const at = opts.at ?? Date.now();
  const entry = files[0]!;
  const dir = entry.file.includes("/") ? entry.file.slice(0, entry.file.lastIndexOf("/") + 1) : "";
  const pages: LandedPage[] = [];
  const byFile = new Map<string, string>();
  const used = new Set<string>();
  files.forEach((f, i) => {
    const name = pageName(f.file, f.read.title, i === 0);
    let path = i === 0 ? "/" : `/${slug(f.file.split("/").pop() ?? name) || `page-${i + 1}`}`;
    for (let k = 2; used.has(path); k++) path = `${path}-${k}`;
    used.add(path);
    const id = i === 0 ? "page_home" : `page_${slug(path.slice(1)) || i + 1}`;
    pages.push({ id, name, path, prompt: "", scroll: "inherit" });
    byFile.set(f.file.toLowerCase(), id);
    /* Asked for at its own path from the root ("/leaderboard.html"), it is the same page. */
    byFile.set(f.file.slice(dir.length).toLowerCase(), id);
  });
  const nodes: Record<string, unknown>[] = [];
  /* The repository's scripts (and hooks.json), read once for every name any part may be found by (`codeRefs.ts`). */
  const index = opts.code?.length ? codeIndex(opts.code, files.flatMap((f) => f.read.parts.flatMap(namesOf))) : null;
  const report: PageReport = { pages: [], kinds: {}, hidden: 0, hooks: 0, pictures: 0, unstyled: 0, bare: [], truncated: [] };
  files.forEach((f, i) => {
    const fileDir = f.file.includes("/") ? f.file.slice(0, f.file.lastIndexOf("/") + 1) : "";
    const link = (href: string) => pageLink(href, byFile, fileDir);
    const landed = nodesOf(f, pages[i]!.id, link, at, index);
    nodes.push(...landed);
    const hidden = f.read.parts.filter((p) => p.hidden).length;
    report.pages.push({ name: pages[i]!.name, file: f.file, parts: landed.length, hidden });
    report.hidden += hidden;
    for (const p of f.read.parts) {
      report.kinds[p.kind] = (report.kinds[p.kind] ?? 0) + 1;
      if (Object.keys(p.hooks).length || p.runs?.some((r) => r.hooks)) report.hooks++;
      if (p.kind === "picture") report.pictures++;
    }
    report.unstyled += Math.max(0, f.read.parts.length - f.read.styledParts);
    if (f.read.parts.length && f.read.styledParts === 0) report.bare.push(pages[i]!.name);
    if (f.read.truncated) report.truncated.push(pages[i]!.name);
  });
  /* Each page's hooks and variables, and which of its hooks came onto the board: one that did and is gone later was deleted. */
  const styleSource = {
    files: files.filter((f) => f.source).map((f, i) => {
      const on = new Set<string>();
      for (const p of f.read.parts) {
        for (const a of ["data-hook", "id"] as const) if (p.hooks[a]) on.add(`${a}=${p.hooks[a]}`);
        for (const r of p.runs ?? []) for (const a of ["data-hook", "id"] as const) if (r.hooks?.[a]) on.add(`${a}=${r.hooks[a]}`);
      }
      return { file: f.file, pageId: pages[files.indexOf(f)]?.id ?? pages[i]!.id, hooks: f.source!.hooks.map((h) => ({ ...h, imported: on.has(`${h.attr}=${h.value}`) })), vars: f.source!.vars };
    }),
  };
  return { doc: { pages, nodes, frameWidth: entry.read.width || 1440, ground: { bg: entry.read.bg, text: entry.read.colour }, styleSource }, report };
}

/** The kinds counted in words, biggest first: "12 headings, 40 lines of words, 3 fields". */
export function kindsSaid(kinds: Record<string, number>): string {
  return Object.entries(kinds)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${KIND_WORDS[k as PagePart["kind"]]?.[n === 1 ? 0 : 1] ?? k}`)
    .join(", ");
}

/**
 * THE LINE HE READS, and every number in it is a count of what landed.
 *
 * What came and how many of each; how many are hidden as the page opens
 * and are kept as hidden parts; that each keeps its hooks; which pages
 * have no styles of their own and so wear the browser's defaults; that
 * scripts were not run, so what they would have drawn is not here; that
 * pictures are placeholders when they are; and where the cap cut a page.
 */
export function reportSays(report: PageReport, opts: { scripts: boolean; from: string }): string {
  const total = report.pages.reduce((n, p) => n + p.parts, 0);
  const pages = report.pages.length;
  const head = `${total} part${total === 1 ? "" : "s"} from ${opts.from} landed${pages > 1 ? ` on ${pages} pages (${report.pages.map((p) => `${p.name} ${p.parts}`).join(", ")})` : ""}, each a part of its own under the section it sits in: ${kindsSaid(report.kinds)}.`;
  const hidden = report.hidden ? ` ${report.hidden} of them are hidden as the page opens and are kept as hidden parts that take no room, as the page had them.` : "";
  const hooks = report.hooks ? ` ${report.hooks} keep the id or data-hook the page's code finds them by.` : "";
  const many = report.bare.length > 1;
  const bareSaid = !report.bare.length ? "" : report.bare.length === pages ? (pages === 1 ? "The page sets no styles of its own" : "The pages set no styles of their own") : `${report.bare.join(", ")} set${many ? "" : "s"} no styles of ${many ? "their" : "its"} own`;
  const bare = report.unstyled ? ` ${bareSaid ? `${bareSaid}, and ${report.unstyled === total ? "every part" : `${report.unstyled} of the ${total} parts`} no style of the page's reaches` : `${report.unstyled} of the ${total} parts no style of the page's reaches`}: ${report.unstyled === 1 ? "it wears" : "they wear"} the browser's own defaults, as a browser draws them (heading sizes and weights, margins, the button and field look, list bullets).` : "";
  const scripts = opts.scripts ? " The page brought scripts, which were not run: whatever they would have drawn or filled in is not here, and the empty places they write into are kept for them." : "";
  const pics = report.pictures ? ` ${report.pictures} picture${report.pictures === 1 ? " is a placeholder" : "s are placeholders"}: the files are not carried this way.` : "";
  const cut = report.truncated.length ? ` ${report.truncated.join(", ")} had more than this reads, and the rest of it is not here.` : "";
  return `${head}${hidden}${hooks}${bare}${scripts}${pics}${cut}`;
}

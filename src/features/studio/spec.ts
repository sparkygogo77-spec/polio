/**
 * Compiles the canvas into a build brief.
 *
 * The important part is that POSITION CARRIES MEANING. An icon dropped above
 * another is earlier in the page; icons at the same height are a row; anything
 * inside a drawn frame belongs to that region; an arrow between two icons is an
 * explicit relationship. That is what makes "put it here, next to that" a
 * specification rather than decoration.
 */
import { getFeature, categoryOf } from "./catalog";
import { isLinkable, resolvePart } from "./parts";
import { FORMAT_FIELDS, formatLabel, FORMAT_GROUPS, type FormatValues } from "./format";
import { AURA_WORD, delayMs, describeLook, ENTRANCE_MS, ROLES, ROLE_LABEL, speedK, speedWord, type Look, type RoleId } from "./look";

/** A speed as the blueprint says it: the nearest word, and the length in ms so nothing is lost. */
function describeSpeed(v: number | string | null | undefined): string {
  const k = speedK(v);
  if (Math.abs(k - 1) < 0.06) return "";
  return `, ${speedWord(k)} (${Math.round(ENTRANCE_MS * k)} ms)`;
}
function describeDelay(v: number | string | null | undefined): string {
  const ms = delayMs(v);
  return ms ? `, ${ms} ms after the page` : "";
}
import { linkReason } from "./links";
import { filled, motionBrief, type MotionAsset } from "./motion";
import { resolvePalette } from "./parts/theme";
import { describeSketch, isBlankSketch } from "./sketch";
import type { StudioBrief, StudioGroup, StudioNode, StudioPage, StudioShape, TrailEntry } from "./store";

export interface CompileInput {
  pages: StudioPage[];
  nodes: StudioNode[];
  groups: StudioGroup[];
  shapes: StudioShape[];
  format: FormatValues;
  brief: StudioBrief;
  /** Width of the page frame the positions are relative to. */
  frameWidth?: number;
  /** Colour roles and texture layers. */
  look?: Look;
  /** Keyframe crates, each of which becomes a motion brief. */
  motion?: MotionAsset[];
  /** Every prompt as it was written, critiqued and revised — the paper trail. JSON only. */
  trail?: TrailEntry[];
}

interface NodeSpec {
  id: string;
  label: string;
  feature: string;
  featureId: string;
  category: string;
  /** A: a part in the layout. B: a behaviour applied to the whole page. C: needs a service behind it. */
  tier: "A" | "B" | "C";
  priority: string;
  prompt: string;
  content: string;
  options: Record<string, string>;
  /** Where it sends people, in words. */
  link: string | null;
  /** Roles this part repaints for itself, in words. */
  colour: string | null;
  /** This part's own type, in words, or null when it follows the site. */
  font: string | null;
  /** How it arrives on the page, and what glows round it. */
  anim: string | null;
  aura: string | null;
  texture: string | null;
  /** What it shows or does — what the backend must provide. */
  data: string;
  /** What was drawn for it on the drawing board, in words. */
  drawn: string | null;
  /** What the part is cut to, when it is not the box everything is by default. */
  shape: string | null;
  /** Parts this one reads from, via data wires. */
  feeds: string[];
  group: string | null;
  region: string | null;
  row: number;
  column: number;
  /** Share of the frame width this part takes, 0-100. */
  widthPct: number;
  heightPx: number;
  align: "full" | "left" | "centre" | "right";
  leftOf: string | null;
  rightOf: string | null;
  above: string | null;
  below: string | null;
}

export interface PageSpec {
  name: string;
  path: string;
  prompt: string;
  scroll: string;
  /** Reading order. A row is one horizontal band of parts; a section is a drawn region with words and nothing inside it, built from its prompt. */
  rows: { index: number; items: string[]; section?: { prompt: string; widthPct: number; heightPx: number; align: NodeSpec["align"] } }[];
  elements: NodeSpec[];
  /** Data wires: which part feeds which. */
  wires: { from: string; to: string; label: string }[];
  groups: { label: string; prompt: string; members: string[] }[];
  regions: { label: string; prompt: string; contains: string[]; /** Row number when the region is a section of its own. */ row: number | null }[];
  connections: { from: string; to: string; label: string; prompt: string; reason: string; relation: "flow" | "data" }[];
  sketches: { where: string; label: string; prompt: string }[];
}

export interface Spec {
  name: string;
  gimmick: string;
  master: string;
  /** The page frame the positions are relative to, in px. */
  frameWidth: number;
  /** Title, wordmark, description and link preview — what the name and the idea imply for the head of every page. */
  head: string[];
  /** Every format value that matters, resolved. `changed` marks the ones the author set. */
  format: { group: string; label: string; value: string; changed: boolean }[];
  /** Colour and texture, spelled out. */
  look: string[];
  /** One brief per crate of keyframes, exactly as `docs/MOTION.md` specifies. */
  motion: string[];
  pages: PageSpec[];
  stats: { pages: number; elements: number; groups: number; sketches: number; connections: number; prompted: number; must: number };
  /** The prompts' paper trail, when the document keeps one. */
  trail?: TrailEntry[];
}

/** Nodes whose vertical spans overlap are one visual row, read left to right. */
export function toRows(nodes: StudioNode[]): StudioNode[][] {
  const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: StudioNode[][] = [];
  for (const n of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const bottom = Math.max(...row.map((r) => r.y + r.h));
      const top = Math.min(...row.map((r) => r.y));
      const overlap = Math.min(bottom, n.y + n.h) - Math.max(top, n.y);
      // More than a third of the shorter element shares a horizontal band.
      if (overlap > Math.min(n.h, bottom - top) * 0.34) {
        row.push(n);
        continue;
      }
    }
    rows.push([n]);
  }
  return rows.map((r) => [...r].sort((a, b) => a.x - b.x));
}

const centre = (n: StudioNode) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

function frameContaining(shapes: StudioShape[], n: StudioNode): StudioShape | null {
  const c = centre(n);
  const frames = shapes.filter((s) => s.kind === "frame" && s.points.length >= 2);
  let best: StudioShape | null = null;
  let bestArea = Infinity;
  for (const f of frames) {
    const [p1, p2] = [f.points[0]!, f.points[1]!];
    const x1 = Math.min(p1[0], p2[0]);
    const x2 = Math.max(p1[0], p2[0]);
    const y1 = Math.min(p1[1], p2[1]);
    const y2 = Math.max(p1[1], p2[1]);
    if (c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2) {
      const area = (x2 - x1) * (y2 - y1);
      // Innermost frame wins when regions are nested.
      if (area < bestArea) {
        bestArea = area;
        best = f;
      }
    }
  }
  return best;
}

/** A drawn region as a box. */
function frameBox(f: StudioShape): { x: number; y: number; w: number; h: number } {
  const [p1, p2] = [f.points[0]!, f.points[1]!];
  return { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), w: Math.abs(p2[0] - p1[0]), h: Math.abs(p2[1] - p1[1]) };
}

function nearestNode(nodes: StudioNode[], x: number, y: number, maxDist = 140): StudioNode | null {
  let best: StudioNode | null = null;
  let bestD = maxDist;
  for (const n of nodes) {
    const c = centre(n);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function whereOnPage(x: number, y: number, nodes: StudioNode[]): string {
  if (!nodes.length) return "on an otherwise empty page";
  const near = nearestNode(nodes, x, y, 260);
  if (near) {
    const c = centre(near);
    const dx = x - c.x;
    const dy = y - c.y;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right of" : "left of") : dy > 0 ? "below" : "above";
    return `${dir} "${near.label}"`;
  }
  const vert = y < 260 ? "near the top" : y > 700 ? "near the bottom" : "in the middle";
  const horiz = x < 300 ? "on the left" : x > 800 ? "on the right" : "centred";
  return `${vert}, ${horiz}`;
}

function alignOf(n: { x: number; w: number }, fw: number): NodeSpec["align"] {
  if (n.w >= fw - 8) return "full";
  const cx = n.x + n.w / 2;
  if (Math.abs(cx - fw / 2) < fw * 0.06) return "centre";
  return cx < fw / 2 ? "left" : "right";
}

/** "background: the site's accent, text: #ffffff" — or nothing when it follows the site. */
function describeFont(font: StudioNode["font"] | undefined): string | null {
  if (!font) return null;
  const bits: string[] = [];
  if (font.family) bits.push(`set in ${font.family}`);
  if (typeof font.size === "number" && Math.abs(font.size - 1) > 0.02) bits.push(`${Math.round(font.size * 100)}% of the site's base size`);
  if (typeof font.weight === "number") bits.push(`weight ${font.weight}`);
  if (typeof font.spacing === "number" && Math.abs(font.spacing) > 0.004) bits.push(`letter spacing ${font.spacing.toFixed(2)}em`);
  if (typeof font.leading === "number") bits.push(`line height ${font.leading.toFixed(2)}`);
  return bits.length ? bits.join(", ") : null;
}

function describeColour(colour: StudioNode["colour"] | undefined): string | null {
  if (!colour) return null;
  const parts = ROLES.filter((r) => colour[r]).map((r) => {
    const v = colour[r]!;
    const named = (ROLES as readonly string[]).includes(v);
    return `${ROLE_LABEL[r].toLowerCase()}: ${named ? `the site's ${ROLE_LABEL[v as RoleId].toLowerCase()}` : v}`;
  });
  return parts.length ? parts.join(", ") : null;
}

/** The entrance names, in words a reader can act on. */
const ENTRANCE_WORD: Record<string, string> = {
  "el-fade": "fades in",
  "el-rise": "rises into place from below",
  "el-drop": "drops in from above",
  "el-left": "slides in from the left",
  "el-right": "slides in from the right",
  "el-grow": "grows from slightly smaller",
  "el-blur": "comes into focus from a blur",
  "el-flip": "tips up into place",
};

function describeLink(link: StudioNode["link"] | undefined, pages: StudioPage[]): string | null {
  if (!link) return null;
  if (link.kind === "url") return link.target;
  if (link.kind === "node") return `element ${link.target}`;
  const p = pages.find((x) => x.id === link.target);
  return p ? `page "${p.name}" (${p.path})` : `page "${link.target}"`;
}

export function compileSpec(input: CompileInput): Spec {
  const { pages, nodes, groups, shapes, format, brief } = input;
  const look = input.look;
  const motion = input.motion;
  const fw = input.frameWidth ?? 1440;

  // Every value the agent would otherwise have to guess, resolved: the plain
  // fields always, the advanced ones only when the author set them. A default
  // left out of the brief was read as "not decided", and the whole visual
  // system got inferred from six colours.
  const formatRows = FORMAT_FIELDS.flatMap((field) => {
    const changed = field.id in format && format[field.id] !== field.default;
    if (field.advanced && !changed) return [];
    const value = format[field.id] ?? field.default;
    if (field.type === "text" && !String(value).trim()) return [];
    return [{
      group: FORMAT_GROUPS.find((g) => g.id === field.group)?.label ?? field.group,
      label: field.label,
      value: formatLabel(field, value),
      changed,
    }];
  });

  const pageSpecs: PageSpec[] = pages.map((page) => {
    const pNodes = nodes.filter((n) => n.pageId === page.id);
    const pShapes = shapes.filter((s) => s.pageId === page.id);
    const pGroups = groups.filter((g) => g.pageId === page.id);
    // Behaviours apply to the whole page, so they are not part of its layout.
    const tierOf = (n: StudioNode): NodeSpec["tier"] => resolvePart(n.featureId)?.tier ?? "A";
    const laidOut = pNodes.filter((n) => tierOf(n) !== "B");
    const behaving = pNodes.filter((n) => tierOf(n) === "B");
    const rows = toRows(laidOut);
    const byId = new Map(pNodes.map((n) => [n.id, n]));
    const frames = pShapes.filter((s) => s.kind === "frame" && s.points.length >= 2);
    const inside = (f: StudioShape) => pNodes.filter((n) => frameContaining(pShapes, n)?.id === f.id);
    // A drawn region with words on it and nothing inside is a section of its
    // own — it was falling out of the reading order and into a "(nothing yet)".
    const sections = frames.filter((f) => !inside(f).length && (f.prompt.trim() || f.label.trim()));
    type Ordered = { kind: "row"; row: StudioNode[]; y: number } | { kind: "section"; frame: StudioShape; y: number };
    const ordered: Ordered[] = [
      ...rows.map((row) => ({ kind: "row" as const, row, y: Math.min(...row.map((n) => n.y)) })),
      ...sections.map((frame) => ({ kind: "section" as const, frame, y: frameBox(frame).y })),
    ].sort((a, b) => a.y - b.y);
    const rowNumber = new Map<StudioNode[], number>();
    const sectionRow = new Map<string, number>();
    ordered.forEach((o, i) => (o.kind === "row" ? rowNumber.set(o.row, i + 1) : sectionRow.set(o.frame.id, i + 1)));

    const elements: NodeSpec[] = [];
    const place = (n: StudioNode, rowIndex: number, colIndex: number, row: StudioNode[]) => {
      const feature = getFeature(n.featureId);
      const frame = frameContaining(pShapes, n);
      const prevRow = rows[rowIndex - 1];
      const nextRow = rows[rowIndex + 1];
      elements.push({
          id: n.id,
          label: n.label,
          feature: feature?.name ?? n.label,
          featureId: n.featureId,
          category: feature ? categoryOf(feature.category).label : "Custom",
          tier: tierOf(n),
          priority: n.priority,
          prompt: n.prompt.trim(),
          content: (n.content ?? "").trim(),
          options: n.options,
          // A part that sends people somewhere and has nowhere to send them yet
          // says so, so the agent builds a placeholder rather than a guess.
          link: describeLink(n.link, pages) ?? (isLinkable(n.featureId) ? "nowhere yet — a visible placeholder that says so, never an invented target" : null),
          colour: describeColour(n.colour),
          font: describeFont(n.font),
          anim: n.anim
            ? `${ENTRANCE_WORD[n.anim] ?? n.anim}${describeSpeed(n.animSpeed)}${describeDelay(n.animDelay)}${
              n.animEase && n.animEase !== "smooth" ? ` (${n.animEase} easing)` : ""}`
            : null,
          aura: n.aura
            ? `${ROLE_LABEL[n.aura as RoleId]?.toLowerCase() ?? n.aura} ${AURA_WORD[n.auraStyle ?? "glow"]} round its edge${
              n.auraSize && Math.abs(n.auraSize - 1) > 0.05 ? `, ${n.auraSize < 1 ? "tight" : "wide"} (${Math.round(n.auraSize * 100)}% of the usual reach)` : ""}`
            : null,
          texture: !n.texture ? null : n.texture === "none" ? "no texture, whatever the site wears" : "its own texture layer",
          data: (n.data ?? "").trim(),
          drawn: n.sketch && !isBlankSketch(n.sketch) ? describeSketch(n.sketch) : null,
          shape: n.shape && n.shape !== "box" ? n.shape : null,
          feeds: pShapes
            .filter((sh) => sh.kind === "arrow" && sh.relation === "data" && sh.toNodeId === n.id)
            .map((sh) => pNodes.find((x) => x.id === sh.fromNodeId)?.label)
            .filter((x): x is string => !!x),
          widthPct: Math.round((Math.min(n.w, fw) / fw) * 100),
          heightPx: n.h,
          align: alignOf(n, fw),
          group: pGroups.find((g) => g.id === n.groupId)?.label ?? null,
          region: frame ? frame.label || "unnamed region" : null,
          row: rowIndex < 0 ? 0 : rowNumber.get(rows[rowIndex]!) ?? rowIndex + 1,
          column: colIndex + 1,
          leftOf: row[colIndex + 1]?.label ?? null,
          rightOf: row[colIndex - 1]?.label ?? null,
          above: nextRow?.[0]?.label ?? null,
          below: prevRow?.[0]?.label ?? null,
      });
    };
    rows.forEach((row, rowIndex) => row.forEach((n, colIndex) => place(n, rowIndex, colIndex, row)));
    // Behaviours come last, at row 0 — they have no place in the layout.
    behaving.forEach((n) => place(n, -1, -1, []));

    const connections = pShapes
      .filter((s) => s.kind === "arrow" && s.points.length >= 2)
      .map((s) => {
        const from = (s.fromNodeId && byId.get(s.fromNodeId)) || nearestNode(pNodes, s.points[0]![0], s.points[0]![1]);
        const to = (s.toNodeId && byId.get(s.toNodeId)) || nearestNode(pNodes, s.points[1]![0], s.points[1]![1]);
        const relation = s.relation ?? "flow";
        return {
          from: from?.label ?? "canvas",
          to: to?.label ?? "canvas",
          label: s.label.trim(),
          prompt: s.prompt.trim(),
          relation,
          /*
           * Why the two are chained, in one line.
           *
           * A connection used to reach the brief as "A → B", which is a fact
           * nobody can build from: it says two parts are joined and nothing
           * about what either has to do about it. The reason is read off the
           * parts themselves — a condition in one's prompt, the data the
           * other holds — so it is already true and nobody typed it twice.
           */
          reason: s.label.trim() || linkReason(from ?? undefined, to ?? undefined, relation),
        };
      })
      .filter((c) => c.from !== c.to);

    const regions = frames.map((s) => ({
      label: s.label.trim() || "unnamed region",
      prompt: s.prompt.trim(),
      contains: inside(s).map((n) => n.label),
      row: sectionRow.get(s.id) ?? null,
    }));

    const sketches = pShapes
      .filter((s) => s.kind === "pen")
      .map((s) => {
        const xs = s.points.map((p) => p[0]);
        const ys = s.points.map((p) => p[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        return { where: whereOnPage(cx, cy, pNodes), label: s.label.trim(), prompt: s.prompt.trim() };
      });

    return {
      name: page.name,
      path: page.path,
      prompt: page.prompt.trim(),
      scroll: page.scroll,
      rows: ordered.map((o, i) => {
        if (o.kind === "row") return { index: i + 1, items: o.row.map((n) => n.label) };
        const b = frameBox(o.frame);
        return {
          index: i + 1,
          items: [o.frame.label.trim() || "unnamed region"],
          section: { prompt: o.frame.prompt.trim(), widthPct: Math.round((Math.min(b.w, fw) / fw) * 100), heightPx: Math.round(b.h), align: alignOf(b, fw) },
        };
      }),
      elements,
      wires: pShapes
        .filter((sh) => sh.kind === "arrow" && sh.relation === "data")
        .map((sh) => ({
          from: (sh.fromNodeId && byId.get(sh.fromNodeId)?.label) || "somewhere",
          to: (sh.toNodeId && byId.get(sh.toNodeId)?.label) || "somewhere",
          label: sh.label.trim(),
        }))
        .filter((w) => w.from !== w.to),
      groups: pGroups
        .map((g) => ({
          label: g.label,
          prompt: g.prompt.trim(),
          members: pNodes.filter((n) => n.groupId === g.id).map((n) => n.label),
        }))
        .filter((g) => g.members.length > 0),
      regions,
      connections,
      sketches,
    };
  });

  const name = brief.name.trim();
  const gimmick = brief.gimmick.trim();
  const firstSentence = (t: string) => (t.match(/^[^.!?]+[.!?]?/)?.[0] ?? t).trim();
  return {
    name: name || "Untitled site",
    gimmick,
    master: brief.master.trim(),
    frameWidth: fw,
    head: name
      ? [
          `The site is called **${name}**. Wherever a logo or wordmark is drawn it reads "${name}" — never "Logo".`,
          `Browser title: "${name}". Meta description: ${gimmick ? `"${firstSentence(gimmick)}"` : "one sentence from the idea, once it is written"}.`,
          "Link preview (Open Graph and Twitter card): the first page's first screen at 1200×630 with the wordmark on it; the favicon is the wordmark's mark.",
        ]
      : [],
    format: formatRows,
    look: look ? describeLook(look, resolvePalette(format, look)) : [],
    // Only a crate with something to interpolate is worth briefing.
    motion: (motion ?? []).filter((m) => filled(m).length >= 2).map((m) => motionBrief(m)),
    pages: pageSpecs,
    stats: {
      pages: pages.length,
      elements: nodes.length,
      groups: groups.length,
      sketches: shapes.filter((s) => s.kind === "pen").length,
      connections: shapes.filter((s) => s.kind === "arrow").length,
      prompted: nodes.filter((n) => n.prompt.trim()).length + groups.filter((g) => g.prompt.trim()).length,
      must: nodes.filter((n) => n.priority === "must").length,
    },
    ...(input.trail?.length ? { trail: input.trail } : {}),
  };
}

/** The human-and-agent readable brief. This is what gets copied or sent. */
/**
 * The part of the brief that does not move: everything down to the pages.
 *
 * A thread sends this as its prefix and marks it for the cache, so the
 * second call of a thread pays nothing for it. The split is by heading
 * rather than by line count, and it keeps "How to read this" with it,
 * because the conventions are as stable as the idea and are what make the
 * pieces after them legible.
 */
export function briefPrefix(markdown: string): string {
  const at = markdown.indexOf("\n## Pages (");
  const head = at < 0 ? markdown : markdown.slice(0, at);
  const how = markdown.indexOf("\n## How to read this");
  return how < 0 ? head : `${head}\n${markdown.slice(how + 1)}`;
}

export function specToMarkdown(spec: Spec): string {
  const L: string[] = [];
  L.push(`# ${spec.name} — build brief`, "");

  if (spec.gimmick) L.push(`## The idea`, "", spec.gimmick, "");
  if (spec.master) L.push(spec.master, "");
  if (!spec.gimmick && !spec.master) L.push("## The idea", "", "_(not written yet — say what this site is)_", "");

  if (spec.head.length) {
    L.push("## The site", "");
    for (const line of spec.head) L.push(`- ${line}`);
    L.push("");
  }

  if (spec.format.length) {
    L.push("## Format", "");
    L.push("Every value here is binding. `*` marks what the author set by hand; the rest are the defaults, and a default still applies.", "");
    let lastGroup = "";
    for (const row of spec.format) {
      if (row.group !== lastGroup) {
        L.push(`**${row.group}**`);
        lastGroup = row.group;
      }
      L.push(`- ${row.label}: ${row.value}${row.changed ? " *" : ""}`);
    }
    L.push("");
  }

  if (spec.look.length) {
    L.push("## Colour and texture", "");
    L.push(...spec.look, "");
  }

  if (spec.motion.length) {
    L.push("## Motion assets", "");
    L.push(
      "Each block below is a complete brief for one animation. The Builder already plays the",
      "sequence as a cross-dissolve on this timing; match the timing exactly and replace the",
      "dissolve with real in-between frames.",
      "",
    );
    for (const brief of spec.motion) L.push("```", brief, "```", "");
  }

  L.push(`## Pages (${spec.pages.length})`, "");
  spec.pages.forEach((page, i) => {
    L.push(`### ${i + 1}. ${page.name} — \`${page.path}\``, "");
    if (page.scroll && page.scroll !== "inherit") L.push(`Scroll: ${page.scroll}`, "");
    if (page.prompt) L.push(page.prompt, "");

    if (page.rows.length) {
      L.push("Layout, top to bottom:", "");
      for (const row of page.rows) {
        if (row.section) {
          const s = row.section;
          L.push(`${row.index}. **${row.items[0]}** — a section of its own, drawn as a region; ${s.align === "full" ? "full width" : `${s.widthPct}% of the frame, ${s.align}`}, at least ${s.heightPx}px tall`);
          if (s.prompt) L.push(`   - build it from this: ${s.prompt}`);
        } else L.push(`${row.index}. ${row.items.map((x) => `**${x}**`).join("  ·  ")}`);
      }
      L.push("");
    }

    const grouping = page.regions.filter((r) => r.contains.length || r.row === null);
    if (grouping.length) {
      L.push("Regions:", "");
      for (const r of grouping) {
        L.push(`- **${r.label}** — ${r.contains.length ? `contains ${r.contains.join(", ")}` : "drawn but empty and unnamed; ignore it"}`);
        if (r.prompt) L.push(`  - ${r.prompt}`);
      }
      L.push("");
    }

    if (page.groups.length) {
      L.push("Groups:", "");
      for (const g of page.groups) {
        L.push(`- **${g.label}** — ${g.members.join(", ")}`);
        if (g.prompt) L.push(`  - ${g.prompt}`);
      }
      L.push("");
    }

    const behaviours = page.elements.filter((e) => e.tier === "B");
    const laidOut = page.elements.filter((e) => e.tier !== "B");
    if (laidOut.length) {
      L.push("Elements:", "");
      for (const e of laidOut) {
        const opts = Object.entries(e.options).filter(([, v]) => v);
        L.push(`- **${e.label}** — ${e.feature} · ${e.priority}`);
        const place: string[] = [`row ${e.row}, position ${e.column}`, e.align === "full" ? "full width" : `${e.widthPct}% of the frame, ${e.align}`, `at least ${e.heightPx}px tall`];
        if (e.region) place.push(`inside "${e.region}"`);
        if (e.rightOf) place.push(`right of "${e.rightOf}"`);
        if (e.leftOf) place.push(`left of "${e.leftOf}"`);
        if (e.group) place.push(`in group "${e.group}"`);
        L.push(`  - placement: ${place.join("; ")}`);
        if (e.content) L.push(`  - contains: ${e.content}`);
        if (opts.length) L.push(`  - options: ${opts.map(([k, v]) => `${k}=${v}`).join(", ")}`);
        if (e.link) L.push(`  - links to: ${e.link}`);
        if (e.colour) L.push(`  - colour, this part only: ${e.colour}`);
        if (e.font) L.push(`  - type, this part only: ${e.font}`);
        if (e.aura) L.push(`  - aura: ${e.aura}`);
        if (e.texture) L.push(`  - texture: ${e.texture}`);
        if (e.anim) L.push(`  - on arrival: it ${e.anim}`);
        if (e.data) L.push(`  - data: ${e.data}`);
        if (e.feeds.length) L.push(`  - reads from: ${e.feeds.join(", ")}`);
        if (e.shape) L.push(`  - shape: ${e.shape === "rounded" ? "a rounded box" : `${e.shape === "circle" ? "a circle" : "an ellipse"}, cut to it`}`);
        if (e.drawn) L.push(`  - drawn: ${e.drawn}`);
        if (e.prompt) L.push(`  - prompt: ${e.prompt}`);
      }
      L.push("");
    }

    if (behaviours.length) {
      L.push("Behaviours on this page — these apply to the whole page and are not laid out in it:", "");
      for (const b of behaviours) {
        const opts = Object.entries(b.options).filter(([, v]) => v);
        L.push(`- **${b.feature}**${b.content ? ` — ${b.content}` : ""}`);
        if (opts.length) L.push(`  - options: ${opts.map(([k, v]) => `${k}=${v}`).join(", ")}`);
        if (b.prompt) L.push(`  - prompt: ${b.prompt}`);
      }
      L.push("");
    }

    if (page.connections.length) {
      L.push("Connections:", "");
      for (const c of page.connections) {
        // The relation is only worth stating when the reason has not already
        // said it — "reads address from Connect wallet _(reads from it)_" is
        // the same sentence twice.
        const reads = c.relation === "data" && !/^reads\b/i.test(c.reason);
        L.push(`- **${c.from}** → **${c.to}**${c.reason ? ` — ${c.reason}` : ""}${reads ? " _(reads from it)_" : ""}`);
        if (c.prompt) L.push(`  - ${c.prompt}`);
      }
      L.push("");
    }

    if (page.sketches.length) {
      L.push("Hand-drawn marks:", "");
      for (const s of page.sketches) {
        L.push(`- a sketch ${s.where}${s.label ? ` labelled "${s.label}"` : ""}`);
        if (s.prompt) L.push(`  - ${s.prompt}`);
      }
      L.push("");
    }

    if (!page.elements.length && !page.sketches.length) L.push("_(empty page)_", "");
  });

  const withData = spec.pages.flatMap((p) => p.elements.filter((e) => e.data || e.feeds.length).map((e) => ({ page: p, e })));
  const wires = spec.pages.flatMap((p) => p.wires.map((w) => ({ page: p, w })));
  if (withData.length || wires.length) {
    L.push("## What the backend must provide", "");
    L.push(
      "Written from the data notes on each part. Everything below is something the",
      "finished site needs from a server, a contract or a feed — the front end is",
      "already specified above. Build these to fit the parts named, not the other way round.",
      "",
    );
    for (const { page, e } of withData) {
      const where = `${page.name}, row ${e.row}`;
      L.push(`- **${e.label}** (${where}) — ${e.data || "reads from another part"}`);
      if (e.feeds.length) L.push(`  - fed by: ${e.feeds.join(", ")}`);
    }
    if (wires.length) {
      L.push("", "Wires between parts:", "");
      for (const { page, w } of wires) L.push(`- ${w.from} → ${w.to}${w.label ? ` (${w.label})` : ""} — on ${page.name}`);
    }
    L.push("");
  }

  L.push("## How to read this", "");
  const allMust = spec.stats.elements > 2 && spec.stats.must === spec.stats.elements;
  L.push(
    `Positions are relative to a page frame ${spec.frameWidth}px wide. Vertical position is reading order; horizontal`,
    "position is arrangement within a row. Width is a share of that frame and is deliberate. Height is a minimum:",
    "the content decides the rest, and nothing is ever clipped to the number. Narrower than the frame, each row",
    "stacks top to bottom in reading order, full-width parts stay full-width and type steps down to fit, unless an",
    "element's own prompt says otherwise — the frame is the desktop specification, not a fixed canvas.",
    "",
    "\"contains\" lists what the part holds (tab labels, links, fields); \"links to\" is where it sends people — a part",
    "that sends people nowhere yet is built as a visible placeholder that says so, never given an invented target;",
    "\"data\" is what it shows or does, and \"reads from\" names a part that feeds it. A part with a \"colour\" line",
    "repaints those roles for itself; everything else follows the site palette exactly. \"drawn\" is the shape the",
    "author drew for the part on the drawing board, in words: its proportion and outline are the specification for",
    "the part's shape, and the words beside it say what the drawing is.",
    "",
    "Every Format value listed is binding; `*` marks the ones the author set, the rest are defaults that still apply.",
    "Hairlines, rules and borders are one token — the Text role at 12% opacity — unless Format › Borders says otherwise,",
    "and two rules never stack into a double line. When a sticky top bar exists, anchor targets clear it",
    "(scroll-margin-top) and the bar marks the current section. Everything that moves — entrances, loops, glows,",
    "parallax — respects prefers-reduced-motion.",
    "",
    "Anything inside a region belongs to that region; a region listed as a section of its own is built from its",
    "prompt at its row. Behaviours are listed apart from the elements because they change how the whole page moves",
    "rather than occupying a place in it. Element prompts are specific to that placement and override anything more",
    `general. Priorities: \`must\` ships first, \`nice\` if it fits, \`idea\` is exploratory.${allMust ? " Every element here is marked must, so there is no cut list: the row order is the priority." : ""}`,
    "",
  );
  return L.join("\n");
}

export function specToJson(spec: Spec): string {
  return JSON.stringify(spec, null, 2);
}

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
import { changedFormat, formatLabel, FORMAT_GROUPS, type FormatValues } from "./format";
import type { StudioBrief, StudioGroup, StudioNode, StudioPage, StudioShape } from "./store";

export interface CompileInput {
  pages: StudioPage[];
  nodes: StudioNode[];
  groups: StudioGroup[];
  shapes: StudioShape[];
  format: FormatValues;
  brief: StudioBrief;
}

interface NodeSpec {
  id: string;
  label: string;
  feature: string;
  featureId: string;
  category: string;
  priority: string;
  prompt: string;
  options: Record<string, string>;
  group: string | null;
  region: string | null;
  row: number;
  column: number;
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
  rows: { index: number; items: string[] }[];
  elements: NodeSpec[];
  groups: { label: string; prompt: string; members: string[] }[];
  regions: { label: string; prompt: string; contains: string[] }[];
  connections: { from: string; to: string; label: string; prompt: string }[];
  sketches: { where: string; label: string; prompt: string }[];
}

export interface Spec {
  name: string;
  gimmick: string;
  master: string;
  format: { group: string; label: string; value: string }[];
  pages: PageSpec[];
  stats: { pages: number; elements: number; groups: number; sketches: number; connections: number; prompted: number };
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

export function compileSpec(input: CompileInput): Spec {
  const { pages, nodes, groups, shapes, format, brief } = input;

  const formatRows = changedFormat(format).map((field) => ({
    group: FORMAT_GROUPS.find((g) => g.id === field.group)?.label ?? field.group,
    label: field.label,
    value: formatLabel(field, format[field.id]!),
  }));

  const pageSpecs: PageSpec[] = pages.map((page) => {
    const pNodes = nodes.filter((n) => n.pageId === page.id);
    const pShapes = shapes.filter((s) => s.pageId === page.id);
    const pGroups = groups.filter((g) => g.pageId === page.id);
    const rows = toRows(pNodes);
    const byId = new Map(pNodes.map((n) => [n.id, n]));

    const elements: NodeSpec[] = [];
    rows.forEach((row, rowIndex) => {
      row.forEach((n, colIndex) => {
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
          priority: n.priority,
          prompt: n.prompt.trim(),
          options: n.options,
          group: pGroups.find((g) => g.id === n.groupId)?.label ?? null,
          region: frame ? frame.label || "unnamed region" : null,
          row: rowIndex + 1,
          column: colIndex + 1,
          leftOf: row[colIndex + 1]?.label ?? null,
          rightOf: row[colIndex - 1]?.label ?? null,
          above: nextRow?.[0]?.label ?? null,
          below: prevRow?.[0]?.label ?? null,
        });
      });
    });

    const connections = pShapes
      .filter((s) => s.kind === "arrow" && s.points.length >= 2)
      .map((s) => {
        const from = (s.fromNodeId && byId.get(s.fromNodeId)) || nearestNode(pNodes, s.points[0]![0], s.points[0]![1]);
        const to = (s.toNodeId && byId.get(s.toNodeId)) || nearestNode(pNodes, s.points[1]![0], s.points[1]![1]);
        return {
          from: from?.label ?? "canvas",
          to: to?.label ?? "canvas",
          label: s.label.trim(),
          prompt: s.prompt.trim(),
        };
      })
      .filter((c) => c.from !== c.to);

    const regions = pShapes
      .filter((s) => s.kind === "frame")
      .map((s) => ({
        label: s.label.trim() || "unnamed region",
        prompt: s.prompt.trim(),
        contains: pNodes.filter((n) => frameContaining(pShapes, n)?.id === s.id).map((n) => n.label),
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
      rows: rows.map((r, i) => ({ index: i + 1, items: r.map((n) => n.label) })),
      elements,
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

  return {
    name: brief.name.trim() || "Untitled site",
    gimmick: brief.gimmick.trim(),
    master: brief.master.trim(),
    format: formatRows,
    pages: pageSpecs,
    stats: {
      pages: pages.length,
      elements: nodes.length,
      groups: groups.length,
      sketches: shapes.filter((s) => s.kind === "pen").length,
      connections: shapes.filter((s) => s.kind === "arrow").length,
      prompted: nodes.filter((n) => n.prompt.trim()).length + groups.filter((g) => g.prompt.trim()).length,
    },
  };
}

/** The human-and-agent readable brief. This is what gets copied or sent. */
export function specToMarkdown(spec: Spec): string {
  const L: string[] = [];
  L.push(`# ${spec.name} — build brief`, "");

  if (spec.gimmick) L.push(`## The idea`, "", spec.gimmick, "");
  if (spec.master) L.push(spec.master, "");
  if (!spec.gimmick && !spec.master) L.push("## The idea", "", "_(not written yet — say what this site is)_", "");

  if (spec.format.length) {
    L.push("## Format", "");
    let lastGroup = "";
    for (const row of spec.format) {
      if (row.group !== lastGroup) {
        L.push(`**${row.group}**`);
        lastGroup = row.group;
      }
      L.push(`- ${row.label}: ${row.value}`);
    }
    L.push("");
  }

  L.push(`## Pages (${spec.pages.length})`, "");
  spec.pages.forEach((page, i) => {
    L.push(`### ${i + 1}. ${page.name} — \`${page.path}\``, "");
    if (page.scroll && page.scroll !== "inherit") L.push(`Scroll: ${page.scroll}`, "");
    if (page.prompt) L.push(page.prompt, "");

    if (page.rows.length) {
      L.push("Layout, top to bottom:", "");
      for (const row of page.rows) L.push(`${row.index}. ${row.items.map((x) => `**${x}**`).join("  ·  ")}`);
      L.push("");
    }

    if (page.regions.length) {
      L.push("Regions:", "");
      for (const r of page.regions) {
        L.push(`- **${r.label}** — contains ${r.contains.length ? r.contains.join(", ") : "(nothing yet)"}`);
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

    if (page.elements.length) {
      L.push("Elements:", "");
      for (const e of page.elements) {
        const opts = Object.entries(e.options).filter(([, v]) => v);
        L.push(`- **${e.label}** — ${e.feature} (${e.category}) · ${e.priority}`);
        const place: string[] = [`row ${e.row}, position ${e.column}`];
        if (e.region) place.push(`inside "${e.region}"`);
        if (e.rightOf) place.push(`right of "${e.rightOf}"`);
        if (e.leftOf) place.push(`left of "${e.leftOf}"`);
        if (e.group) place.push(`in group "${e.group}"`);
        L.push(`  - placement: ${place.join("; ")}`);
        if (opts.length) L.push(`  - options: ${opts.map(([k, v]) => `${k}=${v}`).join(", ")}`);
        if (e.prompt) L.push(`  - prompt: ${e.prompt}`);
      }
      L.push("");
    }

    if (page.connections.length) {
      L.push("Connections:", "");
      for (const c of page.connections) {
        L.push(`- **${c.from}** → **${c.to}**${c.label ? ` — ${c.label}` : ""}`);
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

  L.push("## How to read this", "");
  L.push(
    "Vertical position is reading order and horizontal position is arrangement within a row.",
    "Anything listed inside a region belongs to that region. Element prompts are specific to",
    "that placement and override anything more general. Priorities: `must` ships first, `nice`",
    "if it fits, `idea` is exploratory.",
    "",
  );
  return L.join("\n");
}

export function specToJson(spec: Spec): string {
  return JSON.stringify(spec, null, 2);
}

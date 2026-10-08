/**
 * What a published repository carries for the code chat that works in it.
 *
 * The builder handles what it can; a repo-connected code chat builds the
 * rest. So every publish leaves the rest written down, in the shape the
 * builder can take back:
 *
 *   · TASKS.md — every task the library could not cover (`node.task`),
 *     each under the part's stable id, with the part, the page, the page's
 *     file and the owner's words. Keyed by id and sorted, so a republish
 *     writes the same entry in the same place and never a second one. A task
 *     whose part now carries a feature is listed as built.
 *   · AGENTS.md and CLAUDE.md — the feature contract, as one marked block
 *     (`BLOCK_START` … `BLOCK_END`), merged into whatever the repository
 *     already has (`mergeBlock`, run by the publish route against the file
 *     on the branch), so the owner's own notes survive every publish.
 *   · features/<id>/ — manifest.json (the library's manifest, plus `parts`,
 *     the part ids it is attached to), script.js (plain browser JavaScript
 *     calling `siteFeatures.define`) and README.md, for each feature the site
 *     uses. A code chat that builds a task writes a folder in the same shape,
 *     and the builder offers it back (`roundTrip.ts`).
 *
 * Pure: the tests run it as written.
 */
import { allWorks, getWork, inputsOf, usesOf, type Work, type WorkManifest, type WorkUse } from "./works.ts";
import { homeFor, type Home } from "../../homePage.ts";

export const BLOCK_START = "<!-- builder:features:start -->";
export const BLOCK_END = "<!-- builder:features:end -->";

interface Page { id: string; name: string; path?: string }
interface Part {
  id: string;
  pageId?: string;
  featureId?: string;
  label?: string;
  content?: unknown;
  task?: string | null;
  work?: WorkUse | null;
}
export interface ContractFile { path: string; content: string }

function wordsOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((s) => (s && typeof s === "object" && "text" in s ? String((s as { text: unknown }).text) : "")).join("");
  return "";
}

/** The file a page is published as: the export's own answer (`homePage.ts`). */
function fileOf(page: Page | undefined, home: Home): string {
  return page ? home.file(page) : "index.html";
}

const one = (s: string) => s.replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------------ */
/* D) TASKS.md                                                         */
/* ------------------------------------------------------------------ */

export function tasksFile(nodes: readonly Part[], pages: readonly Page[]): string {
  const home = homeFor(pages);
  const order = new Map(pages.map((p, i) => [p.id, i]));
  const tasked = nodes
    .filter((n) => n.task && n.task.trim())
    .sort((a, b) => (order.get(a.pageId ?? "") ?? 999) - (order.get(b.pageId ?? "") ?? 999) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const open = tasked.filter((n) => !(n.work && getWork(n.work.id)));
  const built = tasked.filter((n) => n.work && getWork(n.work.id));
  const entry = (n: Part) => {
    const page = pages.find((p) => p.id === n.pageId);
    const shows = one(wordsOf(n.content));
    const lines = [
      `### \`${n.id}\` — ${one(n.label || shows || n.featureId || "part")}`,
      "",
      `- **Page:** ${page?.name ?? "?"} (\`${fileOf(page, home)}\`)`,
      `- **Part:** ${n.featureId ?? "part"}${shows ? `, showing “${shows}”` : ""}`,
      `- **Find it:** \`document.getElementById("${n.id}")\``,
      `- **The owner's words:** ${one(n.task!)}`,
    ];
    if (n.work && getWork(n.work.id)) lines.push(`- **Built as:** \`features/${n.work.id}/\` (${getWork(n.work.id)!.manifest.name})`);
    return lines.join("\n");
  };
  return [
    "# Tasks",
    "",
    "What the owner asked parts of this site to do that the builder's feature library does not cover yet.",
    "Each task is under its part's stable id, which is also that element's `id` on the published page.",
    "The builder rewrites this file on every publish, from the site itself; build a task as a feature",
    "(see the feature contract in AGENTS.md) and name the part in its manifest's `parts`, and the next",
    "publish lists it under Built.",
    "",
    "## Open",
    "",
    open.length ? open.map(entry).join("\n\n") : "No open tasks.",
    "",
    ...(built.length ? ["## Built", "", built.map(entry).join("\n\n"), ""] : []),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* E) the feature contract                                             */
/* ------------------------------------------------------------------ */

function contractBlock(): string {
  return `${BLOCK_START}
## Features: how working parts are built on this site

This site was designed in a visual builder. Anything it could not make work is a task in
\`TASKS.md\`, under the part's stable id. Build it as a **feature**, in this shape, and the builder
can take it back into its library and reuse it on the owner's other sites.

A feature is working code with **no look of its own**. It is attached to a part, and it writes
into that part's own element, so the part keeps the style it was designed with.

Each feature lives in \`features/<name>/\` (the folder's name is the feature's id):

- \`manifest.json\` — plain data:
  - \`id\` (the folder name), \`name\`, \`category\` (e.g. \`"data"\`), \`blurb\`, \`version\`
  - \`inputs\`: \`[{ "id", "label", "kind": "text" | "number" | "one", "default", "values"? }]\`
  - \`needs\`: \`"none"\` (runs on a static page), \`"wallet"\`, \`"backend"\` or \`"key"\`
  - \`says\`: phrases the owner might type to attach it (e.g. \`"sol price"\`)
  - \`look\`: \`{ "sample": "$142.37" }\`, what a part carrying it shows
  - \`parts\`: the ids of the parts it is attached to (from \`TASKS.md\`)
- \`script.js\` — plain browser JavaScript, no framework, no imports:

  \`\`\`js
  siteFeatures.define("<name>", function (el, inputs, api) {
    // el: the part's element (document.getElementById(part id))
    // inputs: the manifest's inputs, as set on the part
    // api.json(url), api.set(el, text), api.money(n), api.percent(n), api.stale(el), api.seconds(v, d)
    function tick() {
      return api.json("https://…").then(function (j) { api.set(el, api.money(j.price)); })
        .catch(function () { api.stale(el); });
    }
    tick();
    return setInterval(tick, api.seconds(inputs.every, 30) * 1000);
  });
  \`\`\`
- \`README.md\` — what it does, its inputs, and what it needs.

The builder publishes \`assets/features/runtime.js\` (which defines \`siteFeatures\`), one
\`assets/features/<name>.js\` per feature in use, and on each page a
\`<script id="site-features" type="application/json">\` list of which part takes which feature.
Those files are rewritten on every publish: change a feature in \`features/<name>/\`, not in
\`assets/\`. The owner reviews every new or changed folder before the builder uses it.
${BLOCK_END}`;
}

export function agentsFile(): string {
  return `# Working on this site\n\n${contractBlock()}\n`;
}
export function claudeFile(): string {
  return `# Claude: working on this site\n\nRead the feature contract below before building anything in \`TASKS.md\`.\n\n${contractBlock()}\n`;
}

/**
 * Our block into the owner's file: replaced where the markers are, added at the end
 * where they are not, and the whole file where there is none.
 */
export function mergeBlock(existing: string | null | undefined, ours: string): string {
  const s = ours.indexOf(BLOCK_START);
  const e = ours.indexOf(BLOCK_END);
  if (s < 0 || e < 0) return ours;
  const block = ours.slice(s, e + BLOCK_END.length);
  if (existing == null || !existing.trim()) return ours;
  const a = existing.indexOf(BLOCK_START);
  const b = existing.indexOf(BLOCK_END);
  if (a >= 0 && b > a) return existing.slice(0, a) + block + existing.slice(b + BLOCK_END.length);
  return `${existing.trimEnd()}\n\n${block}\n`;
}

/** The manifest as a repository holds it: the library's, with the parts it is on. */
export function manifestJson(m: WorkManifest, parts: readonly string[]): string {
  return `${JSON.stringify({ ...m, parts: [...parts] }, null, 2)}\n`;
}

export function readmeOf(w: Work): string {
  if (w.readme?.trim()) return w.readme;
  const m = w.manifest;
  const inputs = inputsOf(m);
  return [
    `# ${m.name}`,
    "",
    m.blurb,
    "",
    `**Needs:** ${m.needs === "none" ? "none, it runs on the static page as published" : m.needs}.`,
    "",
    "## Inputs",
    "",
    ...m.inputs.map((i) => `- \`${i.id}\` — ${i.label}${inputs[i.id] ? ` (default \`${inputs[i.id]}\`)` : ""}${i.values ? `; one of ${i.values.map((v) => `\`${v}\``).join(", ")}` : ""}`),
    "",
    `Attach it in the builder by typing ${m.says.slice(0, 2).map((x) => `“${x}”`).join(" or ")} in a part's box.`,
    "",
  ].join("\n");
}

/** Every file of the contract, for this board. */
export function contractFiles(nodes: readonly Part[], pages: readonly Page[]): ContractFile[] {
  const parts = new Map<string, string[]>();
  for (const n of nodes) {
    for (const u of usesOf(n.work)) {
      if (!getWork(u.id)) continue;
      const list = parts.get(u.id) ?? [];
      list.push(n.id);
      parts.set(u.id, list);
    }
  }
  const folders = allWorks()
    .filter((w) => parts.has(w.manifest.id))
    .flatMap((w) => [
      { path: `features/${w.manifest.id}/manifest.json`, content: manifestJson(w.manifest, [...parts.get(w.manifest.id)!].sort()) },
      { path: `features/${w.manifest.id}/script.js`, content: w.script },
      { path: `features/${w.manifest.id}/README.md`, content: readmeOf(w) },
    ]);
  return [
    { path: "TASKS.md", content: tasksFile(nodes, pages) },
    { path: "AGENTS.md", content: agentsFile() },
    { path: "CLAUDE.md", content: claudeFile() },
    ...folders,
  ];
}

/** The files the publish route merges into what is already on the branch instead of replacing. */
export const MERGED_FILES: ReadonlySet<string> = new Set(["AGENTS.md", "CLAUDE.md"]);

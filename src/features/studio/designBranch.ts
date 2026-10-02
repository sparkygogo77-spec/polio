/**
 * EXPORT FOR CODE, TO A BRANCH OF THE REPOSITORY THE SITE CAME FROM.
 *
 * The pipeline J runs (kit/PIPELINE.md): he arranges a site brought in from
 * a repository (PonsStars), a code chat moves that repository's code into
 * the design, and the Builder brings it in again with every part still tied
 * to its code. The middle step needs the design in the repository, so this
 * writes the export for code (`kitExport.ts`) to a new `design/<site>-<date>`
 * branch, never the default branch, under one folder (`design/`) so the
 * repository's own builder.json, package.json and README stay as they are,
 * and opens a draft pull request that says which hooks moved, which are new
 * and which went.
 *
 * The hooks it came in with are the contract the code is written against:
 * each is written exactly as it was (`kitExport.ts`, `keep`). A part made in
 * the Builder has none; it is given a readable one from its name and listed
 * as new, for the code chat to wire.
 *
 * `hookChanges` is pure; `sendDesign` takes `fetch`, so the tests stand a
 * GitHub in (tests/export-to-branch.mjs).
 */
import { defaultBranch, gh, type Answer } from "./kitRun.ts";
import type { KitExport, KitFile } from "./kitExport.ts";
import type { NodeSource, StyleSource } from "./styleLayer.ts";

type Fetch = typeof fetch;

/** Where the export goes in the source repository: one folder, so nothing of the code's own is written over. */
export const DESIGN_DIR = "design/";

/** The branch: `design/<site>-<YYYY-MM-DD>`. */
export function designBranch(site: string, date: Date): string {
  const name = site.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
  return `design/${name}-${date.toISOString().slice(0, 10)}`;
}

/** The shape of a board part this reads. */
export interface ChangeNode {
  id: string;
  pageId: string;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  byHand?: boolean;
  /** Where it was when he first moved it by hand (`StudioNode.handFrom`); else where it was in the page. */
  handFrom?: { x: number; y: number; w: number; h: number } | null;
  from?: { selector?: string } | null;
  hooks?: Record<string, string> | null;
  source?: NodeSource | null;
  content?: unknown;
}

/** Every `data-hook` on the board: its parts', and those on the words inside them. */
export function hooksOnBoard(nodes: readonly { hooks?: Record<string, string> | null; content?: unknown }[]): string[] {
  const out = new Set<string>();
  const walk = (c: unknown) => {
    if (!c || typeof c !== "object") return;
    if (Array.isArray(c)) { for (const x of c) walk(x); return; }
    const h = (c as { hooks?: Record<string, string> | null }).hooks?.["data-hook"];
    if (h) out.add(h);
    for (const v of Object.values(c as Record<string, unknown>)) if (v && typeof v === "object") walk(v);
  };
  for (const n of nodes) {
    if (n.hooks?.["data-hook"]) out.add(n.hooks["data-hook"]);
    walk(n.content);
    /* A list's choices carry theirs one per line (`pageParts.ts`). */
    const choice = (n as { options?: Record<string, string> }).options?.choiceHooks;
    if (choice) for (const h of choice.split("\n")) if (h.trim()) out.add(h.trim());
  }
  return [...out].sort();
}

/** Where the code finds a hook, as the kit's hooks.json says (`references`). */
export interface HookRef { file: string; line?: number; function?: string; uses?: string }

export interface RemovedHook { hook: string; page: string; refs?: HookRef[]; inside?: string }

/** A hooks.json, as the kit writes it: each hook's code references and the hook it is inside. */
export type HookMap = Record<string, { references?: HookRef[]; parent?: string | null; pages?: string[] }>;

export function readHookMap(text: string | null | undefined): HookMap {
  try { const j = JSON.parse(text ?? "") as { hooks?: HookMap }; return j && typeof j.hooks === "object" && j.hooks ? j.hooks : {}; } catch { return {}; }
}

/** The removed hooks, each with the code that finds it and the removed hook it went with. */
export function withRefs(removed: { hook: string; page: string }[], map: HookMap): RemovedHook[] {
  const gone = new Set(removed.map((r) => r.hook));
  return removed.map((r) => {
    const m = map[r.hook];
    let inside: string | undefined;
    for (let p = m?.parent ?? null, k = 0; p && k < 50; p = map[p]?.parent ?? null, k++) if (gone.has(p)) inside = p;
    return { hook: r.hook, page: r.page || m?.pages?.[0] || "", refs: (m?.references ?? []).map((x) => ({ file: x.file, ...(x.line ? { line: x.line } : {}), ...(x.function ? { function: x.function } : {}), ...(x.uses ? { uses: x.uses } : {}) })), ...(inside ? { inside } : {}) };
  });
}

/** Hooks the site came in with that no part on the board carries now: deleted on the board. */
export function deletedOnBoard(nodes: readonly { hooks?: Record<string, string> | null; content?: unknown }[], source: { onBoard?: string[] } | null | undefined): string[] {
  if (!source?.onBoard) return [];
  const now = new Set(hooksOnBoard(nodes));
  return source.onBoard.filter((h) => !now.has(h));
}

/** One removed hook, in words: where it was, what it went with, and the code that finds it. */
export function removedLine(r: RemovedHook): string {
  const refs = r.refs?.length ? `found by ${r.refs.map((x) => `${x.file}${x.line ? `:${x.line}` : ""}${x.function ? ` ${x.function}` : ""}${x.uses ? ` (${x.uses})` : ""}`).join(", ")}` : "no script finds it";
  return `\`${r.hook}\`${r.page ? ` (${r.page})` : ""}${r.inside ? `, inside \`${r.inside}\`` : ""}: ${refs}`;
}

export interface HookChanges {
  /** The hooks the site came in with, on its board. */
  original: number;
  /** Of those, written exactly as they were. */
  kept: number;
  /** A part he moved (or resized) himself, by its hook: how far, less the move of the section that carries it. */
  moved: { hook: string; page: string; dx: number; dy: number; dw: number; dh: number }[];
  /** A part made in the Builder: its new hook. */
  added: { hook: string; label: string; page: string }[];
  /**
   * A hook it came in with that is on no page of the export: its part was
   * deleted on the board, so the code chat deletes the element and every
   * reference to it. `refs`: the code that finds it, from the repository's
   * hooks.json; `inside`: the removed hook it went with.
   */
  removed: RemovedHook[];
  /** A hook it came in with that had to change: one used twice on a page. */
  renamed: { was: string; now: string; page: string }[];
  /** Hooks in the source's pages the board never held (a page not brought in, a part it could not read): left to the code, not a change. */
  notBrought: string[];
}

const hookOf = (n: ChangeNode): string | null => n.hooks?.["data-hook"] ?? (n.source?.hook?.attr === "data-hook" ? n.source.hook.value : null);

/** The nearest part holding this one, by where each was in the page (`from.selector`), among those that came in with a hook. */
function ownerOf(n: ChangeNode, all: ChangeNode[]): ChangeNode | null {
  const me = (n.from?.selector ?? "").trim();
  let best: ChangeNode | null = null;
  for (const o of all) {
    if (o === n || o.pageId !== n.pageId) continue;
    const p = (o.from?.selector ?? "").trim();
    if (!p || !me.startsWith(p) || me.length <= p.length || !/[\s>]/.test(me[p.length]!)) continue;
    if (!best || p.length > (best.from?.selector ?? "").length) best = o;
  }
  return best;
}

/**
 * What the export changes in the hooks, against what the site came in with.
 * Only what he did is listed: a part he moved, a part he made, a part he
 * deleted. The hooks the export gives its own boxes are not changes.
 */
export function hookChanges(nodes: readonly ChangeNode[], source: (StyleSource & { onBoard?: string[] }) | null | undefined, kit: Pick<KitExport, "files" | "fresh" | "renamed">, map: HookMap = {}): HookChanges {
  const written = new Set<string>();
  for (const f of kit.files) if (f.path.endsWith(".html") && f.encoding !== "base64") for (const m of f.content.matchAll(/\sdata-hook="([^"]+)"/g)) written.add(m[1]!);
  const pageOf = new Map<string, string>();
  for (const f of source?.files ?? []) for (const h of f.hooks) if (h.attr === "data-hook" && !pageOf.has(h.value)) pageOf.set(h.value, f.file);
  const inSource = [...pageOf.keys()];
  const original = new Set(source?.onBoard ?? inSource);
  const sourced = nodes.filter((n) => n.source?.was && hookOf(n));
  /* Against where it was when he first took it in hand: the board's own tidying before that (words grown, what follows laid under them) is not his. */
  const from = (n: ChangeNode) => n.handFrom ?? n.source!.was.box;
  const move = (n: ChangeNode) => ({ dx: n.x - from(n).x, dy: n.y - from(n).y });
  const moved: HookChanges["moved"] = [];
  for (const n of sourced) {
    if (!n.byHand) continue;
    const m = move(n);
    const o = ownerOf(n, sourced);
    const om = o && o.byHand ? move(o) : { dx: 0, dy: 0 };
    const dx = Math.round(m.dx - om.dx), dy = Math.round(m.dy - om.dy);
    const dw = Math.round(n.w - from(n).w), dh = Math.round(n.h - from(n).h);
    const sized = Math.abs(dw) >= 1 || Math.abs(dh) >= 1;
    /* Moved: by itself, not only carried by its section. A size counts when it is known to be his (measured from where he took it in hand), or comes with a move. */
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1 || (sized && n.handFrom)) moved.push({ hook: hookOf(n)!, page: n.source!.file, dx, dy, dw: sized ? dw : 0, dh: sized ? dh : 0 });
  }
  moved.sort((a, b) => a.page.localeCompare(b.page) || a.hook.localeCompare(b.hook));
  const removed = withRefs([...original].filter((h) => !written.has(h)).sort().map((hook) => ({ hook, page: pageOf.get(hook) ?? "" })), map);
  return {
    original: original.size,
    kept: [...original].filter((h) => written.has(h)).length,
    moved,
    added: kit.fresh.map((f) => ({ hook: f.hook, label: f.label, page: f.page })),
    removed,
    renamed: kit.renamed,
    notBrought: source?.onBoard ? inSource.filter((h) => !original.has(h) && !written.has(h)).sort() : [],
  };
}

/** The changes in words, for the pull request and for the code chat (`design/HOOK-CHANGES.md`). */
export function changesMarkdown(c: HookChanges, opts: { site: string; repo: string; base: string }): string {
  const list = <T,>(xs: T[], line: (x: T) => string, none: string) => (xs.length ? xs.map((x) => `- ${line(x)}`).join("\n") : none);
  const px = (v: number) => `${v > 0 ? "+" : ""}${v}px`;
  return [
    `# Hook changes: ${opts.site}`,
    "",
    `The design from the Builder, against ${opts.repo} on ${opts.base} as it was brought in. ${c.kept} of the ${c.original} hooks the board held are written exactly as they were.`,
    "",
    `## Moved (${c.moved.length})`,
    "",
    list(c.moved, (m) => `\`${m.hook}\` (${m.page}): ${[m.dx ? `${px(m.dx)} across` : "", m.dy ? `${px(m.dy)} down` : "", m.dw || m.dh ? `size ${px(m.dw)} by ${px(m.dh)}` : ""].filter(Boolean).join(", ")}`, "None."),
    "",
    `## Added (${c.added.length})`,
    "",
    c.added.length ? "Parts made in the Builder. Nothing in the code finds these yet: wire each one." : "",
    list(c.added, (a) => `\`${a.hook}\`${a.label ? ` (${a.label})` : ""} on ${a.page}`, "None."),
    "",
    `## Removed (${c.removed.length})`,
    "",
    c.removed.length ? "Deleted on the board, on purpose: delete each element and every reference to it (selectors, handlers, tests, CSS), then remake hooks.json. They are listed in HOOK-CHANGES.json for kit:diff." : "",
    list(c.removed, removedLine, "None."),
    ...(c.renamed.length ? ["", `## Renamed (${c.renamed.length})`, "", "Used twice on one page in the design; the second one is told apart.", list(c.renamed, (r) => `\`${r.was}\` to \`${r.now}\` on ${r.page}`, "")] : []),
    ...(c.notBrought.length ? ["", `## Not on the board (${c.notBrought.length})`, "", "In the source's pages but never on the board (pages not brought in, such as the preview and gallery). Not a change: the code keeps them.", "", c.notBrought.map((h) => `\`${h}\``).join(", ")] : []),
    "",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

/** The export, under `design/`: the kit's own CI workflow is left out, as it would not run from a folder. */
export function designFiles(files: KitFile[], changes: string, c?: HookChanges): KitFile[] {
  return [
    ...files.filter((f) => !f.path.startsWith(".github/")).map((f) => ({ ...f, path: `${DESIGN_DIR}${f.path}` })),
    { path: `${DESIGN_DIR}HOOK-CHANGES.md`, content: changes },
    ...(c ? [{ path: `${DESIGN_DIR}HOOK-CHANGES.json`, content: `${JSON.stringify(changesJson(c), null, 2)}\n` }] : []),
  ];
}

/** The changes for a machine: kit:diff passes a hook dropped from the code only when it is listed here as removed. */
export function changesJson(c: HookChanges) {
  return {
    about: "Made by the Builder: the hooks this design moved, added and removed. A removed hook was deleted on the board on purpose; the code drops it.",
    moved: c.moved.map((m) => m.hook),
    added: c.added.map((a) => a.hook),
    removed: c.removed.map((r) => ({ hook: r.hook, page: r.page, refs: r.refs ?? [], ...(r.inside ? { inside: r.inside } : {}) })),
    renamed: c.renamed,
  };
}

/**
 * One commit on a new `design/` branch from the default branch, and a draft
 * pull request from it. Never the default branch; never merged here.
 */
export async function sendDesign(files: KitFile[], changes: HookChanges, repo: string, token: string, opts: { site: string; date?: Date; fetch?: Fetch }): Promise<Answer<{ branch: string; sha: string; base: string; pull: string | null; draft: boolean; says: string }>> {
  const f = opts.fetch ?? fetch;
  const main = await defaultBranch(f, token, repo);
  if (!main.ok) return main;
  const base = main.branch;
  const first = designBranch(opts.site, opts.date ?? new Date());
  if (!first.startsWith(DESIGN_DIR) || first === base) return { ok: false, says: `Refused: the design only ever goes to a new design/ branch, never to ${base}.` };
  const md = changesMarkdown(changes, { site: opts.site, repo, base });
  const all = designFiles(files, md, changes);
  const ref = await gh(f, token, `/repos/${repo}/git/ref/heads/${base.split("/").map(encodeURIComponent).join("/")}`);
  const head = (ref.json?.object as { sha?: string } | undefined)?.sha;
  if (!head) return { ok: false, says: `GitHub has no branch ${base} in ${repo} to start from.` };
  const commit = await gh(f, token, `/repos/${repo}/git/commits/${head}`);
  const baseTree = (commit.json?.tree as { sha?: string } | undefined)?.sha;
  if (!baseTree) return { ok: false, says: "GitHub would not show the default branch's last commit." };
  const tree: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of all) {
    const blob = await gh(f, token, `/repos/${repo}/git/blobs`, { method: "POST", body: { content: file.content, encoding: file.encoding === "base64" ? "base64" : "utf-8" } });
    const sha = blob.json?.sha;
    if (typeof sha !== "string") return { ok: false, says: `GitHub would not take ${file.path}. Does the token have write access to ${repo}?` };
    tree.push({ path: file.path, mode: "100644", type: "blob", sha });
  }
  const made = await gh(f, token, `/repos/${repo}/git/trees`, { method: "POST", body: { base_tree: baseTree, tree } });
  const treeSha = made.json?.sha;
  if (typeof treeSha !== "string") return { ok: false, says: "GitHub would not make the commit's tree." };
  const counts = `${changes.moved.length} moved, ${changes.added.length} added, ${changes.removed.length} removed`;
  const c = await gh(f, token, `/repos/${repo}/git/commits`, { method: "POST", body: { message: `Design from the Builder: ${opts.site}\n\nThe export for code under ${DESIGN_DIR}. Hooks: ${counts}; ${changes.kept} of ${changes.original} kept exactly.`, tree: treeSha, parents: [head] } });
  const sha = c.json?.sha;
  if (typeof sha !== "string") return { ok: false, says: "GitHub would not make the commit." };
  /* A branch of that name already there is a second export the same day: the next free name, never written over. */
  for (let k = 1; k <= 20; k++) {
    const branch = k === 1 ? first : `${first}-${k}`;
    const put = await gh(f, token, `/repos/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha } });
    if (put.status === 201 || put.status === 200) {
      const body = [
        `The design from the Builder, as a builder-ready layout under \`${DESIGN_DIR}\` (pages, \`builder.json\`, \`site/hooks.json\`, \`site/tokens.css\`, \`site/style-layer.css\`). Nothing outside \`${DESIGN_DIR}\` changes.`,
        "",
        "Next: a code chat moves this repository's code into the design, keeping every hook, and wires the new ones. Then the Builder brings it in again.",
        "",
        md.replace(/^# .*\n\n/, ""),
        "Made by the Builder's \"Export for code to a branch\". A draft: the Builder never merges.",
      ].join("\n");
      const pr = await gh(f, token, `/repos/${repo}/pulls`, { method: "POST", body: { title: `Design from the Builder: ${opts.site} (${counts})`, head: branch, base, body, draft: true } });
      const pull = pr.status === 201 && typeof pr.json?.html_url === "string" ? pr.json.html_url : null;
      const draft = pr.json?.draft === true;
      const said = `Hooks: ${counts}. ${changes.kept} of the ${changes.original} it came in with are kept exactly.`;
      const says = pull
        ? `The design is on a new branch, ${branch}, in ${repo}, under ${DESIGN_DIR}, with a draft pull request into ${base}: ${pull}. ${said} Nothing on ${base} has changed.`
        : `The design is on a new branch, ${branch}, in ${repo}, under ${DESIGN_DIR}. ${said} GitHub would not open the pull request (it answered ${pr.status}); open it from https://github.com/${repo}/compare/${base}...${branch}. Nothing on ${base} has changed.`;
      return { ok: true, branch, sha, base, pull, draft, says };
    }
    if (put.status !== 422) return { ok: false, says: `GitHub would not make the branch ${branch} (it answered ${put.status}).` };
  }
  return { ok: false, says: `Every design branch name for today is taken in ${repo}.` };
}

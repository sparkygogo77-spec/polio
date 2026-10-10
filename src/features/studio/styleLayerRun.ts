/**
 * Sending the style layer back to the repository a site came from.
 *
 * In his browser, with his own token, exactly as Bring it in reads the
 * repository (`repoRun.ts`): nothing about the token reaches our server.
 * The pages are read fresh from the repository's default branch (the code
 * the design goes back into), so the one `<link>` and any plain-word change
 * land on what is there now, not on what was there when it was brought in.
 * Then one commit, on a NEW branch `style/<site>-<date>` made from it —
 * never the default branch itself — and a pull request from that branch
 * into the default branch, which is never merged here: he, or the chat that
 * merges designs, merges it once its checks are green.
 *
 * A builder-ready repository (one with `builder.json`, kit/PIPELINE.md) gets
 * the contract's design: only its style layer, checked by the kit's own
 * check with `hooks.json` remade, so `kit:diff --style-only` passes.
 *
 * `fetch` is passed in, so `tests/style-layer.mjs` can stand a GitHub in.
 */
import { deletedOnBoard, readHookMap, removedLine, withRefs, type RemovedHook } from "./send-out/index.ts";
import { applyToPage, buildLayer, hookCounts, layerBranch, linkHref, type Layer, type LayerNode, type StyleSource } from "./send-out/index.ts";
import { defaultBranch, fileAt, gh, kitFiles, kitMapOnServer, readKit, type KitManifest, type KitMapCall } from "./kitRun.ts";

export interface LayerFiles {
  layer: Layer;
  /** Every file the commit writes: the stylesheet, and each page with its link (and any word changes). */
  files: { path: string; content: string; encoding?: "base64" }[];
  /** Word changes that could not be made exactly, with why. */
  skipped: { file: string; from: string; why: string }[];
  /** The stylesheet's path in the repository. */
  cssPath: string;
  /** The branch it was read from, and that the design goes back into: the repository's default branch. */
  base: string;
  /** Sent by the builder contract (`builder.json`): only the style layer and the map made from it. */
  kit: boolean;
  /** A style layer already there that this one replaces, not written by the Builder: how many lines it had. */
  replaces?: { path: string; lines: number } | null;
  /** Hooks whose parts were deleted on the board, with the code that finds each: listed for the code to delete, never removed by the layer. */
  removed?: RemovedHook[];
}

export type Answer<T> = ({ ok: true } & T) | { ok: false; says: string };

type Fetch = typeof fetch;

const pathOf = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** The layer and the files it makes, against the code as it is on the repository's default branch now. */
export async function prepareLayer(nodes: LayerNode[], palette: Record<string, string> | null | undefined, source: StyleSource, token: string, opts: { fetch?: Fetch; when?: string; family?: (name: string) => string | undefined; kitMap?: KitMapCall } = {}): Promise<Answer<LayerFiles>> {
  const f = opts.fetch ?? fetch;
  const main = await defaultBranch(f, token, source.repo);
  if (!main.ok) return main;
  const base = main.branch;
  const kit = await readKit(source.repo, base, token, { fetch: f });
  if (kit && !kit.ok) return kit;
  if (kit) return prepareKitLayer(nodes, palette, source, token, kit.manifest, base, { ...opts, fetch: f });
  const layer = buildLayer(nodes, palette, source, { when: opts.when, family: opts.family });
  /* Where the repository says the layer goes (builder.json), else beside the pages. */
  const cssPath = (source.layerFile ?? `${source.dir}style-layer.css`).replace(/^\//, "");
  const files: LayerFiles["files"] = [{ path: cssPath, content: layer.css }];
  /* A layer someone wrote by hand is said before it is replaced: it stays in the history of the branch it was on, nothing is lost. */
  const there = await fileAt(f, token, source.repo, base, cssPath);
  const replaces = there && there.trim() && !/from the Builder/.test(there) ? { path: cssPath, lines: there.split("\n").length } : null;
  const skipped: LayerFiles["skipped"] = [];
  for (const page of source.files) {
    const html = await fileAt(f, token, source.repo, base, page.file);
    if (html === null) return { ok: false, says: `GitHub would not hand over ${page.file} from ${source.repo} on ${base}. Check the token can read it, and that the page is still there.` };
    const edits = layer.text.filter((e) => e.file === page.file);
    const done = applyToPage(html, { href: linkHref(page.file, cssPath), edits });
    for (const s of done.skipped) skipped.push({ file: page.file, from: s.from, why: s.why });
    /* The layer never removes a hook: every hook the page had, it still has, as many times. */
    const before = hookCounts(html);
    const after = hookCounts(done.html);
    for (const [k, v] of before) if ((after.get(k) ?? 0) < v) return { ok: false, says: `Stopped: the change to ${page.file} would have lost ${k}. Nothing was written.` };
    if (done.html !== html) files.push({ path: page.file, content: done.html });
  }
  const removed = withRefs(deletedOnBoard(nodes as never, source).map((hook) => ({ hook, page: source.files.find((x) => x.hooks.some((h) => h.attr === "data-hook" && h.value === hook))?.file ?? "" })), {});
  return { ok: true, layer, files, skipped, cssPath, base, kit: false, replaces, removed };
}

/**
 * THIS ROUND'S RULES INTO THE LAYER ALREADY MERGED. A rule for a part the
 * layer already styles replaces the old one (and any copies of it) rather
 * than following it as a second copy; a part new to the layer is added
 * after the rest, so it wins. A round that changes nothing leaves the file
 * as it was.
 */
/**
 * The stylesheet's top-level blocks, each whole: a rule, or an at-rule with
 * the rules inside it (`@keyframes`, `@media`, `@supports`), keyed by what
 * comes before its brace. Comments are skipped. A flat match took only the
 * innermost braces, so a merged layer lost the `@keyframes name {` round its
 * frames (the motion `motionCss.ts` writes, a texture's drift).
 */
export function topBlocks(css: string): { selector: string; body: string; text: string }[] {
  const out: { selector: string; body: string; text: string }[] = [];
  let i = 0;
  while (i < css.length) {
    if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i + 2); i = e < 0 ? css.length : e + 2; continue; }
    if (/\s/.test(css[i]!)) { i++; continue; }
    const open = css.indexOf("{", i);
    if (open < 0) break;
    /* A statement with no block of its own (`@import …;`) before it is not part of its name. */
    const semi = css.lastIndexOf(";", open);
    const start = semi >= i ? semi + 1 : i;
    let depth = 0, j = open;
    for (; j < css.length; j++) { if (css[j] === "{") depth++; else if (css[j] === "}" && --depth === 0) break; }
    out.push({ selector: css.slice(start, open).trim(), body: css.slice(open + 1, j).trim().replace(/\s+/g, " "), text: css.slice(start, j + 1).trim() });
    i = j + 1;
  }
  return out;
}

export function mergeLayer(had: string, rules: string, when?: string): string {
  const blocks = topBlocks;
  const fresh = blocks(rules);
  if (!fresh.length) return had;
  const old = blocks(had);
  const same = (a: { selector: string; body: string }) => old.some((o) => o.selector === a.selector && o.body === a.body);
  if (fresh.every(same) && fresh.every((f) => old.filter((o) => o.selector === f.selector).length === 1)) return had;
  let out = had;
  for (const f of fresh) for (const o of old) if (o.selector === f.selector) out = out.replace(o.text, "");
  /* A round's note left with no rule under it goes too. */
  out = out.replace(/\/\* From the Builder[^*]*\*\/\s*(?=(\/\*|$))/g, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  return `${out}\n\n/* From the Builder${when ? `, ${when}` : ""}: this round's rules, after the ones already here, so they win. */\n${fresh.map((f) => f.text.trim()).join("\n\n")}\n`;
}

/**
 * A builder-ready repository (kit/BUILDER-CONTRACT.md): the design is its
 * style layer and nothing else. Rules keyed by data-hook, colours in custom
 * properties, no page touched; what was already in the layer is kept, with
 * this round after it; and `hooks.json` remade by the kit's own check, which
 * must pass, or nothing is sent. The branch then passes `kit:diff --style-only`.
 */
async function prepareKitLayer(nodes: LayerNode[], palette: Record<string, string> | null | undefined, source: StyleSource, token: string, manifest: KitManifest, base: string, opts: { fetch: Fetch; when?: string; family?: (name: string) => string | undefined; kitMap?: KitMapCall }): Promise<Answer<LayerFiles>> {
  const layer = buildLayer(nodes, palette, source, { when: opts.when, family: opts.family, kit: true });
  const got = await kitFiles(source.repo, base, token, manifest, { fetch: opts.fetch });
  if (!got.ok) return got;
  const cssPath = manifest.styleLayer;
  const had = got.files[cssPath] ?? "";
  /* Its rules alone, without the header: a layer already merged stays, and this round follows it, so its rules win. */
  const rules = layer.css.slice(layer.css.indexOf("*/") + 2).trim();
  const kept = had.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const css = !rules ? had || layer.css : kept ? mergeLayer(had, rules, opts.when) : layer.css;
  const after = { ...got.files, [cssPath]: css };
  const map = await (opts.kitMap ?? kitMapOnServer)(after);
  if (map.problems.length) return { ok: false, says: `The kit's check finds ${map.problems.length} problem${map.problems.length === 1 ? "" : "s"} with the code and this design together, so nothing was written: ${map.problems.slice(0, 5).join("; ")}${map.problems.length > 5 ? "; and more" : ""}.` };
  const files: LayerFiles["files"] = [];
  if (css !== had) files.push({ path: cssPath, content: css });
  for (const [path, content] of Object.entries(map.made)) if (content !== got.files[path]) files.push({ path, content });
  const skipped = (layer.held ?? []).map((h) => ({ file: h.split(":")[0] ?? "", from: h, why: "a design for a builder-ready repository changes only its style layer" }));
  const removed = withRefs(deletedOnBoard(nodes as never, source).map((hook) => ({ hook, page: source.files.find((x) => x.hooks.some((h) => h.attr === "data-hook" && h.value === hook))?.file ?? "" })), readHookMap(got.files[manifest.hooks] ?? null));
  return { ok: true, layer, files, skipped, cssPath, base, kit: true, removed };
}

/**
 * One commit on a new branch made from the default branch, and a pull
 * request from it into the default branch. Never merged here: he, or the
 * chat that merges designs, merges it once its checks are green.
 */
export async function publishLayer(prepared: LayerFiles, source: StyleSource, token: string, opts: { site: string; date?: Date; fetch?: Fetch }): Promise<Answer<{ branch: string; sha: string; compare: string; says: string; pull: string | null }>> {
  const f = opts.fetch ?? fetch;
  const repo = source.repo;
  const main = await defaultBranch(f, token, repo);
  if (!main.ok) return main;
  const base = prepared.base || main.branch;
  let branch = layerBranch(opts.site, opts.date ?? new Date());
  if (!branch.startsWith("style/") || branch === main.branch || branch === base || branch === source.ref) return { ok: false, says: `Refused: the layer only ever goes to a new style/ branch, never to ${main.branch}.` };
  if (!prepared.files.length) return { ok: false, says: "There is nothing to send: the design changes nothing in the code." };
  const ref = await gh(f, token, `/repos/${repo}/git/ref/heads/${pathOf(base)}`);
  const head = (ref.json?.object as { sha?: string } | undefined)?.sha;
  if (!head) return { ok: false, says: `GitHub has no branch ${base} in ${repo} to start from.` };
  const commit = await gh(f, token, `/repos/${repo}/git/commits/${head}`);
  const baseTree = (commit.json?.tree as { sha?: string } | undefined)?.sha;
  if (!baseTree) return { ok: false, says: "GitHub would not show the branch's last commit." };
  const tree: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of prepared.files) {
    const blob = await gh(f, token, `/repos/${repo}/git/blobs`, { method: "POST", body: { content: file.content, encoding: file.encoding ?? "utf-8" } });
    const sha = blob.json?.sha;
    if (typeof sha !== "string") return { ok: false, says: `GitHub would not take ${file.path}. Does the token have write access to ${repo}?` };
    tree.push({ path: file.path, mode: "100644", type: "blob", sha });
  }
  const made = await gh(f, token, `/repos/${repo}/git/trees`, { method: "POST", body: { base_tree: baseTree, tree } });
  const treeSha = made.json?.sha;
  if (typeof treeSha !== "string") return { ok: false, says: "GitHub would not make the commit's tree." };
  const message = `Style layer from the Builder\n\n${prepared.layer.says}`;
  const c = await gh(f, token, `/repos/${repo}/git/commits`, { method: "POST", body: { message, tree: treeSha, parents: [head] } });
  const sha = c.json?.sha;
  if (typeof sha !== "string") return { ok: false, says: "GitHub would not make the commit." };
  /* A branch of that name already there is a second layer the same day: the next free name, never written over. */
  for (let k = 1; k <= 20; k++) {
    const name = k === 1 ? branch : `${branch}-${k}`;
    const put = await gh(f, token, `/repos/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${name}`, sha } });
    if (put.status === 201 || put.status === 200) {
      branch = name;
      const compare = `https://github.com/${repo}/compare/${base}...${branch}`;
      const listed = `${prepared.files.length} file${prepared.files.length === 1 ? "" : "s"} (${prepared.files.map((x) => x.path).join(", ")})`;
      const body = [
        "The design from the Builder, sent back as a style layer.",
        "",
        prepared.layer.says,
        "",
        `Files: ${prepared.files.map((x) => `\`${x.path}\``).join(", ")}.`,
        ...(prepared.files.some((x) => x.path === "design/pictures.json") ? [`Pictures on parts (${prepared.files.filter((x) => x.path.startsWith("design/pictures/")).length}): \`design/pictures.json\` names each part's hook and picture. Apply each as that part's look by BUILDER-RULES.md "Pictures on parts": copy it into the site, crop it to its \`crop\` box, make it the part's look through a token, and keep the same element, data-hook and behaviour.`, ""] : []),
        prepared.kit ? "Only the style layer (and the hooks map made from it) changes, so `kit:diff --style-only` holds it." : "Each page gains at most one <link> to the layer, and words written once as plain text.",
        ...(prepared.removed?.length ? ["", `Deleted on the board (${prepared.removed.length}): the layer leaves these as the page draws them. Delete each element and every reference to it in the code (selectors, handlers, tests, CSS), then remake hooks.json.`, ...prepared.removed.map((r) => `- ${removedLine(r)}`)] : []),
        "",
        "Made by the Builder's \"Send the design back\". The Builder never merges: merge it once its checks are green.",
      ].join("\n");
      const pr = await gh(f, token, `/repos/${repo}/pulls`, { method: "POST", body: { title: `Design from the Builder: ${opts.site || repo}`, head: branch, base, body } });
      const pull = pr.status === 201 && typeof pr.json?.html_url === "string" ? pr.json.html_url : null;
      /* A layer someone wrote by hand is said before it is replaced: it stays on the default branch until the pull request is merged. */
      const replaced = prepared.replaces ? ` It replaces the ${prepared.replaces.lines} lines already in ${prepared.replaces.path}, which stay on ${base}.` : "";
      const gone = prepared.removed?.length ? ` It lists ${prepared.removed.length} hook${prepared.removed.length === 1 ? "" : "s"} deleted on the board (${prepared.removed.slice(0, 4).map((r) => r.hook).join(", ")}${prepared.removed.length > 4 ? ", …" : ""}) for the code to remove.` : "";
      const says = pull
        ? `The design is a pull request into ${base} of ${repo}, from a new branch ${branch}: ${listed}.${replaced}${gone} Nothing on ${base} has changed, and nothing is merged. Read it and merge it once its checks are green: ${pull}`
        : `The style layer is on a new branch, ${branch}, in ${repo}: ${listed}.${replaced}${gone} Nothing on ${base} has changed. ${pr.status === 403 ? "GitHub would not let this key open the pull request (it needs Pull requests: read and write)" : `GitHub would not open the pull request (it answered ${pr.status})`}; open it from the compare page: ${compare}`;
      return { ok: true, branch, sha, compare, says, pull };
    }
    if (put.status !== 422) return { ok: false, says: `GitHub would not make the branch ${name} (it answered ${put.status}).` };
  }
  return { ok: false, says: `Every style branch name for today is taken in ${repo}.` };
}

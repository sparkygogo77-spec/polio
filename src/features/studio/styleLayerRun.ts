/**
 * Sending the style layer back to the repository a site came from.
 *
 * In his browser, with his own token, exactly as Bring it in reads the
 * repository (`repoRun.ts`): nothing about the token reaches our server.
 * The pages are read fresh from the branch the site was brought in from, so
 * the one `<link>` and any plain-word change land on what is there now, not
 * on what was there when it was brought in. Then one commit, on a NEW branch
 * `style/<site>-<date>` made from that branch — never the default branch,
 * never the branch it was read from — and the compare link, so he reads the
 * change and approves the merge himself.
 *
 * `fetch` is passed in, so `tests/style-layer.mjs` can stand a GitHub in.
 */
import { applyToPage, buildLayer, hookCounts, layerBranch, linkHref, type Layer, type LayerNode, type StyleSource } from "./styleLayer.ts";

const API = "https://api.github.com";

export interface LayerFiles {
  layer: Layer;
  /** Every file the commit writes: the stylesheet, and each page with its link (and any word changes). */
  files: { path: string; content: string }[];
  /** Word changes that could not be made exactly, with why. */
  skipped: { file: string; from: string; why: string }[];
  /** The stylesheet's path in the repository. */
  cssPath: string;
}

export type Answer<T> = ({ ok: true } & T) | { ok: false; says: string };

type Fetch = typeof fetch;

async function gh(f: Fetch, token: string, path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const res = await f(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(init?.body ? { "content-type": "application/json" } : {}) },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
    let json: Record<string, unknown> | null = null;
    try { json = (await res.json()) as Record<string, unknown>; } catch { /* an empty answer */ }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
const pathOf = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** One file of the repository at a ref, as text. */
async function fileAt(f: Fetch, token: string, repo: string, ref: string, path: string): Promise<string | null> {
  const got = await gh(f, token, `/repos/${repo}/contents/${pathOf(path)}?ref=${encodeURIComponent(ref)}`);
  const content = got.json?.content;
  return got.status === 200 && typeof content === "string" ? b64decode(content) : null;
}

/** The layer and the files it makes, against the pages as they are on the branch now. */
export async function prepareLayer(nodes: LayerNode[], palette: Record<string, string> | null | undefined, source: StyleSource, token: string, opts: { fetch?: Fetch; when?: string; family?: (name: string) => string | undefined } = {}): Promise<Answer<LayerFiles>> {
  const f = opts.fetch ?? fetch;
  const layer = buildLayer(nodes, palette, source, { when: opts.when, family: opts.family });
  const cssPath = `${source.dir}style-layer.css`;
  const files: LayerFiles["files"] = [{ path: cssPath, content: layer.css }];
  const skipped: LayerFiles["skipped"] = [];
  for (const page of source.files) {
    const html = await fileAt(f, token, source.repo, source.ref, page.file);
    if (html === null) return { ok: false, says: `GitHub would not hand over ${page.file} from ${source.repo} on ${source.ref}. Check the token can read it, and that the branch is still there.` };
    const edits = layer.text.filter((e) => e.file === page.file);
    const done = applyToPage(html, { href: linkHref(page.file, cssPath), edits });
    for (const s of done.skipped) skipped.push({ file: page.file, from: s.from, why: s.why });
    /* The layer never removes a hook: every hook the page had, it still has, as many times. */
    const before = hookCounts(html);
    const after = hookCounts(done.html);
    for (const [k, v] of before) if ((after.get(k) ?? 0) < v) return { ok: false, says: `Stopped: the change to ${page.file} would have lost ${k}. Nothing was written.` };
    if (done.html !== html) files.push({ path: page.file, content: done.html });
  }
  return { ok: true, layer, files, skipped, cssPath };
}

/**
 * One commit on a new branch made from the branch the site was read from.
 * Never the default branch: refused before anything is written.
 */
export async function publishLayer(prepared: LayerFiles, source: StyleSource, token: string, opts: { site: string; date?: Date; fetch?: Fetch }): Promise<Answer<{ branch: string; sha: string; compare: string; says: string }>> {
  const f = opts.fetch ?? fetch;
  const repo = source.repo;
  const info = await gh(f, token, `/repos/${repo}`);
  if (info.status !== 200) return { ok: false, says: info.status === 404 ? `GitHub has no ${repo}, or this token cannot see it.` : info.status === 401 || info.status === 403 ? "GitHub refused that token. Check it under Keys." : "GitHub could not be reached." };
  const main = String(info.json?.default_branch ?? "main");
  const base = source.ref || main;
  let branch = layerBranch(opts.site, opts.date ?? new Date());
  if (!branch.startsWith("style/") || branch === main || branch === base) return { ok: false, says: `Refused: the layer only ever goes to a new style/ branch, never to ${main}.` };
  const ref = await gh(f, token, `/repos/${repo}/git/ref/heads/${pathOf(base)}`);
  const head = (ref.json?.object as { sha?: string } | undefined)?.sha;
  if (!head) return { ok: false, says: `GitHub has no branch ${base} in ${repo} to start from.` };
  const commit = await gh(f, token, `/repos/${repo}/git/commits/${head}`);
  const baseTree = (commit.json?.tree as { sha?: string } | undefined)?.sha;
  if (!baseTree) return { ok: false, says: "GitHub would not show the branch's last commit." };
  const tree: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of prepared.files) {
    const blob = await gh(f, token, `/repos/${repo}/git/blobs`, { method: "POST", body: { content: file.content, encoding: "utf-8" } });
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
      const says = `The style layer is on a new branch, ${branch}, in ${repo}: ${prepared.files.length} file${prepared.files.length === 1 ? "" : "s"} (${prepared.files.map((x) => x.path).join(", ")}). Nothing on ${base} or ${main} has changed. Read it and merge it yourself: ${compare}`;
      return { ok: true, branch, sha, compare, says };
    }
    if (put.status !== 422) return { ok: false, says: `GitHub would not make the branch ${name} (it answered ${put.status}).` };
  }
  return { ok: false, says: `Every style branch name for today is taken in ${repo}.` };
}

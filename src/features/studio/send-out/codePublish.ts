/**
 * A SITE FROM A CODE REPOSITORY: REFRESH FROM IT, PUBLISH INTO IT.
 *
 * J (2026-10-04): the site's code is the site, so its two buttons are about
 * the code. Refresh reads the repository it came from and says whether the
 * board is up to date with it (the button goes green when it is). Publish
 * sends the design back as a style branch, as "Send the design back" does,
 * and merges it into the default branch once he has confirmed what changes:
 * no pull request left waiting. A merge GitHub refuses (a required check, a
 * conflict, a key without the right) leaves the pull request open and says
 * why. And what the check list finds that the board cannot fix (a word hard
 * to read, a button the board cannot wire) can go to a branch of its own as
 * a list a code chat on that branch works through.
 *
 * Pure of the page: GitHub through `gh`, so the tests hand it a stand-in.
 */
import { gh, type Answer, type Fetch } from "../kitRun.ts";
import type { StyleSource } from "./styleLayer.ts";

const pathOf = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** The commit a branch of the repository is at now. */
export async function headOf(repo: string, ref: string, token: string, f: Fetch = fetch): Promise<string | null> {
  const got = await gh(f, token, `/repos/${repo}/commits/${encodeURIComponent(ref)}`);
  const sha = got.json?.sha;
  return got.status === 200 && typeof sha === "string" ? sha : null;
}

/** Where the board stands against the code: up to date, the code moved on, or a design not yet published. */
export type CodeStatus = { at: "current" | "behind" | "unknown"; head: string | null; pending: boolean; says: string };

/** A fingerprint of a layer: what was last published, against what the board would send now. */
export function layerPrint(css: string): string {
  const body = css.slice(css.indexOf("*/") + 2).replace(/\s+/g, " ").trim();
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h << 5) + h + body.charCodeAt(i)) | 0;
  return `${body.length}:${(h >>> 0).toString(36)}`;
}

/** Where the board stands, in words. `layerNow` is the layer the board would send (its fingerprint). */
export function codeStatus(source: Pick<StyleSource, "repo" | "ref"> & { commit?: string | null; sent?: string | null }, head: string | null, layerNow: string, empty: boolean): CodeStatus {
  const pending = !empty && layerNow !== (source.sent ?? "");
  const where = `${source.repo}${source.ref ? ` on ${source.ref}` : ""}`;
  if (!head) return { at: "unknown", head, pending, says: `${where} could not be read just now.` };
  if (!source.commit) return { at: "behind", head, pending, says: `This board does not know which commit of ${where} it was read at. Refresh reads it again.` };
  if (head !== source.commit) return { at: "behind", head, pending, says: `${where} has moved on since this board read it (${source.commit.slice(0, 7)} → ${head.slice(0, 7)}). Refresh brings it in.` };
  return { at: "current", head, pending, says: pending ? `Up to date with ${where} (${head.slice(0, 7)}), with a design not yet published.` : `Up to date with ${where} (${head.slice(0, 7)}).` };
}

/** Merge the design's pull request into its base. A refusal leaves it open, and says why in plain words. */
export async function mergePull(repo: string, pull: string, token: string, opts: { title?: string; fetch?: Fetch } = {}): Promise<Answer<{ sha: string }>> {
  const f = opts.fetch ?? fetch;
  const n = /\/pull\/(\d+)/.exec(pull)?.[1];
  if (!n) return { ok: false, says: "There is no pull request to merge." };
  const got = await gh(f, token, `/repos/${repo}/pulls/${n}/merge`, { method: "PUT", body: { merge_method: "squash", ...(opts.title ? { commit_title: opts.title } : {}) } });
  const sha = got.json?.sha;
  if (got.status === 200 && typeof sha === "string") return { ok: true, sha };
  const why = got.status === 405 ? "GitHub will not merge it yet: a check it requires has not passed, or the branch is protected" : got.status === 409 ? "it conflicts with what changed on the default branch since" : got.status === 403 || got.status === 401 ? "the saved key may not merge (it needs Contents and Pull requests: read and write)" : `GitHub answered ${got.status}`;
  return { ok: false, says: `The design is a pull request, not merged: ${why}. ${pull}` };
}

/** One thing the check list found, as it goes to the code. */
export interface Issue { kind: string; hook: string | null; page: string; says: string }

/** The list a code chat works through, as Markdown and as data. */
export function issueFiles(issues: readonly Issue[], o: { repo: string; site: string; when: string }): { path: string; content: string }[] {
  const byKind = new Map<string, Issue[]>();
  for (const i of issues) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);
  const md = [
    `# Design issues from the Builder: ${o.site}`,
    "",
    `Found by the Builder's check before publishing ${o.repo}, ${o.when}. Each line names the part by its data-hook.`,
    "Fix them in the code (tokens.css, base.css, the scripts), keep every hook, run `npm run kit:hooks`, `npm run kit:check`",
    "and `npm run kit:diff -- --base <the default branch>`, then open a pull request from this branch. Delete this file in that pull request.",
    "",
    ...[...byKind].flatMap(([kind, list]) => [`## ${kind} (${list.length})`, "", ...list.map((i) => `- [ ] ${i.hook ? `\`${i.hook}\`` : "(no hook)"} on ${i.page}: ${i.says}`), ""]),
  ].join("\n");
  return [
    { path: "design/ISSUES.md", content: md },
    { path: "design/issues.json", content: `${JSON.stringify({ site: o.site, repo: o.repo, at: o.when, issues }, null, 2)}\n` },
  ];
}

/** Files onto a new branch from the default branch's head; the next free name when one is taken. Never the default branch. */
export async function pushBranch(repo: string, token: string, files: { path: string; content: string; encoding?: "base64" }[], o: { branch: string; message: string; fetch?: Fetch }): Promise<Answer<{ branch: string; sha: string; url: string; base: string }>> {
  const f = o.fetch ?? fetch;
  const info = await gh(f, token, `/repos/${repo}`);
  const base = typeof info.json?.default_branch === "string" ? info.json.default_branch : null;
  if (!base) return { ok: false, says: `GitHub would not show ${repo}.` };
  if (o.branch === base) return { ok: false, says: `Refused: this only ever writes a new branch, never ${base}.` };
  const ref = await gh(f, token, `/repos/${repo}/git/ref/heads/${pathOf(base)}`);
  const head = (ref.json?.object as { sha?: string } | undefined)?.sha;
  if (!head) return { ok: false, says: `GitHub has no branch ${base} in ${repo}.` };
  const commit = await gh(f, token, `/repos/${repo}/git/commits/${head}`);
  const baseTree = (commit.json?.tree as { sha?: string } | undefined)?.sha;
  if (!baseTree) return { ok: false, says: "GitHub would not show the branch's last commit." };
  const tree: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of files) {
    /* A picture travels as the base64 it already is; everything else as text. */
    const blob = await gh(f, token, `/repos/${repo}/git/blobs`, { method: "POST", body: { content: file.content, encoding: file.encoding === "base64" ? "base64" : "utf-8" } });
    if (typeof blob.json?.sha !== "string") return { ok: false, says: `GitHub would not take ${file.path}. Does the key have write access to ${repo}?` };
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.json.sha });
  }
  const made = await gh(f, token, `/repos/${repo}/git/trees`, { method: "POST", body: { base_tree: baseTree, tree } });
  if (typeof made.json?.sha !== "string") return { ok: false, says: "GitHub would not make the commit's tree." };
  const c = await gh(f, token, `/repos/${repo}/git/commits`, { method: "POST", body: { message: o.message, tree: made.json.sha, parents: [head] } });
  const sha = c.json?.sha;
  if (typeof sha !== "string") return { ok: false, says: "GitHub would not make the commit." };
  for (let k = 1; k <= 20; k++) {
    const name = k === 1 ? o.branch : `${o.branch}-${k}`;
    const put = await gh(f, token, `/repos/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${name}`, sha } });
    if (put.status === 201 || put.status === 200) return { ok: true, branch: name, sha, url: `https://github.com/${repo}/tree/${pathOf(name)}`, base };
    if (put.status !== 422) return { ok: false, says: `GitHub would not make the branch ${name} (it answered ${put.status}).` };
  }
  return { ok: false, says: `Every branch name like ${o.branch} is taken in ${repo}.` };
}

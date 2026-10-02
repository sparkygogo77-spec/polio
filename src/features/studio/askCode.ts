/**
 * ASK THE CODE CHAT FROM A PART.
 *
 * The Builder never edits a site's scripts: game logic stays with the code.
 * What it can do is ask. The owner picks a part, types what they want, and
 * this writes the request to a new `request/<hook>-<date>` branch of the
 * repository the site came from, as `requests/<hook>-<stamp>.md` (the
 * request, the part's hook, the code that uses it from hooks.json) beside a
 * picture of the part, and opens a draft pull request from it. A code chat
 * picks it up, makes the change on that branch, keeps every hook, and the
 * owner approves it and brings the site in again. Never the default branch;
 * never merged here.
 *
 * Pure apart from the GitHub calls, which take `fetch`: `tests/ask-code.mjs`.
 */
import { defaultBranch, gh, type Answer, type Fetch } from "./kitRun.ts";

export interface AskRef { file: string; line: number; fn: string | null; kind?: string; code?: string }

export interface CodeAsk {
  /** What the owner typed. */
  text: string;
  hook: string;
  /** The part's name on the board. */
  name: string;
  /** The page file it is on. */
  page: string | null;
  refs: AskRef[];
  /** The part as a PNG, base64, when one could be taken. */
  picture?: string | null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "part";

/** The branch: `request/<hook>-<YYYY-MM-DD>`. */
export const requestBranch = (hook: string, date: Date) => `request/${slug(hook)}-${date.toISOString().slice(0, 10)}`;

/** The request file, in words a code chat reads first. */
export function requestMarkdown(ask: CodeAsk, opts: { repo: string; base: string; picture: string | null; when: string }): string {
  const refs = ask.refs.length
    ? ask.refs.map((r) => `- \`${r.file}\` line ${r.line}${r.fn ? `, in \`${r.fn}\`` : ""}${r.kind ? ` (${r.kind})` : ""}${r.code ? `: \`${r.code.replace(/`/g, "'")}\`` : ""}`).join("\n")
    : "- No script names it (hooks.json lists nothing for it).";
  return [
    `# Code request: \`${ask.hook}\``,
    "",
    `From the Builder, ${opts.when}. The part “${ask.name}” (\`data-hook="${ask.hook}"\`)${ask.page ? ` on \`${ask.page}\`` : ""} of ${opts.repo}.`,
    "",
    "## The request",
    "",
    ask.text.trim(),
    "",
    "## The code that uses it",
    "",
    refs,
    "",
    ...(opts.picture ? ["## The part as it looks", "", `![${ask.hook}](${opts.picture.split("/").pop()})`, ""] : []),
    "## For the code chat",
    "",
    `Make the change on this branch (or one from it), keep every \`data-hook\`, put any number, colour or words a script uses in the tokens, run \`kit:check\` and \`kit:diff\` against \`${opts.base}\`, and mark the pull request ready. The owner approves it and brings the site into the Builder again.`,
    "",
  ].join("\n");
}

/** One commit of these files on a new branch from the default branch, and a draft pull request. */
export async function askCode(ask: CodeAsk, repo: string, token: string, opts: { date?: Date; fetch?: Fetch } = {}): Promise<Answer<{ branch: string; pull: string | null; file: string; says: string }>> {
  const f = opts.fetch ?? fetch;
  if (!ask.text.trim()) return { ok: false, says: "Type what you want the code to do first." };
  const date = opts.date ?? new Date();
  const main = await defaultBranch(f, token, repo);
  if (!main.ok) return main;
  const base = main.branch;
  const first = requestBranch(ask.hook, date);
  if (!first.startsWith("request/") || first === base) return { ok: false, says: `Refused: a request only ever goes to a new request/ branch, never to ${base}.` };
  const stamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const file = `requests/${slug(ask.hook)}-${stamp}.md`;
  const picture = ask.picture ? `requests/${slug(ask.hook)}-${stamp}.png` : null;
  const md = requestMarkdown(ask, { repo, base, picture, when: date.toISOString().slice(0, 10) });
  const files = [{ path: file, content: md, encoding: "utf-8" }, ...(picture ? [{ path: picture, content: ask.picture!, encoding: "base64" }] : [])];

  const ref = await gh(f, token, `/repos/${repo}/git/ref/heads/${base.split("/").map(encodeURIComponent).join("/")}`);
  const head = (ref.json?.object as { sha?: string } | undefined)?.sha;
  if (!head) return { ok: false, says: `GitHub has no branch ${base} in ${repo} to start from.` };
  const commit = await gh(f, token, `/repos/${repo}/git/commits/${head}`);
  const baseTree = (commit.json?.tree as { sha?: string } | undefined)?.sha;
  if (!baseTree) return { ok: false, says: "GitHub would not show the default branch's last commit." };
  const tree: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const x of files) {
    const blob = await gh(f, token, `/repos/${repo}/git/blobs`, { method: "POST", body: { content: x.content, encoding: x.encoding } });
    if (typeof blob.json?.sha !== "string") return { ok: false, says: `GitHub would not take ${x.path}. Does the token have write access to ${repo}?` };
    tree.push({ path: x.path, mode: "100644", type: "blob", sha: blob.json.sha });
  }
  const made = await gh(f, token, `/repos/${repo}/git/trees`, { method: "POST", body: { base_tree: baseTree, tree } });
  if (typeof made.json?.sha !== "string") return { ok: false, says: "GitHub would not make the commit's tree." };
  const c = await gh(f, token, `/repos/${repo}/git/commits`, { method: "POST", body: { message: `Code request from the Builder: ${ask.hook}\n\n${ask.text.trim()}`, tree: made.json.sha, parents: [head] } });
  const sha = c.json?.sha;
  if (typeof sha !== "string") return { ok: false, says: "GitHub would not make the commit." };
  for (let k = 1; k <= 20; k++) {
    const branch = k === 1 ? first : `${first}-${k}`;
    const put = await gh(f, token, `/repos/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha } });
    if (put.status === 201 || put.status === 200) {
      const title = `Code request: ${ask.hook}: ${ask.text.trim().split("\n")[0]!.slice(0, 80)}`;
      const pr = await gh(f, token, `/repos/${repo}/pulls`, { method: "POST", body: { title, head: branch, base, body: `${md}\nMade by the Builder's “Ask the code chat”. A draft: the Builder never merges.`, draft: true } });
      const pull = pr.status === 201 && typeof pr.json?.html_url === "string" ? pr.json.html_url : null;
      const says = pull
        ? `Asked: the request is on ${branch} in ${repo}, with a draft pull request for a code chat: ${pull}. Nothing on ${base} has changed.`
        : `Asked: the request is on ${branch} in ${repo}. GitHub would not open the pull request (it answered ${pr.status}${pr.status === 403 ? "; the key needs Pull requests: read and write" : ""}); open it from https://github.com/${repo}/compare/${base}...${branch}.`;
      return { ok: true, branch, pull, file, says };
    }
    if (put.status !== 422) return { ok: false, says: `GitHub would not make the branch ${branch} (it answered ${put.status}).` };
  }
  return { ok: false, says: `Every request branch name for today is taken in ${repo}.` };
}

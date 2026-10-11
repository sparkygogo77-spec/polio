import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { MERGED_FILES, mergeBlock } from "@/features/studio/shelf";
import { CaptureUnknown, holdsCapture, sourceAmong } from "./capture";

/**
 * The site, pushed to GitHub — and from there to Vercel.
 *
 * One commit on one branch with every file the Builder hands over: the
 * document the app renders at /site, the blueprint in both forms, and any
 * code Claude wrote. Made through GitHub's git data API so it is one commit
 * however many files.
 *
 * **Whose token.** The person's: `x-github-token`, typed into the Keys panel
 * and held in their browser, exactly as the Replicate one is. It is theirs
 * because the account is theirs. Nothing here writes it down, and `safe()`
 * scrubs it from anything GitHub says on the way out.
 *
 *   GITHUB_TOKEN   a silent fallback when the browser offers none
 *   GITHUB_REPO    owner/name — where a request that names nowhere else goes
 *   GITHUB_BRANCH  the branch to push to; main when unset
 *   GITHUB_REPOS   optional: the only repositories a request may name, comma
 *                  separated. Unset, the token's own permissions are the
 *                  boundary, which is the right answer for a Builder you run
 *                  yourself and the wrong one for a Builder on the open web.
 *                  Set, it also turns off making repositories.
 *
 * **Where it goes.** A request names its own repository, because the Builds
 * page keeps more than one site and each publishes somewhere of its own. A
 * site that has none yet sends `create` — a name — and gets a private
 * repository of its own made on the spot, the way Vercel does it; the name it
 * settled on comes back as `created` and the browser writes it on the site.
 * Nobody is asked for a repository up front. An existing name is never taken
 * over: a clash gets a suffix.
 *
 * Vercel deploys a connected repository on every push by itself. For a
 * project that is not connected, `VERCEL_DEPLOY_HOOK` is the hook URL from
 * the project's settings, and it is called after the push.
 *
 * GET says what is set. Nothing here is load-bearing: without a token the
 * Builder still downloads the same files for you to commit by hand.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

/*
 * GitHub, or something standing in for it.
 *
 * `GITHUB_API` is unset everywhere but a test run, where it points at a
 * stub that answers the way an empty repository does — a 409 on the ref, a
 * root commit with no parents — so the first publish into one can be proven
 * rather than reasoned about (`tests/publish-empty.mjs`). It is also what a
 * GitHub Enterprise host would need.
 */
const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";
/*
 * WHAT ONE SITE MAY BE. Bring brings up to 600 pictures (`repoRun.ts`), and
 * share.xyz's page alone is past 2 MB, the cap this used to have; past 200
 * files the rest were dropped without a word (`tests/publish-big-site.mjs`).
 * A site past these is refused in words, before a repository is made.
 */
const MAX_FILES = 2000;
const MAX_BYTES = 25 * 1024 * 1024;
/** A file put back together from pieces (`assemble`): under GitHub's own 100 MB for a file, since no one request carried it. */
const MAX_ASSEMBLED = 95 * 1024 * 1024;

const REPO = /^[\w.-]+\/[\w.-]+$/;

/*
 * HOW FAST, AND FOR HOW LONG. GitHub takes about 80 writes a minute from one
 * key before its secondary rate limit refuses the rest, and gotchi's ~230
 * pictures went up all at once and were refused. So blobs go one at a time
 * with a gap, a limit is waited out when GitHub says for how long, and a
 * call stops making blobs well inside `maxDuration`: what went up is
 * answered as `staged`, what did not as `pending`, and the browser's next
 * call carries on from there (`reason: "resume"`). Still one commit and one
 * move of the branch at the end, so one deployment per press.
 * `tests/publish-steady.mjs`.
 */
const BLOB_GAP_MS = Number(process.env.PUBLISH_BLOB_GAP_MS ?? 750);
const BLOB_BUDGET_MS = Number(process.env.PUBLISH_BUDGET_MS ?? 80_000);
/** The tree, the commit and the move of the branch may wait on a limit until here, well inside `maxDuration`. */
const CALL_BUDGET_MS = 105_000;
/** The longest one call waits on a limit; past it the browser waits, between calls. */
const LONGEST_WAIT_S = 60;

/**
 * Whose token this is.
 *
 * The person's, not the deployment's — the same rule the renderer follows for
 * Replicate, and for the same reason: the account being written to is theirs,
 * so the token is theirs, typed into the keys panel under the key button and held
 * in their browser. It rides as `x-github-token`, is held here for the length
 * of the call and no longer, and is never written down, logged, or echoed
 * back; `safe()` scrubs it out of anything GitHub says on the way out.
 *
 * `GITHUB_TOKEN` in the environment still works and is a silent fallback
 * rather than the path. A browser that offered one is using that one: the
 * person who typed it is the person whose repositories these are.
 */
function tokenFor(request: Request): string | null {
  const supplied = request.headers.get("x-github-token")?.trim();
  if (supplied && supplied.length > 8) return supplied;
  return process.env.GITHUB_TOKEN?.trim() || null;
}

/** Nothing that leaves here may carry the token, whatever GitHub put in a message. */
function safe(message: string, token: string | null): string {
  const clean = token ? message.split(token).join("[token]") : message;
  return clean.replace(/gh[pousr]_[A-Za-z0-9]{16,}/g, "[token]").replace(/github_pat_[A-Za-z0-9_]{20,}/g, "[token]").slice(0, 400);
}

function config() {
  const token = process.env.GITHUB_TOKEN?.trim() || null;
  const repo = process.env.GITHUB_REPO?.trim() || null;
  const branch = process.env.GITHUB_BRANCH?.trim() || null;
  const hook = process.env.VERCEL_DEPLOY_HOOK?.trim() || null;
  const allow = (process.env.GITHUB_REPOS ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  return { token, repo, branch, hook, allow };
}

/** Where a request asked to go, if it may. Anything else falls back to the one the server names. */
function where(asked: unknown, c: ReturnType<typeof config>): { repo: string | null; refused: string | null } {
  if (typeof asked !== "string" || !asked.trim()) return { repo: c.repo, refused: null };
  const repo = asked.trim();
  if (!REPO.test(repo)) return { repo: c.repo, refused: `“${repo}” is not owner/name.` };
  if (c.allow.length && !c.allow.some((a) => a.toLowerCase() === repo.toLowerCase())) {
    return { repo: c.repo, refused: `This server only publishes to ${c.allow.join(", ")}.` };
  }
  return { repo, refused: null };
}

/*
 * GET is a status probe and it is not handed a token.
 *
 * It used to read `x-github-token` so it could answer whether a push was
 * possible, which meant the person's real token crossed to this server on
 * every page load that asked — for a question the browser could already
 * answer, since the browser is the thing holding it. The route now speaks
 * only for the server, and the browser ORs in what it holds itself
 * (`publishStatus`). The POST below still takes the token, because pushing
 * is what it is for.
 */
export async function GET(request?: Request) {
  const asked = request ? new URL(request.url).searchParams : null;
  if (asked?.get("tree") && request) return treeListing(request, asked);
  const c = config();
  /* `configured` used to mean the server has both a token and a repository.
     Neither is required now: a token from the browser pushes just as well,
     and a site with no repository gets one made on its first publish. So it
     means what the button needs it to mean — can this publish push, as far
     as this side of it knows. */
  const token = process.env.GITHUB_TOKEN?.trim() || null;
  return NextResponse.json({
    github: {
      configured: !!token,
      token: token ? "server" : null,
      repo: c.repo,
      branch: c.branch,
      missing: token ? [] : ["GITHUB_TOKEN"],
      allow: c.allow.length ? c.allow : null,
    },
    vercel: { hook: !!c.hook },
  });
}

interface FileIn { path?: unknown; content?: unknown; encoding?: unknown }

function safePath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const s = p.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
  if (!s || s.length > 300 || s.startsWith("/") || s.split("/").some((seg) => seg === ".." || seg === "" || seg === ".")) return null;
  if (/[ -]/.test(s)) return null;
  return s;
}

class GitHubError extends Error {
  /** Which step of the write GitHub refused, when it was one of them: "tree", "commit" or "ref" (the branch moved to the new commit). */
  step?: "tree" | "commit" | "ref";
  /** Seconds GitHub asked for before the next try (`retry-after`, or `x-ratelimit-reset` from now), when it said. */
  wait?: number;
  /** A rate limit — primary or secondary — rather than a refusal: waiting settles it, a key with more access does not. */
  limited = false;
  constructor(message: string, public status: number) { super(message); }
}

/** A publish that stopped with part of it up: what went up, what did not, and how long GitHub asked to wait. */
class Resume extends Error {
  constructor(public made: Staged[], public pending: string[], public wait: number, public cause: GitHubError | null) { super("resume"); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A call GitHub may rate-limit, waited out when it says for how long and
 * that is soon enough: up to four tries, never past `until`, never longer
 * than LONGEST_WAIT_S at once. Anything else is thrown as it came.
 */
async function patient<T>(until: number, run: () => Promise<T>): Promise<T> {
  for (let tries = 0; ; tries++) {
    try {
      return await run();
    } catch (err) {
      if (!(err instanceof GitHubError) || !err.limited || tries >= 3) throw err;
      const wait = err.wait ?? Math.min(5 * 2 ** tries, LONGEST_WAIT_S);
      if (wait > LONGEST_WAIT_S || Date.now() + wait * 1000 > until) throw err;
      await sleep(wait * 1000);
    }
  }
}

/** A step of the write, named on the error it throws: GitHub's refusal says which part it refused. */
async function at<T>(step: NonNullable<GitHubError["step"]>, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (err) { if (err instanceof GitHubError) err.step = step; throw err; }
}

/**
 * WHY GITHUB SAID NO, IN ITS OWN WORDS. Every 403 was "The token is not
 * allowed to write here.", and a push the key could make (the files were
 * staged) but a rule on `main` stopped read the same as a key with no
 * access. So a refusal keeps GitHub's own message and the step it came at,
 * with a line on what usually settles it. Never the key: `safe` takes it out
 * of anything GitHub echoed, and no header is ever read into it.
 * `tests/publish-refused.mjs`.
 */
function refusal(error: GitHubError, token: string, branch: string): string {
  const said = safe(error.message, token).replace(/[.\s]+$/, "");
  if (error.status === 401) return "GitHub rejected the token.";
  const where = error.step === "ref" ? `moving ${branch}` : error.step === "commit" ? "making the commit" : error.step === "tree" ? "making the tree" : null;
  /* A rate limit is not a permission: the key is fine, GitHub wants it slower. */
  if (error.limited) return `GitHub is limiting how fast this key writes${where ? `, at ${where}` : ""}: ${said}. What went up is kept; press again in ${error.wait && error.wait > 90 ? `about ${Math.ceil(error.wait / 60)} minutes` : "a minute"} and it carries on from there.`;
  const hint = /workflow/i.test(said)
    ? " A file under .github/workflows needs the key's Workflows permission (read and write), or leave that file out."
    : /rule|protect/i.test(said)
      ? ` Ask the owner to allow pushes to ${branch}, or publish to another branch.`
      : error.status === 403 && /not accessible|permission|must have|write access/i.test(said) ? " The key may not have Contents write on this repository." : "";
  if (!where) return error.status === 403 ? `GitHub refused: ${said}.${hint}` : said;
  return `GitHub refused ${where}: ${said}.${hint}`;
}

async function gh<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string } & T;
  if (!res.ok) {
    const error = new GitHubError(data.message ?? `GitHub answered ${res.status}`, res.status);
    /* Only the two numbers are read from the headers, and nothing else of them goes anywhere. */
    const after = Number(res.headers.get("retry-after"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(after) && after > 0) error.wait = Math.ceil(after);
    else if (Number.isFinite(reset) && reset > 0) error.wait = Math.max(1, Math.ceil(reset - Date.now() / 1000));
    error.limited = res.status === 429 || (res.status === 403 && (/rate limit|abuse/i.test(error.message) || res.headers.get("x-ratelimit-remaining") === "0"));
    throw error;
  }
  return data;
}

/** A repository name GitHub will take, made from whatever the site is called. */
function slug(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const s = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  return s && /[a-z0-9]/.test(s) ? s : null;
}

/**
 * Make the site a repository of its own, the way Vercel does it: on the first
 * publish, named after the site, without ever asking.
 *
 * Private, and empty — `auto_init` would put a README in it that the first
 * push would then have to merge around. A name already in use is never taken
 * over: pushing into a repository somebody made earlier for something else is
 * the one unrecoverable thing this route could do, so a clash gets a suffix
 * and a repository of its own. The name it settled on goes back to the
 * browser, which writes it on the site.
 */
async function createRepo(token: string, wanted: string): Promise<{ repo: string; renamed: boolean }> {
  for (let i = 0; i < 10; i++) {
    const name = i ? `${wanted}-${i}` : wanted;
    try {
      const made = await gh<{ full_name: string }>(token, "POST", "/user/repos", {
        name,
        private: true,
        auto_init: false,
        description: "Made by the Builder.",
      });
      return { repo: made.full_name, renamed: i > 0 };
    } catch (err) {
      const taken = err instanceof GitHubError && err.status === 422;
      if (!taken) throw err;
    }
  }
  throw new GitHubError(`Every name from “${wanted}” to “${wanted}-9” is already a repository of yours.`, 422);
}

/**
 * Is this GitHub saying "there is nothing there", in either of the two ways
 * it says it?
 *
 * A branch that does not exist in a repository that has commits is a 404. A
 * repository with no commits at all is a **409**, with the message "Git
 * Repository is empty." — and that is the one that took the first publish
 * down: the route knew how to make a root commit and never got there,
 * because the 409 from the ref lookup was rethrown as a failure before the
 * empty case was ever reached. Every site's first publish lands in a
 * repository this route made a moment earlier, so the empty case is the
 * normal one, not the odd one.
 */
const nothingThere = (err: unknown) => err instanceof GitHubError && (err.status === 404 || err.status === 409);

/** The branch's tip, or the default branch's, or nothing at all: an empty repository. */
async function tipOf(token: string, repo: string, branch: string, make = true): Promise<string | null> {
  try {
    const ref = await gh<{ object: { sha: string } }>(token, "GET", `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    return ref.object.sha;
  } catch (err) {
    if (!nothingThere(err)) throw err;
  }
  try {
    const info = await gh<{ default_branch: string }>(token, "GET", `/repos/${repo}`);
    const def = await gh<{ object: { sha: string } }>(token, "GET", `/repos/${repo}/git/ref/heads/${encodeURIComponent(info.default_branch)}`);
    // The branch asked for does not exist yet, but the repository has
    // history: start it where the default branch stands. A read-only
    // listing only asks where that is; it makes no branch.
    if (make) await gh(token, "POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: def.object.sha });
    return def.object.sha;
  } catch (err) {
    if (!nothingThere(err)) throw err;
    return null;
  }
}

/**
 * AGENTS.md and CLAUDE.md, merged into what the branch already holds.
 *
 * A publish writes the feature contract as one marked block. The owner, or
 * a code chat working in the repository, may have written these files
 * first, so the block is merged into the file as it stands at `baseSha`:
 * replaced where its markers are, added at the end where they are not. A
 * file that is not there, or cannot be read, is written as sent.
 */
async function mergeContract(token: string, repo: string, baseSha: string, files: { path: string; content: string; encoding: "utf-8" | "base64" }[]): Promise<void> {
  for (const f of files) {
    if (!MERGED_FILES.has(f.path) || f.encoding !== "utf-8") continue;
    try {
      const was = await gh<{ content?: string; encoding?: string }>(token, "GET", `/repos/${repo}/contents/${encodeURIComponent(f.path)}?ref=${encodeURIComponent(baseSha)}`);
      if (was.encoding !== "base64" || typeof was.content !== "string") continue;
      f.content = mergeBlock(Buffer.from(was.content, "base64").toString("utf8"), f.content);
    } catch {
      /* Not there, or not readable: the contract is the whole file. */
    }
  }
}

type Staged = { path: string; sha: string };
type FileOut = { path: string; content: string; encoding: "utf-8" | "base64" };

/** The document says which repository it belongs to, so a copy made from it later can tell, and a publish into the wrong place has a record. */
function stampDoc(f: FileOut, repo: string, branch: string): void {
  if (f.path !== "site/document.json" || f.encoding !== "utf-8") return;
  try {
    const doc = JSON.parse(f.content) as Record<string, unknown>;
    doc.publishedTo = { repo, branch, at: new Date().toISOString() };
    f.content = JSON.stringify(doc, null, 2) + "\n";
  } catch { /* not a document: pushed as it came */ }
}

/** The sha git gives a file's bytes, worked out here: the same bytes already in the repository need not go up again. */
function blobSha(f: FileOut): string {
  const bytes = Buffer.from(f.content, f.encoding === "base64" ? "base64" : "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/** Every blob sha in the tree of `baseSha`. Unreadable, it is nothing known, and every file goes up. */
async function knownBlobs(token: string, repo: string, baseSha: string | null, treeSha?: string): Promise<Set<string>> {
  const known = new Set<string>();
  if (!baseSha) return known;
  try {
    const tree = treeSha ?? (await gh<{ tree: { sha: string } }>(token, "GET", `/repos/${repo}/git/commits/${baseSha}`)).tree.sha;
    const listing = await gh<{ tree?: { sha?: string; type?: string }[] }>(token, "GET", `/repos/${repo}/git/trees/${tree}?recursive=1`);
    for (const e of listing.tree ?? []) if (e.type === "blob" && typeof e.sha === "string") known.add(e.sha);
  } catch {
    /* Not listed: nothing is skipped, which is only slower. */
  }
  return known;
}

/**
 * Each file as a blob in the repository, ready for a tree — one at a time,
 * a gap between, and none that is already there. Out of time, or limited
 * for longer than this call can wait, it stops with a `Resume` that says
 * what went up and what did not.
 */
async function blobsOf(token: string, repo: string, files: FileOut[], known: Set<string>, until: number): Promise<Staged[]> {
  const made: Staged[] = [];
  let sent = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const sha = blobSha(f);
    if (known.has(sha)) { made.push({ path: f.path, sha }); continue; }
    const pending = () => files.slice(i).map((x) => x.path);
    if (sent && Date.now() + BLOB_GAP_MS > until) throw new Resume(made, pending(), 0, null);
    if (sent) await sleep(BLOB_GAP_MS);
    try {
      const got = await patient(until, () => gh<{ sha: string }>(token, "POST", `/repos/${repo}/git/blobs`, { content: f.content, encoding: f.encoding }));
      made.push({ path: f.path, sha: got.sha });
      known.add(got.sha);
      sent++;
    } catch (err) {
      if (err instanceof GitHubError && err.limited) throw new Resume(made, pending(), err.wait ?? LONGEST_WAIT_S, err);
      throw err;
    }
  }
  return made;
}

/** Every file in one commit, on top of `baseSha` — or as the root commit, when there is none. `staged` are blobs an earlier call made. */
async function writeCommit(
  token: string,
  repo: string,
  branch: string,
  files: FileOut[],
  message: string,
  baseSha: string | null,
  staged: Staged[],
  clock: { blobs: number; end: number },
): Promise<{ sha: string; html_url: string }> {
  const baseCommit = baseSha ? await gh<{ tree: { sha: string } }>(token, "GET", `/repos/${repo}/git/commits/${baseSha}`) : null;
  const known = await knownBlobs(token, repo, baseSha, baseCommit?.tree.sha);
  const own = new Set(files.map((f) => f.path));
  const made = await blobsOf(token, repo, files, known, clock.blobs);
  const tree = [...staged.filter((s) => !own.has(s.path)), ...made]
    .map((b) => ({ path: b.path, mode: "100644" as const, type: "blob" as const, sha: b.sha }));
  /* Every blob is up: a limit from here on keeps them all, and the next call goes straight to the commit. */
  const kept = <T,>(run: () => Promise<T>) => patient(clock.end, run).catch((err) => {
    if (err instanceof GitHubError && err.limited) throw new Resume(made, [], err.wait ?? LONGEST_WAIT_S, err);
    throw err;
  });
  const newTree = await kept(() => at("tree", () => gh<{ sha: string }>(token, "POST", `/repos/${repo}/git/trees`, {
    ...(baseCommit ? { base_tree: baseCommit.tree.sha } : {}),
    tree,
  })));
  const commit = await kept(() => at("commit", () => gh<{ sha: string; html_url: string }>(token, "POST", `/repos/${repo}/git/commits`, {
    message,
    tree: newTree.sha,
    parents: baseSha ? [baseSha] : [],
  })));
  await kept(() => at("ref", () => (baseSha
    ? gh(token, "PATCH", `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false })
    : gh(token, "POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha }))));
  return commit;
}

/** What a call that stopped part-way answers: not a failure, the next call carries on from `staged`. */
function resumed(r: Resume, token: string, branch: string, repo: string, created: string | null) {
  const up = r.made.length;
  const message = r.cause
    ? refusal(r.cause, token, branch)
    : `This call ran out of time with ${up} file${up === 1 ? "" : "s"} up; ${r.pending.length} to go, and the next call carries on from there.`;
  return NextResponse.json({
    ok: false, reason: "resume", repo, branch, ...(created ? { created } : {}),
    staged: r.made, pending: r.pending, wait: r.cause ? r.wait : 0,
    ...(r.cause ? { status: r.cause.status, ...(r.cause.step ? { step: r.cause.step } : {}) } : {}),
    message,
  });
}

export async function POST(request: Request) {
  const started = Date.now();
  const clock = { blobs: started + BLOB_BUDGET_MS, end: started + CALL_BUDGET_MS };
  const c = config();
  const token = tokenFor(request);
  if (!token) {
    return NextResponse.json({ ok: false, reason: "no-github", message: "No GitHub token. Put one in the Keys panel — it stays in this browser — or set GITHUB_TOKEN on the server. Until then, download the files and commit them by hand." });
  }

  let body: { files?: FileIn[]; message?: string; deploy?: boolean; repo?: unknown; branch?: unknown; create?: unknown; boundTo?: unknown; sources?: unknown; stage?: unknown; staged?: unknown; assemble?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const asked = where(body.repo, c);
  if (asked.refused) return NextResponse.json({ ok: false, reason: "bad-repo", message: asked.refused });
  /*
   * A SITE WITH NO REPOSITORY OF ITS OWN NEVER LANDS IN THE SERVER'S.
   *
   * `GITHUB_REPO` used to catch every request that named nowhere, which
   * meant a scratch site made a minute ago published straight into the
   * real repository, on its branch. A request that carries a name to make
   * a repository under is a site that has none yet, and it gets one of its
   * own; the server's is only for a request that names nothing at all.
   */
  const named = typeof body.repo === "string" && body.repo.trim().length > 0;
  let target = named || !slug(body.create) ? asked.repo : null;
  /*
   * THE LOCK, AT THE ROUTE. A site bound to a repository publishes there
   * and nowhere else. A call that names its binding and a different
   * target is refused in words, before a byte moves: that is how a design
   * never lands in a repository that belongs to another site.
   */
  const boundTo = typeof body.boundTo === "string" ? body.boundTo.trim() : "";
  if (boundTo && target && boundTo.toLowerCase() !== target.toLowerCase()) {
    return NextResponse.json({ ok: false, reason: "bound", message: `This site belongs to ${boundTo} and cannot be published into ${target}.` });
  }
  /*
   * NEVER INTO WHERE A SITE CAME FROM. The browser sends every repository a
   * site in it was brought in from; a publish into any of them is refused
   * in words, before a byte moves, whatever else the call says.
   */
  const fromHere = target ? sourceAmong(target, body.sources) : null;
  if (fromHere) {
    return NextResponse.json({ ok: false, reason: "source", repo: fromHere, message: `${fromHere} is where a site here was brought in from, and Publish never writes back into that. This site publishes to a repository of its own.` });
  }
  /*
   * WHAT GOES UP IS READ BEFORE ANYTHING IS MADE. A file past the cap used
   * to be refused after the repository was made, and the refusal did not
   * name it, so every press made another.
   *
   * A BIG SITE COMES IN MORE THAN ONE REQUEST. On Vercel a function takes a
   * body of at most 4.5 MB, and share.xyz's push was 9.3 MB. So `publish()`
   * packs text (`encoding: "gzip"`, unpacked here) and, past that, sends
   * the files in parts: calls with `stage` make blobs and answer their shas,
   * and the last call carries them as `staged` into the one commit.
   */
  const staged: Staged[] = Array.isArray(body.staged)
    ? body.staged.flatMap((s: { path?: unknown; sha?: unknown }) => {
        const path = safePath(s?.path);
        return path && typeof s?.sha === "string" && /^[\w-]{1,64}$/.test(s.sha) ? [{ path, sha: s.sha }] : [];
      })
    : [];
  const sent = Array.isArray(body.files) ? body.files : [];
  if (sent.length + staged.length > MAX_FILES) {
    return NextResponse.json({ ok: false, reason: "too-many", message: `This site is ${sent.length + staged.length} files, and a publish takes up to ${MAX_FILES}.` }, { status: 400 });
  }
  const files: FileOut[] = [];
  for (const f of sent) {
    const path = safePath(f?.path);
    if (!path || typeof f.content !== "string") continue;
    /* A picture arrives as base64 and is committed as base64: the bytes go
       to the repository as a file, which is the whole point of them not
       being in the document. Its real size is three quarters of what was
       sent, and that is what the limit is about. Packed text is unpacked,
       never past the cap. */
    if (f.encoding === "gzip") {
      let text: string;
      try {
        text = gunzipSync(Buffer.from(f.content, "base64"), { maxOutputLength: MAX_BYTES + 1 }).toString("utf8");
      } catch (err) {
        const over = err instanceof RangeError || (err as { code?: string })?.code === "ERR_BUFFER_TOO_LARGE";
        return NextResponse.json({ ok: false, reason: over ? "too-big" : "bad-request", message: over ? `“${path}” is over ${MAX_BYTES / 1024 / 1024} MB.` : `“${path}” could not be unpacked.` }, { status: 400 });
      }
      if (Buffer.byteLength(text, "utf8") > MAX_BYTES) return NextResponse.json({ ok: false, reason: "too-big", message: `“${path}” is over ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 400 });
      files.push({ path, content: text, encoding: "utf-8" });
      continue;
    }
    const b64 = f.encoding === "base64";
    const real = b64 ? Math.floor((f.content.length * 3) / 4) : Buffer.byteLength(f.content, "utf8");
    if (real > MAX_BYTES) return NextResponse.json({ ok: false, reason: "too-big", message: `“${path}” is over ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 400 });
    files.push({ path, content: f.content, encoding: b64 ? "base64" : "utf-8" });
  }
  /*
   * A FILE BIGGER THAN ONE REQUEST, PUT BACK TOGETHER HERE.
   *
   * parasiteonsol.fun's picture was 3.8 MB, 5.1 MB once encoded, and a
   * request to the Builder carries 4.5 MB: Go live was refused. So a file
   * past what one request carries comes up in pieces, each piece staged as a
   * blob of its own like any other file, and a last small `stage` call names
   * the pieces in order (`assemble`): they are read back from the repository
   * they were just written to, joined byte for byte, and made the file's real
   * blob. The pieces are never in any tree, so nothing of them is committed;
   * the file is the same bytes, and it is still one commit and one deployment
   * (`tests/publish-big-picture.mjs`).
   */
  /* `gzip`: the pieces are packed text (the site document past one request, 3.5 MB even packed on parasiteonsol.fun), unpacked once joined. */
  const assemble: { path: string; parts: string[]; gzip: boolean }[] = Array.isArray(body.assemble)
    ? body.assemble.flatMap((a: { path?: unknown; parts?: unknown; gzip?: unknown }) => {
        const path = safePath(a?.path);
        const parts = Array.isArray(a?.parts) ? a.parts.filter((x): x is string => typeof x === "string" && /^[\w-]{1,64}$/.test(x)) : [];
        return path && parts.length && parts.length === (a.parts as unknown[]).length && parts.length <= 64 ? [{ path, parts, gzip: a.gzip === true }] : [];
      })
    : [];
  if (!files.length && !staged.length && !assemble.length) return NextResponse.json({ ok: false, reason: "empty", message: "Nothing to publish." }, { status: 400 });
  const stage = body.stage === true || assemble.length > 0;
  /* Nowhere to push yet, but a name to make one under: this is a site's first
     publish, so it gets its repository here rather than being sent away to
     make one by hand. */
  let created: string | null = null;
  if (!target && c.allow.length && slug(body.create)) {
    /* A name to make one under, on a server that only pushes to a list: the
       list wins, and the answer says so rather than "nothing to name it after". */
    return NextResponse.json({ ok: false, reason: "no-repo", message: `This server only publishes to ${c.allow.join(", ")}: pick one of them on the Builds page.` });
  }
  if (!target && !c.allow.length) {
    const wanted = slug(body.create);
    if (wanted) {
      try {
        const made = await createRepo(token, wanted);
        target = made.repo;
        created = made.repo;
      } catch (error) {
        const why = error instanceof GitHubError
          ? error.status === 403 ? "The token is not allowed to make repositories: it needs Administration write, or a classic token with repo scope."
            : error.status === 401 ? "GitHub rejected the token."
              : safe(error.message, token)
          : "Could not make the repository.";
        return NextResponse.json({ ok: false, reason: "no-repo", message: why });
      }
    }
  }
  if (!target || !REPO.test(target)) {
    return NextResponse.json({
      ok: false,
      reason: "no-repo",
      message: target
        ? `A repository is owner/name, not “${target}”.`
        /* This used to say "give the site a name in the brief", which sent a
           person to look at a brief that was named all along: Go live simply
           never sent the name. It says what it means now. */
        : "This publish named no repository to push to and no name to make one under.",
    });
  }
  /* No branch asked for and none on the server: main is assumed, and the
     answer says it was, so a push to the wrong branch can be read off it. */
  const branch = (typeof body.branch === "string" && body.branch.trim()) || c.branch || "main";
  const assumed = !((typeof body.branch === "string" && body.branch.trim()) || c.branch);
  const message = (typeof body.message === "string" && body.message.trim() ? body.message.trim() : "Builder: publish the site").slice(0, 500);

  const repo = target;
  /* The document says where it was published (`stampDoc`); one put back together from pieces is stamped as it is joined. */
  for (const f of files) stampDoc(f, repo, branch);
  /* A repository this call made a moment ago is empty; any other is looked in first. */
  if (!created) {
    try {
      /* The capture check (`./capture.ts`) runs ahead of `tipOf`, which can itself make a branch. */
      if (await holdsCapture(token, repo, branch)) {
        return NextResponse.json({ ok: false, reason: "capture", repo, message: `${repo} holds a capture (site/capture/), and Publish never writes into a capture repository. This site publishes to a repository of its own.` });
      }
    } catch (error) {
      /* A token GitHub turns down is that, and said as the push would have said it. */
      const status = error instanceof CaptureUnknown ? error.status : null;
      if (status === 401) return NextResponse.json({ ok: false, reason: "github", status: 401, repo, message: "GitHub rejected the token." });
      const why = error instanceof CaptureUnknown ? error.message : "GitHub could not be reached";
      return NextResponse.json({ ok: false, reason: "capture-unknown", repo, ...(status ? { status } : {}), message: `Could not tell whether ${repo} holds a capture (${why}), so nothing was pushed.` });
    }
  }
  if (stage) {
    /* Blobs only, for a later call's commit. An empty repository takes no
       blob, so its first file goes in through the contents API first: the
       seed a first publish makes anyway (below). */
    try {
      const base = await tipOf(token, repo, branch);
      if (!base) {
        const seed = files[0];
        if (!seed) return NextResponse.json({ ok: false, reason: "empty", message: "There is nothing in the repository yet to put the pieces of a big file beside." }, { status: 400 });
        await gh(token, "PUT", `/repos/${repo}/contents/${seed.path.split("/").map(encodeURIComponent).join("/")}`, {
          message,
          branch,
          content: seed.encoding === "base64" ? seed.content : Buffer.from(seed.content, "utf8").toString("base64"),
        });
      }
      const known = await knownBlobs(token, repo, base);
      for (const s of staged) known.add(s.sha);
      const whole: FileOut[] = [];
      for (const a of assemble) {
        const pieces: Buffer[] = [];
        for (const sha of a.parts) {
          const got = await gh<{ content?: string; encoding?: string }>(token, "GET", `/repos/${repo}/git/blobs/${sha}`);
          if (typeof got.content !== "string") throw new GitHubError(`A piece of “${a.path}” could not be read back.`, 404);
          pieces.push(Buffer.from(got.content.replace(/\s+/g, ""), got.encoding === "base64" ? "base64" : "utf8"));
        }
        const bytes = Buffer.concat(pieces);
        const tooBig = NextResponse.json({ ok: false, reason: "too-big", message: `“${a.path}” is over ${MAX_ASSEMBLED / 1024 / 1024} MB, more than GitHub keeps in one file.` }, { status: 400 });
        if (a.gzip) {
          let text: string;
          try {
            text = gunzipSync(bytes, { maxOutputLength: MAX_ASSEMBLED + 1 }).toString("utf8");
          } catch (err) {
            const over = err instanceof RangeError || (err as { code?: string })?.code === "ERR_BUFFER_TOO_LARGE";
            if (over) return tooBig;
            return NextResponse.json({ ok: false, reason: "bad-request", message: `“${a.path}” could not be unpacked once put back together.` }, { status: 400 });
          }
          if (Buffer.byteLength(text, "utf8") > MAX_ASSEMBLED) return tooBig;
          /* The document says where it was published, as it does when it comes in one request. */
          const out: FileOut = { path: a.path, content: text, encoding: "utf-8" };
          stampDoc(out, repo, branch);
          whole.push(out);
          continue;
        }
        if (bytes.length > MAX_ASSEMBLED) return tooBig;
        whole.push({ path: a.path, content: bytes.toString("base64"), encoding: "base64" });
      }
      const made = await blobsOf(token, repo, [...files, ...whole], known, clock.blobs);
      return NextResponse.json({ ok: true, stage: true, repo, branch, ...(created ? { created } : {}), staged: made });
    } catch (error) {
      if (error instanceof Resume) return resumed(error, token, branch, repo, created);
      const made = created ? { created, repo: created } : {};
      const why = error instanceof GitHubError ? refusal(error, token, branch) : "The publish failed.";
      return NextResponse.json({ ok: false, reason: "github", ...(error instanceof GitHubError ? { status: error.status, ...(error.step ? { step: error.step } : {}) } : {}), message: why, ...made });
    }
  }
  try {
    /* The branch's tip, or a new branch off the default one — or nothing at
       all, which is what a repository made a moment ago looks like: no
       commits, so no branch, so both of those are a 404 and there is no
       parent to hang the first commit from. That case is the normal one now
       rather than the odd one, since every site's first publish lands in a
       repository this route has just made. */
    let baseSha = await tipOf(token, repo, branch);
    /* The feature contract goes into the owner's AGENTS.md and CLAUDE.md, not over them (`library/contract.ts`). */
    if (baseSha) await mergeContract(token, repo, baseSha, files);
    let commit: { sha: string; html_url: string };
    try {
      commit = await writeCommit(token, repo, branch, files, message, baseSha, staged, clock);
    } catch (err) {
      /*
       * A repository with no commits in it at all can refuse the git data
       * API outright — the same 409 the ref lookup gives — because there is
       * nothing for a blob to belong to yet. The contents API does not
       * refuse: it will write one file into an empty repository and make the
       * root commit while it is there. So the first file goes up that way and
       * the whole set is written on top of it, which is two commits on a
       * first publish and no publish that fails.
       */
      if (baseSha || !(err instanceof GitHubError && err.status === 409) || !files.length) throw err;
      const seed = files[0]!;
      await gh(token, "PUT", `/repos/${repo}/contents/${seed.path.split("/").map(encodeURIComponent).join("/")}`, {
        message,
        branch,
        content: seed.encoding === "base64" ? seed.content : Buffer.from(seed.content, "utf8").toString("base64"),
      });
      baseSha = await tipOf(token, repo, branch);
      commit = await writeCommit(token, repo, branch, files, message, baseSha, staged, clock);
    }

    let deployed = false;
    let deployNote: string | undefined;
    if (body.deploy !== false && c.hook) {
      try {
        const r = await fetch(c.hook, { method: "POST" });
        deployed = r.ok;
        if (!r.ok) deployNote = `The Vercel deploy hook answered ${r.status}.`;
      } catch (err) {
        deployNote = `The Vercel deploy hook could not be reached: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    return NextResponse.json({
      ok: true,
      sha: commit.sha,
      /* The tip it was written on (none for a root commit): a kit the board sent at that tip is still the board's own (`kitAfterPush`). */
      parent: baseSha,
      commitUrl: commit.html_url ?? `https://github.com/${repo}/commit/${commit.sha}`,
      branch,
      ...(assumed ? { assumed: true } : {}),
      repo,
      /* Only set when this call made it, so the browser knows to write it on
         the site rather than assuming every publish is the first. */
      ...(created ? { created } : {}),
      files: new Set([...files.map((f) => f.path), ...staged.map((f) => f.path)]).size,
      deployed,
      hook: !!c.hook,
      deployNote,
    });
  } catch (error) {
    /*
     * A repository this call made is named even when the push then failed,
     * so the browser can write it on the site and the next press goes to the
     * same place. Without it every failed first publish made another one:
     * the name is taken by the last attempt, so the next gets a suffix, and
     * a person pressing twice ends up with two empty repositories and no
     * site in either.
     */
    if (error instanceof Resume) return resumed(error, token, branch, repo, created);
    const made = created ? { created, repo: created } : {};
    if (error instanceof GitHubError) {
      const why = error.status === 404 && !error.step ? "The repository was not found, or the token cannot see it." : refusal(error, token, branch);
      return NextResponse.json({ ok: false, reason: "github", status: error.status, ...(error.step ? { step: error.step } : {}), message: why, ...made });
    }
    return NextResponse.json({ ok: false, reason: "unknown", message: error instanceof Error ? error.message : "The publish failed.", ...made });
  }
}

/**
 * WHAT IS ON THE BRANCH NOW, FOR A PUSH THAT SENDS ONLY WHAT CHANGED.
 *
 * Update live site sent every file every time: parasite's 354 files at about
 * two a request took six minutes when little had changed. The browser works
 * out each file's git blob sha itself and asks this for the branch's tree
 * (or, before the branch exists, the default branch's, which is where it
 * will start): a file whose sha is already there at its path is not sent,
 * only named, and it is still the one commit (`tests/publish-changed.mjs`).
 * Read only.
 */
async function treeListing(request: Request, q: URLSearchParams) {
  const token = tokenFor(request);
  const repo = (q.get("repo") ?? "").trim();
  const branch = (q.get("branch") ?? "").trim() || "main";
  if (!token) return NextResponse.json({ ok: false, reason: "no-token", tree: [] });
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return NextResponse.json({ ok: false, reason: "bad-request", tree: [] }, { status: 400 });
  try {
    const base = await tipOf(token, repo, branch, false);
    if (!base) return NextResponse.json({ ok: true, tree: [] });
    const commit = await gh<{ tree: { sha: string } }>(token, "GET", `/repos/${repo}/git/commits/${base}`);
    const listing = await gh<{ tree?: { path?: string; sha?: string; type?: string }[]; truncated?: boolean }>(token, "GET", `/repos/${repo}/git/trees/${commit.tree.sha}?recursive=1`);
    const tree = (listing.tree ?? []).flatMap((e) => (e.type === "blob" && typeof e.path === "string" && typeof e.sha === "string" ? [{ path: e.path, sha: e.sha }] : []));
    return NextResponse.json({ ok: true, base, tree, truncated: listing.truncated === true });
  } catch (error) {
    /* Unreadable is not a refusal: every file is sent, as before. */
    return NextResponse.json({ ok: false, reason: "github", tree: [], message: error instanceof Error ? safe(error.message, token) : "GitHub could not be read." });
  }
}

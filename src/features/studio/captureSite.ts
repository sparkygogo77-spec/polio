/**
 * "Capture a site": any address, captured by the sink repository's
 * workflow and brought in from where it lands.
 *
 * WHY A WORKFLOW. The capture opens a real browser on the page and
 * measures it; that is sink's `capture-route.mjs`, and it needs a machine
 * with a browser and the converter beside it. GitHub Actions is such a
 * machine he already has, and its `workflow_dispatch` API is one POST.
 * The run commits `sites/<name>/` to a branch `captures/<name>`, so every
 * site captured is kept beside the others and the root `site/` (the one
 * captured by hand) is never written.
 *
 * WHY THE BROWSER. His token is read here, in his browser, exactly as the
 * importer and a publish read it (`repoRun.ts`), and it reaches our
 * server never. GitHub is asked directly.
 *
 * WHAT THE IMPORTER IS HANDED. A capture is read the way any repository
 * is — `owner/sink@captures/<name>` through `bringRepoIn` — plus a path,
 * `sites/<name>`, because the importer reads the root `site/document.json`
 * today. The path setting is another lane's (`repoRun.ts`); this file
 * expects it as `Bringing.path?: string`, carried to
 * `readRepoSite(repo, token, say, { path })`, and `capturePlace` says what
 * the value is. Until it lands, `bringRepoIn` reads the root site.
 *
 * Every function here takes `fetch` and `sleep` so the check can stand a
 * GitHub in; nothing here touches React or the store.
 */

const API = "https://api.github.com";
/** The workflow file in sink: `.github/workflows/capture.yml`. */
export const WORKFLOW = "capture.yml";

export interface CaptureRepo { owner: string; name: string }

/** The pure pipes: a fetch and a sleep, stand-ins in the check. */
export interface Pipes {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** The folder name a site is kept under: lowered, dashes, never a path, never one of sink's own folders. Mirrors sink's `siteName`. */
export function captureName(raw: string): string | null {
  const typed = String(raw ?? "").trim();
  if (/[/\\]|\.\./.test(typed)) return null;
  const s = typed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s || s.length > 64) return null;
  if (["site", "sites", "capture", "assets", "app", "public"].includes(s)) return null;
  return s;
}

/** A name from an address, when none was typed: the host without its www and its top-level domain. */
export function nameFrom(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return captureName(host.split(".").slice(0, -1).join("-") || host);
  } catch { return null; }
}

/** Where a capture lands, and what the importer is handed to read it. */
export function capturePlace(name: string): { ref: string; path: string } {
  return { ref: `captures/${name}`, path: `sites/${name}` };
}

/** The `want` string `bringRepoIn` reads: the repository at the capture's branch. */
export function captureWant(repo: CaptureRepo, name: string): string {
  return `${repo.owner}/${repo.name}@${capturePlace(name).ref}`;
}

const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

export type Started = { ok: true; runId: number; htmlUrl: string; name: string } | { ok: false; says: string; status?: number };

/**
 * A key that may not run the capture, said so it can be put right: the
 * exact permission, for either kind of token, and the way round it. A
 * capture chat captures the same address into the same folder, and the site
 * brings it in with Bring in again.
 */
export function workflowPermissionSays(repo: CaptureRepo, url?: string, name?: string): string {
  const where = `${repo.owner}/${repo.name}`;
  return `This GitHub key can't run workflows on ${where}. Add to it: on a fine-grained token, Actions: Read and write and Contents: Read and write, on ${where}; on a classic token, the repo and workflow scopes. Or ask a capture chat to capture ${url || "the address"}${name ? ` into sites/${name}` : ""}, then use Bring in again.`;
}
/** What GitHub's own answer says, when it has one. */
async function messageOf(r: Response): Promise<string> {
  try { return String(((await r.json()) as { message?: string }).message ?? "").trim(); } catch { return ""; }
}

/**
 * A refused dispatch, said as what it is. A 403 is not always the token's
 * permission: a spent rate limit, Actions turned off, or an organisation's
 * sign-in are 403s too, and each is fixed somewhere else. A 404 on a typed
 * branch is also what a token that cannot see the repository gets, so the
 * repository is asked before a missing workflow is blamed.
 */
async function refusal(d: Response, o: { f: typeof fetch; base: string; h: Record<string, string>; repo: CaptureRepo; ref: string; url: string; name: string }): Promise<string> {
  const full = `${o.repo.owner}/${o.repo.name}`;
  const said = await messageOf(d);
  if (d.status === 401) return "GitHub does not know this token: it is expired, revoked or pasted wrong. Put a fresh one in Keys.";
  if (d.status === 403 || d.status === 429) {
    if (d.headers.get("x-ratelimit-remaining") === "0" || /rate limit/i.test(said)) {
      const reset = Number(d.headers.get("x-ratelimit-reset"));
      const at = reset ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString()}.` : " Try again in a while.";
      return `GitHub's rate limit for this token is spent.${at}`;
    }
    if (/disabled/i.test(said)) return `Actions are turned off for ${full}: GitHub said "${said}". Turn them on in the repository's Settings → Actions → General.`;
    if (/SAML|SSO|single sign-on/i.test(said) || d.headers.get("x-github-sso")) return `The token has to be authorised for the organisation's single sign-on: GitHub said "${said}".`;
    if (!said || /not accessible|permission|must have/i.test(said)) {
      return `${workflowPermissionSays(o.repo, o.url, o.name)}${said ? ` GitHub said "${said}".` : ""}`;
    }
    return `GitHub refused the dispatch (${d.status}): "${said}".`;
  }
  if (d.status === 404) {
    const seen = await o.f(o.base, { headers: o.h }).then((r) => r.ok, () => true);
    if (!seen) return `The token cannot see ${full}. A fine-grained token needs it chosen under its repository access.`;
    return `${full} has no ${WORKFLOW} workflow on ${o.ref}. Merge sink's capture branch first, or name the branch it is on under advanced.`;
  }
  if (d.status === 422) {
    if (/no ref/i.test(said)) return `${full} has no branch ${o.ref}. Name the branch the workflow is on under advanced.`;
    if (/workflow_dispatch/i.test(said)) return `The ${WORKFLOW} on ${o.ref} cannot be started by hand: GitHub said "${said}". It needs a workflow_dispatch trigger.`;
    return `GitHub would not start ${WORKFLOW} on ${o.ref}: "${said || "422"}".`;
  }
  return `GitHub answered ${d.status} to the dispatch${said ? `: "${said}"` : ""}.`;
}


/**
 * Dispatch the workflow, then find the run it made. The dispatch answers
 * 204 and names no run, so the newest workflow_dispatch run of this
 * workflow created after the call is it.
 */
export async function startCapture(o: { repo: CaptureRepo; token: string; url: string; name: string; pages: string; ref?: string; findEveryMs?: number; findTries?: number } & Pipes): Promise<Started> {
  const f = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let address: URL;
  try { address = new URL(o.url.trim()); if (!/^https?:$/.test(address.protocol)) throw new Error(); } catch { return { ok: false, says: "That is not an address. It wants to start with https://." }; }
  const name = captureName(o.name) ?? nameFrom(address.href);
  if (!name) return { ok: false, says: "Name the site: letters, digits and dashes." };
  if (!o.token) return { ok: false, says: "No GitHub token in this browser yet. Open Keys and put one in; the capture runs in your own repository with it." };
  const base = `${API}/repos/${o.repo.owner}/${o.repo.name}`;
  const h = headers(o.token);
  let ref = o.ref?.trim() || "";
  try {
    if (!ref) {
      const r = await f(base, { headers: h });
      if (!r.ok) return { ok: false, says: r.status === 404 ? `${o.repo.owner}/${o.repo.name} is not a repository the token can see.` : `GitHub answered ${r.status} when asked about ${o.repo.owner}/${o.repo.name}.` };
      ref = ((await r.json()) as { default_branch?: string }).default_branch ?? "main";
    }
    const since = Date.now() - 5_000;
    const d = await f(`${base}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST", headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ ref, inputs: { url: address.href.replace(/\/$/, ""), name, pages: o.pages.trim() || "/" } }),
    });
    if (!d.ok) return { ok: false, status: d.status, says: await refusal(d, { f, base, h, repo: o.repo, ref, url: address.href, name }) };
    for (let tries = 0; tries < (o.findTries ?? 10); tries++) {
      const r = await f(`${base}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=5`, { headers: h, cache: "no-store" } as RequestInit);
      if (r.ok) {
        const runs = ((await r.json()) as { workflow_runs?: { id: number; html_url: string; created_at: string }[] }).workflow_runs ?? [];
        const mine = runs.find((run) => Date.parse(run.created_at) >= since);
        if (mine) return { ok: true, runId: mine.id, htmlUrl: mine.html_url, name };
      }
      await sleep(o.findEveryMs ?? 2_000);
    }
    return { ok: false, says: "The capture was asked for, but its run did not show up in time. Look at the repository's Actions tab." };
  } catch {
    return { ok: false, says: "GitHub could not be reached from this browser." };
  }
}

export interface RunState { status: string; conclusion: string | null; htmlUrl: string }

export async function readRun(o: { repo: CaptureRepo; token: string; runId: number } & Pipes): Promise<RunState> {
  const f = o.fetch ?? fetch;
  const r = await f(`${API}/repos/${o.repo.owner}/${o.repo.name}/actions/runs/${o.runId}`, { headers: headers(o.token), cache: "no-store" } as RequestInit);
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
  const j = (await r.json()) as { status: string; conclusion: string | null; html_url: string };
  return { status: j.status, conclusion: j.conclusion, htmlUrl: j.html_url };
}

/** The step the run is on, by name, from its jobs. Empty when none has started. */
async function stepOf(o: { repo: CaptureRepo; token: string; runId: number } & Pipes): Promise<string> {
  const f = o.fetch ?? fetch;
  try {
    const r = await f(`${API}/repos/${o.repo.owner}/${o.repo.name}/actions/runs/${o.runId}/jobs`, { headers: headers(o.token), cache: "no-store" } as RequestInit);
    if (!r.ok) return "";
    const jobs = ((await r.json()) as { jobs?: { steps?: { name: string; status: string }[] }[] }).jobs ?? [];
    const steps = jobs.flatMap((j) => j.steps ?? []);
    const on = steps.find((s) => s.status === "in_progress") ?? [...steps].reverse().find((s) => s.status === "completed");
    return on?.name ?? "";
  } catch { return ""; }
}

export type Progress = { done: false; status: string; step: string; htmlUrl: string };
export type Ended = { done: true; ok: true; ref: string; path: string; htmlUrl: string } | { done: true; ok: false; says: string; htmlUrl: string };

/** Watch a run to its end, saying the step it is on as it goes. */
export async function watchCapture(o: { repo: CaptureRepo; token: string; runId: number; name: string; onProgress: (p: Progress) => void; everyMs?: number } & Pipes): Promise<Ended> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const every = o.everyMs ?? 5_000;
  let htmlUrl = "";
  let run: RunState;
  for (;;) {
    try { run = await readRun(o); } catch { await sleep(every); continue; }
    htmlUrl = run.htmlUrl;
    if (run.status === "completed") break;
    o.onProgress({ done: false, status: run.status, step: await stepOf(o), htmlUrl });
    await sleep(every);
  }
  /* The read that saw it complete is the answer: asking again straight away was a second read inside the same breath. */
  if (run.conclusion === "success") return { done: true, ok: true, ...capturePlace(o.name), htmlUrl };
  return { done: true, ok: false, says: `The capture failed (${run.conclusion ?? "no conclusion"}). Its log says why.`, htmlUrl };
}

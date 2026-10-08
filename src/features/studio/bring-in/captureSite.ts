/**
 * "Capture a site": any address, captured by a capture workflow and brought
 * in from where it lands.
 *
 * WHY A WORKFLOW. The capture opens a real browser on the page and
 * measures it (`capture/site/capture/capture-route.mjs`), and it needs a
 * machine with a browser and the converter beside it. GitHub Actions is
 * such a machine he already has, and its `workflow_dispatch` API is one POST.
 *
 * WHERE IT LANDS. polio's own workflow (`.github/workflows/capture.yml`,
 * the capturer folded in from sink) commits nothing: a capture is a site
 * document, and site documents are not kept in git. It hands the folder back
 * as the run's artifact, `capture-<name>`, and the site is brought in from
 * the run (`owner/polio/sites/<name>@run:<id>`, `captureArtifact.ts`) into
 * the Builder's own store. A capturer that commits instead (sink, named
 * under advanced) still works the old way: `sites/<name>` on a branch.
 *
 * WHY THE BROWSER. His token is read here, in his browser, exactly as the
 * importer and a publish read it (`repoRun.ts`), and it rides only in the
 * header of each call: to GitHub, and to the route that reads the
 * artifact's bytes (`api/studio/capture-artifact`), which keeps nothing.
 *
 * Every function here takes `fetch` and `sleep` so the check can stand a
 * GitHub in; nothing here touches React or the store.
 */
import { findArtifact, runRef } from "../captureArtifact.ts";

const API = "https://api.github.com";
/** The workflow file, in polio as it was in sink: `.github/workflows/capture.yml`. */
export const WORKFLOW = "capture.yml";

/** The capturer by default: polio itself, whose workflow hands a capture back as an artifact. */
export const DEFAULT_CAPTURER = "sparkygogo77-spec/polio";

/**
 * Does this capturer hand a capture back as its run's artifact, rather than
 * commit it? polio's workflow does; sink's commits `sites/<name>` to a
 * branch. Only a committing capturer needs a branch made for it, and the
 * owner's say-so for its main line.
 */
export function handsBack(capturer: string): boolean {
  return capturer.trim().toLowerCase() === DEFAULT_CAPTURER.toLowerCase();
}

export interface CaptureRepo { owner: string; name: string }

/** The pure pipes: a fetch and a sleep, stand-ins in the check. */
export interface Pipes {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** The folder name a site is kept under: lowered, dashes, never a path, never one of the capturer's own folders. Mirrors `capture-site.mjs`'s `siteName`. */
export function captureName(raw: string): string | null {
  const typed = withoutJoinedAddress(String(raw ?? "").trim());
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

/**
 * One address from a field. Typing or pasting onto an address already in
 * the field joins two ("https://pst-server-beige.vercel.apphttps://…"),
 * and a capture once ran on exactly that: the last whole address is the one
 * meant. `joined` says it happened, so the field can say so.
 */
export function oneAddress(text: string): { url: string; joined: boolean } {
  const t = String(text ?? "").trim();
  /* A second address glued on, or after a space; one inside a query (`?next=https://…`) belongs to the first. */
  const starts = [...t.matchAll(/https?:\/\//gi)].map((m) => m.index!).filter((i) => i > 0 && /[a-z0-9\s]/i.test(t[i - 1]!));
  if (!starts.length) return { url: t, joined: false };
  return { url: t.slice(starts[starts.length - 1]).trim(), joined: true };
}

/** A name made from a joined address loses the second address glued to its end ("vercel-apphttps…" is "vercel-app"). */
export function withoutJoinedAddress(name: string): string {
  return name.replace(/(?<=[^\s/:])https?(?::\/\/\S*|[-_.]\S*)?$/i, "").replace(/[-_.\s]+$/, "") || name;
}

/** Where a committing capturer's capture lands, and what the importer is handed to read it. An artifact's is `{ ref: runRef(id), path }`. */
export function capturePlace(name: string): { ref: string; path: string } {
  return { ref: `captures/${name}`, path: `sites/${name}` };
}

/** The `want` string `bringRepoIn` reads: the repository at the capture's branch (the one it landed on, when known). */
export function captureWant(repo: CaptureRepo, name: string, ref?: string): string {
  return `${repo.owner}/${repo.name}@${ref || capturePlace(name).ref}`;
}

/*
 * A CAPTURE STARTS ON A BRANCH OF ITS OWN.
 *
 * The dialog's advanced defaults ran the workflow on the capturer's default
 * branch, sink's main, and a workflow that commits to the branch it runs on
 * changed main with nobody asked. So the capture runs on a new branch made
 * for it, `capture/<name>-<date>`, cut from the default branch (where the
 * workflow lives), and main changes only when someone types it on purpose,
 * with the owner's say-so (`CaptureSiteDialog.tsx`).
 */
export function captureBranch(name: string, now = new Date()): string {
  return `capture/${captureName(name) ?? "site"}-${now.toISOString().slice(0, 10)}`;
}

/** Whether a branch is one the owner has to agree to changing: the default one, or main or master by name. */
export function isMainBranch(ref: string, defaultBranch?: string | null): boolean {
  const r = ref.trim().toLowerCase();
  return !r || r === "main" || r === "master" || (!!defaultBranch && r === defaultBranch.toLowerCase());
}

const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

export type Started = { ok: true; runId: number; htmlUrl: string; name: string; /** The branch the workflow ran on. */ ref?: string; /** Set when this call made that branch. */ madeBranch?: boolean } | { ok: false; says: string; status?: number };

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
    return `${full} has no ${WORKFLOW} workflow on ${o.ref}. Merge the branch that adds it first, or name the branch it is on under advanced.`;
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
export async function startCapture(o: { repo: CaptureRepo; token: string; url: string; name: string; pages: string; ref?: string; learn?: unknown;
  /** Look only, no presses: the pages as they open (polio's workflow's `look` input). Sent only when on, so a capturer without the input is asked as before. */
  look?: boolean; findEveryMs?: number; findTries?: number;
  /** Make `ref` first, from the default branch, when it is not there: the capture's own branch. Never main. */
  makeBranch?: boolean } & Pipes): Promise<Started> {
  const f = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let address: URL;
  try { address = new URL(oneAddress(o.url).url); if (!/^https?:$/.test(address.protocol)) throw new Error(); } catch { return { ok: false, says: "That is not an address. It wants to start with https://." }; }
  const name = captureName(o.name) ?? nameFrom(address.href);
  if (!name) return { ok: false, says: "Name the site: letters, digits and dashes." };
  if (!o.token) return { ok: false, says: "No GitHub token in this browser yet. Open Keys and put one in; the capture runs in your own repository with it." };
  const base = `${API}/repos/${o.repo.owner}/${o.repo.name}`;
  const h = headers(o.token);
  let ref = o.ref?.trim() || "";
  try {
    let made = false;
    if (!ref || o.makeBranch) {
      const r = await f(base, { headers: h });
      if (!r.ok) return { ok: false, says: r.status === 404 ? `${o.repo.owner}/${o.repo.name} is not a repository the token can see.` : `GitHub answered ${r.status} when asked about ${o.repo.owner}/${o.repo.name}.` };
      const main = ((await r.json()) as { default_branch?: string }).default_branch ?? "main";
      if (!ref) ref = main;
      else if (!isMainBranch(ref, main)) {
        /* The capture's own branch, cut from the default branch's tip. One that is already there (a second capture today) is used as it is. */
        const tip = await f(`${base}/git/ref/heads/${main.split("/").map(encodeURIComponent).join("/")}`, { headers: h });
        if (!tip.ok) return { ok: false, status: tip.status, says: `GitHub would not say where ${main} is on ${o.repo.owner}/${o.repo.name} (${tip.status}), so no branch was made for the capture.` };
        const sha = ((await tip.json()) as { object?: { sha?: string } }).object?.sha;
        const mk = await f(`${base}/git/refs`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${ref}`, sha }) });
        if (mk.ok) made = true;
        else if (mk.status !== 422) return { ok: false, status: mk.status, says: mk.status === 403 || mk.status === 404 ? `This GitHub key may not make the branch ${ref} on ${o.repo.owner}/${o.repo.name}: it needs Contents: Read and write there.` : `GitHub would not make the branch ${ref} (${mk.status}).` };
      }
    }
    const since = Date.now() - 5_000;
    const d = await f(`${base}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST", headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ ref, inputs: { url: address.href.replace(/\/$/, ""), name, pages: o.pages.trim() || "/", ...(o.learn ? { learn: JSON.stringify(o.learn) } : {}), ...(o.look ? { look: "true" } : {}) } }),
    });
    if (!d.ok) return { ok: false, status: d.status, says: await refusal(d, { f, base, h, repo: o.repo, ref, url: address.href, name }) };
    for (let tries = 0; tries < (o.findTries ?? 10); tries++) {
      const r = await f(`${base}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=5`, { headers: h, cache: "no-store" } as RequestInit);
      if (r.ok) {
        const runs = ((await r.json()) as { workflow_runs?: { id: number; html_url: string; created_at: string }[] }).workflow_runs ?? [];
        const mine = runs.find((run) => Date.parse(run.created_at) >= since);
        if (mine) return { ok: true, runId: mine.id, htmlUrl: mine.html_url, name, ref, ...(made ? { madeBranch: true } : {}) };
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
export async function watchCapture(o: { repo: CaptureRepo; token: string; runId: number; name: string; onProgress: (p: Progress) => void; everyMs?: number;
  /** The branch the run was started on: asked first for the site, since a workflow may commit to the branch it runs on. */
  ranOn?: string } & Pipes): Promise<Ended> {
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
  if (run.conclusion === "success") return { done: true, ok: true, ...(await landedOn(o)), htmlUrl };
  return { done: true, ok: false, says: `The capture failed (${run.conclusion ?? "no conclusion"}). Its log says why.`, htmlUrl };
}

/**
 * Where the finished capture actually is: the run's own artifact when it
 * handed one back (polio's workflow), else on the branch it ran on when the
 * site is there, else the workflow's `captures/<name>`.
 */
async function landedOn(o: { repo: CaptureRepo; token: string; name: string; runId: number; ranOn?: string } & Pipes): Promise<{ ref: string; path: string }> {
  const place = capturePlace(o.name);
  try {
    const art = await findArtifact({ repo: o.repo, token: o.token, runId: o.runId, name: o.name, fetch: o.fetch });
    if (art && !art.expired) return { ref: runRef(o.runId), path: place.path };
  } catch { /* asked below */ }
  if (!o.ranOn || o.ranOn === place.ref) return place;
  const f = o.fetch ?? fetch;
  try {
    const r = await f(`${API}/repos/${o.repo.owner}/${o.repo.name}/contents/${place.path}?ref=${encodeURIComponent(o.ranOn)}`, { headers: headers(o.token), cache: "no-store" } as RequestInit);
    if (r.ok) return { ref: o.ranOn, path: place.path };
  } catch { /* asked below */ }
  return place;
}

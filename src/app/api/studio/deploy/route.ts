import { NextResponse } from "next/server";
import { findVercelProject, type VercelProject } from "@/features/studio/vercelProjects";
import { CaptureUnknown, holdsCapture, sourceAmong } from "../publish/capture";

/**
 * Live, and the address back.
 *
 * Pushing to GitHub is half a publish: a connected Vercel project deploys on
 * its own afterwards, silently, and the Builder never learns where the site
 * ended up. This is the other half — one call that asks Vercel to build the
 * repository's current branch, and a second that waits for it and hands back
 * the address people will actually type.
 *
 * The token can come from either side, like the Claude key: the server's
 * `VERCEL_TOKEN` if it has one, or the browser's keys panel as `x-vercel-token`.
 * The server's wins. It is used for these calls and nothing else, is never
 * written down, and never comes back in an answer.
 *
 * The deploy hook in `/api/studio/publish` stays what it was: a poke for a
 * project that is not connected to the repository. A hook answers with
 * nothing you can open, which is why it is not this.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/*
 * Vercel, or something standing in for it. `VERCEL_API` is unset everywhere
 * but a test run, where it points at a stub, as `GITHUB_API` does for the
 * publish route (`tests/live-link.mjs`).
 */
const API = process.env.VERCEL_API?.replace(/\/$/, "") || "https://api.vercel.com";
const REPO = /^[\w.-]+\/[\w.-]+$/;

/**
 * A team's things are not the account's, so every call names the team when
 * there is one, the way Vercel reads it: a `team_` id as `?teamId=`, and a
 * slug as `?slug=`. Either sent as the other names no team at all, and Vercel
 * answers 403 (`tests/go-live-refused.mjs`).
 */
function query(team: string | null, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (team) p.set(/^team_/.test(team) ? "teamId" : "slug", team);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function token(request: Request): { token: string | null; source: "server" | "browser" | null } {
  const own = process.env.VERCEL_TOKEN?.trim();
  if (own) return { token: own, source: "server" };
  const supplied = request.headers.get("x-vercel-token")?.trim();
  return supplied && supplied.length > 8 ? { token: supplied, source: "browser" } : { token: null, source: null };
}


/** What Vercel says when it refuses: its words, its code, and for a limit, when it resets. */
type VercelError = { message?: string; code?: string; limit?: { reset?: number; resetMs?: number } };

async function vercel<T>(tok: string, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: VercelError }; reset?: number }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${tok}`, ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: VercelError };
  /* A limit's reset, from the body where Vercel puts it or its header, so the Builder can say when it lifts. */
  const header = Number(res.headers.get("x-ratelimit-reset"));
  const reset = data.error?.limit?.resetMs ?? data.error?.limit?.reset ?? (header > 0 ? header : undefined);
  return { ok: res.ok, status: res.status, data, ...(reset ? { reset } : {}) };
}

/** A refusal passed on whole: the words for the details fold, and the code and reset the Builder turns into plain words (`publishWords.ts`). */
const refusalOf = (r: { status: number; data: { error?: VercelError }; reset?: number }) => ({
  status: r.status,
  ...(r.data.error?.code ? { code: r.data.error.code } : {}),
  ...(r.reset ? { reset: r.reset } : {}),
});

/**
 * The project connected to this repository, or the one named.
 *
 * A token Vercel turns down and an account with no such project are two
 * different problems with two different answers, so the lookup failing is
 * never folded into "not found": being told to go and connect a project when
 * the real trouble is a stale token sends someone the wrong way entirely.
 */
type Lookup =
  | { found: VercelProject }
  | { found: null; refused?: { reason: string; message: string; hint?: string } };

async function findProject(tok: string, team: string | null, repo: string, named: string | null): Promise<Lookup> {
  const [owner, name] = repo.split("/");
  // A page at a time, following `pagination.next` as `until`: one page of a
  // hundred was all this read, and an account past that was told to go and
  // import a project it already had.
  let refused: { reason: string; message: string; hint?: string } | undefined;
  const page = async (until: string | null) => {
    const { ok, status, data } = await vercel<{ projects?: VercelProject[]; pagination?: { next?: number | string | null } }>(
      tok,
      `/v9/projects${query(team, { limit: "100", ...(until ? { until } : {}) })}`,
    );
    if (status === 401 || status === 403) {
      refused = {
        reason: "auth",
        message: `Vercel would not accept the token${team ? ` for ${team}` : ""}. Vercel said: ${data.error?.message ?? `${status}`}`,
        hint: `Check the token is copied whole, has not expired, and its scope includes ${team ?? "your account"} (Vercel → Account Settings → Tokens).`,
      };
      return { projects: [], next: null };
    }
    if (!ok || !Array.isArray(data.projects)) {
      refused = { reason: "vercel", message: data.error?.message ?? `Vercel answered ${status} when asked for your projects.` };
      return { projects: [], next: null };
    }
    return { projects: data.projects, next: data.pagination?.next ?? null };
  };
  const hit = await findVercelProject(page, (p) =>
    named
      ? p.name === named || p.id === named
      : p.link?.type === "github" && p.link.org?.toLowerCase() === owner?.toLowerCase() && p.link.repo?.toLowerCase() === name?.toLowerCase(),
  );
  if (refused) return { found: null, refused };
  return hit ? { found: hit } : { found: null };
}

/** How long this call waits for a push's own deployment to appear before handing the wait to the poll. */
const PUSH_WAIT_MS = 20_000;
/** How long the poll waits for a Git-connected project to start the push's deployment before it says why it may not. */
const GIT_START_MS = 5 * 60_000;

type Listed = { uid?: string; id?: string; url?: string; readyState?: string; state?: string; inspectorUrl?: string; created?: number; createdAt?: number; meta?: { githubCommitSha?: string; githubCommitRef?: string } };

/**
 * The deployment Vercel's Git integration made of a push: by its commit when
 * the push says which (a short sha matches its start), else the newest of the
 * branch made since the push. Any target: a branch that is not the project's
 * production branch deploys as a preview. Null while there is none yet;
 * `listed: false` when Vercel would not give the list.
 */
async function pushDeployment(tok: string, team: string | null, projectId: string, sha: string | null, branch: string, since: number): Promise<{ listed: boolean; own: Listed | null }> {
  const { ok, data } = await vercel<{ deployments?: Listed[] }>(tok, `/v6/deployments${query(team, { projectId, limit: "20" })}`);
  if (!ok) return { listed: false, own: null };
  const list = data.deployments ?? [];
  const own = sha
    ? list.find((d) => { const c = d.meta?.githubCommitSha?.toLowerCase(); return !!c && (c === sha.toLowerCase() || c.startsWith(sha.toLowerCase())); })
    : list.filter((d) => d.meta?.githubCommitRef === branch && (d.created ?? d.createdAt ?? 0) >= since - 5_000).sort((a, b) => (b.created ?? b.createdAt ?? 0) - (a.created ?? a.createdAt ?? 0))[0];
  return { listed: true, own: own && (own.uid ?? own.id) ? own : null };
}

/*
 * A PUSH NOT YET DEPLOYED IS FOLLOWED BY ITS COMMIT. When a Git-connected
 * project has not started the push's deployment by the time this call
 * answers, the Builder is handed this in place of a deployment's id and
 * polls it like one (`GET ?id=`): the deployment, once Vercel has made it.
 */
const COMMIT = /^commit:([\w-]+):([0-9a-f]{0,40}):([^:]*):(\d+)$/i;
const commitHandle = (projectId: string, sha: string | null, branch: string, since: number) => `commit:${projectId}:${sha ?? ""}:${encodeURIComponent(branch)}:${since}`;

/** What Publish sends is static HTML: nothing to detect, build or install, served from the root. */
const STATIC_SITE = { framework: null, buildCommand: null, installCommand: null, outputDirectory: null };

/** A Vercel project name made from whatever the site is called: lowercase letters, digits, `.`, `_` and `-`. */
function projectName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const s = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-{3,}/g, "--").replace(/^[-._]+|[-._]+$/g, "").slice(0, 90);
  return s && /[a-z0-9]/.test(s) ? s : null;
}

/*
 * A NEW REPOSITORY, CONNECTED ON ITS FIRST GO LIVE.
 *
 * Publish makes a site its own repository, and nobody can import that by
 * hand before its first Go live, so "no project is connected" was the answer
 * every new site got. A project is made here instead, connected to the
 * repository (Vercel's create-project with `gitRepository`) and named after
 * the site, so every later push deploys on its own.
 *
 * Every way it can fail is said: a name Vercel already has gets a suffix, as
 * a repository name does, and the answer says so; Vercel's GitHub app not
 * seeing the repository is said with how to grant it; a token Vercel turns
 * down is said as that.
 */
type Made = { project: VercelProject; note: string | null } | { refused: { reason: string; message: string; hint?: string } };

const githubAccess = (repo: string, said: string) => {
  const owner = repo.split("/")[0];
  return `Vercel's GitHub app cannot see ${repo}, so no Vercel project could be connected to it. To let it: on GitHub open Settings, then Applications, then Vercel's Configure (github.com/settings/installations, or ${owner}'s own organization settings if it is an organization), and under Repository access choose All repositories or add ${repo}. If Vercel is not installed there at all, install it from github.com/apps/vercel. Then press Go live again. Vercel said: ${said}`;
};

async function makeProject(tok: string, team: string | null, repo: string, wanted: string): Promise<Made> {
  let clash: string | null = null;
  for (let i = 0; i < 10; i++) {
    const name = i ? `${wanted}-${i}` : wanted;
    const { ok, status, data } = await vercel<VercelProject & { error?: { code?: string; message?: string } }>(
      tok,
      `/v11/projects${query(team)}`,
      /* The project holds the static-site settings itself, not only the first
         deployment request: every later build is Vercel's own Git build of a
         push, which reads what the project stores (the check of 30 September:
         the direct deploy passed these per request and nothing kept them). */
      { method: "POST", body: JSON.stringify({ name, gitRepository: { type: "github", repo }, ...STATIC_SITE }) },
    );
    if (ok && data.id) {
      const note = clash ? `Vercel already has a project named ${clash}, so this one is ${name}.` : null;
      return { project: data, note };
    }
    const said = data.error?.message ?? `Vercel answered ${status}.`;
    const code = data.error?.code ?? "";
    if (status === 409 || /conflict|exist/i.test(code) || /already exists/i.test(said)) { clash ??= name; continue; }
    if (/github|git repository|repositor|integration|install/i.test(`${code} ${said}`) && status !== 401) {
      return { refused: { reason: "github-access", message: githubAccess(repo, said) } };
    }
    if (status === 401 || status === 403) {
      /* The same token has just listed this scope's projects, so it is
         valid and can see the scope: what is left is where it was asked to
         make one, and whether Vercel may connect the repository. */
      return {
        refused: {
          reason: "auth",
          message: `Vercel would not let this token make a project${team ? ` under ${team}` : ""}. Vercel said: ${said}`,
          hint: team
            ? `Likely fix: let Vercel's GitHub app see ${repo} (GitHub → Settings → Applications → Vercel → Repository access), or give the token a scope that includes ${team}.`
            : "Likely fix: no team was named, so Vercel was asked to make it in your personal scope; put your team's slug or team_ id in the Vercel Team field of the keys panel (Ctrl+Shift+K).",
        },
      };
    }
    return { refused: { reason: "vercel", message: `Vercel would not make a project for ${repo}. Vercel said: ${said}` } };
  }
  return { refused: { reason: "name-taken", message: `Vercel already has projects named every name from ${wanted} to ${wanted}-9. Rename the site and press Go live again.` } };
}

/**
 * What a deployment is reachable at.
 *
 * `url` is the deployment's own host, which is unique to the build and always
 * works. An alias is the address the site is meant to be known by, and the
 * shortest of them is the production domain rather than one of the long
 * branch-and-hash forms, so that is preferred when the build has aliases.
 */
function liveUrl(d: { url?: string; alias?: string[] }): string | null {
  const alias = (d.alias ?? []).filter(Boolean).sort((a, b) => a.length - b.length)[0];
  const host = alias ?? d.url;
  return host ? `https://${host}` : null;
}

/*
 * THE ADDRESS BEFORE THE PUSH. A link preview needs the address the site is
 * published at (og:url, og:image as full addresses), and one press is one
 * deployment (tests/go-live-once.mjs), so it is asked for before anything
 * is pushed: the project connected to the repository, and its production
 * domain from Vercel's project domains (not a redirect, not a branch's),
 * the shortest as `liveUrl` prefers. Nothing is made and nothing deployed;
 * a repository with no project yet has no address, and says so.
 */
async function productionAddress(tok: string | null, repo: string, team: string | null, sources: string[]): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!tok) return { ok: false, reason: "no-token" };
  if (!REPO.test(repo) || sourceAmong(repo, sources)) return { ok: false, reason: "no-repo" };
  try {
    const lookup = await findProject(tok, team, repo, null);
    if (!lookup.found) return { ok: false, reason: lookup.refused?.reason ?? "no-project" };
    const { ok, data } = await vercel<{ domains?: { name?: string; redirect?: string | null; gitBranch?: string | null }[] }>(tok, `/v9/projects/${encodeURIComponent(lookup.found.id)}/domains${query(team)}`);
    const names = ok ? (data.domains ?? []).filter((d) => d.name && !d.redirect && !d.gitBranch).map((d) => d.name as string) : [];
    const host = names.sort((a, b) => a.length - b.length)[0];
    return host ? { ok: true, url: `https://${host}` } : { ok: false, reason: "no-domain" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** GET with no id says whether this can deploy at all; with one, how a deployment is getting on; with `address`, where a repository's project is published. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const { token: tok, source } = token(request);

  const addressOf = url.searchParams.get("address");
  if (addressOf !== null) return NextResponse.json(await productionAddress(tok, addressOf, url.searchParams.get("team")?.trim() || null, url.searchParams.getAll("source")));
  if (!id) {
    return NextResponse.json({ configured: !!tok, source, repo: process.env.GITHUB_REPO?.trim() ?? null, hook: !!process.env.VERCEL_DEPLOY_HOOK?.trim() });
  }
  if (!tok) return NextResponse.json({ ok: false, reason: "no-token", message: "No Vercel token, on the server or in this browser." });

  const team = url.searchParams.get("team")?.trim() || null;
  /* A push followed by its commit: its deployment once Vercel has made one, else still waiting, and after a while, why it may not come. */
  let depId = id;
  const byCommit = COMMIT.exec(id);
  if (byCommit) {
    const [, projectId, sha, branch, since] = byCommit;
    const { listed, own } = await pushDeployment(tok, team, projectId!, sha || null, decodeURIComponent(branch!), Number(since));
    if (!own) {
      const late = Date.now() - Number(since) > GIT_START_MS;
      return NextResponse.json({
        ok: true,
        state: late ? "NOT_STARTED" : null,
        done: late,
        ...(late ? { reason: "not-started" } : {}),
        url: null,
        inspectorUrl: null,
        message: late
          ? `Vercel has not started a deployment of ${sha ? sha.slice(0, 7) : "the push"} in ${GIT_START_MS / 60_000} minutes. Its project deploys every push to the repository by itself, so none was asked for here: its Git deployments may be rate limited (the Hobby plan allows 100 deployments a day) or switched off for this branch. The next push deploys once Vercel allows it; the project's Deployments page on Vercel says why.`
          : listed ? "Waiting for Vercel to start the build of the push." : "Vercel would not list the project's deployments just now; asking again.",
      });
    }
    depId = (own.uid ?? own.id)!;
  }
  const { ok, status, data } = await vercel<{ readyState?: string; url?: string; alias?: string[]; inspectorUrl?: string; errorMessage?: string }>(
    tok,
    `/v13/deployments/${encodeURIComponent(depId)}${query(team)}`,
  );
  if (!ok) {
    return NextResponse.json({ ok: false, reason: "vercel", status, ...(data.error?.code ? { code: data.error.code } : {}), message: data.error?.message ?? `Vercel answered ${status}.` });
  }
  // A deployment Vercel has not put a state on is reported as none, not
  // as "QUEUED": the two are told apart in the dialog.
  const state = data.readyState ?? null;
  return NextResponse.json({
    ok: true,
    state,
    done: state === "READY" || state === "ERROR" || state === "CANCELED",
    url: liveUrl(data),
    inspectorUrl: data.inspectorUrl ?? null,
    message: state === "ERROR" ? (data.errorMessage ?? "The build failed. The Vercel log says why.") : undefined,
  });
}

export async function POST(request: Request) {
  const { token: tok } = token(request);
  if (!tok) {
    return NextResponse.json({
      ok: false,
      reason: "no-token",
      message: "No Vercel token. Put one in the keys panel (⌘⇧K) or set VERCEL_TOKEN on the server, and this can put the site live.",
      hint: "Put the Vercel token in the keys panel, Ctrl+Shift+K.",
    });
  }

  let body: { repo?: unknown; branch?: unknown; project?: unknown; team?: unknown; name?: unknown; sources?: unknown; sha?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const repo = (typeof body.repo === "string" && body.repo.trim()) || process.env.GITHUB_REPO?.trim() || "";
  if (!REPO.test(repo)) {
    return NextResponse.json({ ok: false, reason: "no-repo", message: "Nowhere to deploy from: name the repository on the Builds page, or set GITHUB_REPO on the server." });
  }
  const askedBranch = (typeof body.branch === "string" && body.branch.trim()) || process.env.GITHUB_BRANCH?.trim() || null;
  // Nobody named a branch: main is assumed, and the answer says so.
  const branch = askedBranch ?? "main";
  const team = (typeof body.team === "string" && body.team.trim()) || process.env.VERCEL_TEAM?.trim() || null;
  /* The server's VERCEL_PROJECT is for a request that names no repository,
     the server's own. A site that names its repository is deployed from the
     project connected to that repository, and never from one the server
     happens to name. */
  const repoNamed = typeof body.repo === "string" && !!body.repo.trim();
  const named = (typeof body.project === "string" && body.project.trim()) || (repoNamed ? null : process.env.VERCEL_PROJECT?.trim()) || null;

  /* NEVER INTO WHERE A SITE CAME FROM: the same rule as Publish. */
  const fromHere = sourceAmong(repo, body.sources);
  if (fromHere) {
    return NextResponse.json({ ok: false, reason: "source", repo: fromHere, message: `${fromHere} is where a site here was brought in from, and Go live never connects Vercel to that. This site goes live from a repository of its own.` });
  }

  let lookup: Lookup;
  try {
    lookup = await findProject(tok, team, repo, named);
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "network", message: `The server could not reach Vercel${err instanceof Error ? ` (${err.message})` : ""}.` });
  }
  if (!lookup.found && lookup.refused) return NextResponse.json({ ok: false, ...lookup.refused });
  if (!lookup.found && named) {
    return NextResponse.json({ ok: false, reason: "no-project", message: `There is no Vercel project named ${named}${team ? ` under ${team}` : ""}.` });
  }
  /* A project asked for by name deploys only the repository it is connected to. */
  const link = lookup.found?.link;
  if (lookup.found && named && link?.type === "github" && link.org && link.repo && `${link.org}/${link.repo}`.toLowerCase() !== repo.toLowerCase()) {
    return NextResponse.json({ ok: false, reason: "elsewhere", message: `The Vercel project ${lookup.found.name} is connected to ${link.org}/${link.repo}, not to ${repo}, so it was not built from ${repo}.` });
  }

  let project: VercelProject;
  let made: string | null = null;
  let note: string | null = null;
  if (lookup.found) {
    project = lookup.found;
  } else {
    /* Connecting is the step the rule is about: nothing is connected to a
       capture repository, and it is looked for before anything is made. */
    const ghToken = request.headers.get("x-github-token")?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
    if (ghToken.length <= 8) {
      return NextResponse.json({ ok: false, reason: "no-github", message: `No GitHub token to check that ${repo} is not a capture repository, so no Vercel project was connected to it. Put one in the keys panel.` });
    }
    try {
      if (await holdsCapture(ghToken, repo, branch)) {
        return NextResponse.json({ ok: false, reason: "capture", repo, message: `${repo} holds a capture (site/capture/), and Go live never connects Vercel to a capture repository. This site goes live from a repository of its own.` });
      }
    } catch (error) {
      const why = error instanceof CaptureUnknown ? error.message : "GitHub could not be reached";
      return NextResponse.json({ ok: false, reason: "capture-unknown", repo, message: `Could not tell whether ${repo} holds a capture (${why}), so no Vercel project was connected to it.` });
    }
    const wanted = projectName(body.name) ?? projectName(repo.split("/")[1]) ?? "site";
    let got: Made;
    try {
      got = await makeProject(tok, team, repo, wanted);
    } catch (err) {
      return NextResponse.json({ ok: false, reason: "network", message: `The server could not reach Vercel${err instanceof Error ? ` (${err.message})` : ""}.` });
    }
    if ("refused" in got) return NextResponse.json({ ok: false, ...got.refused });
    project = got.project;
    made = project.name;
    note = got.note;
  }

  /*
   * OPEN TO EVERYONE (J, 2026-10-10: "the published sites should not be
   * locked"). Vercel makes a new project behind its own sign-in ("Vercel
   * Authentication", on for every address but a custom domain), so the
   * site's own vercel.app address showed a Vercel login page to anyone but
   * J. A published site is for visitors: the lock is taken off the project,
   * and a project that cannot be opened says so rather than failing the build.
   */
  const locked = (project as VercelProject & { ssoProtection?: unknown; passwordProtection?: { enabled?: boolean } | null });
  if (locked.ssoProtection !== null || locked.passwordProtection?.enabled) {
    try {
      const open = await vercel(tok, `/v9/projects/${encodeURIComponent(project.id)}${query(team)}`, { method: "PATCH", body: JSON.stringify({ ssoProtection: null, passwordProtection: null }) });
      if (!open.ok) note = [note, `The site is still behind Vercel's sign-in: Vercel would not open it (${open.data.error?.message ?? open.status}). In Vercel, open the project's Settings, then Deployment Protection, and turn Vercel Authentication off.`].filter(Boolean).join(" ");
    } catch {
      note = [note, "The site may still be behind Vercel's sign-in: Vercel could not be reached to open it."].filter(Boolean).join(" ");
    }
  }

  const [org, name] = repo.split("/");
  // repoId is what v13 wants when it has one; org and repo are accepted too,
  // and are the only thing to go on for a project linked before repoId was
  // recorded. Both are sent, so neither case needs a second round trip.
  /* The commit the push just made, when the caller says: that one is built, not whatever the branch holds by then. */
  const sha = typeof body.sha === "string" && /^[0-9a-f]{7,40}$/i.test(body.sha.trim()) ? body.sha.trim() : null;
  const gitSource = {
    type: "github",
    ref: branch,
    ...(sha ? { sha } : {}),
    ...(project.link?.repoId ? { repoId: project.link.repoId } : {}),
    org,
    repo: name,
  };

  /*
   * ONE PRESS, ONE DEPLOYMENT, AND NONE ASKED FOR WHEN THE PUSH MAKES ONE.
   *
   * A project connected to the repository (its `link`, as Vercel lists it)
   * deploys every push by itself: that is Vercel's Git integration. Asking
   * for a deployment as well built the same commit twice (`tests/go-live-
   * once.mjs`), and on the owner's Hobby plan spent two of the day's hundred
   * deployments a press: 8627a05's own Git deployment came back "Deployment
   * rate limited". So for a connected project the deploy API is never
   * called. The push's own deployment is found by its commit and followed to
   * READY; when it has not appeared by the time this answers, the Builder is
   * handed the commit to poll (`commitHandle`), and told plainly if Vercel
   * never starts one (`GET`, GIT_START_MS). Rate limited or not, a second
   * deployment would only be refused the same way.
   *
   * A project this call made was not there when the push landed, so nothing
   * deployed it: one is asked for, as for a project not connected to the
   * repository (`tests/go-live-linked.mjs`).
   */
  /* Only a push to the branch Vercel builds to production deploys the live
     site by itself; a push to any other branch makes a preview, behind a
     sign-in, and following it would record a preview as the live address.
     So a site that publishes to another branch still asks for a production
     deployment of that branch, as the direct deploy always did. */
  const productionBranch = project.link?.productionBranch ?? "main";
  const linked = !made && project.link?.type === "github" && !!project.link.org && !!project.link.repo && `${project.link.org}/${project.link.repo}`.toLowerCase() === repo.toLowerCase()
    && branch.toLowerCase() === productionBranch.toLowerCase();
  if (linked) {
    const since = Date.now();
    const until = since + PUSH_WAIT_MS;
    for (;;) {
      const { listed, own } = await pushDeployment(tok, team, project.id, sha, branch, since);
      if (own) {
        return NextResponse.json({
          ok: true,
          id: own.uid ?? own.id,
          project: project.name,
          repo,
          branch,
          ...(askedBranch ? {} : { assumed: true }),
          team,
          state: own.readyState ?? own.state ?? null,
          url: own.url ? `https://${own.url}` : null,
          inspectorUrl: own.inspectorUrl ?? null,
          /* Started by the push, not by this call. */
          followed: true,
        });
      }
      if (!listed || Date.now() >= until) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return NextResponse.json({
      ok: true,
      id: commitHandle(project.id, sha, branch, since),
      project: project.name,
      repo,
      branch,
      ...(askedBranch ? {} : { assumed: true }),
      team,
      state: null,
      url: null,
      inspectorUrl: null,
      followed: true,
      waiting: true,
    });
  }

  /*
   * A NEW PROJECT'S FIRST DEPLOYMENT SAYS WHAT IT IS BUILDING.
   *
   * Vercel refuses the first deployment of a project that has none with a
   * 400, "The `projectSettings` object is required for new projects", which
   * is what the first real Go live got. What Publish sends is static HTML
   * (an index.html and a folder per page, assets/, site/), so the settings
   * say so: no framework, no build, no install, and the output directory
   * left to Vercel's default, the root when there is no public/ folder.
   *
   * A project made by this call is new, so it gets them at once. One found
   * connected is tried as it is, so a project with a framework of its own
   * keeps it, and given them only when Vercel says it needs them: a project
   * an earlier press made and never deployed, which is reused, never
   * replaced (`tests/go-live-first-deploy.mjs`).
   */
  const start = (settings: boolean) => vercel<{ id?: string; url?: string; alias?: string[]; inspectorUrl?: string; readyState?: string }>(
    tok,
    `/v13/deployments${query(team, { forceNew: "1" })}`,
    { method: "POST", body: JSON.stringify({ name: project.name, project: project.id, target: "production", gitSource, ...(settings ? { projectSettings: STATIC_SITE } : {}) }) },
  );
  let started = await start(!!made);
  if (!made && !started.ok && started.status === 400 && /projectSettings/.test(started.data.error?.message ?? "")) started = await start(true);
  const { ok, status, data } = started;
  if (!ok || !data.id) {
    return NextResponse.json({
      ok: false,
      reason: "vercel",
      ...refusalOf(started),
      message: data.error?.message ?? `Vercel would not start the build (${status}).`,
    });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    project: project.name,
    repo,
    branch,
    ...(askedBranch ? {} : { assumed: true }),
    team,
    state: data.readyState ?? null,
    /* Set only when this call made the project, and what it had to say about it. */
    ...(made ? { created: made } : {}),
    ...(note ? { note } : {}),
    // The build's own address, live the moment it is ready; the production
    // alias replaces it in the poll once Vercel has assigned one.
    url: liveUrl(data),
    inspectorUrl: data.inspectorUrl ?? null,
  });
}

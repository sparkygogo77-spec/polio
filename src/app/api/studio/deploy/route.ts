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


async function vercel<T>(tok: string, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: { message?: string } } }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${tok}`, ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  return { ok: res.ok, status: res.status, data };
}

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
      { method: "POST", body: JSON.stringify({ name, gitRepository: { type: "github", repo } }) },
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

/** GET with no id says whether this can deploy at all; with one, how a deployment is getting on. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const { token: tok, source } = token(request);

  if (!id) {
    return NextResponse.json({ configured: !!tok, source, repo: process.env.GITHUB_REPO?.trim() ?? null, hook: !!process.env.VERCEL_DEPLOY_HOOK?.trim() });
  }
  if (!tok) return NextResponse.json({ ok: false, reason: "no-token", message: "No Vercel token, on the server or in this browser." });

  const team = url.searchParams.get("team")?.trim() || null;
  const { ok, status, data } = await vercel<{ readyState?: string; url?: string; alias?: string[]; inspectorUrl?: string; errorMessage?: string }>(
    tok,
    `/v13/deployments/${encodeURIComponent(id)}${query(team)}`,
  );
  if (!ok) {
    return NextResponse.json({ ok: false, reason: "vercel", message: data.error?.message ?? `Vercel answered ${status}.` });
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

  let body: { repo?: unknown; branch?: unknown; project?: unknown; team?: unknown; name?: unknown; sources?: unknown };
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

  const [org, name] = repo.split("/");
  // repoId is what v13 wants when it has one; org and repo are accepted too,
  // and are the only thing to go on for a project linked before repoId was
  // recorded. Both are sent, so neither case needs a second round trip.
  const gitSource = {
    type: "github",
    ref: branch,
    ...(project.link?.repoId ? { repoId: project.link.repoId } : {}),
    org,
    repo: name,
  };

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
      status,
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

import { NextResponse } from "next/server";

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
 * `VERCEL_TOKEN` if it has one, or the browser's vault as `x-vercel-token`.
 * The server's wins. It is used for these calls and nothing else, is never
 * written down, and never comes back in an answer.
 *
 * The deploy hook in `/api/studio/publish` stays what it was: a poke for a
 * project that is not connected to the repository. A hook answers with
 * nothing you can open, which is why it is not this.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const API = "https://api.vercel.com";
const REPO = /^[\w.-]+\/[\w.-]+$/;

/** A team's things are not the account's, so every call carries the slug when there is one. */
function query(team: string | null, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  if (team) p.set("slug", team);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function token(request: Request): { token: string | null; source: "server" | "browser" | null } {
  const own = process.env.VERCEL_TOKEN?.trim();
  if (own) return { token: own, source: "server" };
  const supplied = request.headers.get("x-vercel-token")?.trim();
  return supplied && supplied.length > 8 ? { token: supplied, source: "browser" } : { token: null, source: null };
}

interface VercelProject {
  id: string;
  name: string;
  link?: { type?: string; org?: string; repo?: string; repoId?: number };
  targets?: { production?: { alias?: string[] } };
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
  | { found: null; refused?: { reason: string; message: string } };

async function findProject(tok: string, team: string | null, repo: string, named: string | null): Promise<Lookup> {
  const [owner, name] = repo.split("/");
  const { ok, status, data } = await vercel<{ projects?: VercelProject[] }>(tok, `/v9/projects${query(team, { limit: "100" })}`);
  if (status === 401 || status === 403) {
    return { found: null, refused: { reason: "auth", message: `Vercel would not accept the token${team ? ` for ${team}` : ""}. Check it is copied whole, has not expired, and can see that team.` } };
  }
  if (!ok || !Array.isArray(data.projects)) {
    return { found: null, refused: { reason: "vercel", message: data.error?.message ?? `Vercel answered ${status} when asked for your projects.` } };
  }
  const hit = named
    ? data.projects.find((p) => p.name === named || p.id === named)
    : data.projects.find(
        (p) => p.link?.type === "github" && p.link.org?.toLowerCase() === owner?.toLowerCase() && p.link.repo?.toLowerCase() === name?.toLowerCase(),
      );
  return hit ? { found: hit } : { found: null };
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
  const state = data.readyState ?? "QUEUED";
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
      message: "No Vercel token. Put one in the vault (⌘⇧K) or set VERCEL_TOKEN on the server, and this can put the site live.",
    });
  }

  let body: { repo?: unknown; branch?: unknown; project?: unknown; team?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const repo = (typeof body.repo === "string" && body.repo.trim()) || process.env.GITHUB_REPO?.trim() || "";
  if (!REPO.test(repo)) {
    return NextResponse.json({ ok: false, reason: "no-repo", message: "Nowhere to deploy from: name the repository on the Builds page, or set GITHUB_REPO on the server." });
  }
  const branch = (typeof body.branch === "string" && body.branch.trim()) || process.env.GITHUB_BRANCH?.trim() || "main";
  const team = (typeof body.team === "string" && body.team.trim()) || process.env.VERCEL_TEAM?.trim() || null;
  const named = (typeof body.project === "string" && body.project.trim()) || process.env.VERCEL_PROJECT?.trim() || null;

  let lookup: Lookup;
  try {
    lookup = await findProject(tok, team, repo, named);
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "network", message: `The server could not reach Vercel${err instanceof Error ? ` (${err.message})` : ""}.` });
  }
  if (!lookup.found) {
    if (lookup.refused) return NextResponse.json({ ok: false, ...lookup.refused });
    return NextResponse.json({
      ok: false,
      reason: "no-project",
      message: `No Vercel project is connected to ${repo}${team ? ` under ${team}` : ""}. Import it once at vercel.com/new and this button works from then on.`,
    });
  }
  const project = lookup.found;

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

  const { ok, status, data } = await vercel<{ id?: string; url?: string; alias?: string[]; inspectorUrl?: string; readyState?: string }>(
    tok,
    `/v13/deployments${query(team, { forceNew: "1" })}`,
    { method: "POST", body: JSON.stringify({ name: project.name, project: project.id, target: "production", gitSource }) },
  );
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
    team,
    state: data.readyState ?? "QUEUED",
    // The build's own address, live the moment it is ready; the production
    // alias replaces it in the poll once Vercel has assigned one.
    url: liveUrl(data),
    inspectorUrl: data.inspectorUrl ?? null,
  });
}

import { NextResponse } from "next/server";
import { keyFor } from "../keyFor";
import { MODEL_DEFAULTS } from "@/features/models/defaults";

/**
 * The model viewer's window onto a repository.
 *
 * Two questions, both answered with J's GitHub token (the one in the Keys
 * panel, then the server's `GITHUB_TOKEN`), because the models live in a
 * private repository the browser cannot read on its own:
 *
 *   GET /api/models?repo=owner/name&ref=branch&dir=a,b   every .glb, .gltf
 *       and .bbmodel under those folders, with sizes
 *   GET /api/models?repo=owner/name&ref=branch&path=p    where to fetch one
 *       file: GitHub's own short-lived download link
 *
 * The file itself never passes through here. A Lantern export is two to four
 * megabytes and a function answer stops at four and a half, so the route
 * hands out GitHub's `download_url` (it carries its own temporary token for
 * a private repository) and the browser reads the bytes from GitHub direct.
 * The token is used for the call and nothing else.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = /\.(glb|gltf|bbmodel)$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;

export interface ModelFile { path: string; size: number }

function gh(token: string | undefined, url: string) {
  return fetch(`https://api.github.com${url}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
}

const say = (status: number, message: string) => NextResponse.json({ ok: false, message }, { status });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const repo = q.get("repo")?.trim() || MODEL_DEFAULTS.repo;
  const ref = q.get("ref")?.trim() || MODEL_DEFAULTS.ref;
  if (!REPO.test(repo)) return say(400, `"${repo}" is not owner/name.`);
  const token = keyFor(request, "x-github-token")?.key;
  const path = q.get("path")?.trim();

  if (path) {
    if (!MODEL.test(path) || path.includes("..")) return say(400, "Only .glb, .gltf and .bbmodel files are opened here.");
    const res = await gh(token, `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
    if (!res.ok) return say(res.status, `GitHub answered ${res.status} for ${path} on ${ref}.${token ? "" : " No GitHub token: put one in Keys."}`);
    const body = (await res.json()) as { download_url?: string | null; size?: number };
    if (!body.download_url) return say(502, `GitHub gave no download link for ${path}.`);
    return NextResponse.json({ ok: true, url: body.download_url, size: body.size ?? 0 });
  }

  const dirs = (q.get("dir")?.split(",").map((d) => d.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean)) ?? MODEL_DEFAULTS.dirs;
  const res = await gh(token, `/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  if (!res.ok) {
    const why = res.status === 404 ? `GitHub can't see ${repo} at ${ref}${token ? " with this token" : ": no GitHub token, put one in Keys"}.` : `GitHub answered ${res.status}.`;
    return say(res.status, why);
  }
  const tree = (await res.json()) as { tree: { path: string; type: string; size?: number }[]; truncated?: boolean };
  const inDirs = (p: string) => dirs.length === 0 || dirs.some((d) => p === d || p.startsWith(d + "/"));
  const files: ModelFile[] = tree.tree
    .filter((t) => t.type === "blob" && MODEL.test(t.path) && inDirs(t.path))
    .map((t) => ({ path: t.path, size: t.size ?? 0 }));
  return NextResponse.json({ ok: true, repo, ref, dirs, files, truncated: !!tree.truncated });
}

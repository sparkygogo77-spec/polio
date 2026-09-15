import { NextResponse } from "next/server";

/**
 * Which keys the server has — never what they are.
 *
 * The keys panel needs to tell someone whether to bother pasting a key at
 * all, and that is the whole of what this answers: a name and a yes or no.
 * No value, no prefix, no length, nothing that narrows a guess. Anything
 * added here in future must pass the same test.
 */

export const runtime = "nodejs";

const NAMES = [
  "ANTHROPIC_API_KEY",
  "REPLICATE_API_TOKEN",
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_SECRET",
  "X_HANDLE",
  "GITHUB_TOKEN",
  "GITHUB_REPO",
  "GITHUB_BRANCH",
  "GITHUB_REPOS",
  "VERCEL_TOKEN",
  "VERCEL_TEAM",
  "VERCEL_PROJECT",
  "VERCEL_DEPLOY_HOOK",
] as const;

export async function GET() {
  const set: Record<string, boolean> = {};
  for (const n of NAMES) set[n] = !!process.env[n]?.trim();
  // The repository name is not a secret and the panel shows it, so it is the
  // one value that comes back. A token never does. A branch nobody set is
  // null, not "main": the push assumes main, and says so, but this route
  // reports what is set.
  return NextResponse.json({ set, repo: process.env.GITHUB_REPO?.trim() ?? null, branch: process.env.GITHUB_BRANCH?.trim() || null });
}

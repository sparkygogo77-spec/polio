import { NextResponse } from "next/server";

/**
 * Which commit this deployment is serving.
 *
 * There was no way to ask. A live site could be three days and eleven
 * commits behind trunk and look exactly like one that was current, which is
 * how J drew a cube on the live site and got nothing: the work had never
 * reached trunk and nothing said so. A deployment that cannot name its own
 * commit cannot be checked against the branch it is meant to be.
 *
 * Vercel sets these at build and they are readable at request time. Nothing
 * here is a secret — a commit hash, the branch it came from, which
 * environment it is and when it was built — and nothing else may be added:
 * this is a route anyone can call, so the test that applies to
 * `/api/keys/status` applies here. No tokens, no repository private to
 * anyone, no environment variable that was not put here on purpose.
 *
 * `GIT_COMMIT_SHA` is the same answer for a deployment that is not Vercel's,
 * so a self-host can set it and the check still works.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const at = (name: string) => process.env[name]?.trim() || null;

export async function GET() {
  const commit = at("VERCEL_GIT_COMMIT_SHA") ?? at("GIT_COMMIT_SHA");
  return NextResponse.json(
    {
      commit,
      short: commit ? commit.slice(0, 7) : null,
      branch: at("VERCEL_GIT_COMMIT_REF") ?? at("GIT_BRANCH"),
      message: at("VERCEL_GIT_COMMIT_MESSAGE"),
      environment: at("VERCEL_ENV") ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
      // Read as a literal, not through the helper: `env` in next.config
      // replaces the text `process.env.BUILD_TIME` at build, and a lookup by
      // variable name is not that text.
      builtAt: process.env.BUILD_TIME ?? null,
      // Said plainly, because "commit: null" on its own reads like a bug.
      note: commit ? undefined : "This build was not given a commit. On Vercel that is VERCEL_GIT_COMMIT_SHA; elsewhere set GIT_COMMIT_SHA at build time.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

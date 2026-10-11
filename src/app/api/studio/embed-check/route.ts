import { NextResponse } from "next/server";
import { safeFetch } from "@/features/studio/siteResolve";
import { frameRefusal } from "@/features/studio/embedLink";

/**
 * Does this page agree to be shown inside another site?
 *
 * A browser hides the answer from the page that asks (a refused frame just
 * stays blank), so the embed box asks here: the server reads the page's own
 * headers (X-Frame-Options, Content-Security-Policy frame-ancestors) and
 * says. The bounds are `siteFetch.ts#allowed`, held by `siteResolve.ts#safeFetch`:
 * https only, no private addresses (as typed, as resolved, and at every
 * redirect, each checked before it is asked for), one page, a short deadline. Every answer is HTTP 200, like the
 * other routes here; `refuses: null` means it could not tell.
 */
export const runtime = "nodejs";
export const maxDuration = 15;

const DEADLINE_MS = 8_000;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  try {
    const res = await safeFetch(url, { signal: AbortSignal.timeout(DEADLINE_MS), headers: { "user-agent": "Mozilla/5.0 (Polio builder embed check)", accept: "text/html,*/*" } });
    if (!(res instanceof Response)) return NextResponse.json({ refuses: null, says: res.says });
    void res.body?.cancel();
    const refuses = frameRefusal({ xfo: res.headers.get("x-frame-options"), csp: res.headers.get("content-security-policy") });
    return NextResponse.json({ refuses, status: res.status });
  } catch {
    return NextResponse.json({ refuses: null, says: "That page did not answer in time, so it could not be checked." });
  }
}

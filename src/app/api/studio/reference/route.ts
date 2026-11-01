import { NextResponse } from "next/server";
import { findPlaywright, NO_PLAYWRIGHT } from "../headless";
import { answerBudget } from "../budget";
import { allowedResolved, requestCheck } from "@/features/studio/siteResolve";
import { readReference } from "@/features/studio/reference/open";

/**
 * A site J likes, read for real: one public page opened on the server,
 * summed up and photographed (`features/studio/reference/`), and handed back
 * for the browser to keep with the project. No Claude and no key here.
 *
 * Bounds as `api/studio/element` keeps them (`siteFetch.ts`, `siteResolve.ts`).
 * Every failure is HTTP 200 with `ok: false`, a reason and a plain sentence,
 * and the Builder carries on with the site's name alone.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const began = Date.now();
  let body: { url?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const typed = String(body.url ?? "");
  /* The address first, so a refused one says why even on a box with no browser. */
  const first = await allowedResolved(typed);
  if (!first.ok) return NextResponse.json({ ok: false, reason: first.why, message: first.says.charAt(0).toLowerCase() + first.says.slice(1) });
  const found = await findPlaywright();
  if (!found.pw) return NextResponse.json({ ok: false, reason: "no-browser", message: NO_PLAYWRIGHT });
  const answer = await readReference(typed, {
    launch: async () => found.pw.chromium.launch(await found.launchOptions()) as never,
    gate: (u) => allowedResolved(u),
    check: requestCheck(),
    until: began + answerBudget(process.env, maxDuration),
  });
  return NextResponse.json(answer);
}

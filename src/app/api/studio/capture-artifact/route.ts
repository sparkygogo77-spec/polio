import { NextResponse } from "next/server";

/**
 * ONE RANGE OF A CAPTURE RUN'S ARTIFACT.
 *
 * polio's capture workflow hands a capture back as the run's artifact
 * (`.github/workflows/capture.yml`), and the Builder brings it in
 * (`captureArtifact.ts`). GitHub answers the download with a redirect to
 * storage that sends no CORS headers, so the browser cannot follow it; this
 * follows it for one byte range and hands the bytes back. Nothing is kept:
 * the route holds nothing between calls, like every route here.
 *
 * **Whose token.** His, in `x-github-token`, read from the Keys panel in his
 * browser, exactly as the publish and repo routes take it; it rides with the
 * call and is gone when it returns. It is sent to GitHub and nowhere else:
 * the storage the redirect names is asked with the signed address alone.
 *
 *   GET ?repo=owner/name&id=<artifact>&from=<byte>&to=<byte>   a range, inclusive
 *   GET ?repo=owner/name&id=<artifact>&last=<n>                the zip's last n bytes
 *
 * At most `MOST` bytes an answer, under a function's 4.5 MB. The answer
 * carries `content-range: bytes a-b/total`. A refusal is GitHub's status
 * with a sentence: 410 when the artifact has expired.
 *
 * `GITHUB_API` is unset everywhere but a test run, where it points at a stub.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";
const MOST = 3_500_000;

const no = (status: number, message: string) => NextResponse.json({ ok: false, message }, { status });

export async function GET(request: Request) {
  const token = request.headers.get("x-github-token")?.trim();
  if (!token) return no(401, "No GitHub key came with the call. Put one in Keys.");
  const q = new URL(request.url).searchParams;
  const repo = q.get("repo") ?? "";
  const id = q.get("id") ?? "";
  if (!/^[A-Za-z0-9][\w-]*\/[\w.-]+$/.test(repo) || repo.includes("..") || !/^\d{1,20}$/.test(id)) return no(400, "Name the repository as owner/name and the artifact by its number.");
  const last = q.has("last") ? Number(q.get("last")) : null;
  const from = Number(q.get("from") ?? 0), to = Number(q.get("to") ?? -1);
  let range: string;
  if (last !== null) {
    if (!Number.isInteger(last) || last < 1 || last > MOST) return no(400, `Ask for the last 1 to ${MOST} bytes.`);
    range = `bytes=-${last}`;
  } else {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from + 1 > MOST) return no(400, `Ask for a range of 1 to ${MOST} bytes.`);
    range = `bytes=${from}-${to}`;
  }

  /* Where the artifact is: GitHub answers with a redirect to a signed address, which is asked without the token. */
  let where: string | null = null;
  let gh: Response;
  try {
    gh = await fetch(`${API}/repos/${repo}/actions/artifacts/${id}/zip`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return no(502, "GitHub could not be reached.");
  }
  if (gh.status >= 300 && gh.status < 400) where = gh.headers.get("location");
  else if (gh.status === 410) return no(410, "That capture has expired: GitHub keeps a run's artifact for 30 days.");
  else if (gh.status === 401) return no(401, "GitHub does not know this key: it is expired, revoked or pasted wrong.");
  else if (gh.status === 403 || gh.status === 404) return no(gh.status, `GitHub would not hand over the capture (${gh.status}): the key needs Actions: Read on ${repo}.`);
  else if (!gh.ok) return no(502, `GitHub answered ${gh.status} when asked for the capture.`);
  if (!where && gh.ok) {
    /* Answered with the zip itself (a stub, or a GitHub that stops redirecting): the range is cut from it here. */
    const all = new Uint8Array(await gh.arrayBuffer());
    const a = last !== null ? Math.max(0, all.length - last) : from;
    const b = last !== null ? all.length - 1 : Math.min(to, all.length - 1);
    if (a > b) return no(416, "That range is past the end of the capture.");
    return new NextResponse(all.slice(a, b + 1), { status: 206, headers: { "content-type": "application/octet-stream", "content-range": `bytes ${a}-${b}/${all.length}`, "cache-control": "no-store" } });
  }
  if (!where || !/^https:\/\//.test(where)) return no(502, "GitHub did not say where the capture is.");

  let got: Response;
  try {
    got = await fetch(where, { headers: { range }, cache: "no-store" });
  } catch {
    return no(502, "The capture's storage could not be reached.");
  }
  if (got.status === 416) return no(416, "That range is past the end of the capture.");
  if (!got.ok) return no(502, `The capture's storage answered ${got.status}.`);
  const bytes = new Uint8Array(await got.arrayBuffer());
  const said = got.headers.get("content-range");
  if (got.status === 206 && said) {
    if (bytes.length > MOST) return no(502, "The capture's storage answered with more than was asked.");
    return new NextResponse(bytes, { status: 206, headers: { "content-type": "application/octet-stream", "content-range": said, "cache-control": "no-store" } });
  }
  /* Storage that ignores ranges sends it whole: cut it here. */
  const a = last !== null ? Math.max(0, bytes.length - last) : from;
  const b = last !== null ? bytes.length - 1 : Math.min(to, bytes.length - 1);
  if (a > b) return no(416, "That range is past the end of the capture.");
  return new NextResponse(bytes.slice(a, b + 1), { status: 206, headers: { "content-type": "application/octet-stream", "content-range": `bytes ${a}-${b}/${bytes.length}`, "cache-control": "no-store" } });
}

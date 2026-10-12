import { safeFetch } from "@/features/studio/siteResolve";

/**
 * A picture's bytes, fetched here when its own host will not hand them to the
 * page (no CORS header), so Copy can still put the picture itself on the
 * clipboard instead of its address. Bounds are `siteResolve.ts#safeFetch`'s:
 * https only, no private addresses at any redirect. Only an image comes back,
 * and only up to MAX_BYTES.
 */
export const runtime = "nodejs";
export const maxDuration = 15;

const DEADLINE_MS = 10_000;
const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  try {
    const res = await safeFetch(url, { signal: AbortSignal.timeout(DEADLINE_MS), headers: { accept: "image/*" } });
    if (!(res instanceof Response)) return new Response(res.says, { status: 400 });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\//i.test(type)) {
      void res.body?.cancel();
      return new Response("That address is not a picture.", { status: 415 });
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return new Response("That picture is too big to copy.", { status: 413 });
    return new Response(bytes, { headers: { "content-type": type, "cache-control": "private, max-age=300" } });
  } catch {
    return new Response("That picture did not arrive in time.", { status: 504 });
  }
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { dataPath, ITEM_MAX } from "../core";
import { answer, guard, said } from "../guard";

/**
 * A big item (over 4 MB) goes from the browser straight into the Blob store:
 * this route checks the key and hands back a one-off upload pass for that
 * one place, for pictures, videos or JSON only, and nothing else.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = said(async (request: Request) => {
  const g = await guard(request, "any");
  if (g instanceof Response) return g;
  if (g.store?.kind !== "blob") return answer({ ok: false, says: "Big items need the Vercel Blob store." }, 503);
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || body.type !== "blob.generate-client-token") return answer({ ok: false, says: "Not an upload request." }, 400);
  try {
    const out = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!dataPath(pathname)) throw new Error("Not a place saved work is kept.");
        const json = pathname.endsWith(".json") && !pathname.startsWith("data/pictures/");
        return {
          allowedContentTypes: json ? ["application/json"] : ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm"],
          maximumSizeInBytes: ITEM_MAX,
          addRandomSuffix: false,
          /* A picture is written once; a pass lasts a minute, so a cancelled key cannot keep using one. */
          allowOverwrite: json,
          validUntil: Date.now() + 60_000,
        };
      },
    });
    return answer(out);
  } catch (err) {
    /* A refusal of ours says so; anything else is the store failing, and says why. */
    if (err instanceof Error && err.message === "Not a place saved work is kept.") return answer({ ok: false, says: err.message }, 400);
    throw err;
  }
});

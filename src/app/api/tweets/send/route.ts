import { NextResponse } from "next/server";
import { createPost, keysFromEnv, uploadMedia, XError, type PostInput } from "../x";

/**
 * Post one tweet, with its media, to X.
 *
 * The console sends a multipart form: `payload` (the post as JSON) and one
 * file field per media item, named in the payload. A thread is several of
 * these in a row, each replying to the id the last one returned; the console
 * runs that loop, so a failure half way is reported as exactly that and
 * never retried into duplicates.
 *
 * With no keys this is HTTP 200 and `ok: false, reason: "no-keys"`, and the
 * console falls back to opening X with the words. The keys are never
 * load-bearing.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

interface Payload {
  text?: string;
  media?: { name: string; type: string; alt: string; kind: "image" | "gif" | "video"; field: string }[];
  replySettings?: PostInput["replySettings"];
  poll?: { options: string[]; durationMinutes: number } | null;
  quoteTweetId?: string | null;
  inReplyToTweetId?: string | null;
  sensitive?: boolean;
}

export async function POST(request: Request) {
  const { keys, missing } = keysFromEnv();
  if (!keys) {
    return NextResponse.json({
      ok: false,
      reason: "no-keys",
      retryable: false,
      message: `No X keys on the server (${missing.join(", ")} missing), so nothing can be posted from here. Use Open in X or Copy.`,
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", retryable: false, message: "Expected a multipart form." }, { status: 400 });
  }
  let payload: Payload;
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}")) as Payload;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", retryable: false, message: "The payload was not JSON." }, { status: 400 });
  }
  const text = (payload.text ?? "").trim();
  const media = payload.media ?? [];
  if (!text && !media.length) {
    return NextResponse.json({ ok: false, reason: "empty", retryable: false, message: "Nothing to post." }, { status: 400 });
  }

  const steps: string[] = [];
  try {
    const mediaIds: string[] = [];
    for (const m of media) {
      const file = form.get(m.field);
      if (!(file instanceof Blob)) throw new XError(`The file for “${m.name}” did not arrive.`, 400);
      const id = await uploadMedia(keys, file, { type: m.type, kind: m.kind, alt: m.alt, onStep: (s) => steps.push(`${m.name}: ${s}`) });
      mediaIds.push(id);
    }
    const post = await createPost(keys, {
      text,
      mediaIds,
      replySettings: payload.replySettings,
      poll: payload.poll ?? null,
      quoteTweetId: payload.quoteTweetId ?? null,
      inReplyToTweetId: payload.inReplyToTweetId ?? null,
      sensitive: payload.sensitive,
    });
    return NextResponse.json({ ok: true, id: post.id, text: post.text, mediaIds, steps });
  } catch (error) {
    if (error instanceof XError) {
      return NextResponse.json({ ok: false, reason: "x", retryable: error.retryable, status: error.status, message: error.message, steps });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, reason: "error", retryable: true, message, steps });
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Does the Claude key work? One cheap call, no tokens spent.
 *
 * The vault panel has a "Try it" button so that "the prompts are not working"
 * has a first answer that is not a guess: the key the request would use is
 * asked to look up the model the Builder calls. A rejected key, a network
 * problem and a working key each come back as a plain sentence. Like every
 * other route, the server's key wins over one the browser offers; the key is
 * used for the call and nothing else.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-opus-5";

export async function POST(request: Request) {
  const own = process.env.ANTHROPIC_API_KEY?.trim();
  const supplied = request.headers.get("x-anthropic-key")?.trim();
  const apiKey = own || (supplied && supplied.length > 8 ? supplied : null);
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no-key", message: "No key to try: nothing on the server and nothing offered by this browser." });
  }
  const source = own ? "server" : "browser";
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  try {
    const model = await client.models.retrieve(MODEL);
    return NextResponse.json({ ok: true, source, model: model.id, message: `The ${source}'s key works: ${model.display_name} answered.` });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ ok: false, reason: "auth", source, message: `Anthropic rejected the ${source}'s key. Check it is copied whole and still active.` });
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json({ ok: false, reason: "forbidden", source, message: `The ${source}'s key is valid but not allowed to use ${MODEL}.` });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json({ ok: false, reason: "network", source, message: "The server could not reach Anthropic. Check its network or proxy." });
    }
    const detail = error instanceof Anthropic.APIError ? `${error.status}: ${error.message}` : error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, reason: "error", source, message: `Trying the key failed (${detail}).` });
  }
}

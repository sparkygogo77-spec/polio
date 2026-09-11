import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Does the key work? One cheap call each, no tokens spent.
 *
 * The vault panel has a "Try it" button so that "it is not working" has a
 * first answer that is not a guess: the key the next request would use is
 * asked the smallest question its service answers — Claude, the model the
 * Builder calls; Replicate, who the token belongs to; Vercel, the same. A
 * rejected key, a network problem and a working key each come back as a
 * plain sentence. Each is tried the way its own route would use it: the
 * server's wins for Claude and Vercel, the browser's wins for Replicate,
 * which is the one key the person is expected to bring. It is used for the
 * call and nothing else, and never comes back in the answer.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-opus-5";

type Answer = { ok: boolean; reason?: string; source?: string; message: string; model?: string; who?: string };

async function tryClaude(request: Request): Promise<Answer> {
  const own = process.env.ANTHROPIC_API_KEY?.trim();
  const supplied = request.headers.get("x-anthropic-key")?.trim();
  const apiKey = own || (supplied && supplied.length > 8 ? supplied : null);
  if (!apiKey) {
    return { ok: false, reason: "no-key", message: "No key to try: nothing on the server and nothing offered by this browser." };
  }
  const source = own ? "server" : "browser";
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  try {
    const model = await client.models.retrieve(MODEL);
    return { ok: true, source, model: model.id, message: `The ${source}'s key works: ${model.display_name} answered.` };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: "auth", source, message: `Anthropic rejected the ${source}'s key. Check it is copied whole and still active.` };
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, reason: "forbidden", source, message: `The ${source}'s key is valid but not allowed to use ${MODEL}.` };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { ok: false, reason: "network", source, message: "The server could not reach Anthropic. Check its network or proxy." };
    }
    const detail = error instanceof Anthropic.APIError ? `${error.status}: ${error.message}` : error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: "error", source, message: `Trying the key failed (${detail}).` };
  }
}

async function tryVercel(request: Request): Promise<Answer> {
  const own = process.env.VERCEL_TOKEN?.trim();
  const supplied = request.headers.get("x-vercel-token")?.trim();
  const token = own || (supplied && supplied.length > 8 ? supplied : null);
  if (!token) {
    return { ok: false, reason: "no-key", message: "No token to try: nothing on the server and nothing offered by this browser." };
  }
  const source = own ? "server" : "browser";
  try {
    const res = await fetch("https://api.vercel.com/v2/user", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "auth", source, message: `Vercel rejected the ${source}'s token. Check it is copied whole and has not expired.` };
    }
    const data = (await res.json().catch(() => ({}))) as { user?: { username?: string; email?: string }; error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, reason: "error", source, message: `Vercel answered ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}.` };
    }
    const who = data.user?.username ?? data.user?.email ?? "someone";
    return { ok: true, source, who, message: `The ${source}'s token works: it belongs to ${who}.` };
  } catch (err) {
    return { ok: false, reason: "network", source, message: `The server could not reach Vercel${err instanceof Error ? ` (${err.message})` : ""}.` };
  }
}

/**
 * Replicate, asked who the token belongs to.
 *
 * The browser's token is tried first, because that is the one the image
 * route will use. Nothing about the account comes back but the name.
 */
async function tryReplicate(request: Request): Promise<Answer> {
  const supplied = request.headers.get("x-replicate-key")?.trim();
  const own = process.env.REPLICATE_API_TOKEN?.trim();
  const token = (supplied && supplied.length > 8 ? supplied : null) || own || null;
  if (!token) {
    return { ok: false, reason: "no-key", message: "No token to try: nothing held in this browser and nothing on the server." };
  }
  const source = supplied && supplied.length > 8 ? "browser" : "server";
  try {
    const res = await fetch("https://api.replicate.com/v1/account", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "auth", source, message: `Replicate rejected the ${source}'s token. Check it is copied whole and has not been revoked.` };
    }
    const data = (await res.json().catch(() => ({}))) as { username?: string; name?: string; detail?: string };
    if (!res.ok) {
      return { ok: false, reason: "error", source, message: `Replicate answered ${res.status}${data.detail ? `: ${data.detail}` : ""}.` };
    }
    const who = data.username ?? data.name ?? "someone";
    return { ok: true, source, who, message: `The ${source}'s token works: it belongs to ${who}. A drawn body costs $0.08 vector, $0.04 raster.` };
  } catch (err) {
    return { ok: false, reason: "network", source, message: `The server could not reach Replicate${err instanceof Error ? ` (${err.message})` : ""}.` };
  }
}

export async function POST(request: Request) {
  let service = "anthropic";
  try {
    const body = (await request.json()) as { service?: unknown };
    if (body?.service === "vercel" || body?.service === "replicate") service = body.service;
  } catch {
    /* no body: the Claude key, which is what the button meant before there was a choice */
  }
  const answer = service === "vercel" ? await tryVercel(request) : service === "replicate" ? await tryReplicate(request) : await tryClaude(request);
  return NextResponse.json(answer);
}

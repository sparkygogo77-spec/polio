import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { keyFor } from "@/app/api/keyFor";
import { rateCardSays } from "@/features/studio/renderMeter";

/**
 * Does the key work? One cheap call each, no tokens spent.
 *
 * The keys panel has a "Try it" button so that "it is not working" has a
 * first answer that is not a guess: the key the next request would use is
 * asked the smallest question its service answers — Claude, the model the
 * Builder calls; Replicate, who the token belongs to; Vercel, the same. A
 * rejected key, a network problem and a working key each come back as a
 * plain sentence. Each is tried the way its own route would use it
 * (`keyFor`): the browser's when it offers one, the server's when it does
 * not. It is used for the call and nothing else, and never comes back in
 * the answer.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-opus-5";

type Answer = { ok: boolean; reason?: string; source?: string; message: string; model?: string; who?: string };

/**
 * A key was offered and is too short to be one. Every route drops a key of
 * eight characters or fewer rather than send it anywhere, and this used to
 * be answered as "nothing offered by this browser", which is untrue to the
 * person who just pasted one. Nothing of what was pasted comes back.
 */
const tooShort = (what: string) => `The ${what} held in this browser is too short to be one. Paste it whole, from its first character to its last, and try again.`;

async function tryClaude(request: Request): Promise<Answer> {
  const picked = keyFor(request, "x-anthropic-key");
  const supplied = request.headers.get("x-anthropic-key")?.trim();
  if (!picked) return { ok: false, reason: supplied ? "malformed" : "no-key", message: supplied ? tooShort("key") : "No key to try: nothing held in this browser and nothing on the server." };
  const { key: apiKey, source } = picked;
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
  const picked = keyFor(request, "x-vercel-token");
  const supplied = request.headers.get("x-vercel-token")?.trim();
  if (!picked) return { ok: false, reason: supplied ? "malformed" : "no-key", message: supplied ? tooShort("token") : "No token to try: nothing held in this browser and nothing on the server." };
  const { key: token, source } = picked;
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
  const picked = keyFor(request, "x-replicate-key");
  const supplied = request.headers.get("x-replicate-key")?.trim();
  if (!picked) return { ok: false, reason: supplied ? "malformed" : "no-key", message: supplied ? tooShort("token") : "No token to try: nothing held in this browser and nothing on the server." };
  const { key: token, source } = picked;
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
    return { ok: true, source, who, message: `The ${source}'s token works: it belongs to ${who}. A drawn body costs ${rateCardSays()}.` };
  } catch (err) {
    return { ok: false, reason: "network", source, message: `The server could not reach Replicate${err instanceof Error ? ` (${err.message})` : ""}.` };
  }
}

/**
 * GitHub, asked who the token belongs to and whether it may make a repository.
 *
 * The browser's is tried first, because that is the one the publish route
 * will use — a test that tried the server's would be a test of a different
 * token. The scopes come back in a header rather than the body, so a classic
 * token can say whether `repo` is on it; a fine-grained one reports nothing
 * there and the only honest answer is that the first publish will find out.
 */
async function tryGithub(request: Request): Promise<Answer> {
  const picked = keyFor(request, "x-github-token");
  const supplied = request.headers.get("x-github-token")?.trim();
  if (!picked) return { ok: false, reason: supplied ? "malformed" : "no-key", message: supplied ? tooShort("token") : "No token to try: nothing held in this browser and nothing on the server." };
  const { key: token, source } = picked;
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "auth", source, message: `GitHub rejected the ${source}'s token. Check it is copied whole and has not expired.` };
    }
    const data = (await res.json().catch(() => ({}))) as { login?: string; message?: string };
    if (!res.ok) {
      return { ok: false, reason: "error", source, message: `GitHub answered ${res.status}${data.message ? `: ${data.message}` : ""}.` };
    }
    const who = data.login ?? "someone";
    const scopes = res.headers.get("x-oauth-scopes");
    const canMake = scopes === null ? null : /(^|,\s*)(repo|public_repo)(\s*,|$)/.test(scopes);
    const note = canMake === null
      ? " Whether it can make one is settled on the first publish."
      : canMake ? " It can make one." : " It cannot make repositories: add the repo scope.";
    return { ok: true, source, who, message: `The ${source}'s token works: it belongs to ${who}.${note}` };
  } catch (err) {
    return { ok: false, reason: "network", source, message: `The server could not reach GitHub${err instanceof Error ? ` (${err.message})` : ""}.` };
  }
}

/**
 * OpenAI, asked which models the key can use, which is all the remake needs
 * to know. Nothing about the account comes back.
 */
async function tryOpenai(request: Request): Promise<Answer> {
  const picked = keyFor(request, "x-openai-key");
  const supplied = request.headers.get("x-openai-key")?.trim();
  if (!picked) return { ok: false, reason: supplied ? "malformed" : "no-key", message: supplied ? tooShort("key") : "No key to try: nothing held in this browser and nothing on the server." };
  const { key, source } = picked;
  try {
    const res = await fetch(`${(process.env.OPENAI_API ?? "https://api.openai.com").replace(/\/$/, "")}/v1/models`, { headers: { authorization: `Bearer ${key}` }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "auth", source, message: `OpenAI rejected the ${source}'s key. Check it is copied whole and has not been revoked.` };
    if (!res.ok) return { ok: false, reason: "error", source, message: `OpenAI answered ${res.status}.` };
    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] };
    const images = (data.data ?? []).map((m) => m.id ?? "").filter((id) => id.startsWith("gpt-image"));
    const two = images.some((id) => id === "gpt-image-2" || id.startsWith("gpt-image-2-20"));
    return { ok: true, source, message: `The ${source}'s key works.${images.length ? two ? " GPT Image 2 is open to it." : ` GPT Image 2 is not open to it; remakes use ${images.sort().reverse()[0]}.` : " No GPT image model is open to it yet."}` };
  } catch (err) {
    return { ok: false, reason: "network", source, message: `The server could not reach OpenAI${err instanceof Error ? ` (${err.message})` : ""}.` };
  }
}

export async function POST(request: Request) {
  let service = "anthropic";
  try {
    const body = (await request.json()) as { service?: unknown };
    if (body?.service === "vercel" || body?.service === "replicate" || body?.service === "github" || body?.service === "openai") service = body.service;
  } catch {
    /* no body: the Claude key, which is what the button meant before there was a choice */
  }
  const answer = service === "vercel" ? await tryVercel(request)
    : service === "replicate" ? await tryReplicate(request)
      : service === "openai" ? await tryOpenai(request)
      : service === "github" ? await tryGithub(request)
        : await tryClaude(request);
  return NextResponse.json(answer);
}

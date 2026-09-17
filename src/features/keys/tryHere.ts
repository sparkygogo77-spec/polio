"use client";
/**
 * Try it, without the key leaving the browser.
 *
 * "Try it" used to be a POST to our own route with the key on it: the server
 * took the key, asked the service, and answered. It worked, and it meant the
 * one button whose whole purpose is to prove a key is the person's own was
 * also the one that handed it to us. These three services answer a browser
 * directly, measured on the deployed page's own origin:
 *
 *   Anthropic  refused outright without `anthropic-dangerous-direct-browser-access`,
 *              and a real 401 on a dummy key with it — so the call lands
 *   GitHub     200
 *   Vercel     403 on a dummy token, which is an answer and not a refusal
 *
 * So Claude, GitHub and Vercel are tried from here and the route never sees
 * those keys. **Replicate is not**, and the panel says so rather than
 * pretending: it does not answer a browser from another origin, and its
 * token reaches our server anyway, because the renderer is a server call.
 * `tryHere` returns null for it and the caller falls back to the route.
 *
 * Nothing here is written down, logged or sent anywhere but the service the
 * key belongs to.
 */
import type { ServiceId } from "./store";

export interface Tried {
  ok: boolean;
  message: string;
  /** Who made the call, which is the whole point of this file. */
  source: "browser";
  reason?: string;
}

/** The model the Builder calls, asked for by name: the smallest question Anthropic answers. */
const MODEL = "claude-opus-5";

const tooShort = (what: string) =>
  `The ${what} held in this browser is too short to be one. Paste it whole, from its first character to its last, and try again.`;

/** A network failure from a browser says nothing about the key, so it must not be reported as if it did. */
const unreachable = (who: string, err: unknown) =>
  `This browser could not reach ${who}${err instanceof Error && err.message ? ` (${err.message})` : ""}. That is the connection, not the key.`;

async function tryClaude(key: string): Promise<Tried> {
  try {
    const res = await fetch(`https://api.anthropic.com/v1/models/${MODEL}`, {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        /* Without this Anthropic refuses a browser outright: no response at
           all, not a rejection. With it the call reaches them. */
        "anthropic-dangerous-direct-browser-access": "true",
      },
    });
    const data = (await res.json().catch(() => ({}))) as { display_name?: string; error?: { message?: string } };
    if (res.ok) return { ok: true, source: "browser", message: `The key works: ${data.display_name ?? MODEL} answered.` };
    if (res.status === 401) return { ok: false, reason: "auth", source: "browser", message: "Anthropic rejected the key. Check it is copied whole and still active." };
    if (res.status === 403) return { ok: false, reason: "forbidden", source: "browser", message: `The key is valid but not allowed to use ${MODEL}.` };
    if (res.status === 404) return { ok: false, reason: "forbidden", source: "browser", message: `The key works, but ${MODEL} is not one this account can use.` };
    return { ok: false, reason: "error", source: "browser", message: `Anthropic answered ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}.` };
  } catch (err) {
    return { ok: false, reason: "network", source: "browser", message: unreachable("Anthropic", err) };
  }
}

async function tryGithub(token: string): Promise<Tried> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    });
    const data = (await res.json().catch(() => ({}))) as { login?: string; message?: string };
    if (res.ok) {
      /* A classic token says what it may do; a fine-grained one does not, and
         the difference is worth knowing before a publish fails on it. */
      const scopes = res.headers.get("x-oauth-scopes");
      const can = scopes === null ? "" : scopes.includes("repo") ? " It can write to repositories." : ` It has ${scopes || "no scopes"}, so it cannot push.`;
      return { ok: true, source: "browser", message: `The token works: it belongs to ${data.login ?? "someone"}.${can}` };
    }
    if (res.status === 401) return { ok: false, reason: "auth", source: "browser", message: "GitHub rejected the token. Check it is copied whole and has not expired." };
    return { ok: false, reason: "error", source: "browser", message: `GitHub answered ${res.status}${data.message ? `: ${data.message}` : ""}.` };
  } catch (err) {
    return { ok: false, reason: "network", source: "browser", message: unreachable("GitHub", err) };
  }
}

async function tryVercel(token: string): Promise<Tried> {
  try {
    const res = await fetch("https://api.vercel.com/v2/user", { headers: { authorization: `Bearer ${token}` } });
    const data = (await res.json().catch(() => ({}))) as { user?: { username?: string; email?: string }; error?: { message?: string } };
    if (res.ok) {
      const who = data.user?.username ?? data.user?.email ?? "someone";
      return { ok: true, source: "browser", message: `The token works: it belongs to ${who}.` };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "auth", source: "browser", message: "Vercel rejected the token. Check it is copied whole and has not expired." };
    return { ok: false, reason: "error", source: "browser", message: `Vercel answered ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}.` };
  } catch (err) {
    return { ok: false, reason: "network", source: "browser", message: unreachable("Vercel", err) };
  }
}

/**
 * Try a key from here, or say that this service cannot be tried from here.
 *
 * Null means the caller should ask the route instead — which is Replicate,
 * and only Replicate. A key shorter than nine characters is not sent
 * anywhere at all; every route does the same, and so does this.
 */
export async function tryHere(service: ServiceId, key: string): Promise<Tried | null> {
  const k = key.trim();
  if (service === "replicate") return null;
  if (k.length <= 8) return { ok: false, reason: "malformed", source: "browser", message: tooShort(service === "anthropic" ? "key" : "token") };
  if (service === "anthropic") return tryClaude(k);
  if (service === "github") return tryGithub(k);
  return tryVercel(k);
}

/** Which services this browser can try on its own. The panel says so where a person can read it. */
export const TRIED_HERE: Record<ServiceId, boolean> = { anthropic: true, github: true, vercel: true, replicate: false };

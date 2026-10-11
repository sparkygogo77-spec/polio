import { lookup } from "node:dns/promises";
import { allowed, privateAddress, privateHost, REFUSAL_SAYS, type Allowed, type Denied } from "./siteFetch.ts";

/**
 * The bounds in `siteFetch.ts`, held where the server actually opens things.
 *
 * `allowed()` reads the address as typed, and that is not enough on its own:
 * localtest.me and 127.0.0.1.nip.io are public-looking names that point at
 * this machine, a public page can redirect to one that is not, and a page the
 * headless browser opens can ask for a picture or a frame from inside the
 * network and come back as a screenshot. So, on the server only (this file
 * asks DNS, and the client never imports it):
 *
 *   · **every name is resolved**, and refused if any address it gives is
 *     private (`allowedResolved`, `hostIsPrivate`);
 *   · **redirects are followed by hand**, at most five, each hop checked
 *     before it is asked for (`safeFetch`);
 *   · **every request a page makes** goes through the same check
 *     (`requestCheck`, which the element route installs on its browser).
 *
 * A name that does not resolve here is let through to fail on its own: the
 * browser or `fetch` cannot reach it either, and refusing it would refuse
 * every read behind a proxy that resolves names itself. What this does not
 * hold is a name that answers public to this lookup and private to the
 * browser's own a moment later (DNS rebinding); that is accepted for now.
 */

/** Where a name points: every address, as DNS gives them. Passed in by the tests. */
export type Resolve = (host: string) => Promise<string[]>;

const dnsResolve: Resolve = async (host) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

const refused = (): Denied => ({ ok: false, why: "private", says: REFUSAL_SAYS.private });

/** Is this host private as typed, or does any address it resolves to sit on a private network? */
export async function hostIsPrivate(hostname: string, resolve: Resolve = dnsResolve): Promise<boolean> {
  if (privateHost(hostname)) return true;
  let addresses: string[];
  try {
    addresses = await resolve(hostname.replace(/\.+$/, ""));
  } catch {
    return false;
  }
  return addresses.some(privateAddress);
}

/** `allowed()`, and then where the name really points. The gate for every route that opens an address. */
export async function allowedResolved(raw: string, resolve: Resolve = dnsResolve): Promise<Allowed | Denied> {
  const gate = allowed(raw);
  if (!gate.ok) return gate;
  return (await hostIsPrivate(gate.host, resolve)) ? refused() : gate;
}

/**
 * One check for everything a headless page asks for: `data:` and `blob:`
 * are the page's own, http and https go if their host is public (a page's
 * pictures may still be plain http; what matters is where they are), and
 * anything else stays shut. Each host is looked up once per check.
 */
export function requestCheck(resolve: Resolve = dnsResolve): (url: string) => Promise<boolean> {
  const seen = new Map<string, Promise<boolean>>();
  return async (url) => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    if (u.protocol === "data:" || u.protocol === "blob:" || url === "about:blank") return true;
    if (!/^(https?|wss?):$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (!seen.has(host)) seen.set(host, hostIsPrivate(host, resolve).then((p) => !p));
    return seen.get(host)!;
  };
}

/**
 * `fetch`, with each redirect followed by hand and checked before it is asked
 * for, so a public page cannot bounce the server onto a private one. Answers
 * the final response, or the refusal of the first hop that was not allowed.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  { hops = 5, resolve = dnsResolve, fetcher = fetch }: { hops?: number; resolve?: Resolve; fetcher?: typeof fetch } = {},
): Promise<Response | Denied> {
  let gate = await allowedResolved(raw, resolve);
  for (let hop = 0; ; hop++) {
    if (!gate.ok) return gate;
    const res = await fetcher(gate.url, { ...init, redirect: "manual" });
    const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!to) return res;
    void res.body?.cancel();
    if (hop >= hops) return { ok: false, why: "private", says: "That address redirects too many times to follow." };
    let next: string;
    try {
      next = new URL(to, gate.url).toString();
    } catch {
      return res;
    }
    gate = await allowedResolved(next, resolve);
  }
}

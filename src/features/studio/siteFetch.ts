/**
 * What a person is allowed to point this at, and the words for saying no.
 *
 * Opening an arbitrary address from the server is the one genuinely new
 * capability the recreate step adds, so the bounds are written here, once,
 * in a file with no browser in it, and the route imports them rather than
 * checking as it goes. The rules J set and I am not loosening:
 *
 *   · **https only.** Not http, not file:, not data:, not anything else. A
 *     page worth recreating is served over https in 2026, and every other
 *     scheme is a way of asking the server to read something local.
 *   · **No private addresses.** Not localhost, not a numeric address in a
 *     private range, not `.local`, not a bare hostname with no dot. The
 *     server sits inside a network the person on the other end of the
 *     browser cannot reach, and it must not be a window into it.
 *   · **One page, one element.** There is no crawl here and there is not
 *     going to be one: the route opens the address a person typed and
 *     reads it. Nothing follows a link.
 *   · **A budget at both ends**, because a call that can hang must have a
 *     deadline at both ends and the spinner must stop with a sentence.
 *
 * Pure: no fetch, no browser, no keys. `tests/site-bounds.mjs` holds it.
 */

/** How long the whole read may take on the server, inside the route's own `maxDuration`. */
export const READ_BUDGET_MS = 25_000;

/** And how long the browser waits for the route before giving up on its own. */
export const READ_DEADLINE_MS = 45_000;

/** How much of a page is worth measuring. Past this it is a document, not a design. */
export const MAX_ELEMENTS = 400;

/** Why an address was refused, in the words the panel will use. */
export type Refusal = "not-a-url" | "not-https" | "private" | "too-long";

export const REFUSAL_SAYS: Record<Refusal, string> = {
  "not-a-url": "That is not a web address. It wants to start with https://",
  "not-https": "Only https addresses can be opened, so that nothing local can be asked for by accident.",
  private: "That address is on a private network. This reads public pages only.",
  "too-long": "That address is too long to be one somebody typed.",
};

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

/**
 * A numeric address inside a range that is not the public internet.
 *
 * Written out rather than reached for a library: these are the ranges a
 * server can see and a visitor cannot, and the list being short and legible
 * is worth more here than being exhaustive about IPv6.
 */
function privateNumber(host: string): boolean {
  // IPv6 loopback and the unique-local block.
  if (host === "::1" || host === "[::1]") return true;
  if (/^\[?(fc|fd)[0-9a-f]{2}:/i.test(host)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  // Link-local, including the cloud metadata address every provider serves there.
  if (a === 169 && b === 254) return true;
  return false;
}

export interface Allowed {
  ok: true;
  /** The address as it will actually be opened, normalised. */
  url: string;
  host: string;
}
export interface Denied {
  ok: false;
  why: Refusal;
  says: string;
}

/** May this address be opened? The one place that decides. */
export function allowed(raw: string): Allowed | Denied {
  const no = (why: Refusal): Denied => ({ ok: false, why, says: REFUSAL_SAYS[why] });
  const text = (raw ?? "").trim();
  if (!text || text.length > 2048) return no(text.length > 2048 ? "too-long" : "not-a-url");
  let u: URL;
  try {
    // A bare host is a common thing to type, and https is the only scheme
    // on offer anyway, so it is completed rather than refused.
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return no("not-a-url");
  }
  if (u.protocol !== "https:") return no("not-https");
  const host = u.hostname.toLowerCase();
  if (!host || PRIVATE_HOST.test(host) || privateNumber(host)) return no("private");
  // A hostname with no dot is a machine on this network, not a site.
  if (!host.includes(".")) return no("private");
  return { ok: true, url: u.toString(), host };
}

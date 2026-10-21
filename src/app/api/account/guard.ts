import { NextResponse } from "next/server";
import { addressOf, backend, NO_STORE, throttle } from "./backend";
import { GithubDown, githubOwners, identify, offered, ownerKey, type Backend, type Who } from "./core";

export const answer = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * Who is asking, or the answer to send instead. A wrong key counts against
 * the address it came from; too many and every key from there waits.
 */
export async function guard(request: Request, need: "any" | "owner"): Promise<{ who: Who; store: Backend | null } | Response> {
  const ip = addressOf(request);
  if (throttle.blocked(ip)) return answer({ ok: false, says: "Too many wrong keys from here. Wait ten minutes and try again." }, 429);
  const header = request.headers.get("authorization");
  const store = backend();
  if (!offered(header)) return answer({ ok: false, says: "Sign in with a key first." }, 401);
  if (!ownerKey(process.env) && !githubOwners(process.env).length && !store) return answer({ ok: false, says: "Accounts are not set up on this server yet: it has no owner key and no store." }, 503);
  let who: Who | null;
  try {
    who = await identify(store, process.env, header);
  } catch (err) {
    if (err instanceof GithubDown) return answer({ ok: false, code: "github-down", says: "GitHub did not answer when asked whose key this is. Try again in a moment." }, 503);
    /* The store did not answer: that says nothing about the key, so it is neither counted nor refused. */
    return answer({ ok: false, code: "store-down", says: "The account's store did not answer. Try again in a moment." }, 503);
  }
  if (!who) {
    throttle.failed(ip);
    if (/^(gh[pousr]_|github_pat_)/.test(offered(header) ?? "")) return answer({ ok: false, code: "unknown-key", says: "That GitHub key is not the owner's: GitHub does not know it, or it belongs to someone else." }, 401);
    return answer({ ok: false, code: "unknown-key", says: "That key does not open this account. It may have been cancelled, or copied only in part." }, 401);
  }
  if (need === "owner" && who.role !== "owner") return answer({ ok: false, says: "Only the owner key can do that." }, 403);
  return { who, store };
}

export const noStore = () => answer({ ok: false, says: "This server has no store for saved work yet. Connect a Vercel Blob store to the project." }, 503);

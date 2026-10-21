import { cancelKey, cleanName, listKeys, makeKey } from "../core";
import { answer, guard, noStore, said } from "../guard";

/**
 * The owner's keys: list, make, cancel. The owner key only.
 * A made key is in the answer to the POST that made it, and nowhere ever again.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = said(async (request: Request) => {
  const g = await guard(request, "owner");
  if (g instanceof Response) return g;
  if (g.who.role === "owner" && g.who.github) return answer({ ok: false, says: "Your GitHub key is the key for every browser: put it in Keys there. Made keys need the owner key." }, 400);
  if (!g.store) return noStore();
  return answer({ ok: true, keys: await listKeys(g.store) });
});

export const POST = said(async (request: Request) => {
  const g = await guard(request, "owner");
  if (g instanceof Response) return g;
  if (g.who.role === "owner" && g.who.github) return answer({ ok: false, says: "Your GitHub key is the key for every browser: put it in Keys there. Made keys need the owner key." }, 400);
  if (!g.store) return noStore();
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = cleanName(body.name);
  if (!name) return answer({ ok: false, says: "Give the key a name, so you know later which browser or person has it." }, 400);
  if ((await listKeys(g.store)).length >= 50) return answer({ ok: false, says: "That is fifty keys already. Cancel one you no longer use first." }, 400);
  const { key, record } = await makeKey(g.store, name);
  return answer({ ok: true, key, record });
});

export const DELETE = said(async (request: Request) => {
  const g = await guard(request, "owner");
  if (g instanceof Response) return g;
  if (g.who.role === "owner" && g.who.github) return answer({ ok: false, says: "Your GitHub key is the key for every browser: put it in Keys there. Made keys need the owner key." }, 400);
  if (!g.store) return noStore();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{16}$/.test(id)) return answer({ ok: false, says: "No such key." }, 404);
  return (await cancelKey(g.store, id)) ? answer({ ok: true }) : answer({ ok: false, says: "No such key: it may have been cancelled already." }, 404);
});

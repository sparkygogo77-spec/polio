import { backend } from "../backend";
import { ownerKey, offered } from "../core";
import { answer, guard } from "../guard";

/**
 * Is the account set up, and who is this key? Says only yes or no about the
 * server's settings, never a value; with a key, says whose it is.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const setup = { store: !!backend(), owner: !!ownerKey(process.env) };
  if (!offered(request.headers.get("authorization"))) return answer({ ok: true, ...setup, who: null });
  const g = await guard(request, "any");
  if (g instanceof Response) return g;
  return answer({ ok: true, ...setup, who: g.who.role === "owner" ? { role: "owner", name: g.who.name } : { role: "key", name: g.who.name } });
}

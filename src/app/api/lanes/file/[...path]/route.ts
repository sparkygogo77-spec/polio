import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { lanesFileAt, lanesFileHeaders } from "../../../../../../helper/server/lanes.ts";

/**
 * The decisions panel's pictures where the Builder runs on the PC that has
 * the files: the same rules as the helper's `GET /lanes/file/<path>`, files
 * under `handovers/` beside lanes.json, read-only, an html page sandboxed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = process.env.LANES_FILE || join(process.cwd(), "..", "handovers", "lanes.json");
  const at = lanesFileAt(dirname(file), (path ?? []).join("/"));
  if (!at) return new Response("no such picture", { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(readFileSync(at.path), { headers: lanesFileHeaders(at.type, "'self'") });
}

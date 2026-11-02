import { NextResponse } from "next/server";
import { join } from "node:path";
import { readLanes } from "../../../../helper/server/lanes.ts";

/**
 * The lanes board's feed, where the Builder runs on the PC that has the files:
 * a checkout sits next to `handovers/` and `agents/`. On a deployment there is
 * no such file, so `feed` is null and the board asks the helper instead.
 * `LANES_FILE` and `LANES_BEATS` point elsewhere (the test's fixture).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const file = process.env.LANES_FILE || join(process.cwd(), "..", "handovers", "lanes.json");
  const beats = process.env.LANES_BEATS || join(process.cwd(), "..", "agents", "lanes");
  return NextResponse.json(readLanes({ file, beats }), { headers: { "cache-control": "no-store" } });
}

import { NextResponse } from "next/server";
import { keysFromEnv, mediaApi } from "../x";

/** Are there keys on the server, and which upload endpoint will be used? Never the keys themselves. */
export const runtime = "nodejs";

export async function GET() {
  const { keys, missing } = keysFromEnv();
  return NextResponse.json({
    configured: !!keys,
    missing,
    mediaApi: mediaApi(),
    handle: process.env.X_HANDLE ?? null,
  });
}

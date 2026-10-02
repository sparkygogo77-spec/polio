import { NextResponse } from "next/server";
import { KIT_MAP_MOST, kitMap } from "@/features/studio/kitMap";

/**
 * THE KIT'S CHECK ON A DESIGN BEFORE IT IS SENT (`kitMap.ts`).
 *
 * The browser hands over the files of a builder-ready repository as they
 * will be on the style branch (read with his own token, which never comes
 * here); this remakes `hooks.json` with the repository's own check and
 * says what the contract finds. Nothing is kept.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > KIT_MAP_MOST * 1.2) return NextResponse.json({ ok: false, problems: ["the files are too big to check here"], made: {} }, { status: 413 });
  let body: { files?: Record<string, string>; manifest?: string };
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false, problems: ["not JSON"], made: {} }, { status: 400 }); }
  if (!body.files || typeof body.files !== "object") return NextResponse.json({ ok: false, problems: ["no files"], made: {} }, { status: 400 });
  const got = kitMap(body.files, typeof body.manifest === "string" ? body.manifest : "builder.json");
  return NextResponse.json({ ok: got.problems.length === 0, ...got });
}

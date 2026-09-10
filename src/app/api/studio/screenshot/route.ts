import { NextResponse } from "next/server";
import { asDevice, findPlaywright, NO_PLAYWRIGHT, takeDoc, withPreview } from "../headless";

/**
 * A picture of one page of the site, as the live preview shows it.
 *
 * This is what goes to Claude beside a prompt: a screenshot says what a
 * page looks like better than any description of it, and it is the same
 * picture the author is looking at. POST the document and a path; back
 * comes a PNG of the whole page, top to bottom, at the width asked for.
 *
 * GET says whether this can be done here at all.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_HEIGHT = 6000;

export async function GET() {
  const found = await findPlaywright();
  return NextResponse.json({ available: !!found.pw, from: found.pw ? found.from : null, video: found.pw ? found.video : false, tried: found.pw ? undefined : found.tried });
}

export async function POST(request: Request) {
  const found = await findPlaywright();
  if (!found.pw) return NextResponse.json({ ok: false, reason: "no-playwright", message: NO_PLAYWRIGHT, tried: found.tried });

  let body: { doc?: unknown; path?: string; device?: string; width?: number; fullPage?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : "/builder/preview";
  const device = asDevice(body.device);
  const width = Math.max(320, Math.min(1920, Math.round(body.width ?? (device === "phone" ? 420 : device === "tablet" ? 820 : 1280))));
  const height = Math.round(width * 0.625);
  const fullPage = body.fullPage !== false;

  try {
    const png = await withPreview(found, { origin, path, doc: takeDoc(body.doc), device, width, height }, async (page) => {
      if (fullPage) {
        // The site scrolls inside its own box, not the window: the box is let
        // grow to its content and the window sized to it, then the picture is
        // of the window.
        const tall = await page.evaluate(() => {
          const s = document.querySelector<HTMLElement>("[data-live-scroller]");
          if (!s) return 0;
          const h = s.scrollHeight;
          s.style.overflow = "visible";
          s.style.height = `${h}px`;
          s.style.flex = "none";
          const box = s.parentElement as HTMLElement | null;
          if (box) box.style.height = `${h}px`;
          return h;
        });
        await page.setViewportSize({ width, height: Math.max(200, Math.min(MAX_HEIGHT, tall || height)) });
        await page.waitForTimeout(250);
      }
      return page.screenshot({ type: "png", fullPage: false });
    });
    return new NextResponse(Buffer.from(png), { headers: { "content-type": "image/png", "x-shot-device": device, "x-shot-width": String(width) } });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "render", message: error instanceof Error ? error.message : "The screenshot failed." });
  }
}

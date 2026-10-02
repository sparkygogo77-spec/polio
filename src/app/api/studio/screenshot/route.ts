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

  let body: { doc?: unknown; path?: string; device?: string; width?: number; fullPage?: boolean; hook?: string };
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
  /* One part, by its hook: a picture of that part alone (a code request carries it), the page when it is not drawn. */
  const hook = typeof body.hook === "string" && /^[\w-]{1,120}$/.test(body.hook) ? body.hook : null;

  // How tall the page really was, so a picture cut at the cap can say so.
  let pageHeight = 0;
  try {
    const png = await withPreview(found, { origin, path, doc: takeDoc(body.doc), device, width, height }, async (page) => {
      if (hook) {
        const box = await page.evaluate((h: string) => {
          const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-hook="${h}"]`)).find((e) => e.getClientRects().length > 0);
          if (!el) return null;
          el.scrollIntoView({ block: "center", inline: "center" });
          const r = el.getBoundingClientRect();
          return r.width >= 2 && r.height >= 2 ? { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth), height: Math.min(r.height, innerHeight) } : null;
        }, hook);
        if (box) return page.screenshot({ type: "png", clip: box });
      }
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
        pageHeight = tall;
        await page.setViewportSize({ width, height: Math.max(200, Math.min(MAX_HEIGHT, tall || height)) });
        await page.waitForTimeout(250);
      }
      return page.screenshot({ type: "png", fullPage: false });
    });
    const cut = pageHeight > MAX_HEIGHT;
    return new NextResponse(Buffer.from(png), {
      headers: {
        "content-type": "image/png",
        "x-shot-device": device,
        "x-shot-width": String(width),
        // A page taller than the cap loses the rest; the label the picture
        // goes up with reads these rather than calling it top to bottom.
        ...(cut ? { "x-shot-cut": "1", "x-shot-height": String(pageHeight), "x-shot-max": String(MAX_HEIGHT) } : {}),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "render", message: error instanceof Error ? error.message : "The screenshot failed." });
  }
}

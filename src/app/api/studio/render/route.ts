import { NextResponse } from "next/server";
import { findPlaywright, NO_PLAYWRIGHT } from "../headless";
import { cleanSnippet, frameDoc } from "@/features/studio/snippet";

/**
 * A picture of one part's body, on its own, at the size it will be.
 *
 * The loop that writes a body has to see what it wrote: a fragment is
 * judged by the shape it actually paints, not by how good the code looks.
 * So the fragment is rendered here in the same headless browser the
 * screenshots use — nothing else on the page, transparent behind it — and
 * the caller compares the silhouette of what came back against the outline
 * that was drawn.
 *
 * The fragment is cleaned again on the way in. It arrives from a browser,
 * and a route that renders whatever it is handed is a route that renders
 * whatever anyone hands it: no scripts, nothing fetched, and the page it
 * goes into carries the same content policy the part will be rendered
 * under. The browser here has no network of its own to speak of, but the
 * lock is not conditional on that.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const found = await findPlaywright();
  if (!found.pw) return NextResponse.json({ ok: false, reason: "no-playwright", message: NO_PLAYWRIGHT, tried: found.tried });

  let body: { html?: string; w?: number; h?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const raw = typeof body.html === "string" ? body.html : "";
  if (!raw.trim()) return NextResponse.json({ ok: false, reason: "empty", message: "No body to render." }, { status: 400 });
  const { html } = cleanSnippet(raw);
  if (!html) return NextResponse.json({ ok: false, reason: "empty-body", message: "Everything in that body had to be stripped." });

  const w = Math.round(Math.max(32, Math.min(1600, Number(body.w) || 320)));
  const h = Math.round(Math.max(32, Math.min(1600, Number(body.h) || 320)));

  const browser = await found.pw.chromium.launch(await found.launchOptions());
  try {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, javaScriptEnabled: false });
    const page = await context.newPage();
    // Nothing leaves this page. The fragment has already been stripped of
    // anything that would try; this is what makes that true rather than
    // hoped for.
    await page.route("**/*", (route) => (route.request().url().startsWith("data:") ? route.continue() : route.abort()));
    await page.setContent(frameDoc(html, { colour: "#111111" }), { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(220);
    const png = await page.screenshot({ type: "png", omitBackground: true });
    await context.close();
    return new NextResponse(Buffer.from(png), { headers: { "content-type": "image/png", "x-render-width": String(w), "x-render-height": String(h) } });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "render", message: error instanceof Error ? error.message : "The render failed." });
  } finally {
    await browser.close().catch(() => undefined);
  }
}

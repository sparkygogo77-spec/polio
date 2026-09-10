import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { encodeGif } from "@/features/tweets/gif";
import { decodePng } from "../png";
import { findPlaywright, NO_PLAYWRIGHT, NO_VIDEO } from "../../studio/headless";

/**
 * A recording of the live site being scrolled and worked, made on the server.
 *
 * Playwright opens the preview route in a headless browser, hides the shell
 * round it, runs the same tour the console runs in its frame, and records
 * it. Playwright records WebM; X does not take WebM, so the WebM is pulled
 * apart into frames by the ffmpeg Playwright ships (which can read WebM but
 * cannot write a GIF) and written as a GIF here, which X does take. The
 * response says which it is.
 *
 * Optional, like everything that needs more than a browser: with no browser
 * to be found this is HTTP 200 and `ok: false` with a reason, and the console
 * records the tab in the browser instead.
 *
 * It needs a *full* Playwright, not only a browser. Where there is none the
 * screenshot routes fall to the cut-down Chromium a serverless function can
 * carry, and that one opens pages perfectly well and cannot record a frame of
 * them: the recording is written by the ffmpeg a full install ships. So this
 * says so before it launches anything, rather than running a whole tour and
 * finding out at the end that there is no file.
 */

export const runtime = "nodejs";
export const maxDuration = 180;

const run = promisify(execFile);

/** The handle a launch gives back, and what this route asks of it. */
type PW = { chromium: { launch: (o?: Record<string, unknown>) => Promise<{ newContext: (o: Record<string, unknown>) => Promise<PWContext>; close: () => Promise<void> }> } };
type PWContext = { newPage: () => Promise<PWPage>; close: () => Promise<void> };
type PWPage = {
  goto: (url: string, o?: Record<string, unknown>) => Promise<unknown>;
  addStyleTag: (o: { content: string }) => Promise<unknown>;
  evaluate: <T>(fn: (arg: T) => unknown, arg: T) => Promise<unknown>;
  waitForSelector: (sel: string, o?: Record<string, unknown>) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  video: () => { path: () => Promise<string> } | null;
};

/** An ffmpeg, if there is one: named, on the path, or the one Playwright ships. */
function findFfmpeg(): string | null {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean) as string[];
  for (const root of roots) {
    try {
      for (const d of readdirSync(/* turbopackIgnore: true */ root)) {
        if (!d.startsWith("ffmpeg")) continue;
        for (const name of ["ffmpeg-linux", "ffmpeg-mac", "ffmpeg-win64.exe", "ffmpeg"]) {
          const p = join(/* turbopackIgnore: true */ root, d, name);
          if (existsSync(/* turbopackIgnore: true */ p)) return p;
        }
      }
    } catch {
      /* no such root */
    }
  }
  return "ffmpeg";
}

const HIDE = `
  header, footer { display: none !important; }
  div:has(> [data-live-scroller]) > div:first-child { display: none !important; }
  div:has(> [data-live-scroller]) { height: 100dvh !important; }
  [data-live-scroller] { scrollbar-width: none !important; }
  [data-live-scroller]::-webkit-scrollbar { display: none !important; }
`;

/** The tour, self-contained so it can run inside the page. Mirrors `tour.ts`. */
async function tourInPage(arg: { pxPerSec: number; interact: boolean; loops: number; device: string }) {
  const w = window as unknown as { __studioLiveDevice?: (d: string) => void };
  w.__studioLiveDevice?.(arg.device);
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const scroller = document.querySelector("[data-live-scroller]") as HTMLElement | null;
  if (!scroller) return;
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const glide = (from: number, to: number, pxPerSec: number) =>
    new Promise<void>((resolve) => {
      const ms = Math.max(200, (Math.abs(to - from) / pxPerSec) * 1000);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        scroller.scrollTop = from + (to - from) * ease(t);
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  const work = async (node: HTMLElement) => {
    const tabs = Array.from(node.querySelectorAll('[role="tab"]')) as HTMLElement[];
    if (tabs.length > 1) {
      for (const t of [tabs[1], tabs[2] ?? tabs[0]]) { if (t) { t.click(); await sleep(520); } }
      return;
    }
    const rows = Array.from(node.querySelectorAll('[aria-expanded="false"]')) as HTMLElement[];
    if (rows[0]) { rows[0].click(); await sleep(420); }
    if (rows[1]) { rows[1].click(); await sleep(420); }
  };
  await sleep(600);
  for (let loop = 0; loop < Math.max(1, arg.loops); loop++) {
    scroller.scrollTop = 0;
    await sleep(500);
    const travel = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const nodes = Array.from(document.querySelectorAll("[data-live-node]")) as HTMLElement[];
    const done = new Set<HTMLElement>();
    let y = 0;
    for (let guard = 0; guard < 200; guard++) {
      const next = arg.interact
        ? nodes
            .filter((n) => !done.has(n))
            .map((n) => ({ n, at: n.offsetTop + n.offsetHeight / 2 - scroller.clientHeight / 2 }))
            .filter((x) => x.at > y + 4)
            .sort((a, b) => a.at - b.at)[0]
        : undefined;
      const target = next ? Math.min(travel, Math.max(0, next.at)) : travel;
      await glide(y, target, arg.pxPerSec);
      y = target;
      if (next) { done.add(next.n); await work(next.n); }
      if (!next || y >= Math.max(0, scroller.scrollHeight - scroller.clientHeight)) break;
    }
    await sleep(700);
    await glide(scroller.scrollTop, 0, arg.pxPerSec * 2.2);
    await sleep(400);
  }
}

const GIF_FPS = 12;
const GIF_MAX_FRAMES = 360;

/** Frames out of the WebM with ffmpeg, then a GIF written here. */
async function webmToGif(videoPath: string, dir: string, gifWidth: number): Promise<Uint8Array> {
  const ffmpeg = findFfmpeg();
  const framesDir = join(dir, "frames");
  mkdirSync(framesDir, { recursive: true });
  await run(ffmpeg!, ["-y", "-hide_banner", "-loglevel", "error", "-i", videoPath, "-r", String(GIF_FPS), "-vf", `scale=${gifWidth}:-2`, "-f", "image2", "-pix_fmt", "rgb24", join(framesDir, "%05d.png")], { timeout: 120_000, maxBuffer: 1 << 24 });
  const files = readdirSync(framesDir).filter((f) => f.endsWith(".png")).sort();
  if (!files.length) throw new Error("ffmpeg wrote no frames.");
  // A long tour keeps its length but not every frame, so the file stays under what X takes.
  const keepEvery = Math.max(1, Math.ceil(files.length / GIF_MAX_FRAMES));
  const kept = files.filter((_, i) => i % keepEvery === 0);
  const frames = kept.map((f) => decodePng(readFileSync(join(framesDir, f))));
  const first = frames[0]!;
  return encodeGif(frames.map((f) => ({ data: f.data, stride: f.stride })), first.width, first.height, { delayMs: (1000 / GIF_FPS) * keepEvery });
}

export async function POST(request: Request) {
  const found = await findPlaywright();
  if (!found.pw) {
    return NextResponse.json({
      ok: false,
      reason: "no-playwright",
      message: `${NO_PLAYWRIGHT} Record the tab from the console instead.`,
      tried: found.tried,
    });
  }
  if (!found.video) {
    return NextResponse.json({
      ok: false,
      reason: "no-video",
      message: `${NO_VIDEO} Record the tab from the console instead.`,
      from: found.from,
    });
  }

  let body: { path?: string; device?: string; speed?: string; interact?: boolean; loops?: number; width?: number; format?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : "/builder/preview";
  const device = ["desktop", "tablet", "phone"].includes(body.device ?? "") ? body.device! : "desktop";
  const pxPerSec = body.speed === "slow" ? 160 : body.speed === "fast" ? 540 : 300;
  const width = [640, 960, 1280].includes(body.width ?? 0) ? body.width! : 960;
  const height = Math.round(width * 0.625);
  const wantGif = body.format !== "webm";

  const dir = mkdtempSync(join(tmpdir(), "tour-"));
  let browser: Awaited<ReturnType<PW["chromium"]["launch"]>> | null = null;
  try {
    browser = await found.pw.chromium.launch(await found.launchOptions());
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, recordVideo: { dir, size: { width, height } } });
    const page = await context.newPage();
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-live-scroller]", { timeout: 30_000 });
    await page.addStyleTag({ content: HIDE });
    await page.evaluate(tourInPage, { pxPerSec, interact: body.interact !== false, loops: Math.max(1, Math.min(4, body.loops ?? 1)), device });
    await page.waitForTimeout(300);
    const videoPath = await page.video()?.path();
    await context.close();
    if (!videoPath) throw new Error("Playwright did not write a video.");

    if (wantGif) {
      try {
        const gif = await webmToGif(videoPath, dir, Math.min(640, width));
        return new NextResponse(Buffer.from(gif), { headers: { "content-type": "image/gif", "x-tour-format": "gif", "x-tour-from": found.from, "content-disposition": 'inline; filename="tour.gif"' } });
      } catch (err) {
        // No ffmpeg, or one that could not: the WebM still goes back, marked as such.
        const bytes = readFileSync(videoPath);
        return new NextResponse(bytes, { headers: { "content-type": "video/webm", "x-tour-format": "webm", "x-tour-from": found.from, "x-tour-note": `GIF not made: ${err instanceof Error ? err.message.slice(0, 160) : "ffmpeg failed"}` } });
      }
    }
    const bytes = readFileSync(videoPath);
    return new NextResponse(bytes, { headers: { "content-type": "video/webm", "x-tour-format": "webm", "x-tour-from": found.from } });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "render", message: error instanceof Error ? error.message : "The render failed." });
  } finally {
    await browser?.close().catch(() => undefined);
    rmSync(dir, { recursive: true, force: true });
  }
}

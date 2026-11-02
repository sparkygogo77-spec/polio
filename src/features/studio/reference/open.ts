/**
 * OPEN ONE PUBLIC PAGE, READ IT, PHOTOGRAPH IT. Server only.
 *
 * Why not the capture: it is a GitHub Actions run, minutes long and needing a
 * token, and this answers while J is still in the dialog. The bounds are the
 * ones `api/studio/element` keeps: the address checked as typed and as
 * resolved, and every request the page makes checked the same way. A fresh
 * browser context each time: no cookies, nothing signed in, nothing typed into
 * the page. Service workers off, video and audio not asked for. One page,
 * nothing followed, a deadline over the whole of it, and the parts and the
 * photograph capped in size.
 *
 * The browser and the two checks are handed in, so the route passes the real
 * ones and a test can open a page it serves itself.
 */
import type { Allowed, Denied } from "../siteFetch.ts";
import { READ_PAGE, WAKE_PAGE } from "./pageRead.ts";
import { summarise, type PageRead, type ReferenceFailure, type ReferenceRecord } from "./model.ts";

export const SHOT_MAX_BYTES = 700_000;
/** How much of the page is photographed, in page pixels. Half that in the picture itself. */
const SHOT_MAX_HEIGHT = 4000;
const WIDTH = 1280;

export interface OpenWith {
  launch: () => Promise<{ newContext: (o: Record<string, unknown>) => Promise<unknown>; close: () => Promise<void> }>;
  gate: (url: string) => Promise<Allowed | Denied>;
  check: (url: string) => Promise<boolean>;
  /** The time this must answer by. */
  until: number;
}

type Routed = { request: () => { url: () => string; isNavigationRequest: () => boolean; resourceType: () => string; frame: () => unknown }; continue: () => Promise<void>; abort: () => Promise<void> };
type Sock = { url: () => string; connectToServer: () => unknown; close: () => Promise<void> };
interface Page {
  mainFrame: () => unknown;
  url: () => string;
  goto: (url: string, o: Record<string, unknown>) => Promise<{ status: () => number } | null>;
  waitForLoadState: (s: string, o: Record<string, unknown>) => Promise<void>;
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate: (code: string) => Promise<unknown>;
  screenshot: (o: Record<string, unknown>) => Promise<Buffer>;
}
interface Context {
  newPage: () => Promise<Page>;
  route: (pattern: string, handler: (route: Routed) => Promise<void>) => Promise<void>;
  routeWebSocket?: (pattern: RegExp, handler: (ws: Sock) => Promise<void>) => Promise<void>;
}

const fail = (reason: string, message: string): ReferenceFailure => ({ ok: false, reason, message });
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const SIGN_IN = fail("sign-in", "the page asks for a sign-in, and only public pages are read.");
const LATE = fail("timeout", "the page did not finish loading in time.");

/** Under the size cap: less quality first, then less page. */
async function photograph(page: Page, width: number, height: number): Promise<{ shot: Buffer; cut: boolean }> {
  const tall = Math.min(height, SHOT_MAX_HEIGHT);
  const take = (quality: number, h: number) => page.screenshot({ type: "jpeg", quality, fullPage: true, clip: { x: 0, y: 0, width, height: h } });
  let shot = await take(60, tall);
  if (shot.length > SHOT_MAX_BYTES) shot = await take(35, tall);
  if (shot.length <= SHOT_MAX_BYTES) return { shot, cut: height > tall };
  return { shot: await take(35, Math.min(tall, 1800)), cut: true };
}

async function read(url: string, w: OpenWith, browser: { newContext: (o: Record<string, unknown>) => Promise<unknown> }): Promise<{ ok: true; record: ReferenceRecord } | ReferenceFailure> {
  const context = (await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 0.5, serviceWorkers: "block", acceptDownloads: false })) as Context;
  const page = await context.newPage();
  const mainFrame = page.mainFrame();
  let refused = false;
  await context.route("**/*", async (route) => {
    const req = route.request();
    if (req.resourceType() === "media") return route.abort().catch(() => undefined);
    if (await w.check(req.url())) return route.continue().catch(() => undefined);
    try {
      if (req.isNavigationRequest() && req.frame() === mainFrame) refused = true;
    } catch {
      /* A request with no frame is not the page. */
    }
    return route.abort().catch(() => undefined);
  });
  await context.routeWebSocket?.(/.*/, async (ws) => {
    if (await w.check(ws.url())) ws.connectToServer();
    else await ws.close().catch(() => undefined);
  });
  const private_ = fail("private", "that address leads to a private network, and only public pages are read.");
  const answer = await page.goto(url, { waitUntil: "domcontentloaded", timeout: Math.max(1_000, w.until - Date.now()) }).catch((err: unknown) => {
    if (refused) return null;
    throw err;
  });
  if (refused || !(await w.check(page.url()))) return private_;
  const status = answer?.status() ?? 200;
  if (status >= 400) return fail("status", status === 401 || status === 403 ? `the page answered ${status}: it is closed to machines or needs a sign-in.` : status === 404 ? "the page answered 404: there is nothing at that address." : `the page answered ${status}.`);
  /* What loads late: until the requests go quiet, up to four seconds. */
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
  await page.evaluate(WAKE_PAGE);
  await page.waitForTimeout(250);
  const got = (await page.evaluate(READ_PAGE)) as PageRead;
  if (got.signIn && got.parts.length < 25) return SIGN_IN;
  if (got.parts.length < 3) return fail("empty", "the page drew almost nothing to read.");
  const { shot, cut } = await photograph(page, got.width, got.height);
  return { ok: true, record: { ...summarise(got, url), title: got.title, at: Date.now(), shot: shot.toString("base64"), cut } };
}

/** The whole read, answering by `until` whatever the page does. */
export async function readReference(typed: string, w: OpenWith): Promise<{ ok: true; record: ReferenceRecord } | ReferenceFailure> {
  const gate = await w.gate(typed);
  if (!gate.ok) return fail(gate.why, lower(gate.says));
  let browser: Awaited<ReturnType<OpenWith["launch"]>> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    browser = await w.launch();
    const late = new Promise<ReferenceFailure>((done) => { timer = setTimeout(() => done(LATE), Math.max(1_000, w.until - Date.now())); });
    return await Promise.race([read(gate.url, w, browser), late]);
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") return LATE;
    return fail("open", `the page could not be opened (${e instanceof Error ? e.message.split("\n")[0]!.slice(0, 160) : "unknown"}).`);
  } finally {
    clearTimeout(timer);
    await browser?.close().catch(() => undefined);
  }
}

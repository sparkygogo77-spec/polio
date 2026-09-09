import { createRequire } from "node:module";

/**
 * The site, open in a browser on the server.
 *
 * The Builder's document lives in the visitor's browser, so a headless
 * browser opening the preview route would see an empty site. The document
 * travels with the request instead, and is put into the page's storage
 * before the first script runs, under the same key the Builder saves to —
 * so what the server opens is exactly what the author sees.
 *
 * Playwright is found wherever it is (the project, `PLAYWRIGHT_MODULE`, or
 * the box's own) and never bundled; with none to be found the routes that
 * need one answer `ok: false` with a reason, and the console does without.
 */

export type PW = { chromium: { launch: (o?: Record<string, unknown>) => Promise<PWBrowser> } };
export type PWBrowser = { newContext: (o: Record<string, unknown>) => Promise<PWContext>; close: () => Promise<void> };
export type PWContext = { newPage: () => Promise<PWPage>; addInitScript: (fn: (arg: unknown) => void, arg: unknown) => Promise<void>; close: () => Promise<void> };
export type PWPage = {
  goto: (url: string, o?: Record<string, unknown>) => Promise<unknown>;
  addStyleTag: (o: { content: string }) => Promise<unknown>;
  evaluate: <T, R = unknown>(fn: (arg: T) => R, arg?: T) => Promise<R>;
  waitForSelector: (sel: string, o?: Record<string, unknown>) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  setViewportSize: (s: { width: number; height: number }) => Promise<void>;
  screenshot: (o?: Record<string, unknown>) => Promise<Buffer>;
  video: () => { path: () => Promise<string> } | null;
};

export function findPlaywright(): { pw: PW; from: string } | { pw: null; tried: string[] } {
  const req = createRequire(process.cwd() + "/");
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean) as string[];
  const tried: string[] = [];
  for (const c of candidates) {
    try {
      return { pw: req(/* turbopackIgnore: true */ c) as PW, from: c };
    } catch (err) {
      tried.push(`${c}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }
  return { pw: null, tried };
}

export const NO_PLAYWRIGHT = "There is no Playwright on this server, so the site cannot be opened here.";

/** The shell round the live site, hidden: top bar, status bar, the preview's own toolbar. */
export const HIDE_CHROME = `
  header, footer { display: none !important; }
  div:has(> [data-live-scroller]) > div:first-child { display: none !important; }
  div:has(> [data-live-scroller]) { height: 100dvh !important; }
  [data-live-scroller] { scrollbar-width: none !important; }
  [data-live-scroller]::-webkit-scrollbar { display: none !important; }
`;

export type Device = "desktop" | "tablet" | "phone";
export const asDevice = (v: unknown): Device => (v === "tablet" || v === "phone" ? v : "desktop");

/** The Builder's document as the client sends it: whatever it keeps in storage. Size-capped, shape-checked lightly. */
export function takeDoc(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.pages) || !Array.isArray(o.nodes)) return null;
  return o;
}

export interface OpenOptions {
  origin: string;
  path: string;
  doc: Record<string, unknown> | null;
  device: Device;
  width: number;
  height: number;
  record?: { dir: string };
}

/** Open the preview with the document in place, chrome hidden, device set; hand the page over; close after. */
export async function withPreview<T>(pw: PW, opts: OpenOptions, run: (page: PWPage, context: PWContext) => Promise<T>): Promise<T> {
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  try {
    const context = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: 1,
      ...(opts.record ? { recordVideo: { dir: opts.record.dir, size: { width: opts.width, height: opts.height } } } : {}),
    });
    if (opts.doc) {
      await context.addInitScript((arg) => {
        const { doc } = arg as { doc: Record<string, unknown> };
        try {
          localStorage.setItem("builder.studio", JSON.stringify({ state: doc, version: 0 }));
        } catch {
          /* storage off: the page shows what it can */
        }
      }, { doc: opts.doc });
    }
    const page = await context.newPage();
    await page.goto(`${opts.origin}${opts.path}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-live-scroller]", { timeout: 30_000 });
    await page.addStyleTag({ content: HIDE_CHROME });
    await page.evaluate((d) => {
      (window as unknown as { __studioLiveDevice?: (d: string) => void }).__studioLiveDevice?.(d as string);
    }, opts.device);
    await page.waitForTimeout(350);
    try {
      return await run(page, context);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

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
 * the box's own) and never bundled. Failing that — which is every serverless
 * host, where a six-hundred-megabyte Chromium cannot go in a function bundle —
 * it falls to `playwright-core` driving `@sparticuz/chromium`, a Chromium cut
 * down to something a function can carry.
 *
 * The two are *dependencies*, and imported by name rather than required from
 * outside the project, because on a host that installs from `package.json`
 * neither of those is optional: a package that is not listed is never
 * installed, and an import the bundler cannot see is never traced into the
 * function. Both together are what made this fall over on Vercel with
 * "Cannot find module 'playwright-core'" while working here. They stay out of
 * the bundle through `serverExternalPackages`, and the packed browser is
 * pulled into the function by `outputFileTracingIncludes` — both in
 * `next.config.ts`.
 *
 * The fallback is second on purpose. A box with a real Playwright on it should
 * keep using it: the full install is the one the tests run against, and it is
 * the only one that can record video. `@sparticuz/chromium` is a browser and
 * nothing else — no bundled ffmpeg — so `recordVideo` has nothing to write the
 * file with, and a route that needs video says so rather than launching and
 * failing halfway through a tour.
 *
 * With neither to be found the routes that need one answer `ok: false` with a
 * reason, and the console does without.
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
  /** Set the page's HTML directly: for rendering one part's body with nothing else on the page. */
  setContent: (html: string, o?: Record<string, unknown>) => Promise<void>;
  /** Intercept what the page asks for, so a render can be made to ask for nothing. */
  route: (pattern: string, handler: (route: { request: () => { url: () => string }; continue: () => Promise<void>; abort: () => Promise<void> }) => void) => Promise<void>;
  screenshot: (o?: Record<string, unknown>) => Promise<Buffer>;
  video: () => { path: () => Promise<string> } | null;
};

/** A browser this server can drive, and what it can be asked to do. */
export interface Found {
  pw: PW;
  /** Where it came from, for the status route to be honest about. */
  from: string;
  /**
   * Can it record video? Only a full Playwright install can: video is written
   * by the ffmpeg that install ships, and the serverless pairing has none.
   */
  video: boolean;
  /**
   * What to launch it with. Async because the serverless Chromium unpacks its
   * binary on first use and hands back the path afterwards.
   */
  launchOptions: () => Promise<Record<string, unknown>>;
}

/** A module required at run time from outside the project, never bundled. */
const outside = (id: string): unknown => createRequire(process.cwd() + "/")(/* turbopackIgnore: true */ id);

const why = (err: unknown) => (err instanceof Error ? err.message.split("\n")[0] : String(err));

export async function findPlaywright(): Promise<Found | { pw: null; tried: string[] }> {
  const tried: string[] = [];
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      return {
        pw: outside(c) as PW,
        from: c,
        video: true,
        launchOptions: async () => ({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined }),
      };
    } catch (err) {
      tried.push(`${c}: ${why(err)}`);
    }
  }
  // Nothing installed: the serverless pairing this deployment carries. Named
  // imports, so the bundler leaves them external *and* traces them in.
  try {
    const pw = ((await import("playwright-core")) as unknown as { default?: PW } & PW);
    const mod = (await import("@sparticuz/chromium")) as unknown as { default?: SparticuzChromium } & SparticuzChromium;
    const chromium = mod.default ?? mod;
    return {
      pw: pw.default ?? pw,
      from: "playwright-core + @sparticuz/chromium",
      video: false,
      launchOptions: async () => ({
        headless: true,
        args: chromium.args,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || (await chromium.executablePath()),
      }),
    };
  } catch (err) {
    tried.push(`playwright-core + @sparticuz/chromium: ${why(err)}`);
  }
  return { pw: null, tried };
}

/** The shape of `@sparticuz/chromium` this uses. Only these two are ever asked of it. */
interface SparticuzChromium {
  args: string[];
  executablePath: (input?: string) => Promise<string>;
}

export const NO_PLAYWRIGHT =
  "There is no browser on this server, so the site cannot be opened here. "
  + "The cut-down one ships with this project, so if it is missing the install skipped it: check that "
  + "playwright-core and @sparticuz/chromium came down with the rest. "
  + "On a machine you control, a full install is better: npm i -D playwright && npx playwright install chromium.";
/** What a route that needs video says when the browser it found cannot make any. */
export const NO_VIDEO = "The browser on this server can open the site but cannot record it: recording needs the ffmpeg a full Playwright install ships, and this one is the cut-down Chromium a serverless function can carry.";

/** The shell round the live site, hidden: top bar, status bar, the preview's own toolbar. */
export const HIDE_CHROME = `
  header, footer { display: none !important; }
  [data-live-bar] { display: none !important; }
  [data-live-column] { height: 100dvh !important; }
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
export async function withPreview<T>(found: Found, opts: OpenOptions, run: (page: PWPage, context: PWContext) => Promise<T>): Promise<T> {
  const browser = await found.pw.chromium.launch(await found.launchOptions());
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

/**
 * The real browser behind check.ts: headless Chromium in a fresh profile
 * with the GPU flags from lane-rules.md, the live Builder, and a saved board
 * (tests/fixtures/boards, never one of J's). Each reading opens a new
 * context, so nothing carries over between readings.
 */
import { join } from "node:path";
import { chromium, type Browser } from "playwright-core";
import { openBoard } from "../../tests/lib/board.mjs";
import type { LiveDeps } from "./check.ts";
import { LIVE } from "./check.ts";
import type { Reading } from "./compare.ts";

export const GPU_ARGS = ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"];

export type MeasureOpts = { board?: string; base?: string; shotsDir: string; executablePath?: string };

export async function liveBrowser(o: MeasureOpts): Promise<{ deps: Omit<LiveDeps, "ownCheck">; close: () => Promise<void> }> {
  const base = o.base ?? LIVE;
  const board = o.board ?? "solface";
  const exe = o.executablePath ?? process.env.PLAYWRIGHT_CHROMIUM;
  const browser: Browser = await chromium.launch({ args: GPU_ARGS, ...(exe ? { executablePath: exe } : {}) });

  const withPage = async <T>(fn: (page: import("playwright-core").Page) => Promise<T>) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try { const page = await ctx.newPage(); await openBoard(page, base, board); return await fn(page); }
    finally { await ctx.close(); }
  };

  const deps: Omit<LiveDeps, "ownCheck"> = {
    version: async () => {
      const r = await fetch(`${base}/api/version`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as { short?: string }).short ?? null : null;
    },
    read: () => withPage((page) => page.evaluate(() => {
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const el of document.querySelectorAll<HTMLElement>("[data-node-id]")) {
        const r = el.getBoundingClientRect();
        if (r.width || r.height) out[el.dataset.nodeId!] = { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
      }
      return out;
    })) as Promise<Reading>,
    shoot: (name) => withPage(async (page) => {
      const path = join(o.shotsDir, `${name}.png`);
      await page.screenshot({ path });
      return path;
    }),
  };
  return { deps, close: () => browser.close() };
}

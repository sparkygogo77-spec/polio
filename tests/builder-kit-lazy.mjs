#!/usr/bin/env node
/**
 * THE CODE KIT LOADS WHEN IT IS EXPORTED, NOT WITH THE BUILDER.
 *
 * `codeSend.ts` (behind the Publish buttons, on every Builder page) imported
 * `exportForCode.ts` for one function, and with it the code kit's file texts
 * (`kitFiles.ts`, 174 KB; 201 KB with the exporter). Every route paid for
 * them, though only "Export for code" and "Send the design back" read them.
 *
 *   1. `/builder` loads none of the kit's texts (found by a string only
 *      `kitFiles.ts` holds), and under 4,120 KB of script (4,266 before,
 *      4,065 after);
 *   2. asking for the export still finds the kit: the exporter loads on
 *      demand and makes its design record.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/builder-kit-lazy.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/codeSend.ts
 */
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const BUDGET_KB = 4120;
const KIT_MARK = "Everything a person sees is a real tagged element";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const scripts = [];
page.on("response", (r) => { if (r.request().resourceType() === "script" && r.url().startsWith(URL_BASE)) scripts.push(r.text().catch(() => "")); });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL_BASE + "/builder", { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(1500);
const first = await Promise.all(scripts.splice(0));
const kb = Math.round(first.reduce((t, s) => t + Buffer.byteLength(s), 0) / 1024);
check("/builder loads none of the code kit", !first.some((t) => t.includes(KIT_MARK)));
check(`/builder loads under ${BUDGET_KB} KB of script`, kb < BUDGET_KB, `${kb} KB in ${first.length} files`);

/* The Builder's own handle on the exporter (`page/StudioPage.tsx`), the same import the export buttons make. */
const record = await page.evaluate(async () => {
  const w = window;
  for (let i = 0; i < 100 && !w.__studioRecord; i++) await new Promise((r) => setTimeout(r, 100));
  return w.__studioRecord ? w.__studioRecord() : null;
});
const later = await Promise.all(scripts.splice(0));
check("the export loads the kit when asked", later.some((t) => t.includes(KIT_MARK)), `${later.length} files fetched on demand`);
check("the export makes its design record", !!record && typeof record === "object" && "record" in record && typeof record.site === "string", record ? Object.keys(record).slice(0, 6).join(", ") : "no record");
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);

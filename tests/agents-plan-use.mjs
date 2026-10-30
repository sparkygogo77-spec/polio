/**
 * Agents panel, spend: the plan-use reading Claude Code really sends.
 *
 * MEASURED on J's PC (Claude Code 2.1.309, 2026-10-29): every turn of
 * `claude -p --output-format stream-json --verbose` carries a
 * `rate_limit_event` whose share is under `unifiedWindows` (five_hour,
 * seven_day), with no top-level `utilization`. The reader looked only at the
 * top level, so the dock's plan meter stayed blank in both smoke runs. Now
 * the window nearest its limit is read, and named.
 *
 *   node --import <pw-args.mjs> tests/agents-plan-use.mjs
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
};

let St = null, S = null, C = null;
try {
  St = await import("../helper/agents/stream.ts");
  S = await import("../helper/agents/spend.ts");
  C = await import("../helper/contract.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the stream reader, the spend book and the contract load", !!(St && S && C));
if (!(St && S && C)) done();

// The line exactly as Claude Code 2.1.309 wrote it on J's PC (ids replaced).
const REAL = { type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 1793324400, rateLimitType: "five_hour", overageStatus: "rejected", overageDisabledReason: "out_of_credits", isUsingOverage: false,
  unifiedWindows: { five_hour: { utilization: 0.06, resetsAt: 1793324400 }, seven_day: { utilization: 0.08, resetsAt: 1793570400 } } }, uuid: "u", session_id: "s" };

const ev = new St.StreamReader().read(REAL);
const plan = ev.find((e) => e.type === "plan")?.plan;
check("the real event becomes a plan reading", !!plan, JSON.stringify(ev));
check("it reads the window nearest its limit: the weekly one at 8%", plan?.used === 0.08 && plan.window === "seven_day", JSON.stringify(plan));
check("with that window's reset time, in Unix seconds", plan?.resetsAt === 1793570400, JSON.stringify(plan));
check("and the status Claude Code gave", plan?.status === "allowed");

const nearFive = St.planUseOf({ ...REAL.rate_limit_info, status: "allowed_warning", unifiedWindows: { five_hour: { utilization: 0.91, resetsAt: 1793324400 }, seven_day: { utilization: 0.3, resetsAt: 1793570400 } } });
check("when the 5-hour window is nearer, that one is shown", nearFive?.used === 0.91 && nearFive.window === "five_hour" && nearFive.resetsAt === 1793324400, JSON.stringify(nearFive));
const top = St.planUseOf({ status: "allowed", utilization: 0.4, resetsAt: 1793030400, rateLimitType: "five_hour", unifiedWindows: REAL.rate_limit_info.unifiedWindows });
check("a top-level utilization, if a CLI sends one, still wins", top?.used === 0.4 && top.window === "five_hour", JSON.stringify(top));
const rejected = St.planUseOf({ status: "rejected", resetsAt: 1793324400, rateLimitType: "five_hour" });
check("a rejected status with no share still reads as at the limit (the runner pauses)", rejected?.used === 1 && rejected.status === "rejected", JSON.stringify(rejected));
check("an allowed status with no share at all is still dropped", St.planUseOf({ status: "allowed" }) === null);
check("ms timestamps and percentages are read as before", St.planUseOf({ status: "allowed", unifiedWindows: { five_hour: { utilization: 55, resetsAt: 1793324400000 } } })?.used === 0.55);

const book = new S.SpendBook();
book.open("r", "lane", "plan");
book.setPlan(plan);
const line = book.message("r");
check("the spend line carries it and is a good contract message", line.plan?.window === "seven_day" && C.problems(line).length === 0, C.problems(line).join("; "));
check("the contract stays at its version (window is optional)", line.v === C.CONTRACT_VERSION);
check("the contract refuses a window that isn't a short name", C.problems({ ...line, plan: { ...line.plan, window: 7 } }).length > 0);

// ---- the dock -----------------------------------------------------------------
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require("playwright-core")); } catch { /* below */ }
if (chromium) {
  const { serveDock } = await import("../helper/dock/serve.mjs");
  const server = await serveDock({ port: 0 });
  const browser = await chromium.launch();
  const meter = async (url) => {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}${url}`);
    await page.waitForSelector("body[data-dock-ready]");
    const t = (await page.textContent('[data-meter="plan"]')).replace(/\s+/g, " ").trim();
    await page.close();
    return t;
  };
  try {
    check("before any reading the dock says Claude Code hasn't reported it, not a blank", /not reported by Claude Code yet/.test(await meter("/dock?fake=1&demo=0&delay=100000")));
    const named = await meter("/dock?fake=1");
    check("a reading names its window in plain words", /31% of your 5-hour limit used/.test(named), named);
  } finally { await browser.close(); server.close(); }
} else check("a browser kit is there", false);

done();

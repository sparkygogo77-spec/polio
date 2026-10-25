/**
 * Agents panel, the dock taking context from the Builder (helper/dock/context.ts
 * and its listener in dock.ts).
 *
 * - Only from https://polio-two.vercel.app; any other origin is ignored.
 * - Only data: chips, the part action, the part, its System tokens.
 * - Anything control-shaped (a token, start, approve, pause, stop) is
 *   refused whole, at any depth, and starts nothing.
 * - In the dock: the chips and the action fill in, the target follows the
 *   action, and the request J then sends carries that action.
 *
 *   node tests/agents-dock-context.mjs
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = (code) => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(code ?? (passed === results.length ? 0 : 1));
};

let take = null, serveDock = null;
try {
  ({ takeContext: take } = await import("../helper/dock/context.ts"));
  ({ serveDock } = await import("../helper/dock/serve.mjs"));
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the context gate and the dock load", typeof take === "function" && typeof serveDock === "function");
if (!take || !serveDock) done(1);

const BUILDER = "https://polio-two.vercel.app";
const ctx = (extra = {}) => ({
  source: "polio-builder", kind: "context", v: 1, action: "security",
  chips: [{ kind: "part", id: "n_cta_16", name: "Join button" }, { kind: "page", id: "home" }, { kind: "shot", ref: "board:home@1440#n_cta_16" }],
  part: { id: "n_cta_16", kind: "Cta", name: "Join button", box: { x: 1, y: 2, w: 3, h: 4 } },
  page: { id: "home", name: "Home", path: "/" }, shot: { ref: "board:home@1440#n_cta_16", width: 1440 },
  systemTokens: [{ field: "colour.bg", tokenId: "t1", name: "accent", value: "#22ff88" }],
  ...extra,
});

// ---- the gate, pure --------------------------------------------------------
const ok = take(BUILDER, ctx());
check("the Builder's context is taken", !("refused" in ok) && ok.action === "security" && ok.chips.length === 3 && ok.part?.id === "n_cta_16" && ok.tokens.length === 1);
check("another origin is refused", "refused" in take("https://evil.example", ctx()));
check("a captured site's own origin is refused", "refused" in take("https://thesolface.site", ctx()));
check("a non-context message is refused", "refused" in take(BUILDER, { ...ctx(), kind: "control" }));
for (const bad of [{ token: "x" }, { do: "approve" }, { stop: true }, { part: { id: "a", kind: "b", name: "c", pairing: "123456" } }, { chips: [{ kind: "part", id: "a", control: { do: "start" } }] }]) {
  const r = take(BUILDER, ctx(bad));
  check(`a message carrying ${JSON.stringify(bad).slice(0, 50)} is refused whole`, "refused" in r, r.refused ?? "taken");
}
check("an unknown action is refused", "refused" in take(BUILDER, ctx({ action: "deploy" })));
check("unknown chip kinds are dropped", take(BUILDER, ctx({ chips: [{ kind: "file", path: "C:/x" }, { kind: "page", id: "p" }] })).chips.length === 1);

// ---- in the dock -----------------------------------------------------------
const server = await serveDock({ port: 0 });
const BASE = `http://127.0.0.1:${server.address().port}`;
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath: existsSync(AT) ? AT : undefined });
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 420, height: 1200 } })).newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/dock?delay=0&demo=0`);
await page.waitForSelector("[data-dock-ready]");

const post = (origin, data) => page.evaluate(([o, d]) => window.dispatchEvent(new MessageEvent("message", { origin: o, data: d })), [origin, data]);
const state = () => page.evaluate(() => ({
  chips: window.__dock.chips.map((c) => c.kind), action: window.__dock.action,
  target: document.querySelector('[name="target"]:checked')?.value, sent: window.__dock.sent.length,
  refused: window.__dock.contextsRefused.length, request: window.__dock.request,
  chipText: document.querySelector("[data-chips]").textContent,
}));

await post("https://evil.example", ctx());
let s = await state();
check("in the dock, another origin changes nothing", s.action === null && s.refused === 1);

await post(BUILDER, ctx({ do: "stop" }));
s = await state();
check("in the dock, a control-shaped message changes nothing and sends nothing", s.action === null && s.sent === 0 && s.refused === 2);

await post(BUILDER, ctx());
s = await state();
check("the Builder's context fills the chips and the action", s.action === "security" && s.chips.join() === "part,page,shot" && /Join button/.test(s.chipText), JSON.stringify(s));
check("it starts nothing", s.sent === 0 && s.request === null);

await post(BUILDER, ctx({ action: "backend" }));
s = await state();
check("Build its backend picks the Backend target", s.action === "backend" && s.target === "backend");

await post(BUILDER, ctx({ action: "change" }));
await page.fill("[data-prompt]", "Make it calmer");
await page.click("[data-plan-it]");
s = await state();
check("the request J sends carries the action and the chips", s.request?.action === "change" && s.request?.chips?.length === 3 && s.target === "site", JSON.stringify(s.request));

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
done();

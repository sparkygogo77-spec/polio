/**
 * Agents panel, spend: cache reads aren't new tokens.
 *
 * Claude Code re-reads the whole conversation from its prompt cache on every
 * turn, so `cache_read_input_tokens` grows by the context size each turn.
 * The first real smoke run on J's PC (2026-10-29) counted those reads as
 * input: a two-step task read as 424,000 tokens after 8 turns and hit the
 * 400,000 per-request cap. Fresh input, cache writes and output are what
 * count toward the caps and the headline number; cache reads stay visible on
 * their own (`tokens.cached`, an optional contract field).
 *
 * The fixture is shaped like that run: 8 turns, each assistant message sent
 * twice (two content blocks, same id), reads growing by about 55,000 a turn.
 *
 *   node --import <pw-args.mjs> tests/agents-cache-tokens.mjs
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

// ---- the fixture: 8 turns of stream-json ------------------------------------------
const TURNS = 8;
const lines = [{ type: "system", subtype: "init", session_id: "s-smoke" }];
let reads = 0, fresh = 0, out = 0;
for (let k = 0; k < TURNS; k++) {
  const usage = { input_tokens: 6, cache_creation_input_tokens: 1800, cache_read_input_tokens: 14_000 + 55_000 * k, output_tokens: 350 };
  reads += usage.cache_read_input_tokens; fresh += usage.input_tokens + usage.cache_creation_input_tokens; out += usage.output_tokens;
  const msg = (content) => ({ type: "assistant", session_id: "s-smoke", message: { id: `msg-${k}`, content, usage } });
  lines.push(msg([{ type: "text", text: k === 0 ? "[step:red] writing the red test" : "working" }]));
  lines.push(msg([{ type: "tool_use", id: `t${k}`, name: "Read", input: {} }]));
  lines.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: `t${k}`, content: "ok" }] } });
}
lines.push({ type: "result", subtype: "success", is_error: false, session_id: "s-smoke", usage: {} });

const reader = new St.StreamReader();
const events = lines.flatMap((m) => reader.read(m));
const usage = events.filter((e) => e.type === "usage");
const sum = usage.reduce((t, e) => ({ in: t.in + e.tokens.in, out: t.out + e.tokens.out, cached: t.cached + (e.tokens.cached ?? 0) }), { in: 0, out: 0, cached: 0 });

check("input is fresh input plus cache writes, not cache reads", sum.in === fresh, `${sum.in} vs ${fresh}`);
check("output counts as before", sum.out === out, `${sum.out}`);
check("cache reads are kept, on their own", sum.cached === reads, `${sum.cached} vs ${reads}`);
check("a message sent twice still counts once", usage.length === TURNS, String(usage.length));

// ---- the spend book and the cap -------------------------------------------------------
const book = new S.SpendBook({ caps: { tokensPerRequest: 400_000, tokensPerDay: 2_000_000 } });
book.open("r-smoke", "helper-readme-note", "plan");
for (const e of usage) book.add("helper-readme-note", e.tokens);
const line = book.message("r-smoke");
check("the request's headline tokens are fresh + output only", book.requestTokens("r-smoke") === fresh + out, `${book.requestTokens("r-smoke")} (the smoke run read ${fresh + reads + out})`);
check("a tiny task stays far under the 400,000 cap", book.over().length === 0, JSON.stringify(book.over()));
check("the spend line carries cache reads separately, lane and request", line.lanes[0].tokens?.cached === reads && line.tokens.cached === reads, JSON.stringify(line.tokens));
check("the spend line is a valid contract message", C.problems(line).length === 0, C.problems(line).join("; "));
check("the contract stays at its version (an optional field)", line.v === C.CONTRACT_VERSION);
check("the contract refuses a broken cached count", C.problems({ ...line, tokens: { ...line.tokens, cached: -1 } }).length > 0);

// Reads still feed the day cap? No: caps are what J's plan spends fresh.
const tight = new S.SpendBook({ caps: { tokensPerDay: fresh + out + 1 } });
tight.open("r", "x", "plan");
for (const e of usage) tight.add("x", e.tokens);
check("the day cap counts no cache reads either", tight.over().length === 0, JSON.stringify(tight.over()));

// ---- the dock shows the reads, apart from the headline ----------------------------------
const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require("playwright-core")); } catch { /* below */ }
if (chromium) {
  const { serveDock } = await import("../helper/dock/serve.mjs");
  const server = await serveDock({ port: 0 });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/dock?fake=1&delay=0`);
    await page.waitForSelector("[data-spend-pc]");
    const pc = (await page.textContent("[data-spend-pc]")).replace(/\s+/g, " ").trim();
    const row = (await page.textContent('[data-spend-row="hero-calm"]')).replace(/\s+/g, " ").trim();
    check("the dock's PC meter shows tokens, with cache reads said apart", /228k tokens/.test(pc) && /1\.9M read from cache/.test(pc), pc);
    check("the lane's row keeps the headline count", row.includes("228k") && !row.includes("1.9M"), row);
  } finally { await browser.close(); server.close(); }
} else check("a browser kit is there", false);

done();

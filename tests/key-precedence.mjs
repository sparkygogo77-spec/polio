#!/usr/bin/env node
/**
 * THE KEY HE TYPES INTO KEYS IS THE ONE EVERY ROUTE USES.
 *
 * What he would have seen: on a Builder whose server has a Claude key of its
 * own, he pastes his own into Keys to use his own limit and his own billing,
 * and nothing changes. Generate, the written body and the drawing board's
 * reading went on calling Claude with the server's key, because those routes
 * took the server's first; Go live did the same with Vercel, and the updates
 * list with GitHub. Publish, the renderer and the remake did it the other way
 * round, so two keys pasted side by side behaved differently, and Try it told
 * him his Claude key worked while the calls went on using the server's.
 *
 * Every route now picks through one rule, `keyFor`: the key in Keys (its own
 * header on the request) wins, the server's variable of the same name is the
 * fallback, and a key of eight characters or fewer is dropped as if none were
 * offered. Checked here:
 *
 *   1. the rule itself, for all five keys;
 *   2. the real handlers, called in-process with a server key AND his key
 *      set, against a stand-in Anthropic, Vercel, GitHub and OpenAI: the key
 *      that leaves is his, on the routes that used to send the server's
 *      (generate, body, reshape, Try it, Go live, the updates list) and on
 *      the ones that always sent his (publish, the remake);
 *   3. wiring (source reads): every route that takes a key picks it through
 *      `keyFor` and none reads a key's variable on its own; the Keys panel no
 *      longer says his key is used only when the server has none; and the
 *      browser follows a deployment with the token that made it.
 *
 * Stand-in keys only (STANDIN_*): nothing leaves the machine, and no server
 * or browser is needed.
 *
 *   node tests/key-precedence.mjs
 *
 * Covers: src/app/api/keyFor.ts, src/app/api/studio/body/route.ts, src/app/api/studio/generate/route.ts, src/app/api/studio/reshape/route.ts, src/app/api/keys/test/route.ts, src/app/api/studio/deploy/route.ts, src/app/api/updates/route.ts, src/app/api/studio/image/route.ts, src/app/api/studio/remake/route.ts, src/app/api/studio/publish/route.ts, src/app/api/studio/merge/route.ts, src/app/api/studio/branches/route.ts, src/app/api/studio/repo/route.ts, src/app/api/studio/repo/choices/route.ts, src/features/studio/loop/agent.ts, src/features/keys/KeysPanel.tsx
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 300)}`}`);
};

/* ------------------------------------------------- stand-in keys, both sides */
const SERVER = {
  ANTHROPIC_API_KEY: "STANDIN_SERVER_CLAUDE_KEY",
  REPLICATE_API_TOKEN: "STANDIN_SERVER_REPLICATE_TOKEN",
  OPENAI_API_KEY: "STANDIN_SERVER_OPENAI_KEY",
  GITHUB_TOKEN: "STANDIN_SERVER_GITHUB_TOKEN",
  VERCEL_TOKEN: "STANDIN_SERVER_VERCEL_TOKEN",
};
const HIS = {
  "x-anthropic-key": "STANDIN_HIS_CLAUDE_KEY",
  "x-replicate-key": "STANDIN_HIS_REPLICATE_TOKEN",
  "x-openai-key": "STANDIN_HIS_OPENAI_KEY",
  "x-github-token": "STANDIN_HIS_GITHUB_TOKEN",
  "x-vercel-token": "STANDIN_HIS_VERCEL_TOKEN",
};
Object.assign(process.env, SERVER, {
  GITHUB_API: "https://github.test",
  VERCEL_API: "https://vercel.test",
  OPENAI_API: "https://openai.test",
  /* The updates list asks GitHub for this commit of this repository. */
  VERCEL_GIT_REPO_OWNER: "someone",
  VERCEL_GIT_REPO_SLUG: "builder",
  VERCEL_GIT_COMMIT_SHA: "abc1234def5678",
});
delete process.env.GITHUB_REPOS;

/* Every outgoing call: where it went, and the key it carried. */
const sent = [];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const h = new Headers(init.headers ?? (url instanceof Request ? url.headers : undefined));
  sent.push({ host: u.host, path: u.pathname, key: h.get("x-api-key") ?? (h.get("authorization") ?? "").replace(/^Bearer /, "") });
  if (u.host === "api.anthropic.com" && u.pathname.startsWith("/v1/models/")) return json(200, { type: "model", id: "claude-opus-5", display_name: "Claude Opus 5", created_at: "2026-01-01T00:00:00Z" });
  if (u.host === "api.anthropic.com") return json(401, { type: "error", error: { type: "authentication_error", message: "stand-in refuses every key" } });
  if (u.host === "api.vercel.com" && u.pathname === "/v2/user") return json(200, { user: { username: "him" } });
  if (u.host === "vercel.test") return json(200, { readyState: "READY", url: "site.vercel.app", alias: [] });
  if (u.host === "github.test" && /\/commits$/.test(u.pathname)) return json(200, []);
  if (u.host === "openai.test") return json(401, { error: { message: "stand-in refuses every key" } });
  return json(401, { message: "stand-in refuses every key" });
};

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@site": join(ROOT, "site.config.ts"), "@": join(ROOT, "src") } });
const load = (f) => jiti.import(join(ROOT, f));

/* ------------------------------------------------- 1. the rule */
const { keyFor, KEY_ENV } = await load("src/app/api/keyFor.ts");
const asked = (headers) => new Request("http://polio.test/api/x", { headers });
check("every key the Keys panel holds has its pair: a header and the server's variable", Object.keys(HIS).every((h) => KEY_ENV[h]) && Object.keys(KEY_ENV).length === 5, JSON.stringify(KEY_ENV));
for (const [header, name] of Object.entries(KEY_ENV)) {
  const env = { [name]: SERVER[name] };
  const both = keyFor(asked({ [header]: HIS[header] }), header, env);
  check(`${name}: his key wins over the server's`, both?.key === HIS[header] && both?.source === "browser", JSON.stringify(both));
  const none = keyFor(asked({}), header, env);
  check(`${name}: with nothing typed, the server's is the fallback`, none?.key === SERVER[name] && none?.source === "server", JSON.stringify(none));
  const short = keyFor(asked({ [header]: "8chars!!" }), header, env);
  check(`${name}: eight characters or fewer is not a key, so the server's is used`, short?.key === SERVER[name] && short?.source === "server", JSON.stringify(short));
}
check("a key is trimmed before it is used", keyFor(asked({ "x-anthropic-key": `  ${HIS["x-anthropic-key"]}  ` }), "x-anthropic-key", {})?.key === HIS["x-anthropic-key"]);
check("neither side: no key at all", keyFor(asked({}), "x-github-token", {}) === null && keyFor(asked({ "x-github-token": "short" }), "x-github-token", { GITHUB_TOKEN: "  " }) === null);
check("the routes' own environment is the default", keyFor(asked({}), "x-vercel-token")?.key === SERVER.VERCEL_TOKEN);

/* ------------------------------------------------- 2. the real handlers, both keys set */
const call = async (file, method, headerName, body, { url = "http://polio.test/api/x", typed = true } = {}) => {
  const route = await load(file);
  sent.length = 0;
  const headers = { "content-type": "application/json", ...(typed ? { [headerName]: HIS[headerName] } : {}) };
  const res = await route[method](new Request(url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  return { res, a: await res.clone().json().catch(() => null), out: [...sent] };
};
const keysOut = (out, host) => [...new Set(out.filter((c) => c.host === host).map((c) => c.key))];
const square = { strokes: [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]]], words: "" };

for (const [name, file, body] of [
  ["Generate", "src/app/api/studio/generate/route.ts", { markdown: "# A site\n\nOne page.", mode: "plan" }],
  ["the written body", "src/app/api/studio/body/route.ts", { prompt: "a five-pointed star" }],
  ["the drawing board's reading", "src/app/api/studio/reshape/route.ts", { sketch: square }],
]) {
  const { a, out } = await call(file, "POST", "x-anthropic-key", body);
  const used = keysOut(out, "api.anthropic.com");
  check(`${name} calls Claude with his key, not the server's`, used.length === 1 && used[0] === HIS["x-anthropic-key"], `${used.join(", ") || "Claude was never called"} (${JSON.stringify(a)?.slice(0, 160)})`);
}
{
  const { a, out } = await call("src/app/api/studio/body/route.ts", "POST", "x-anthropic-key", { prompt: "a five-pointed star" }, { typed: false });
  const used = keysOut(out, "api.anthropic.com");
  check("…and with nothing typed, the server's still works", used.length === 1 && used[0] === SERVER.ANTHROPIC_API_KEY, `${used.join(", ") || "Claude was never called"} (${JSON.stringify(a)?.slice(0, 160)})`);
}

{
  const { a, out } = await call("src/app/api/keys/test/route.ts", "POST", "x-anthropic-key", { service: "anthropic" });
  check("Try it tries his Claude key, the one the routes now use, and says it is his", a?.ok === true && a?.source === "browser" && keysOut(out, "api.anthropic.com")[0] === HIS["x-anthropic-key"] && /browser's key works/.test(a?.message ?? ""), JSON.stringify(a));
  const v = await call("src/app/api/keys/test/route.ts", "POST", "x-vercel-token", { service: "vercel" });
  check("…and his Vercel token", v.a?.ok === true && v.a?.source === "browser" && keysOut(v.out, "api.vercel.com")[0] === HIS["x-vercel-token"], JSON.stringify(v.a));
  const g = await call("src/app/api/keys/test/route.ts", "POST", "x-github-token", { service: "github" });
  check("…and his GitHub token, as before", g.a?.source === "browser" && keysOut(g.out, "api.github.com")[0] === HIS["x-github-token"], JSON.stringify(g.a));
  const none = await call("src/app/api/keys/test/route.ts", "POST", "x-anthropic-key", { service: "anthropic" }, { typed: false });
  check("…and with nothing typed, the server's, said to be the server's", none.a?.source === "server" && keysOut(none.out, "api.anthropic.com")[0] === SERVER.ANTHROPIC_API_KEY, JSON.stringify(none.a));
}

{
  const status = await call("src/app/api/studio/deploy/route.ts", "GET", "x-vercel-token", undefined, { url: "http://polio.test/api/studio/deploy" });
  check("Go live: offered his Vercel token, it says the token is his", status.a?.configured === true && status.a?.source === "browser", JSON.stringify(status.a));
  const bare = await call("src/app/api/studio/deploy/route.ts", "GET", "x-vercel-token", undefined, { url: "http://polio.test/api/studio/deploy", typed: false });
  check("…and with nothing offered, the server's", bare.a?.source === "server", JSON.stringify(bare.a));
  const follow = await call("src/app/api/studio/deploy/route.ts", "GET", "x-vercel-token", undefined, { url: "http://polio.test/api/studio/deploy?id=dpl_STANDIN" });
  const used = keysOut(follow.out, "vercel.test");
  check("…and follows a deployment with his token, not the server's", used.length === 1 && used[0] === HIS["x-vercel-token"], `${used.join(", ") || "Vercel was never asked"} (${JSON.stringify(follow.a)?.slice(0, 160)})`);
}

{
  const { res, out } = await call("src/app/api/updates/route.ts", "GET", "x-github-token", undefined, { url: "http://polio.test/api/updates" });
  const used = keysOut(out, "github.test");
  check("the updates list reads GitHub with his token, not the server's", used.length >= 1 && used.every((k) => k === HIS["x-github-token"]), used.join(", ") || "GitHub was never asked");
  check("…and an answer read with his token is not cached for everyone", /^private/.test(res.headers.get("cache-control") ?? ""), res.headers.get("cache-control"));
}

{
  const { out } = await call("src/app/api/studio/publish/route.ts", "POST", "x-github-token", { files: [{ path: "a.txt", content: "x" }], repo: "someone/a-site" });
  const used = keysOut(out, "github.test");
  check("Publish still pushes with his GitHub token", used.length >= 1 && used.every((k) => k === HIS["x-github-token"]), used.join(", ") || "GitHub was never asked");
  const r = await call("src/app/api/studio/remake/route.ts", "POST", "x-openai-key", { probe: true });
  const usedR = keysOut(r.out, "openai.test");
  check("the remake still asks OpenAI with his key", usedR.length >= 1 && usedR.every((k) => k === HIS["x-openai-key"]), `${usedR.join(", ") || "OpenAI was never asked"} (${JSON.stringify(r.a)?.slice(0, 160)})`);
}

/* ------------------------------------------------- 3. wiring (source reads) */
const routes = [];
const walk = (d) => {
  for (const f of readdirSync(join(ROOT, d))) {
    const p = join(d, f).replaceAll("\\", "/"); /* repo-relative with forward slashes, as the lists below spell them */
    if (statSync(join(ROOT, p)).isDirectory()) walk(p);
    else if (f === "route.ts") routes.push(p);
  }
};
walk("src/app/api");
const bare = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const VARS = Object.values(KEY_ENV).join("|");
/* A key's variable read on its own, outside a status answer that only says whether it is set. */
const ownPick = new RegExp(`process\\.env\\.(${VARS})\\b|env\\("(${VARS})"\\)`);
const statusOnly = new Set(["src/app/api/keys/status/route.ts"]);
const strays = routes.filter((f) => !statusOnly.has(f)).flatMap((f) => {
  const src = bare(f);
  /* Publish's GET answers whether the server has a token, for the button: a yes or no, never a pick. */
  const picked = f.endsWith("studio/publish/route.ts") ? src.replace(/function config\(\)[\s\S]*?\n\}/, "").replace(/export async function GET[\s\S]*?\n\}/, "") : src;
  return ownPick.test(picked) ? [f] : [];
});
check("no route picks a key from the server's variables on its own", strays.length === 0, strays.join(", "));
const takers = {
  "src/app/api/studio/generate/route.ts": ["x-anthropic-key"],
  "src/app/api/studio/body/route.ts": ["x-anthropic-key"],
  "src/app/api/studio/reshape/route.ts": ["x-anthropic-key"],
  "src/app/api/studio/image/route.ts": ["x-replicate-key"],
  "src/app/api/studio/remake/route.ts": ["x-openai-key"],
  "src/app/api/studio/deploy/route.ts": ["x-vercel-token", "x-github-token"],
  "src/app/api/studio/publish/route.ts": ["x-github-token"],
  "src/app/api/studio/merge/route.ts": ["x-github-token"],
  "src/app/api/studio/branches/route.ts": ["x-github-token"],
  "src/app/api/studio/repo/route.ts": ["x-github-token"],
  "src/app/api/studio/repo/choices/route.ts": ["x-github-token"],
  "src/app/api/updates/route.ts": ["x-github-token"],
  "src/app/api/keys/test/route.ts": Object.keys(KEY_ENV),
};
const unwired = Object.entries(takers).flatMap(([f, hs]) => {
  const src = bare(f);
  const missing = hs.filter((h) => !src.includes(`keyFor(request, "${h}")`));
  return /import \{ keyFor \} from "@\/app\/api\/keyFor"/.test(src) && !missing.length ? [] : [`${f} (${missing.join(", ") || "no import"})`];
});
check("every route that takes a key picks it through keyFor", unwired.length === 0, unwired.join("; "));
/* Any route reading a key header is one of the above, or the capture download, which takes his token alone and never the server's. */
const readers = routes.filter((f) => new RegExp(`headers\\.get\\("(${Object.keys(KEY_ENV).join("|")})"\\)`).test(bare(f)));
const unknown = readers.filter((f) => !takers[f] && f !== "src/app/api/studio/capture-artifact/route.ts");
check("…and no other route reads a key header", unknown.length === 0, unknown.join(", "));
const capture = bare("src/app/api/studio/capture-artifact/route.ts");
check("…while the capture download still never falls back to the server's token", !ownPick.test(capture) && !/keyFor\(/.test(capture));

const agent = bare("src/features/studio/loop/agent.ts");
check("the browser follows a deployment, and asks its address, with the token it holds",
  !/vercelHeaderIfNeeded|serverHasVercel/.test(agent) && (agent.match(/fetch\(`\/api\/studio\/deploy\?\$\{(q|query)\}`, \{ cache: "no-store", headers: vercelHeader\(\)/g) ?? []).length === 2);
check("and calls the site live off his token whenever he holds one", /return mine \? \{ \.\.\.said, configured: true, source: "browser" \} : said;/.test(agent));
const panel = read("src/features/keys/KeysPanel.tsx");
check("the Keys panel no longer says his key is used only when the server has none",
  !/only when the server has (none|no key)/.test(panel) && !/Nothing you type here is used for it/.test(panel) && /used instead of the server&rsquo;s/.test(panel));
check("and Try it, with a key typed, says it asks about his key, not the server's",
  /server\?\.set\[keyField\] && !\(draft\[keyField\] \?\? ""\)\.trim\(\)\s*\? `Asks \$\{s\.label\} whether the server's/.test(panel));
const env = read(".env.example");
check(".env.example says the browser's key wins", !/server's value always\s*#?\s*wins/.test(env) && /Keys panel wins over the server's value/.test(env.replace(/\n# /g, " ")));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

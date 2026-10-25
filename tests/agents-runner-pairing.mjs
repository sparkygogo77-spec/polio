/**
 * Agents panel, the runner: pairing and the loopback server's checks.
 *
 * The helper's server, on an ephemeral port on 127.0.0.1, must refuse:
 * another origin (CORS preflight included), a missing or wrong token, a
 * wrong Host (DNS rebinding), the Builder page doing anything but asking
 * whether a helper is there, a dock control claiming to be the runner, and
 * pairing after five wrong codes. The pairing code shows only on the PC
 * (here, a callback), never in a reply; Unpair makes the old token useless.
 *
 *   node tests/agents-runner-pairing.mjs
 */
import { request as httpRequest } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let Sv = null, Pa = null, R = null, S = null;
try {
  Sv = await import("../helper/server/server.ts");
  Pa = await import("../helper/server/pairing.ts");
  R = await import("../helper/agents/runner.ts");
  S = await import("../helper/agents/spend.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the server and pairing load", !!(Sv && Pa && R && S));

if (Sv && Pa && R && S) {
  const dir = mkdtempSync(join(tmpdir(), "agents-pair-"));
  const shown = [];
  const pairing = new Pa.Pairing({ show: (c) => shown.push(c) });
  const runner = new R.Runner({ adapters: {}, stateDir: join(dir, "state"), spend: new S.SpendBook({ planWindowTokens: 1 }), workspace: () => dir });
  const helper = await Sv.startHelperServer({ runner, pairing, port: 0 });
  const port = helper.port;
  const DOCK = `http://127.0.0.1:${port}`;
  const BUILDER = Sv.BUILDER_ORIGIN;

  // node:http, not fetch, so the test can send any Host it likes.
  const call = (method, path, { origin, host = `127.0.0.1:${port}`, token, body } = {}) => new Promise((resolve, reject) => {
    const headers = { host };
    if (origin) headers.origin = origin;
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const req = httpRequest({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let text = "";
      res.on("data", (c) => { text += c; if (path === "/stream" && res.statusCode === 200) { res.destroy(); resolve({ status: 200, headers: res.headers, text }); } });
      res.on("end", () => { let json = null; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode, headers: res.headers, text, json }); });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });

  try {
    check("it listens on 127.0.0.1 only", helper.server.address().address === "127.0.0.1", JSON.stringify(helper.server.address()));

    const health = await call("GET", "/health", { origin: BUILDER });
    check("the Builder page may ask whether a helper is there", health.status === 200 && health.json?.helper === true && health.headers["access-control-allow-origin"] === BUILDER);
    const evil = await call("GET", "/health", { origin: "https://evil.example" });
    check("another origin is refused, with no CORS allowance", evil.status === 403 && !evil.headers["access-control-allow-origin"]);
    const lookalike = await call("GET", "/health", { origin: "https://polio-two.vercel.app.evil.example" });
    check("a look-alike of the Builder's origin is refused", lookalike.status === 403);
    const pre = await call("OPTIONS", "/stream", { origin: "https://evil.example" });
    check("another origin's preflight is refused", pre.status === 403 && !pre.headers["access-control-allow-origin"]);
    const rebind = await call("GET", "/health", { origin: BUILDER, host: `evil.example:${port}` });
    check("a wrong Host is refused (DNS rebinding)", rebind.status === 421);
    const byName = await call("POST", "/pair/start", { origin: DOCK, host: `localhost:${port}` });
    check("even localhost by name is refused: only 127.0.0.1", byName.status === 421);

    const builderPairs = await call("POST", "/pair/start", { origin: BUILDER });
    check("the Builder page can't start pairing (the dock does)", builderPairs.status === 403 && shown.length === 0);
    const start = await call("POST", "/pair/start", { origin: DOCK });
    const code = shown.at(-1);
    check("pairing shows a 6-digit code on the PC only", start.status === 200 && /^\d{6}$/.test(code ?? "") && !start.text.includes(code), start.text);
    const wrong = await call("POST", "/pair", { origin: DOCK, body: { code: code === "000000" ? "111111" : "000000" } });
    check("a wrong code is refused", wrong.status === 403 && !wrong.json?.token);
    const right = await call("POST", "/pair", { origin: DOCK, body: { code } });
    const token = right.json?.token;
    check("the right code gives the dock a long token", right.status === 200 && typeof token === "string" && token.length >= 40);
    const reuse = await call("POST", "/pair", { origin: DOCK, body: { code } });
    check("a code is good once", reuse.status === 403);

    const noToken = await call("GET", "/stream", { origin: DOCK });
    check("the stream without a token is refused", noToken.status === 401);
    const badToken = await call("GET", "/stream", { origin: DOCK, token: token.slice(0, -2) + "xx" });
    check("the stream with a wrong token is refused", badToken.status === 401);
    const fromBuilder = await call("GET", "/stream", { origin: BUILDER, token });
    check("the token is refused from the Builder page's origin", fromBuilder.status === 403);
    const noOrigin = await call("GET", "/stream", { token });
    check("the token is refused with no Origin (an agent's curl, say)", noOrigin.status === 403);
    const stream = await call("GET", "/stream", { origin: DOCK, token });
    check("the paired dock gets the stream", stream.status === 200 && /ndjson/.test(stream.headers["content-type"]));

    const asRunner = await call("POST", "/control", { origin: DOCK, token, body: { v: 1, kind: "control", lane: "x", do: "pause", by: "runner", reason: "spend-cap" } });
    check("a control from the dock claiming to be the runner is refused", asRunner.status === 403);
    const stopNoToken = await call("POST", "/control", { origin: DOCK, body: { v: 1, kind: "control", lane: "x", do: "stop", by: "j" } });
    check("Stop without the token is refused", stopNoToken.status === 401);
    const stopBuilder = await call("POST", "/control", { origin: BUILDER, token, body: { v: 1, kind: "control", lane: "x", do: "stop", by: "j" } });
    check("Stop from the Builder page is refused, token or not", stopBuilder.status === 403);

    const page = await call("GET", "/dock");
    check("the dock page loads with no Origin, framable only by the Builder",
      page.status === 200 && page.headers["content-security-policy"] === `frame-ancestors ${BUILDER}`);

    const out = await call("POST", "/unpair", { origin: DOCK, token });
    const after = await call("GET", "/stream", { origin: DOCK, token });
    check("after Unpair the old token is refused", out.status === 200 && after.status === 401);

    await call("POST", "/pair/start", { origin: DOCK });
    const fresh = shown.at(-1);
    for (let i = 0; i < Pa.TRIES; i++) await call("POST", "/pair", { origin: DOCK, body: { code: fresh === "999999" ? "123456" : "999999" } });
    const locked = await call("POST", "/pair", { origin: DOCK, body: { code: fresh } });
    const restart = await call("POST", "/pair/start", { origin: DOCK });
    check("five wrong codes lock pairing, even for the right code", locked.status === 403 && /locked/.test(locked.json?.error) && restart.json?.ok === false, locked.text);
  } finally {
    await helper.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);

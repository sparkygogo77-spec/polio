/**
 * No key of his is written down in the clear. Anywhere. Under any name.
 *
 * What was measured in his browser on the live deploy: two entries in
 * localStorage. `builder.keys`, 277 characters, unreadable, and
 * `builder.keys.plain`, 275 characters, with the Anthropic prefix sitting in
 * it in plain sight. The second was there so the key survived a reload, and
 * it undid the first: sealing a key and then keeping a readable copy beside
 * it protects nothing at all.
 *
 * So: one representation, never the key itself. This walks the whole of
 * localStorage and sessionStorage looking for the pasted string, rather than
 * checking the entry it expects — a copy under a name nobody thought of is
 * exactly what this is for.
 *
 * The key pasted here is a made-up string that is not a key and reaches no
 * server: nothing in this file presses Try it.
 *
 *   node tests/no-plain-key.mjs [url]
 */
const req = (await import("node:module")).createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* Shaped like one, and it is not one. */
const FAKE = "sk-ant-api03-NOTAKEY-elegant-hypatia-0000000000";
const OLD = "sk-ant-api03-NOTAKEY-legacy-plain-111111111111";
/* Shaped like a GitHub token, and not one. */
const GH = "github_pat_NOTATOKEN_elegant_hypatia_0000000000";

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
/* Every request the page makes, and whether it carried a key on it. */
const sent = [];
page.on("request", (r) => {
  const h = r.headers();
  sent.push({
    url: r.url(),
    method: r.method(),
    keyed: ["x-github-token", "x-anthropic-key", "x-replicate-key", "x-vercel-token"].filter((k) => h[k]),
  });
});
await page.goto(URL_, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

/** Every name and every value in both stores, as one heap to search. */
const storage = () => page.evaluate(() => {
  const all = { names: [], text: "" };
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      all.names.push(k);
      all.text += `${k}=${store.getItem(k)}\n`;
    }
  }
  return all;
});

/* The panel is in the page whether or not it is open, so opening it means
   waiting for it to say so rather than for a moment to pass. */
const openPanel = async () => {
  const panel = page.locator('[role="dialog"][aria-label="Keys"]').first();
  for (let go = 0; go < 3; go++) {
    if ((await panel.count()) && (await panel.getAttribute("data-open")) === "1") break;
    await page.keyboard.press("Control+Shift+K");
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(300);
  return panel;
};

/* ------------------------------------------------------------------ */
/* 1. Pasting a key writes no readable copy                             */
/* ------------------------------------------------------------------ */

let panel = await openPanel();
check("the keys panel opens", (await panel.count()) > 0 && (await panel.getAttribute("data-open")) === "1", `data-open ${await panel.getAttribute("data-open")}`);
const field = panel.locator('input[type="password"]').first();
const canType = (await field.count()) > 0;
check("and offers a field for the Claude key", canType, canType ? "" : "no password field in the panel");
if (!canType) {
  console.log("\nnothing to paste into, so nothing to look for. Stopping here rather than passing by default.");
  await browser.close();
  process.exit(1);
}
await field.fill(FAKE);
const save = panel.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
check("and a key to save it with", (await save.count()) > 0, await save.first().innerText().catch(() => ""));
await save.click();
await page.waitForTimeout(900);

let held = await storage();
check("something was written down", held.names.some((n) => n.startsWith("builder.keys")), held.names.filter((n) => n.startsWith("builder.keys")).join(", ") || "nothing");
check("and the key is in none of it", !held.text.includes(FAKE), held.text.includes(FAKE) ? `found in ${held.names.filter((n) => (held.text.match(new RegExp(`^${n}=.*$`, "m")) ?? [""])[0].includes(FAKE)).join(", ")}` : `${held.names.length} entries searched`);
check("and no part of it either", !held.text.includes(FAKE.slice(0, 24)) && !held.text.includes("sk-ant"), held.text.includes("sk-ant") ? "an Anthropic prefix is in storage" : "no prefix anywhere");
check("builder.keys.plain does not exist", !held.names.includes("builder.keys.plain"));

/* ------------------------------------------------------------------ */
/* 2. And it still survives a reload, which is what the copy was for    */
/* ------------------------------------------------------------------ */

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
panel = await openPanel();
const show = panel.getByRole("button", { name: "Show" }).first();
if (await show.count()) await show.click();
await page.waitForTimeout(300);
const back = await panel.locator("input").first().inputValue().catch(() => "");
check("the key comes back after a reload", back === FAKE, back ? `${back.slice(0, 12)}… (${back.length} chars)` : "the field is empty");
const after = await storage();
check("and is still in none of the storage", !after.text.includes(FAKE));

/* ------------------------------------------------------------------ */
/* 3. A browser that already holds a readable copy is cleaned on load   */
/* ------------------------------------------------------------------ */

await page.evaluate((v) => localStorage.setItem("builder.keys.plain", JSON.stringify({ ANTHROPIC_API_KEY: v })), OLD);
const planted = await storage();
check("a readable copy planted, as his browser has one", planted.text.includes(OLD));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1400);
const swept = await storage();
check("one load takes it away", !swept.names.includes("builder.keys.plain"), swept.names.join(", "));
check("and leaves nothing readable behind", !swept.text.includes(OLD) && !swept.text.includes("sk-ant"));
panel = await openPanel();
const show2 = panel.getByRole("button", { name: "Show" }).first();
if (await show2.count()) await show2.click();
await page.waitForTimeout(300);
const carried = await panel.locator("input").first().inputValue().catch(() => "");
check("the key it held was carried across, not dropped", carried === OLD, carried ? `${carried.slice(0, 12)}… (${carried.length} chars)` : "the field is empty");

/* ------------------------------------------------------------------ */
/* 4. And no route is handed a key it has no use for                    */
/* ------------------------------------------------------------------ */

/* The publish route's GET is a status probe — can this push, which
   repository, which branch — and it used to be sent the person's real
   GitHub token so it could answer the first of those, on every load that
   asked. The browser is the thing holding the token, so the browser is the
   thing that knows. Only the push itself carries it. */
const gh = panel.locator('input[type="password"]').nth(2);
if (await gh.count()) {
  await gh.fill(GH);
  const save2 = panel.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
  if (await save2.count()) await save2.click();
  await page.waitForTimeout(700);
}
const saved = await page.evaluate(() => {
  try {
    const raw = localStorage.getItem("builder.keys") ?? localStorage.getItem("builder.keys.plain") ?? "";
    return raw.length;
  } catch { return 0; }
});
check("the GitHub token is held in this browser", saved > 0, `${saved} characters written`);
sent.length = 0;
/* The Builder is where the publish button asks; the Builds page asks the
   same route for the repository name and never had a token to send. */
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const probes = sent.filter((r) => r.method === "GET" && r.url.includes("/api/studio/publish"));
check("the publish route is asked whether it can push", probes.length > 0, `${probes.length} probes`);
check("and the app hands it no token to answer with", probes.every((r) => !r.keyed.length),
  probes.filter((r) => r.keyed.length).map((r) => r.keyed.join("+")).join(", ") || "none carried one");
const keyed = sent.filter((r) => r.keyed.length);
check("nothing but a call that needs one carries a key at all", keyed.every((r) => r.method === "POST"),
  keyed.length ? keyed.map((r) => `${r.method} ${new URL(r.url).pathname} [${r.keyed.join("+")}]`).join("; ") : "no call carried one");

/*
 * And the route itself, asked directly with a token in its hand, because
 * whether the app happens to send one on a given load is a matter of which
 * mounted first. A GET that reads a token answers "browser"; one that does
 * not cannot, whatever it is handed.
 */
const answered = await page.evaluate(async (t) => {
  try {
    const r = await fetch("/api/studio/publish", { cache: "no-store", headers: { "x-github-token": t } });
    const j = await r.json();
    return { token: j?.github?.token ?? null, configured: j?.github?.configured === true };
  } catch (e) {
    return { error: String(e) };
  }
}, GH);
check("and the route does not read one even when it is handed one", answered.token !== "browser",
  `it answered token: ${JSON.stringify(answered.token)}, configured ${answered.configured}`);

panel = await openPanel();

/* ------------------------------------------------------------------ */
/* 5. Forget leaves nothing                                             */
/* ------------------------------------------------------------------ */

const forget = panel.getByRole("button", { name: /Forget the key/ }).first();
if (await forget.count()) {
  await forget.click();
  await page.waitForTimeout(500);
  const yes = page.getByRole("button", { name: /Forget it/ }).first();
  if (await yes.count()) { await yes.click(); await page.waitForTimeout(600); }
  const gone = await storage();
  check("Forget leaves no entry of any kind", !gone.names.some((n) => n.startsWith("builder.keys") && n !== "builder.keys.probe"), gone.names.filter((n) => n.startsWith("builder.keys")).join(", ") || "none");
} else {
  check("Forget leaves no entry of any kind", false, "no Forget control found");
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

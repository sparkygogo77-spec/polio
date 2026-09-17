/**
 * Try it asks the service, not us.
 *
 * The one button whose whole purpose is to prove a key is the person's own
 * used to hand that key to this site's server on the way: a POST to
 * /api/keys/test with the key on a header, and the server asked Anthropic.
 * Claude, GitHub and Vercel all answer a browser directly — measured on the
 * deployed page's own origin — so they are asked from the browser now and
 * the key does not leave it.
 *
 * Replicate is the exception and is meant to be: it does not answer a
 * browser from another origin, and its token reaches the server anyway
 * because the renderer is a server call. This checks that it still works
 * rather than pretending otherwise.
 *
 * The three services are answered by the test itself, so nothing real is
 * called and no key — not even a made-up one — is sent to anybody.
 *
 *   node tests/try-here.mjs [url]
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

const FAKE = { anthropic: "sk-ant-api03-NOTAKEY-try-here-000000", github: "github_pat_NOTATOKEN_try_here_00", vercel: "NOTATOKEN_try_here_0000000000" };

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

/* Every request the page makes, and what it carried. */
const sent = [];
page.on("request", (r) => {
  const h = r.headers();
  sent.push({
    url: r.url(),
    method: r.method(),
    keyed: ["x-github-token", "x-anthropic-key", "x-replicate-key", "x-vercel-token", "x-api-key", "authorization"].filter((k) => h[k]),
    direct: h["anthropic-dangerous-direct-browser-access"] === "true",
  });
});

/* The three services, answered here, so nothing real is called. */
await page.route("https://api.anthropic.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "claude-opus-5", display_name: "Claude Opus 5" }) }));
/* The scope header is only readable across origins when the answer says it
   may be read, which is what GitHub's own `access-control-expose-headers`
   does. Without that line here the check was failing the code for a header
   the stub had made unreadable. */
await page.route("https://api.github.com/**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "x-oauth-scopes": "repo", "access-control-allow-origin": "*", "access-control-expose-headers": "x-oauth-scopes" },
    body: JSON.stringify({ login: "someone" }),
  }));
await page.route("https://api.vercel.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { username: "someone" } }) }));

await page.goto(URL_, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

const panel = page.locator('[role="dialog"][aria-label="Keys"]').first();
for (let go = 0; go < 3; go++) {
  if ((await panel.count()) && (await panel.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
check("the keys panel opens", (await panel.getAttribute("data-open")) === "1");

const fields = panel.locator('input[type="password"]');
const tries = panel.getByRole("button", { name: /^Try it/ });
check("four services, each with a Try it", (await fields.count()) === 4 && (await tries.count()) === 4, `${await fields.count()} fields, ${await tries.count()} keys`);

/**
 * Press one service's Try it and report what the page did about it.
 *
 * The answer is read out of that service's own section. Read off the whole
 * panel it was the first answer on screen every time, so GitHub's check was
 * quoting Claude's sentence back and passing or failing on it.
 */
const press = async (i, host, label) => {
  sent.length = 0;
  await tries.nth(i).click();
  await page.waitForTimeout(1800);
  const mine = panel.locator("section").filter({ hasText: label }).first();
  const said = ((await mine.count()) ? await mine.innerText() : await panel.innerText())
    .split("\n").find((l) => /works|rejected|could not|too short|answered/i.test(l)) ?? "";
  return {
    said,
    toService: sent.filter((r) => r.url.includes(host)),
    toUs: sent.filter((r) => r.url.includes("/api/keys/test")),
  };
};

/* Claude */
await fields.nth(0).fill(FAKE.anthropic);
let out = await press(0, "api.anthropic.com", "Claude");
check("Claude is asked by this browser", out.toService.length > 0, out.toService.map((r) => r.url).join(", ") || "nothing went to Anthropic");
check("…with the header Anthropic needs before it will answer a page at all", out.toService.some((r) => r.direct));
check("…and nothing at all went to this site's own route", out.toUs.length === 0, out.toUs.length ? `${out.toUs.length} calls to /api/keys/test` : "none");
check("…and the answer is the service's own", /works/i.test(out.said), out.said || "nothing said");

/* GitHub */
await fields.nth(2).fill(FAKE.github);
out = await press(2, "api.github.com", "GitHub");
check("GitHub is asked by this browser, and our route is not", out.toService.length > 0 && out.toUs.length === 0, `${out.toService.length} to GitHub, ${out.toUs.length} to us`);
check("…and it says who the token belongs to and whether it can push", /belongs to/i.test(out.said) && /push|write/i.test(out.said), out.said || "nothing said");

/* Vercel */
await fields.nth(3).fill(FAKE.vercel);
out = await press(3, "api.vercel.com", "Vercel");
check("Vercel is asked by this browser, and our route is not", out.toService.length > 0 && out.toUs.length === 0, `${out.toService.length} to Vercel, ${out.toUs.length} to us`);

/* Replicate: the exception, and it still works. */
await fields.nth(1).fill("r8_NOTATOKEN_try_here_000000");
out = await press(1, "api.replicate.com", "Replicate");
check("Replicate is the one that still goes through the route, because it will not answer a browser", out.toUs.length > 0, `${out.toUs.length} calls to /api/keys/test`);
check("…and the panel says so where a person can read it", /Replicate[\s\S]{0,200}answer a browser/i.test(await panel.innerText()));

/* And the whole session: no key of theirs on any call to our own origin. */
const ours = sent.concat().filter((r) => r.url.startsWith(URL_));
check("no call to this site carried a key that was not meant to", ours.every((r) => !r.keyed.length || r.url.includes("/api/keys/test")),
  ours.filter((r) => r.keyed.length && !r.url.includes("/api/keys/test")).map((r) => `${r.method} ${new URL(r.url).pathname}`).join(", ") || "none");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

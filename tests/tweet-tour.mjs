#!/usr/bin/env node
/**
 * THE TOUR WORKS THE SITE THE WAY A PERSON WOULD, FITS ITS CLIP, AND THE CLIP GOES ON THE POST.
 *
 * Lane H, tweet console items 3 and 4.
 *   1. A site with tabs, a menu or rows, a copy-address button and a chart
 *      gets a tour that presses them in page order, every tab of the strip,
 *      and never a wallet, sign-in, buy or send control, and never leaves
 *      the page (the frame stays on the preview address).
 *   2. A site with nothing to press is scrolled, and the scroll stops at the
 *      "Stop scrolling at" limit (half way, here) rather than the bottom.
 *   3. The tour lasts the clip length asked, within a second, at 4 and at 9
 *      seconds.
 *   4. Record: a stand-in recorder (the browser's own tab capture replaced by
 *      a canvas stream, the real MediaRecorder kept) records while the tour
 *      plays, stops at the clip length within a second, and the clip is
 *      offered; when X would not take it as it is (WebM), the console says
 *      so plainly, Make a GIF turns it into one X takes, and Attach to post 1
 *      puts it on the draft.
 *   5. The rules themselves, read directly: what is refused, how a clip is
 *      spent, and what X refuses.
 *
 * Screenshots: .screenshots/lane-h/tour-*.png.
 *
 *   npx next start -p 3013
 *   node tests/tweet-tour.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const { createJiti } = require("jiti");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SHOTS = ".screenshots/lane-h";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* ------------------------------------------------ 5. the rules, read directly */
{
  const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
  const R = await jiti.import(join(here, "..", "src", "features", "tweets", "tourRules.ts"));
  const no = (words, more = {}) => R.refusal({ tag: "button", words, ...more });
  check("rules: a wallet, sign-in, buy or send control is refused", ["Connect wallet", "Sign in", "Log in", "Buy $TRORTY", "Send", "Subscribe", "Checkout"].every((w) => !!no(w)), J(["Connect wallet", "Sign in", "Buy $TRORTY"].map((w) => no(w))));
  check("rules: tabs, copy and plain buttons may be pressed", [no("Roadmap", { role: "tab" }), no("Copy address"), no("Show more")].every((x) => x === null));
  check("rules: a link out and a form's submit are refused", !!R.refusal({ tag: "a", words: "Docs", href: "https://example.com" }) && !!R.refusal({ tag: "button", type: "submit", words: "Go" }) && !!R.refusal({ tag: "button", words: "Go", inForm: true }));
  const t = R.timing(15000, 20, (n) => 600 * (n + 1));
  check("rules: too many presses for the clip drops the last ones, each watched long enough", t.steps < 20 && t.dwellMs >= R.DWELL_MIN_MS, J(t));
  const none = R.timing(10000, 0, () => 3000);
  check("rules: nothing to press spends the clip scrolling", none.steps === 0 && Math.abs(none.msPerPx * 3000 - (10000 - R.LEAD_MS - R.TAIL_MS)) < 1, J(none));
  check("rules: half way stops half way down", R.stopY("50", 3000, 1000) === 1000 && R.stopY("bottom", 3000, 1000) === 2000 && R.stopY("screens-1", 3000, 1000) === 1000);
  check("rules: X refuses WebM in words, and a clip over 140 seconds", /X takes MP4 or MOV only/.test(R.xRefuses({ type: "video/webm", bytes: 1e6, seconds: 5 }).join(" ")) && /140 seconds/.test(R.xRefuses({ type: "video/mp4", bytes: 1e6, seconds: 150 }).join(" ")));
  check("rules: X takes an MP4 within its limits", R.xRefuses({ type: "video/mp4;codecs=avc1", bytes: 4e6, seconds: 12, width: 1440, height: 900 }).length === 0);
  check("rules: a GIF over 15 MB is refused in words", /15 MB/.test(R.xRefuses({ type: "image/gif", bytes: 16 * 1024 * 1024, seconds: 5 }).join(" ")));
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const node = (id, featureId, content, x, y, w, h, extra = {}) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content, data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, ...extra });

/* A site with things to do, and things never to do, down a long page. */
const busy = [
  node("n_head", "big-headline", "TOUR ME", 80, 40, 1280, 160),
  node("n_buy", "cta-primary", "Buy $TOKEN now", 80, 230, 320, 64),
  node("n_wallet", "cta-primary", "Connect wallet", 440, 230, 320, 64),
  node("n_tabs", "tabs-panel", "Overview, Roadmap, Team", 80, 340, 900, 280),
  node("n_rows", "accordion", "What is it?\nWho made it?\nWhere next?", 80, 700, 900, 260),
  node("n_copy", "copy-button", "0xABCDEF0123456789", 80, 1020, 520, 64),
  node("n_chart", "charts", "", 80, 1120, 900, 340),
  node("n_tail", "prose", "The end of the page.", 80, 1600, 900, 120),
];
/* A plain site: words, and nothing to press, three screens long. */
const plain = [
  node("p_head", "big-headline", "PLAIN SITE", 80, 40, 1280, 200),
  node("p_a", "prose", "First words.", 80, 600, 900, 120),
  node("p_b", "prose", "Middle words.", 80, 1400, 900, 120),
  node("p_c", "prose", "Last words.", 80, 2400, 900, 120),
];

async function openConsole(nodes, { stand = false, noMp4 = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/(api\.)?(vercel|github|x|twitter)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  if (stand) {
    /* THE STAND-IN RECORDER: the tab capture is a canvas stream that keeps drawing; MediaRecorder is the browser's own. */
    await ctx.addInitScript(() => {
      const md = navigator.mediaDevices ?? (Object.defineProperty(navigator, "mediaDevices", { value: {} }), navigator.mediaDevices);
      md.getDisplayMedia = async () => {
        const c = document.createElement("canvas");
        c.width = 640; c.height = 400;
        const g = c.getContext("2d");
        let f = 0;
        const draw = () => { f++; g.fillStyle = `hsl(${(f * 7) % 360} 70% 50%)`; g.fillRect(0, 0, 640, 400); g.fillStyle = "#fff"; g.fillText(String(f), 20, 40); };
        draw();
        setInterval(draw, 40);
        window.__standInUsed = true;
        return c.captureStream(25);
      };
    });
    /* A browser that records only WebM, as Firefox and older Chrome do. */
    if (noMp4) await ctx.addInitScript(() => { const was = MediaRecorder.isTypeSupported.bind(MediaRecorder); MediaRecorder.isTypeSupported = (m) => !/mp4/i.test(m) && was(m); });
  }
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [{ id: "t1", name: "Tour site", updatedAt: Date.now(), nudged: true }], activeId: "t1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes, frameWidth: 1440 }),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300);
  await page.keyboard.press("t");
  await page.waitForTimeout(600);
  const con = page.locator("[data-tweet-console]");
  /* A draft to attach to. */
  if (!(await con.locator("textarea").count())) {
    await con.getByRole("button", { name: /New draft/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(300);
  }
  await con.getByRole("radio", { name: "Tour" }).click().catch(async () => { await con.getByText("Tour", { exact: true }).first().click(); });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !!document.querySelector("[data-tour-iframe]")?.contentDocument?.querySelector("[data-live-scroller] [data-live-node]"), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return { ctx, page, con };
}
const setClip = async (con, seconds, stop) => {
  await con.locator("[data-tour-seconds]").fill(String(seconds));
  await con.locator("[data-tour-seconds]").blur();
  if (stop) {
    const sel = con.getByRole("combobox", { name: "Stop scrolling at" });
    if (await sel.count()) { await sel.click(); await con.page().getByRole("option", { name: stop }).click(); }
  }
};
const preview = async (page, con) => {
  const t0 = Date.now();
  await con.locator("[data-tour-preview]").click();
  await page.waitForFunction(() => !document.querySelector("[data-tour-stop]"), null, { timeout: 160000, polling: 50 });
  const ms = Date.now() - t0;
  return { ms, run: await page.evaluate(() => window.__tweetsTourLast ?? null) };
};

/* ------------------------------------------------ 1. a site with things to do */
{
  const { ctx, page, con } = await openConsole(busy);
  const addr = await page.evaluate(() => document.querySelector("[data-tour-iframe]").contentWindow.location.pathname);
  await setClip(con, 12);
  const shot = setTimeout(() => page.screenshot({ path: `${SHOTS}/tour-pressing.png` }).catch(() => undefined), 5000);
  const { run } = await preview(page, con);
  clearTimeout(shot);
  const pressed = run?.pressed ?? [];
  check("the tour presses the tabs of the strip, each of them", ["Roadmap", "Team", "Overview"].every((t) => pressed.some((p) => p.startsWith("tab:") && p.includes(t))), J(pressed));
  check("and opens a row, presses copy, sweeps the chart", pressed.some((p) => p.startsWith("open:")) && pressed.some((p) => p.startsWith("copy:")) && pressed.some((p) => p.startsWith("chart:")), J(pressed));
  check("in page order: the tabs before the rows, the rows before copy", pressed.findIndex((p) => p.startsWith("tab:")) < pressed.findIndex((p) => p.startsWith("open:")) && pressed.findIndex((p) => p.startsWith("open:")) < pressed.findIndex((p) => p.startsWith("copy:")), J(pressed));
  check("never a wallet, buy or send control", !pressed.some((p) => /wallet|buy|send|sign/i.test(p)), J(pressed));
  check("and it says it turned them down", (run?.refused ?? []).some((r) => /wallet/i.test(r)) && (run?.refused ?? []).some((r) => /Buy/i.test(r)), J(run?.refused));
  const after = await page.evaluate(() => document.querySelector("[data-tour-iframe]").contentWindow.location.pathname);
  check("the frame never left the page", after === addr, `${addr} → ${after}`);
  const said = await con.locator("[data-tour-did]").innerText().catch(() => "");
  check("the console says what it pressed", /^Pressed \d+:/.test(said), J(said));
  await ctx.close();
}

/* ------------------------------------------------ 2–3. a plain site scrolls to the stop, in the clip's length */
{
  const { ctx, page, con } = await openConsole(plain);
  await setClip(con, 4, "Half way");
  const a = await preview(page, con);
  const max = await page.evaluate(() => { const s = document.querySelector("[data-tour-iframe]").contentDocument.querySelector("[data-live-scroller]"); return s.scrollHeight - s.clientHeight; });
  check("a plain site is scrolled, nothing pressed", a.run && a.run.pressed.length === 0 && a.run.endY > 0, J(a.run));
  check("and stops at the limit (half way), not the bottom", a.run && Math.abs(a.run.endY - Math.round(max / 2)) <= 4 && a.run.endY < max - 50, `ended at ${a.run?.endY} of ${max}`);
  check("a 4 second clip lasts 4 seconds, within a second", a.run && Math.abs(a.run.ms - 4000) <= 1000, `${a.run?.ms} ms (the press to the end: ${a.ms} ms)`);
  await setClip(con, 9, "The bottom");
  const b = await preview(page, con);
  check("a 9 second clip lasts 9 seconds, within a second", b.run && Math.abs(b.run.ms - 9000) <= 1000, `${b.run?.ms} ms`);
  check("and, asked for the bottom, reaches it", b.run && b.run.endY >= max - 4, `ended at ${b.run?.endY} of ${max}`);
  await ctx.close();
}

/* ------------------------------------------------ 4. record with the stand-in, and attach: as MP4, and as WebM in a browser that records nothing else */
for (const noMp4 of [false, true]) {
  console.log(noMp4 ? "  (a browser that records only WebM)" : "  (a browser that records MP4)");
  const { ctx, page, con } = await openConsole(busy, { stand: true, noMp4 });
  await setClip(con, 5);
  await con.locator("[data-tour-record]").click();
  await page.waitForTimeout(1500);
  if (!noMp4) await page.screenshot({ path: `${SHOTS}/tour-recording.png` });
  await page.waitForSelector("[data-tour-result]", { timeout: 60000 });
  await page.waitForTimeout(400);
  check("the stand-in recorder was the one asked", await page.evaluate(() => window.__standInUsed === true));
  const secs = Number(await con.locator("[data-tour-clip-seconds]").getAttribute("data-tour-clip-seconds"));
  check("the recording stopped at the clip length, within a second", Math.abs(secs - 5) <= 1, `${secs} s`);
  const format = await con.locator("[data-tour-result]").getAttribute("data-tour-result");
  if (format === "webm") {
    const refused = await con.locator("[data-tour-refused]").innerText();
    check("a WebM clip: the console says plainly X will not take it, and how to fix it", /X takes MP4 or MOV only/.test(refused) && /Make a GIF/.test(refused), J(refused));
    check("and Attach is off until it is fixed", await con.locator("[data-tour-attach]").isDisabled());
    await con.locator("[data-tour-gif]").click();
    await page.waitForSelector('[data-tour-result="gif"]', { timeout: 90000 });
  } else {
    check("an MP4 clip X takes as it is", format === "mp4" && (await con.locator("[data-tour-refused]").count()) === 0, format);
  }
  await page.screenshot({ path: `${SHOTS}/tour-clip-offered${noMp4 ? "-gif" : ""}.png` });
  await con.locator("[data-tour-attach]").click();
  await page.waitForTimeout(1200);
  const media = await page.evaluate(() => { const st = JSON.parse(localStorage.getItem("builder.tweets") ?? "{}").state; const d = st?.drafts?.find((x) => x.id === st.focusedId) ?? st?.drafts?.[0]; return d?.posts?.[0]?.media?.map((m) => ({ kind: m.kind, name: m.name, size: m.size })) ?? []; });
  check("the recorded clip is on the draft's first post", media.length === 1 && /^tour\.(gif|mp4)$/.test(media[0].name) && media[0].size > 0, J(media));
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

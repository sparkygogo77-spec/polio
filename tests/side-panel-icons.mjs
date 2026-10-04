/**
 * The side panel's tabs wear their icons again, and the tab you are on says its word.
 *
 * 73e2549 ("The side panel's six tabs say their names on one row") took the
 * icons off to fit six words into the 215px column: six 35px buttons with
 * 9px words and no picture. HIS ASK: the icons back, on every tab, and the
 * word on the one you are on — "✦ ⚙ ≡ [🎨 Look] 🎬 🖼" — with the other
 * five words in a tooltip and in the name a screen reader reads. The
 * labelled-tab intent 73e2549 carried survives: every tab is still named
 * by its word, only the four you are not reading stop printing it.
 *
 * Measured in the browser, on the row as drawn:
 *   · six tabs, each with an icon (an svg) in the panel's hue;
 *   · the active tab's word is drawn (it has width); the others' are not;
 *   · every tab's accessible name is its word, and every inactive tab has
 *     the word as a tooltip (title);
 *   · pressing another tab moves the word to it;
 *   · the row fits the column: no tab runs past the row, nothing clipped.
 *
 *   node tests/side-panel-icons.mjs [url]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
/* Generate went into each part's "Make a picture" (tests/side-panel-h.mjs). */
const WORDS = ["Element", "Format", "Pages", "Look", "Motion", "Pictures"];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const row = page.locator('[data-side-panel] [aria-label="Side panel"]');
const read = () => row.evaluate((r) => {
  const box = r.getBoundingClientRect();
  return [...r.querySelectorAll("[role=radio]")].map((t) => {
    const b = t.getBoundingClientRect();
    const word = t.querySelector("[data-tab-word]");
    const svg = t.querySelector("svg");
    return {
      name: t.getAttribute("aria-label") ?? t.textContent.trim(),
      title: t.getAttribute("title"),
      on: t.getAttribute("data-state") === "on",
      svg: !!svg && svg.getBoundingClientRect().width >= 10,
      hue: svg ? getComputedStyle(svg).color : null,
      wordW: word ? word.getBoundingClientRect().width : 0,
      text: word?.textContent ?? "",
      inside: b.left >= box.left - 0.5 && b.right <= box.right + 0.5,
      clipped: t.scrollWidth > t.clientWidth + 1,
    };
  });
});

let tabs = await read();
check("six tabs", tabs.length === WORDS.length, tabs.map((t) => t.name).join(", "));
check("every tab wears an icon", tabs.length === WORDS.length && tabs.every((t) => t.svg), tabs.filter((t) => !t.svg).map((t) => t.name).join(", ") || "all of them");
check("…each in its panel's own hue, not one colour for all", new Set(tabs.map((t) => t.hue)).size === WORDS.length, tabs.map((t) => t.hue).join(" "));
check("every tab is named by its word", JSON.stringify(tabs.map((t) => t.name)) === JSON.stringify(WORDS), tabs.map((t) => t.name).join(", "));
/* THE OWNER'S LATER ASK: tab names always visible, not icons only (tests/side-panel-g.mjs). */
const on = tabs.filter((t) => t.on);
check("one tab is on", on.length === 1, on.map((t) => t.name).join());
check("every tab draws its word, whole", tabs.every((t) => t.wordW > 12 && t.text === t.name), tabs.map((t) => `${t.name} ${Math.round(t.wordW)}px`).join(", "));
check("…and carries it as a tooltip", tabs.every((t) => t.title === t.name), tabs.map((t) => `${t.name}:${t.title}`).join(", "));
check("the row fits its column, nothing run over or clipped", tabs.every((t) => t.inside && !t.clipped), tabs.filter((t) => !t.inside || t.clipped).map((t) => t.name).join(", ") || "all inside");

for (const word of ["Look", "Motion", "Element"]) {
  await page.getByRole("radio", { name: word }).first().click();
  await page.waitForTimeout(300);
  tabs = await read();
  const now = tabs.find((t) => t.on);
  check(`pressing ${word} turns it on, every word still drawn`, now?.name === word && tabs.every((t) => t.wordW > 12), `${now?.name}`);
}
check("the tab's word still finds it by text, as the other suites do", (await page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).count()) === 1);
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

/**
 * THE WEBSITE SAYS NOTHING ABOUT HOW IT WAS MADE.
 *
 * The rule is absolute and it is his: the website in its entirety never
 * mentions him, me, the chats, the models, or how the work is made. Only the
 * changes to the website itself. So it is a check rather than a habit.
 *
 * It bit hard when it was written, against the panel as it stood: 14 of 64
 * lines said it out loud in their first sentence, 44 of 64 said it in the
 * body folded under them, and the panel carried 10,075 words of it in the
 * bundle shipped to his browser.
 *
 * Three legs.
 *
 *   · The rule itself, read back: it catches what it is for and lets the
 *     Builder's own nouns — a brief, a part, a page — through.
 *   · The panel's data: every line is about the website, nothing hangs off a
 *     line, the reading claim covers every word shown, and nothing is
 *     dropped without being counted.
 *   · The screen: every page of the website read back through a browser and
 *     put through the rule — the panel under the whole of it, and everything
 *     else under the half of it that can only ever be the making talking,
 *     because "merge" is a git merge on the record and the Layers panel's
 *     own verb everywhere else.
 *
 * The third leg needs a server and is skipped without one:
 *
 *   node tests/nothing-said.mjs                      # the first two legs
 *   node tests/nothing-said.mjs http://localhost:3000  # all three
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { NOT_OURS, aboutTheSite, saidAnywhere, saidPlainly } from "../src/features/studio/aboutTheSite.ts";
import { GENERATED_AT, KIND_MEANS, PASSES, minutes } from "../src/features/studio/passes.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The rule catches what it is for, and nothing else                */
/* ------------------------------------------------------------------ */

const caught = [
  ["The lanes fan off the latest box as he drew it", "him"],
  ["Take back the page wheel's Edit slot, which my merge put back", "me"],
  ["Record the ruling: the later instruction wins", "the chats"],
  ["Claude writes the body when a key is there", "the models"],
  ["Regenerate the passes record for the dijkstra merge", "how the work is made"],
  ["The Keys panel is proven on the deploy", "how the work is made"],
];
for (const [line, of] of caught) {
  check(`caught as ${of}: "${line.slice(0, 48)}…"`, saidPlainly(line) === of, saidPlainly(line) ?? "let through");
}

const through = [
  "The column gets the middle; the fan hangs off it",
  "A part that cannot be published says so on the page",
  "The brief lists every part, and a page that claims none says so",
  "The AI shelf gets its own colour",
  "Preview here opens the page you are standing on",
  "Two controls on the light panel were dead; here they are by name",
];
for (const line of through) {
  check(`let through: "${line.slice(0, 48)}…"`, aboutTheSite(line), saidPlainly(line) ?? "");
}

check("every family is named and is a thing a check can run", NOT_OURS.every((f) => typeof f.of === "string" && f.saw instanceof RegExp),
  NOT_OURS.map((f) => f.of).join(", "));
check("four of them are wrong anywhere on the website", NOT_OURS.filter((f) => f.everywhere).length >= 4,
  NOT_OURS.filter((f) => f.everywhere).map((f) => f.of).join(", "));
check("…and the Layers panel's own verb is not one of them", saidAnywhere("merge it into the one below to bake the pair into a single picture") === null);
check("…while on the record it still is", saidPlainly("The merge brought the page wheel's Edit slot back") !== null);

/* ------------------------------------------------------------------ */
/* 2. The panel's own data                                             */
/* ------------------------------------------------------------------ */

const lines = PASSES.flatMap((p) => p.changes);
check("there are changes at all", lines.length > 0, `${lines.length}`);

const said = lines.map((c) => [c.says, saidPlainly(c.says)]).filter(([, f]) => f);
check("every line on the panel is about the website", said.length === 0,
  said.slice(0, 3).map(([s, f]) => `[${f}] ${s}`).join(" | "));

const hangers = lines.filter((c) => "detail" in c || "areas" in c);
check("nothing hangs off a line: no body, no corners of the tree", hangers.length === 0, `${hangers.length} still carry one`);

const words = lines.reduce((n, c) => n + c.says.trim().split(/\s+/).length, 0);
check("the reading claim covers every word the panel shows",
  minutes(PASSES) === Math.max(1, Math.round(words / 200)),
  `${words} words, ${minutes(PASSES)} min`);

const kinds = new Set(lines.map((c) => c.kind));
check("three kinds, and the one that was never a change to the website is gone",
  Object.keys(KIND_MEANS).length === 3 && !kinds.has("under"),
  [...kinds].join(", "));

check("what the panel does not show, it counts",
  PASSES.every((p) => Number.isInteger(p.more) && p.more >= 0),
  `${PASSES.reduce((n, p) => n + p.more, 0)} counted out`);

const gen = readFileSync("src/features/studio/passes.generated.ts", "utf8");
check("the file shipped to his browser carries none of it",
  !NOT_OURS.some((f) => new RegExp(f.saw.source, f.saw.flags.includes("i") ? "im" : "m").test(gen.replace(/^\/\/.*$/gm, "").replace(/"id":[^,]+,/g, ""))),
  `${Math.round(gen.length / 1024)}kB`);
check("it says when it was read", /^\d{4}-\d{2}-\d{2}T/.test(GENERATED_AT), GENERATED_AT);

const script = readFileSync("scripts/passes.mjs", "utf8");
check("the writer never reads a body out of the history", !/%b/.test(script));
check("and the rule it obeys is the one in aboutTheSite", /aboutTheSite/.test(script));

const panel = readFileSync("src/features/studio/Updates.tsx", "utf8");
check("the panel has nothing left to unfold", !/ChevronRight/.test(panel) && !/change\.detail/.test(panel) && !/change\.areas/.test(panel));
check("and never prints the name a line landed under", !/\{change\.id\}/.test(panel));

/* ------------------------------------------------------------------ */
/* 3. On the screen                                                    */
/* ------------------------------------------------------------------ */

const URL_ = process.argv[2];
if (!URL_) {
  console.log("\n  --  the screen leg needs a url; skipped");
} else {
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
      try { return req(c); } catch { /* next */ }
    }
    throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
  })();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });

  await page.locator("[data-updates-toggle]").first().click();
  await page.waitForSelector("[data-updates-panel]", { timeout: 5000 });
  const seen = await page.locator("[data-updates-panel]").innerText();
  check("the panel opens and has something on it", seen.length > 200, `${seen.split(/\s+/).length} words on screen`);

  const broke = NOT_OURS.map((f) => [f.of, seen.match(new RegExp(f.saw.source, f.saw.flags.includes("i") ? "gi" : "g"))]).filter(([, m]) => m);
  check("nothing on the panel says him, me, the chats, the models or the making",
    broke.length === 0, broke.map(([of, m]) => `${of}: ${[...new Set(m)].slice(0, 4).join(" ")}`).join(" | "));

  await page.keyboard.press("Escape");

  /* And the rest of the website, under the half of the rule that can only
     ever be the making talking. "v0.1.0 · no commit named · built 3 min ago"
     is what this caught: the build mark naming the commit and the branch on
     every page that wears it. */
  for (const path of ["/", "/builds", "/builder", "/preview"]) {
    const res = await page.goto(`${URL_}${path}`, { waitUntil: "networkidle" }).catch(() => null);
    if (!res || !res.ok()) { check(`${path} answers`, false, "no page"); continue; }
    await page.waitForTimeout(600);
    const text = await page.locator("body").innerText();
    const said = NOT_OURS.filter((f) => f.everywhere)
      .map((f) => [f.of, text.match(new RegExp(f.saw.source, f.saw.flags.includes("i") ? "gi" : "g"))])
      .filter(([, m]) => m);
    check(`${path} says nothing about him, me, the chats, the models or how it was made`, said.length === 0,
      said.length ? said.map(([of, m]) => `${of}: ${[...new Set(m)].slice(0, 5).join(" ")}`).join(" | ") : `${text.split(/\s+/).length} words`);
  }

  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

/**
 * Choosing a repository is what brings it in, and there is a way in.
 *
 * WHAT WAS WRONG. He made a fresh site on the Builds page, typed a
 * repository into the field on its Repos tab and pressed the button. It
 * bound where Publish pushes and imported nothing: the Sites list still
 * read "nothing in it yet" and the board opened blank. He then searched the
 * command palette for "import" and for "site" and found neither, and could
 * find no other control anywhere that pulls a repository onto a board.
 *
 * It was reported as delivered, and it half was. "Attaching is importing"
 * shipped inside the GitHub control's own panel — that panel's list does run
 * the import. It never reached the Builds page, which has a repository field
 * of its own that only binds publishing. And the GitHub control draws
 * NOTHING at all until a site already has a repository or a token
 * (`if (!url && !canPush) return null`), so on a fresh site there was no
 * door on screen anywhere. Nothing undid it; it landed in one place and the
 * place he used was a different, older control.
 *
 * HIS RULING: typing an exact name into a field is the wrong shape. He wants
 * to choose from the repositories he has, from inside the Builder, and the
 * act of choosing is what brings it in. Publish binding stays where it is
 * and stops pretending to be the same action.
 *
 * There is one import path, not two. Both controls go through `bringRepoIn`.
 *
 *   npx next start -p 3013
 *   node tests/bring-repo-door.mjs http://127.0.0.1:3013
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
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

/* ------------------------------------------------------------------ */
/* 1. One import path, held at the source                              */
/* ------------------------------------------------------------------ */

/* A file that is not there yet is a failed check, not a stack trace: run
   against a tree without the picker this suite must report what is missing
   rather than explode before the first line of output. */
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const bring = read("src/features/studio/bringRepo.ts");
const button = read("src/features/studio/GithubButton.tsx");
const picker = read("src/features/studio/RepoPicker.tsx");
const builds = read("src/features/builds/BuildsPage.tsx");

check("there is one door, and it holds the whole decision", /export function bringRepoIn\(/.test(bring)
  && /REPO_REFUSAL_SAYS\["not-a-repo"\]/.test(bring) && /REPO_REFUSAL_SAYS\["no-token"\]/.test(bring)
  && /boardIsHere\(\)/.test(bring) && /keepBringForBoard\(asked\)/.test(bring));
/* One repo menu now (tests/repo-menu.mjs): the GitHub control opens it rather than holding a panel, so it keeps no importer of its own at all. */
check("the GitHub control keeps no copy of its own: it opens the one menu",
  /openRepoPicker/.test(button) && !/bringRepoIn\(/.test(button) && !/placeBring\(/.test(button) && !/keepBringForBoard\(/.test(button));
check("and the menu goes through the one door, so there is no second importer",
  /bringRepoIn\(want, \{/.test(picker) && !/placeBring\(/.test(picker));
check("the picker lists what he has rather than asking him to type a name",
  /(fetch|askRoute<[^>]*>)\("\/api\/studio\/repo"/.test(picker) && /data-repo-pick=\{r\.name\}/.test(picker));
check("a site already bound offers only its own repository, and says why",
  /const barred = !!own && r\.name\.toLowerCase\(\) !== own\.toLowerCase\(\);/.test(picker));
/* His ruling that the two actions stop pretending to be one. Read off the
   words a person sees, not the comments explaining why they changed. */
const buildsShown = builds.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
check("the Builds page's field says it is about publishing, not about attaching",
  /"Publish here"/.test(buildsShown) && !/"Use this"/.test(buildsShown));

/* ------------------------------------------------------------------ */
/* 2. The way in, on screen                                            */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });

/** A fresh site: no repository bound, no token. Exactly what he had. */
const fresh = async (width = 1500, height = 1000) => {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  await p.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { localStorage.removeItem("builder.studio"); localStorage.removeItem("builder.builds"); });
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  return { ctx, p };
};

const onScreen = async (loc, W, H) => {
  const b = await loc.first().boundingBox().catch(() => null);
  return !!b && b.width > 4 && b.height > 4 && b.x >= -1 && b.y >= -1 && b.x + b.width <= W + 1 && b.y + b.height <= H + 1;
};

{
  const { ctx, p } = await fresh();
  const door = p.locator("[data-bring-repo]");
  check("a fresh site's Builder shows a way to bring a repository in", (await door.count()) === 1 && await onScreen(door, 1500, 1000));
  /*
   * And it is a door of its own, not the GitHub control. That control draws
   * nothing at all when a site has neither a repository nor a token
   * (`if (!url && !canPush) return null`), which is exactly the state he was
   * in, so a way in that depended on it would not have been there. Whether
   * it happens to be drawn here — a server-side token makes it appear — is
   * not the point and is not asserted.
   */
  check("…and it is a control of its own, not the GitHub button that can vanish",
    (await p.locator("[data-bring-repo][data-github-button]").count()) === 0
    && /if \(!url && !canPush\) return null;/.test(button),
    "the door does not depend on the GitHub control being drawn");
  /* Guarded: with no door there is nothing to press, and the checks below
     should say what is missing rather than the suite dying on a timeout. */
  if (await door.count()) { await door.first().click(); await p.waitForTimeout(600); }
  const sheet = p.locator("[data-repo-picker]");
  check("pressing it opens a picker", (await sheet.count()) === 1);
  check("…which says plainly why it cannot list yet rather than showing a blank",
    /token/i.test((await p.locator("[data-repo-picker-said]").first().innerText().catch(() => "")) || ""),
    (await p.locator("[data-repo-picker-said]").first().innerText().catch(() => "")) || "(said nothing)");
  check("…and says that publishing is a different setting, so the two stop being confused",
    /Publish/i.test(await sheet.first().innerText()));
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 3. The palette finds it by the words he searched for                */
/* ------------------------------------------------------------------ */

for (const word of ["import", "site"]) {
  const { ctx, p } = await fresh();
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(340);
  await p.keyboard.type(word);
  await p.waitForTimeout(420);
  const hits = await p.locator("[cmdk-item]").allTextContents().catch(() => []);
  check(`the palette finds it on "${word}"`, hits.some((t) => /bring a repository in/i.test(t)),
    hits.slice(0, 4).join(" | ") || "nothing offered");
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 4. It is reachable on a phone too                                   */
/* ------------------------------------------------------------------ */

{
  const { ctx, p } = await fresh(390, 844);
  const door = p.locator("[data-bring-repo]");
  const reachable = (await door.count()) === 1 && await onScreen(door, 390, 844);
  check("the way in is on screen at phone width as well", reachable, `${await door.count()} doors`);
  const wide = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  check("…and adding it did not push the Builder sideways", wide <= 390, `${wide}px for a 390px window`);
  await ctx.close();
}

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);

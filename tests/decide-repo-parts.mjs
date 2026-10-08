#!/usr/bin/env node
/**
 * THE ORANGE ! ON A SITE READ FROM ITS REPO.
 *
 * J's report (2026-10-06): on PonsStars the ! sat on the nav's links, which
 * go to real pages, and on the wallet buttons, which the site's own script
 * already works. A repo read keeps a link on its words and the code's
 * references on `source.code`, and the ! now reads both:
 *   · a link whose words carry its place has nothing to decide;
 *   · a button the site's script listens on (or finds) has nothing to decide;
 *   · a number the script writes is already live;
 *   · a button no script touches, and a link with no place, still get one;
 *   · plain text that does nothing never gets one.
 *
 *   node --experimental-strip-types tests/decide-repo-parts.mjs
 *
 * Covers: src/features/studio/shelf/library/badge.ts
 */
import { decisions } from "../src/features/studio/shelf/library/badge.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const code = (refs, built = null) => ({ code: { refs, built } });
const nodes = [
  { id: "nav-menu", pageId: "p", from: { selector: "body > nav > button" }, content: "Menu", source: code([{ kind: "listens" }]) },
  { id: "nav-leaderboard", pageId: "p", from: { selector: "body > nav > span > a:nth-of-type(2)" }, content: [{ text: "Leaderboard", link: { kind: "page", target: "page_leaderboard" } }], source: code([]) },
  { id: "title", pageId: "p", from: { selector: "body > h1 > span" }, content: "PonsStars test page", source: code([]) },
  { id: "wallet-connect-test", pageId: "p", from: { selector: "body > main > section > button" }, content: "Use test wallet", source: code([{ kind: "listens" }]) },
  { id: "wallet-refresh", pageId: "p", from: { selector: "body > main > section > button:nth-of-type(2)" }, content: "Refresh", source: code([{ kind: "finds" }]) },
  { id: "in-match", pageId: "p", from: { selector: "body > main > p" }, content: "0.25 SOL", source: code([{ kind: "writes" }], { kind: "writes" }) },
  { id: "dead-button", pageId: "p", from: { selector: "body > footer > button" }, content: "Nothing", source: code([{ kind: "styles" }]) },
  { id: "dead-link", pageId: "p", from: { selector: "body > footer > a" }, content: [{ text: "Soon" }], source: code([]) },
  { id: "frozen", pageId: "p", from: { selector: "body > footer > p" }, content: "1.5 SOL", source: code([]) },
];
const marked = new Map(decisions(nodes).map((d) => [d.id, d.why]));
const say = [...marked.keys()].join(", ");

check("a nav link that goes to a page has no !", !marked.has("nav-leaderboard"), say);
check("the menu button its script works has no !", !marked.has("nav-menu"), say);
check("plain page title has no !", !marked.has("title"), say);
check("a wallet button the script listens on has no !", !marked.has("wallet-connect-test"), say);
check("a button the script finds has no !", !marked.has("wallet-refresh"), say);
check("a number the script writes has no !", !marked.has("in-match"), say);
check("a button no script touches still has one", marked.get("dead-button") === "nowhere", say);
check("a link with nowhere to go still has one", marked.get("dead-link") === "nowhere", say);
check("a frozen number no script writes still has one", marked.get("frozen") === "live", say);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

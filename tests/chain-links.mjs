/**
 * Chains: red, drawn as chain, and they say why.
 *
 * A link between two parts used to be a line with an arrowhead. It said the
 * two were joined and nothing about what either had to do about it, so it
 * reached the blueprint as "A → B" — a fact nobody can build from — and the
 * parts went to Claude as if neither knew the other existed.
 *
 * What is held shut here:
 *   · the reason is *derived*, in order: a condition in the target's own
 *     words, then the data on a data chain, then a mention, then the relation;
 *   · a chain with an end in the air has no reason, because it has no second
 *     part to have one about;
 *   · what the author typed on the chain always wins;
 *   · both parts carry the chain, each from its own side;
 *   · a chain moves a part's fingerprint, so a part whose chains changed is
 *     resent rather than assumed unchanged;
 *   · the reason reaches the pieces sent to Claude, and the blueprint;
 *   · and on the board the chain is red, made of links, and wears its reason.
 *
 *   node tests/chain-links.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { chainLines, linkReason } from "../src/features/studio/links.ts";
import { piecesFrom, pieceToText } from "../src/features/studio/threads.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The reason, read off the parts                                   */
/* ------------------------------------------------------------------ */

const wallet = { id: "n_wallet", label: "Connect wallet", data: "address, chain id, balance", prompt: "A button that connects a wallet." };
const claim = { id: "n_claim", label: "Claim", data: "", prompt: "The claim button. Shown only when the wallet is connected, and disabled while a claim is in flight." };
const feed = { id: "n_feed", label: "Feed", data: "", prompt: "The latest twenty posts." };
const hero = { id: "n_hero", label: "Hero", data: "", prompt: "A headline and a picture." };

check(
  "a condition in the target's own words is the reason",
  linkReason(wallet, claim) === "only when the wallet is connected",
  linkReason(wallet, claim),
);
check(
  "and the clause that names the other part is the one taken",
  !linkReason(wallet, claim).includes("in flight"),
  linkReason(wallet, claim),
);
check(
  "a data chain reads the first value the source holds",
  linkReason(wallet, feed, "data") === "reads address from Connect wallet",
  linkReason(wallet, feed, "data"),
);
check(
  "a mention is the sentence one part named the other in",
  linkReason(hero, { id: "x", label: "Sign up", prompt: "A form. It repeats the promise made in the Hero." }) === "It repeats the promise made in the Hero",
  linkReason(hero, { id: "x", label: "Sign up", prompt: "A form. It repeats the promise made in the Hero." }),
);
check(
  "with nothing said either way, the relation is at least true",
  linkReason(hero, feed) === "leads to Feed" && linkReason(hero, feed, "data") === "reads from Hero",
  `${linkReason(hero, feed)} · ${linkReason(hero, feed, "data")}`,
);
check(
  "an end in the air gets no reason",
  linkReason(wallet, undefined) === "" && linkReason(undefined, claim) === "",
);
{
  const long = { id: "n_long", label: "Ledger", prompt: "The ledger, shown only when the contract has been read and the balance has settled and the network agrees." };
  const r = linkReason(wallet, long);
  check("a reason is a label, not a paragraph", r.length <= 53 && r.endsWith("…"), `${r.length}: ${r}`);
}
check(
  "a part is never described by its own name mid-word",
  linkReason({ id: "a", label: "Cart", prompt: "" }, { id: "b", label: "Card", prompt: "A card of the product." }) === "leads to Card",
  linkReason({ id: "a", label: "Cart", prompt: "" }, { id: "b", label: "Card", prompt: "A card of the product." }),
);

/* ------------------------------------------------------------------ */
/* 2. The chains on a board, gathered against both parts               */
/* ------------------------------------------------------------------ */

const NODES = [wallet, claim, feed].map((n) => ({ ...n, pageId: "p", w: 200, h: 60 }));
const arrow = (extra = {}) => ({ kind: "arrow", fromNodeId: "n_wallet", toNodeId: "n_claim", relation: "flow", label: "", ...extra });

{
  const map = chainLines(NODES, [arrow()]);
  check("both ends carry the chain, each from its own side", map.get("n_wallet")?.[0] === "→ Claim — only when the wallet is connected" && map.get("n_claim")?.[0] === "← Connect wallet — only when the wallet is connected", JSON.stringify([...map]));
  check("a wire with an end in the air is not a chain", chainLines(NODES, [arrow({ toNodeId: null })]).size === 0);
  check("a drawn shape that is not a wire is not a chain", chainLines(NODES, [{ ...arrow(), kind: "pen" }]).size === 0);
  check("a part chained to itself is not a chain", chainLines(NODES, [arrow({ toNodeId: "n_wallet" })]).size === 0);
  check("what the author typed on the chain wins", chainLines(NODES, [arrow({ label: "the same session" })]).get("n_claim")?.[0] === "← Connect wallet — the same session");
}

/* ------------------------------------------------------------------ */
/* 3. The pieces sent to Claude                                        */
/* ------------------------------------------------------------------ */

const board = (shapes) => {
  const chains = chainLines(NODES, shapes);
  return piecesFrom({ pages: [{ id: "p", name: "Home" }], nodes: NODES.map((n) => ({ ...n, links: chains.get(n.id) })) });
};
{
  const bare = board([]);
  const chained = board([arrow()]);
  const pieceOf = (ps, id) => ps.find((p) => p.id === id);
  check(
    "the reason travels with the part's prompt",
    pieceToText(pieceOf(chained, "node:n_claim")).includes("chained: ← Connect wallet — only when the wallet is connected"),
    pieceToText(pieceOf(chained, "node:n_claim")),
  );
  check("a part on no chain says nothing about chains", !pieceToText(pieceOf(bare, "node:n_claim")).includes("chained"));
  check(
    "a chain moves the fingerprint, so the part is resent",
    pieceOf(bare, "node:n_claim").fingerprint !== pieceOf(chained, "node:n_claim").fingerprint,
  );
  check(
    "and the part at the other end moves too",
    pieceOf(bare, "node:n_wallet").fingerprint !== pieceOf(chained, "node:n_wallet").fingerprint,
  );
  check(
    "a part nowhere near the chain is untouched",
    pieceOf(bare, "node:n_feed").fingerprint === pieceOf(chained, "node:n_feed").fingerprint,
  );
}

/* ------------------------------------------------------------------ */
/* 4. On the board, and in the blueprint                               */
/* ------------------------------------------------------------------ */

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const full = (n, x, y) => ({
  id: n.id, pageId: "page_home", featureId: "cta-primary", label: n.label, prompt: n.prompt, content: "", data: n.data ?? "",
  x, y, w: 260, h: 64, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false,
  link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1,
  auraStyle: "glow", texture: null, sketch: null,
});
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [full(wallet, 200, 160), full(claim, 900, 460)],
    groups: [],
    shapes: [{ id: "s_chain", pageId: "page_home", kind: "arrow", points: [[330, 224], [1030, 524]], hue: 265, width: 2, label: "", prompt: "", relation: "flow", fromNodeId: "n_wallet", toNodeId: "n_claim" }],
    format: {},
    brief: { name: "BLACKORB", gimmick: "", master: "" },
    frameWidth: 1440,
    activePageId: "page_home",
    trail: [],
  },
  version: 0,
};

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), JSON.stringify(doc));
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const chain = page.locator('[data-shape-id="s_chain"][data-chained]').first();
check("a wire between two parts is drawn as a chain", (await chain.count()) === 1);
const link = page.locator("[data-chain] ellipse").first();
const rings = await page.locator("[data-chain] ellipse").count();
check("of interlocking links, not one line", rings >= 8, `${rings} links`);
// Nothing below waits on a link that is not there: a missing chain is one
// failure with a reason, not a suite that hangs for thirty seconds and dies.
const attr = async (name) => (rings ? await link.getAttribute(name) : null);
const stroke = await attr("stroke");
check("in red", /oklch\(0\.64 0\.23 27\)/.test(stroke ?? ""), stroke ?? "no link to measure");
const width = Number(await attr("stroke-width"));
check("wider than the wire it replaced", width >= 2, `${width || "no link"} vs 2 nominal`);
check("and it has no arrowhead: a chain is not a direction", (await page.locator('[data-shape-id="s_chain"] line[marker-end]').count()) === 0);
const chip = page.locator('[data-chain-reason="s_chain"]');
const said = (await chip.count()) ? await chip.innerText() : "";
check("the chain says why it is there", said.trim() === "only when the wallet is connected", said);

await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(800);
const brief = await page.locator("pre").first().innerText();
check(
  "and the reason reaches the blueprint",
  /\*\*Connect wallet\*\* → \*\*Claim\*\* — only when the wallet is connected/.test(brief),
  (brief.split("\n").find((l) => l.includes("→ **Claim**")) ?? "no connection line").trim(),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

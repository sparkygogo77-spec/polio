#!/usr/bin/env node
/**
 * PHASE 2: WHAT A PUBLISHED REPOSITORY CARRIES FOR THE CODE CHAT, AND WHAT
 * COMES BACK FROM IT.
 *
 * THE OWNER'S GOAL: the builder handles what it can, a repo-connected code
 * chat builds the rest, and every feature made once is reused on later
 * sites. So a publish leaves the rest written down, and the builder takes
 * back what was built:
 *   D) TASKS.md: every task the library could not cover, each with the part,
 *      the page, the owner's words and the part's stable id, keyed by that
 *      id so a republish updates an entry and never duplicates it;
 *   E) the feature contract: AGENTS.md and CLAUDE.md say how a feature is
 *      shaped, and features/<name>/ holds manifest.json, script.js (calling
 *      siteFeatures.define) and a README for each feature the site uses. The
 *      contract is a marked block, so the owner's own AGENTS.md survives;
 *   F) the round trip: features/ folders read back are offered when new or
 *      changed, with problems named; an accepted one joins the library as
 *      text, is reused anywhere, and ships in a publish. Nothing runs here.
 * And the Phase 1 gap: words typed on a live-data spot answer its !.
 *
 *   node --experimental-strip-types tests/features-contract.mjs
 */
import vm from "node:vm";
import { LIBRARY, getWork, setAccepted, allWorks, featureFiles, matchWorks } from "../src/features/studio/shelf/library/works.ts";
import { tasksFile, contractFiles, mergeBlock, BLOCK_START, BLOCK_END, agentsFile } from "../src/features/studio/shelf/library/contract.ts";
import { foundIn, offersFrom, acceptedWork, lineDiff } from "../src/features/studio/shelf/library/roundTrip.ts";
import { decisions } from "../src/features/studio/shelf/library/badge.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const pages = [
  { id: "page_home", name: "Creator Hub", path: "/" },
  { id: "page_tokens", name: "Tokens", path: "/tokens" },
];
const nodes = [
  { id: "n_price", pageId: "page_home", featureId: "prose", label: "$116.59", content: "$116.59", work: { id: "sol-price", inputs: { every: "15" } } },
  { id: "n_wallet", pageId: "page_home", featureId: "cta-primary", label: "button “KGER...9OP7”", content: "kgER...9oP7", task: "show the latest transaction hashes from the connected wallet" },
  { id: "n_burn", pageId: "page_tokens", featureId: "cta-primary", label: "Burn", content: [{ text: "Burn " }, { text: "all" }], task: "burn every empty token account and close it" },
  { id: "n_quiet", pageId: "page_tokens", featureId: "prose", label: "words", content: "Just words" },
];

/* ------------------------------------------------------------ D) TASKS.md */
{
  const md = tasksFile(nodes, pages);
  check("TASKS.md lists every task, one entry per part", (md.match(/^### /gm) ?? []).length === 2, `${(md.match(/^### /gm) ?? []).length} entries`);
  const wallet = md.slice(md.indexOf("n_wallet") - 40, md.indexOf("n_burn") > md.indexOf("n_wallet") ? md.indexOf("n_burn") : undefined);
  check("…keyed by the part's stable id", /### .*`n_wallet`/.test(md) && /### .*`n_burn`/.test(md));
  check("…with the owner's words, as typed", md.includes("show the latest transaction hashes from the connected wallet"));
  check("…the page it is on and that page's file", /Creator Hub/.test(wallet) && /index\.html/.test(wallet) && /tokens\/index\.html/.test(md));
  check("…and the part, by what it shows", md.includes("kgER...9oP7") && md.includes("Burn all"));
  check("…and how to reach it on the page: its id is the element's id", md.includes('document.getElementById("n_wallet")'));
  check("parts with no task are not in it", !md.includes("n_quiet") && !/### .*n_price/.test(md));
  check("the same board writes the same file: a republish never duplicates", tasksFile(nodes, pages) === md);
  const moved = tasksFile([...nodes].reverse(), pages);
  check("…whatever order the parts are in", moved === md);
  const built = nodes.map((n) => (n.id === "n_wallet" ? { ...n, work: { id: "sol-price", inputs: {} } } : n));
  const md2 = tasksFile(built, pages);
  check("a task whose part now carries a feature is listed as built, under the same id", /## Built[\s\S]*`n_wallet`/.test(md2) && (md2.match(/`n_wallet`/g) ?? []).length === (md.match(/`n_wallet`/g) ?? []).length);
  check("a board with no tasks still writes the file, saying so", /no open tasks/i.test(tasksFile([nodes[3]], pages)));
}

/* ------------------------------------------------------- E) the contract */
{
  const files = contractFiles(nodes, pages);
  const at = new Map(files.map((f) => [f.path, f.content]));
  for (const p of ["TASKS.md", "AGENTS.md", "CLAUDE.md", "features/sol-price/manifest.json", "features/sol-price/script.js", "features/sol-price/README.md"]) {
    check(`the published repository gets ${p}`, at.has(p));
  }
  check("…and no folder for a feature the site does not use", ![...at.keys()].some((p) => p.startsWith("features/token-price/")));
  const man = JSON.parse(at.get("features/sol-price/manifest.json") ?? "{}");
  check("manifest.json is the library's own manifest", man.id === "sol-price" && man.name === "Live SOL price" && man.needs === "none" && Array.isArray(man.inputs));
  check("…naming the parts it is attached to", JSON.stringify(man.parts) === JSON.stringify(["n_price"]), JSON.stringify(man.parts));
  const script = at.get("features/sol-price/script.js") ?? "";
  check("script.js calls siteFeatures.define with its own id", script.includes('siteFeatures.define("sol-price"'));
  check("README.md says what it is, its inputs and what it needs", /Live SOL price/.test(at.get("features/sol-price/README.md") ?? "") && /every/.test(at.get("features/sol-price/README.md") ?? "") && /needs/i.test(at.get("features/sol-price/README.md") ?? ""));
  const agents = at.get("AGENTS.md") ?? "";
  for (const w of ["features/<name>/", "manifest.json", "script.js", "README.md", "siteFeatures.define", "TASKS.md", "needs", "parts"]) {
    check(`AGENTS.md explains ${w}`, agents.includes(w));
  }
  check("CLAUDE.md carries the same contract", (at.get("CLAUDE.md") ?? "").includes(agents.slice(agents.indexOf(BLOCK_START), agents.indexOf(BLOCK_END))));
  check("the contract is one marked block", agents.includes(BLOCK_START) && agents.includes(BLOCK_END));

  /* The worked example in the contract runs as the contract says it does. */
  const src = at.get("features/sol-price/script.js");
  let defined = null;
  vm.runInNewContext(src, { siteFeatures: { define: (id, fn) => { defined = { id, fn }; } } });
  check("a script written to the contract defines itself when the runtime is there", defined?.id === "sol-price" && typeof defined.fn === "function");

  /* The owner's own AGENTS.md survives. */
  const ours = agentsFile();
  check("with no AGENTS.md there, the file is written whole", mergeBlock(null, ours) === ours);
  const theirs = "# My notes\n\nDeploy with care. Keep the green.\n";
  const once = mergeBlock(theirs, ours);
  check("with the owner's own AGENTS.md there, their words stay and the block is added", once.startsWith(theirs.trimEnd()) && once.includes(BLOCK_START) && once.includes("Keep the green"));
  check("…and a second publish replaces only the block", mergeBlock(once, ours) === once);
  const edited = once.replace("Deploy with care.", "Deploy with great care.") + "\nMore of the owner's words after.\n";
  const again = mergeBlock(edited, ours.replace("siteFeatures.define", "siteFeatures.define "));
  check("…keeping what they wrote before and after it", again.includes("Deploy with great care.") && again.includes("More of the owner's words after.") && (again.match(new RegExp(BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length === 1);
}

/* ------------------------------------------------------- F) round trip */
{
  const pushed = contractFiles(nodes, pages);
  const same = foundIn(pushed);
  check("reading back what was published finds its feature folders", same.length === 1 && same[0].id === "sol-price", same.map((f) => f.id).join(", "));
  check("…and offers nothing when nothing changed", offersFrom(same, allWorks()).length === 0);

  const NEW_SCRIPT = `siteFeatures.define("wallet-activity", function (el, inputs, api) {\n  window.__ranInBuilder = true;\n  api.set(el, "3G8S...EGjn");\n});\n`;
  const newMan = { id: "wallet-activity", name: "Wallet activity", category: "data", blurb: "The latest transaction hashes of the connected wallet.", inputs: [{ id: "count", label: "How many", kind: "number", default: "3" }], needs: "wallet", says: ["latest transactions", "transaction hashes"], look: { sample: "3G8S...EGjn" }, version: 1, parts: ["n_wallet"] };
  const repoFiles = [
    ...pushed,
    { path: "features/wallet-activity/manifest.json", content: JSON.stringify(newMan, null, 2) },
    { path: "features/wallet-activity/script.js", content: NEW_SCRIPT },
    { path: "features/wallet-activity/README.md", content: "# Wallet activity\n" },
    { path: "features/sol-price/script.js", content: (pushed.find((f) => f.path === "features/sol-price/script.js")?.content ?? "").replace("30) * 1000", "20) * 1000") },
    { path: "features/broken/manifest.json", content: "{ not json" },
    { path: "features/broken/script.js", content: "siteFeatures.define(\"broken\", function(){});" },
    { path: "features/wrong-id/manifest.json", content: JSON.stringify({ ...newMan, id: "someone-else" }) },
    { path: "features/wrong-id/script.js", content: NEW_SCRIPT },
  ];
  const offers = offersFrom(foundIn(repoFiles), allWorks());
  const by = new Map(offers.map((o) => [o.id, o]));
  check("a new folder is offered as new", by.get("wallet-activity")?.status === "new", by.get("wallet-activity")?.status);
  check("…with its manifest, its script and its README as text", by.get("wallet-activity")?.script === NEW_SCRIPT && by.get("wallet-activity")?.manifest?.name === "Wallet activity" && !!by.get("wallet-activity")?.readme);
  check("…and the parts it was built for", JSON.stringify(by.get("wallet-activity")?.parts) === JSON.stringify(["n_wallet"]));
  check("…and a diff, every line added", by.get("wallet-activity")?.diff.every((l) => l.op === "+") && by.get("wallet-activity").diff.length > 3);
  const changed = by.get("sol-price");
  check("a changed folder is offered as changed", changed?.status === "changed", changed?.status);
  check("…with a diff naming exactly the changed line", changed?.diff.filter((l) => l.op === "-").length === 1 && changed.diff.some((l) => l.op === "+" && l.text.includes("20) * 1000")), JSON.stringify(changed?.diff.filter((l) => l.op !== " ")));
  check("a folder whose manifest cannot be read is named as such, and cannot be accepted", by.get("broken")?.problems.length > 0 && by.get("broken")?.acceptable === false, by.get("broken")?.problems.join("; "));
  check("…as is one whose manifest names another id", by.get("wrong-id")?.acceptable === false, by.get("wrong-id")?.problems.join("; "));
  check("the good ones can be accepted", by.get("wallet-activity")?.acceptable === true && changed?.acceptable === true);

  const picture = { featureId: "cta-primary", label: "button “KGER...9OP7”", content: "kgER...9oP7", w: 132, h: 40, colour: null, font: null, options: {} };
  const w = acceptedWork(by.get("wallet-activity"), { from: "sparkygogo77-spec/solcinerator", picture });
  check("accepted, it is a library feature held as text", w.manifest.id === "wallet-activity" && w.script === NEW_SCRIPT && typeof w.script === "string");
  check("…with the part it was attached to as its shelf picture", w.picture?.content === "kgER...9oP7" && w.picture?.featureId === "cta-primary");
  check("…and where it came from", w.from === "sparkygogo77-spec/solcinerator");
  setAccepted([w]);
  check("it joins the library, beside the built-in ones", getWork("wallet-activity")?.manifest.name === "Wallet activity" && allWorks().length === LIBRARY.length + 1);
  check("the one box finds it by its words", matchWorks("latest transactions", allWorks().map((x) => x.manifest))[0]?.manifest.id === "wallet-activity");
  const shipped = featureFiles([{ id: "x", work: { id: "wallet-activity", inputs: {} } }]);
  check("a publish that uses it ships its script, on any site", shipped.some((f) => f.path === "assets/features/wallet-activity.js" && f.content.includes(NEW_SCRIPT.trim())));
  const folder = contractFiles([{ id: "x", pageId: "page_home", featureId: "prose", content: "", work: { id: "wallet-activity", inputs: {} } }], pages);
  check("…and writes its folder back, so the round trip closes", folder.some((f) => f.path === "features/wallet-activity/script.js" && f.content === NEW_SCRIPT));
  check("…after which it is not offered again", offersFrom(foundIn(folder), allWorks()).length === 0);
  const acceptedChange = acceptedWork(changed, { from: "sparkygogo77-spec/solcinerator", picture: null });
  setAccepted([w, acceptedChange]);
  check("an accepted change to a built-in replaces it by id", getWork("sol-price")?.script.includes("20) * 1000") && allWorks().filter((x) => x.manifest.id === "sol-price").length === 1);
  setAccepted([]);
  check("taken away, the built-in is back", getWork("sol-price")?.script.includes("30) * 1000") && !getWork("wallet-activity"));
  check("the diff itself: equal lines kept, changes marked", JSON.stringify(lineDiff("a\nb\nc", "a\nx\nc").map((l) => l.op + l.text)) === JSON.stringify([" a", "-b", "+x", " c"]));
}

/* ------------------------------------------------- the Phase 1 gap */
{
  const live = [{ id: "s", pageId: "p", featureId: "prose", content: "0.0000 SOL" }];
  check("a live-data spot with nothing said still wears the !", decisions(live).length === 1);
  check("words typed on it answer it", decisions([{ ...live[0], content: "12.5000 SOL", settled: true }]).length === 0);
  const button = [{ id: "b", pageId: "p", featureId: "cta-primary", content: "1D", settled: true }];
  check("…but words on a button that goes nowhere do not say where it goes", decisions(button).length === 1);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

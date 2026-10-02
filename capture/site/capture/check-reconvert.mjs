/**
 * A SITE CONVERTED AGAIN FROM WHAT IS COMMITTED, ITS OWNER'S SETTINGS KEPT.
 *
 * The first step of share.xyz's plan (docs/fidelity/reimport-plan.md): its
 * document predates two days of converter fixes, and where the live site
 * cannot be opened it is converted again from its committed captures
 * (`capture-site.mjs --reconvert`). Held here on share.xyz itself, in a
 * copy of its folder, with a feature and a hand-placed box set on its
 * document as an owner would:
 *
 *   · the converter runs over the committed captures, no browser: every page
 *     and every part is there, and today's converter's fields arrive (the
 *     max-widths the old document lacked);
 *   · the owner's feature and hand-placed box are kept, and said;
 *   · the captures, the source bytes and run.json are left as they were;
 *   · without a capture folder it refuses, and writes nothing.
 *
 *   node capture/site/capture/check-reconvert.mjs
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { convertKeeping, reconvertPlan } from "./capture-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const SITE = "share-xyz";
if (!existsSync(join(root, "sites", SITE, "capture", "routes.json"))) { console.log(`no sites/${SITE}/capture`); process.exit(1); }

/* A copy of the site's folder, as a repository would hold it. */
const work = mkdtempSync(join(tmpdir(), "reconvert-"));
for (const d of ["capture", "assets/source", "site"]) cpSync(join(root, "sites", SITE, d), join(work, "sites", SITE, d), { recursive: true });
const folder = join(work, "sites", SITE);
const hashes = (dir) => { const out = {}; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (!/ledger\.txt$/.test(p)) out[relative(folder, p)] = createHash("sha1").update(readFileSync(p)).digest("hex"); } })(dir); return out; };
const before = { capture: hashes(join(folder, "capture")), source: hashes(join(folder, "assets", "source")) };

/* The owner's settings on the document as it was. */
const docFile = join(folder, "site", "document.json");
const was = JSON.parse(readFileSync(docFile, "utf8"));
const home = was.pages[0].id;
const words = was.nodes.find((n) => n.pageId === home && n.featureId === "prose" && n.from?.selector);
const box = was.nodes.find((n) => n.pageId === home && n.featureId === "box" && n.from?.selector && n.w > 100);
words.work = { id: "reveal", inputs: { direction: "up", distance: "30", once: "yes" } };
box.x += 24; box.byHand = true;
/* As a document from an older converter: no max-widths (share.xyz's own
 * document, 3e47f8a, had none; it is converted again now). */
for (const n of was.nodes) delete n.maxw;
writeFileSync(docFile, JSON.stringify(was, null, 2) + "\n");
const maxwBefore = was.nodes.filter((n) => n.maxw).length;

/* Converted again, as `capture-site.mjs --reconvert --name share-xyz` does. */
const ok = convertKeeping(reconvertPlan(work, SITE));
check("it converts from the committed captures, no browser", ok === true);
const now = JSON.parse(readFileSync(docFile, "utf8"));
check("every page and every part is there", now.pages.length === was.pages.length && now.nodes.length === was.nodes.length, `${now.pages.length} pages, ${now.nodes.length} parts; were ${was.pages.length}, ${was.nodes.length}`);
check("today's converter's fields arrive: parts carry their max-width", now.nodes.filter((n) => n.maxw).length > maxwBefore, `${maxwBefore} → ${now.nodes.filter((n) => n.maxw).length}`);
const same = (n) => now.nodes.find((m) => m.pageId === n.pageId && m.from?.selector === n.from.selector);
check("the owner's feature is kept", same(words)?.work?.id === "reveal" && same(words)?.work?.inputs?.distance === "30", JSON.stringify(same(words)?.work));
check("…and the box he placed by hand keeps its place", same(box)?.x === box.x && same(box)?.byHand === true, JSON.stringify([same(box)?.x, box.x]));
check("the converter's ledger is written", existsSync(join(folder, "capture", "ledger.txt")) && readFileSync(join(folder, "capture", "ledger.txt"), "utf8").length > 1000);
const after = { capture: hashes(join(folder, "capture")), source: hashes(join(folder, "assets", "source")) };
check("the captures, run.json and the source bytes are left as they were", JSON.stringify(after) === JSON.stringify(before), Object.keys(after.capture).filter((k) => after.capture[k] !== before.capture[k]).join(", "));

/* No capture folder: a refusal, and nothing written. */
const cli = spawnSync(process.execPath, [join(here, "capture-site.mjs"), "--reconvert", "--name", "no-such-site"], { encoding: "utf8" });
check("without a capture folder it refuses", cli.status === 2 && /no sites\/no-such-site\/capture\/routes\.json/.test(cli.stderr) && !existsSync(join(root, "sites", "no-such-site")), cli.stderr.trim());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

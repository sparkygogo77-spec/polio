/**
 * The keys panel is called the keys panel.
 *
 * The owner does not use the word this check looks for, and does not want it
 * used for the keys panel. It was on 150 lines in 43 files: three route
 * messages, the tour, the command keywords, the panel's own buttons and
 * notes, comments, the docs, and a suite named for it. A word on screen that
 * contradicts what the owner calls a thing is an unfinished edge like any
 * other. The word is spelled in two halves below so that this file does not
 * say it either.
 *
 *   node tests/keys-wording.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const WORD = new RegExp("va" + "ult", "i");
const walk = (dir, out = []) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
/*
 * The generated passes carry the history's own words, the inventory names the finding, and this file spells the word in halves.
 * Third-party files copied into a test fixture's vendor folder (tests/fixtures/<name>/.../vendor/, such as PST's
 * BIP39 word list, which holds the word as one of its 2048) are someone else's text, kept whole; nothing else is skipped.
 */
const vendored = (p) => /^tests\/fixtures\/[^/]+\/(?:.+\/)?vendor\//.test(p.split("\\").join("/"));
const skip = (p) => p.endsWith("passes.generated.ts") || p.endsWith("INVENTORY.md") || p.endsWith("keys-wording.mjs") || vendored(p) || /\.(png|jpg|webp|json)$/.test(p);
const files = [...walk("src"), ...walk("tests"), ...walk("docs"), "AGENTS.md", "README.md", ".env.example", "site.config.ts"].filter((p) => !skip(p));
const said = [];
for (const f of files) {
  let s = "";
  try { s = readFileSync(f, "utf8"); } catch { continue; }
  s.split("\n").forEach((line, i) => { if (WORD.test(line)) said.push(`${f}:${i + 1}`); });
}
check("nothing in the code, the interface, the docs or a suite calls the keys panel by the other word", said.length === 0, said.length ? `${said.length} lines: ${said.slice(0, 6).join(", ")}${said.length > 6 ? ", …" : ""}` : `${files.length} files clean`);
check("the suite once named for it is named for the panel", files.some((p) => p.endsWith("tests/keys-panel.mjs")) && !files.some((p) => /keys-va/.test(p)));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

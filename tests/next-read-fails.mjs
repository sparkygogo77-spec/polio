#!/usr/bin/env node
/**
 * A FAILED READ OF polio/NEXT.md STOPS THE SEND INSTEAD OF WIPING THE QUEUE.
 *
 * Publish and "Send the design back" rewrite polio/NEXT.md with what was
 * already there plus this round's lines. When GitHub did not answer the read
 * (a rate limit, a 5xx, a dropped connection), the old lines were taken as
 * none: the file went out holding only the new lines, was merged, and the next
 * Refresh counted every missing line as fixed. Now only a 404 means "no file
 * yet"; any other answer stops the send with one line saying so. GitHub is a
 * stand-in here.
 *
 *   node tests/next-read-fails.mjs
 *
 * Covers: src/features/studio/kitRun.ts, src/features/studio/publishAsks.ts, src/features/studio/fixLoop.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/StyleLayerPanel.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "kitRun.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const read = (f) => readFileSync(join(here, "..", f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* An existing queue: six open lines from earlier rounds. */
const old = Array.from({ length: 6 }, (_, i) => ({ key: `nowhere:old${i + 1}`, kind: "nowhere", hook: `part-${i + 1}`, page: "Play", says: `Part ${i + 1} does nothing yet.` }));
const fresh = { key: "nowhere:new1", kind: "nowhere", hook: "tv-box-start", page: "Play", says: "Start does nothing yet." };
const queue = F.nextMd(old, { site: "PonsStars", when: "2026-10-10" });
const b64 = Buffer.from(queue, "utf8").toString("base64");
const answer = (status, json) => async () => ({ status, json: async () => json });
const read6 = (f) => K.fileOrGone(f, "STANDIN_TOKEN", "owner/site", "main", F.NEXT_PATH);

/* 1. The read: text, gone, or failed. */
const ok200 = await read6(answer(200, { content: b64 }));
check("a 200 gives the file's text", ok200.ok === true && ok200.text === queue);
const gone = await read6(answer(404, { message: "Not Found" }));
check("a 404 means there is no NEXT.md yet", gone.ok === true && gone.text === null);
for (const [name, f] of [["a 403 rate limit", answer(403, { message: "API rate limit exceeded" })], ["a 502", answer(502, null)], ["a dropped connection", async () => { throw new TypeError("fetch failed"); }]]) {
  const got = await read6(f);
  check(`${name} is a failed read, not an empty file`, got.ok === false && /Could not read polio\/NEXT\.md from owner\/site/.test(got.says) && /nothing was sent, try again/.test(got.says), got.says ?? "");
}

/* 2. What gets written when the read works: the old lines stay. */
const written = F.nextMd([fresh], { site: "PonsStars", when: "2026-10-11", prev: ok200.text });
check("the six open lines and the new one are all in the file", (written.match(/^- \[ \] /gm) ?? []).length === 7);
check("so Refresh calls none of the old lines fixed", F.fixedIn([...old, fresh], written).length === 0);

/* 3. Wiring (source read): a failed read sends nothing. */
const asks = read("src/features/studio/publishAsks.ts");
const csb = read("src/features/studio/CodeSiteButtons.tsx");
const slp = read("src/features/studio/StyleLayerPanel.tsx");
check("gatherAsks reads NEXT.md with fileOrGone, never a swallowed fileAt", /fileOrGone\(fetch, token, source\.repo, [^)]*NEXT_PATH\)/.test(asks) && !/fileAt\([^)]*NEXT_PATH\)\.catch/.test(asks));
check("a failed read returns its line with nothing to write", /if \(!prev\.ok\) return \{[^}]*extra: \[\][^}]*says: prev\.says \}/.test(asks) && /prev: prev\.text/.test(asks));
check("Publish stops before sending when the read failed", /if \(says\) \{ say\("Not published", says, "warn"\); return; \}[\s\S]{0,40}const sent = await sendDesign/.test(csb));
check("Send the design back stops before sending too", /if \(asks\.says\) \{ setSaid\(\{ text: asks\.says, bad: true \}\); return; \}[\s\S]{0,40}const done = await sendDesign/.test(slp));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

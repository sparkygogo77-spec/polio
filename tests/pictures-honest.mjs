/**
 * A picture that was sent and could not go is said, not lost.
 *
 * `generate` dropped any page picture over 6,000,000 base64 characters or
 * not PNG/JPEG/WebP after the browser had counted it; `body` dropped a
 * drawing or a render of the last attempt over 700,000 and asked the
 * revision blind. Rows B9 and B10. The taking is one pure module now, so
 * the limits are held here by feeding it exactly what crosses them.
 *
 *   node tests/pictures-honest.mjs
 */
import { readFileSync } from "node:fs";
import { takePictures, takePng, droppedCount, droppedWords, PICTURE_LIMIT, SHOT_LIMIT, PICTURE_MAX } from "../src/features/studio/pictureIn.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* B9. Page pictures: what goes, what is left out, and why. */
const png = (n) => ({ data: "A".repeat(n), mediaType: "image/png", label: "a page" });
const fine = png(1000);
const big = png(PICTURE_LIMIT);
const gif = { ...png(1000), mediaType: "image/gif" };
const junk = { data: "not base64!", mediaType: "image/png" };
const taken = takePictures([fine, big, gif, junk, null]);
check("a picture under the limit goes", taken.pictures.length === 1 && taken.pictures[0].label === "a page", `${taken.pictures.length} went`);
check("one at the limit is left out and counted as too big", taken.dropped.tooBig === 1, JSON.stringify(taken.dropped));
check("a GIF is left out and counted as the wrong type", taken.dropped.wrongType === 1);
check("something that is not base64, or nothing, is counted as unreadable", taken.dropped.unreadable === 2);
check("the count is the four reasons added up", droppedCount(taken.dropped) === 4, `${droppedCount(taken.dropped)}`);
const words = droppedWords(taken.dropped);
check("and the reasons come out in words a person can act on", /1 over 4\.5 MB/.test(words) && /1 not PNG, JPEG or WebP/.test(words) && /2 unreadable/.test(words), words);
const many = takePictures(Array.from({ length: PICTURE_MAX + 3 }, () => fine));
check(`past the ${PICTURE_MAX} an ask carries, the rest are counted, not lost`, many.pictures.length === PICTURE_MAX && many.dropped.over === 3, `${many.pictures.length} went, ${many.dropped.over} over`);
check("one character under the limit goes", takePictures([png(PICTURE_LIMIT - 1)]).pictures.length === 1);

/* B10. The body route's drawing and render. */
check("a render under the cap goes", takePng("B".repeat(SHOT_LIMIT - 1)).data !== null);
const over = takePng("B".repeat(SHOT_LIMIT));
check("one at the cap is left out with its size and the cap in words", over.data === null && /513 KB, over the 513 KB/.test(over.unseen ?? ""), over.unseen ?? "no reason given");
check("a render that was never sent is not a reason", takePng(null).unseen === null && takePng("").unseen === null);
check("one that is not base64 says so", /not a PNG/.test(takePng("data:image/png;base64,xx").unseen ?? ""));

/* The routes and their readers say it. */
const gen = readFileSync("src/app/api/studio/generate/route.ts", "utf8");
const body = readFileSync("src/app/api/studio/body/route.ts", "utf8");
const dialog = readFileSync("src/features/studio/BriefDialog.tsx", "utf8");
const run = readFileSync("src/features/studio/bodyRun.ts", "utf8");
check("generate takes its pictures through the one module and answers with the count and the reasons", /takePictures\(body\.pictures\)/.test(gen) && /dropped: droppedN/.test(gen) && /droppedWhy/.test(gen));
check("and tells the model what it did not see", /could not be \(\$\{droppedWords\(dropped\)\}\)/.test(gen));
check("the body route takes both pictures through it and answers with what was unseen", /takePng\(body\.picture\)/.test(body) && /takePng\(body\.shot\)/.test(body) && /\n\s+unseen,\n/.test(body));
check("and tells the model to work from the words", /Not shown, though it exists/.test(body));
check("the ask's dialog says how many were left out and why", /left out \(\$\{r\.droppedWhy\}\)/.test(dialog) && /left out: \$\{result\.droppedWhy\}/.test(dialog));
check("a revision asked without its render says so on the card", /asked without \$\{answer\.unseen\.join/.test(run));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

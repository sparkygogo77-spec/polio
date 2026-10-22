#!/usr/bin/env node
/**
 * The price said before Generate follows the model, its quality and the 3D
 * choice (J, 2026-10-10: "can we get the estimated cost updated since its not
 * always 4 cents"), and his own past prices win over the guide.
 *
 *   node tests/render-estimate.mjs
 *
 * Covers: src/features/studio/pictures/estimate.ts
 */
import { estimateLine, pictureEstimate, pictureSeconds, progressOf, SOLID_GUIDE } from "../src/features/studio/pictures/estimate.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const low = pictureEstimate("openai/gpt-image-2", "low").dollars;
const high = pictureEstimate("openai/gpt-image-2", "high").dollars;
check("GPT Image 2's quality moves the price", low < high, `low ${low}, high ${high}`);
check("models are not all 4 cents", pictureEstimate("prunaai/p-image-ideogram", "").dollars !== pictureEstimate("openai/gpt-image-2", "").dollars);
const flat = estimateLine("openai/gpt-image-2", "high", "");
const solid = estimateLine("openai/gpt-image-2", "high", "solid");
check("a flat picture says one price", /^About \$0\.25 a picture, on your own Replicate key\.$/.test(flat), flat);
/* A 3D model is the picture, its back and sides, and the modeller's run (now said apart: "plus about $0.75 for the back and sides and $0.10 for the 3D model"), summed. */
const sum = /\$(\d+\.\d\d) a picture, plus about \$(\d+\.\d\d) for the back and sides and \$(\d+\.\d\d) for the 3D model: about \$(\d+\.\d\d) in all/.exec(solid);
check("a real 3D model adds the modeller's run", !!sum && Number(sum[3]) === SOLID_GUIDE && Math.abs(Number(sum[1]) + Number(sum[2]) + Number(sum[3]) - Number(sum[4])) < 0.005, solid);
check("a shape adds nothing", estimateLine("openai/gpt-image-2", "high", "sphere") === flat);
const past = [{ model: "openai/gpt-image-2", quality: "high", cost: 0.2 }, { model: "openai/gpt-image-2", quality: "high", cost: 0.3 }, { model: "openai/gpt-image-2", quality: "low", cost: 0.01 }];
const mine = pictureEstimate("openai/gpt-image-2", "high", past);
check("his own past prices win, for the same model and quality", mine.from === "yours" && Math.abs(mine.dollars - 0.25) < 1e-9 && mine.count === 2, JSON.stringify(mine));
check("and the line says they are his", /your last 2 from this model/.test(estimateLine("openai/gpt-image-2", "high", "", past)));

check("the usual wait follows quality", pictureSeconds("openai/gpt-image-2", "low") < pictureSeconds("openai/gpt-image-2", "high"));
check("and his own runs win", pictureSeconds("openai/gpt-image-2", "high", [{ model: "openai/gpt-image-2", quality: "high", ms: 30000 }]) === 30);
const half = progressOf(30, 60), over = progressOf(120, 60);
check("the bar is time against the usual, never full while running", Math.abs(half.fraction - 0.45) < 1e-9 && !half.late && over.late && over.fraction > 0.9 && over.fraction < 1, `${half.fraction}, ${over.fraction}`);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

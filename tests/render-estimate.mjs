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
import { estimateLine, pictureEstimate, SOLID_GUIDE } from "../src/features/studio/pictures/estimate.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const low = pictureEstimate("openai/gpt-image-2", "low").dollars;
const high = pictureEstimate("openai/gpt-image-2", "high").dollars;
check("GPT Image 2's quality moves the price", low < high, `low ${low}, high ${high}`);
check("models are not all 4 cents", pictureEstimate("prunaai/p-image-ideogram", "").dollars !== pictureEstimate("openai/gpt-image-2", "").dollars);
const flat = estimateLine("openai/gpt-image-2", "high", "");
const solid = estimateLine("openai/gpt-image-2", "high", "solid");
check("a flat picture says one price", /^About \$0\.25 a picture, on your own Replicate key\.$/.test(flat), flat);
check("a real 3D model adds the modeller's run", solid.includes(`about $${SOLID_GUIDE.toFixed(2)} for the 3D model`) && solid.includes("about $0.35 in all"), solid);
check("a shape adds nothing", estimateLine("openai/gpt-image-2", "high", "sphere") === flat);
const past = [{ model: "openai/gpt-image-2", quality: "high", cost: 0.2 }, { model: "openai/gpt-image-2", quality: "high", cost: 0.3 }, { model: "openai/gpt-image-2", quality: "low", cost: 0.01 }];
const mine = pictureEstimate("openai/gpt-image-2", "high", past);
check("his own past prices win, for the same model and quality", mine.from === "yours" && Math.abs(mine.dollars - 0.25) < 1e-9 && mine.count === 2, JSON.stringify(mine));
check("and the line says they are his", /your last 2 from this model/.test(estimateLine("openai/gpt-image-2", "high", "", past)));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

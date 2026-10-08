/**
 * A node's plan is honoured by the run.
 *
 * The create space (claude/amazing-dijkstra-cznfor) writes `plan` on a node:
 * the model and the ordered steps, editable. This branch reads it. When a
 * job runs for a node that has a plan, the run takes the plan's steps in
 * the plan's order and prefers the plan's model, instead of the route's
 * default; a step left out is a step not taken, and every step not taken
 * is said on the card.
 *
 * Pure and static: the plan model is `space.ts`, the run is `reshapeRun.ts`
 * and `refineRun.ts`, and the API is `app/api/studio/image/route.ts`.
 *
 *   node tests/plan-run.mjs
 */
import { readFileSync } from "node:fs";
import { STEPS, MODELS, route } from "../src/features/studio/pictures/imageRoute.ts";
import { defaultSteps, tidySteps, planFor, STEP_MEANS } from "../src/features/studio/space.ts";
import { progressOf } from "../src/features/studio/formation.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const run = readFileSync("src/features/studio/reshapeRun.ts", "utf8");
const refine = readFileSync("src/features/studio/refineRun.ts", "utf8");
const api = readFileSync("src/app/api/studio/image/route.ts", "utf8");

/* ------------------------------------------------------------------ */
/* 1. The shape: theirs, read here                                     */
/* ------------------------------------------------------------------ */

check("the run reads the node's plan once per job", /function planOf\(node: StudioNode \| null\): Planned/.test(run) && /const plan = planOf\(node\);/.test(run));
check("and tidies it with the panel's own rule, so both read the same steps", /import \{ tidySteps \} from "\.\/space";/.test(run) && /tidySteps\(p\.steps\)/.test(run));
check("a plan with no steps is no plan: the run does what it always did", /return \{ steps: steps\.length \? steps : null, model: p\?\.model \?\? null, options: p\?\.options \?\? null \};/.test(run));
check("every step the panel can name is one the route knows", STEPS.every((st) => typeof STEP_MEANS[st] === "string" && STEP_MEANS[st].length > 0), STEPS.join(", "));
check("the grounded step is never a default", !defaultSteps("picture", false).includes("recreate") && !defaultSteps("icon", false).includes("recreate"));
check("…but is kept when a person puts it in the order", tidySteps(["read", "first", "recreate"]).join(">") === "read>first>recreate");
check("the panel routes a plan whose first drawing step is recreate to the one model that can", (() => {
  const part = { label: "A gull", prompt: "a gull", featureId: "custom-idea", w: 200, h: 200, plan: { model: null, steps: ["read", "recreate"] } };
  const r = planFor(part);
  return r.model?.slug === "google/nano-banana-2" && r.ordered && !r.chosen;
})(), JSON.stringify(planFor({ label: "A gull", prompt: "a gull", featureId: "custom-idea", w: 200, h: 200, plan: { model: null, steps: ["read", "recreate"] } }).model?.slug));

/* ------------------------------------------------------------------ */
/* 2. Steps left out are steps not taken, and said                      */
/* ------------------------------------------------------------------ */

check("read left out: the drawing is not sent up to be read, and the card says so as a decision",
  /if \(plan\.steps && !plan\.steps\.includes\("read"\)\) \{/.test(run) && /"not read: the plan left the reading out"/.test(run) && /as planned: \$\{plan\.steps\.join\(" › "\)\}/.test(run));
check("first left out: nothing is traced or written, and the later passes start from the drawing's own picture",
  /if \(plan\.steps && !plan\.steps\.includes\("first"\)\) \{/.test(run) && /notePass\("first pass · left out by the plan", threadId\)/.test(run) && /bare\(pictureOf\(drawn\.strokes\)\)/.test(run));
check("no later pass in the plan: the second pass does not run, and the card says so",
  /notePass\("second pass · left out by the plan", on\)/.test(run));
check("the later passes are the plan's, in the plan's order, refine, recreate and alpha alike",
  /plan\.steps\.filter\(\(st\): st is "refine" \| "recreate" \| "alpha" => st === "refine" \|\| st === "recreate" \|\| st === "alpha"\)/.test(run) && /for \(const step of stages\) \{/.test(run));
check("…each starting from what the one before it made", /if \(r\.image\) picture = r\.image;/.test(run) && /image\?: string;/.test(refine) && /\.\.\.\(after \? \{ image: after \} : \{\}\),/.test(refine));
check("…and with no plan, the one refine there always was", /: \(\["refine"\] as const\);/.test(run));
/*
 * Alpha is a pass of its own now, not a flag on the last one: the picture
 * is rendered again with no ground by a model that can (gpt-image-2 first),
 * which beats cutting one off. It runs where the plan puts it.
 */
check("alpha is a pass of its own, where the plan puts it",
  /const transparent = step === "alpha" \? pick\.alpha !== false :/.test(api)
  && /"Taking the ground off…"/.test(refine)
  && progressOf("Taking the ground off…") === 0.9);
check("…and the route sends it to something that renders with no ground", (() => {
  const r = route({ making: "icon", step: "alpha", fromImage: true });
  return r.model?.slug === "openai/gpt-image-2";
})());

/* ------------------------------------------------------------------ */
/* 3. The model is the plan's, when it serves the job                   */
/* ------------------------------------------------------------------ */

check("the plan's model is preferred at every later pass", /prefer: plan\.model \?\? undefined,/.test(run) && /\.\.\.\(input\.prefer \? \{ model: input\.prefer \} : \{\}\),/.test(refine));
check("…and the route honours it only when that model serves the cell", /prefer: body\.model/.test(api) && /const asked = need\.prefer \? model\(need\.prefer\) : null;/.test(readFileSync("src/features/studio/pictures/imageRoute.ts", "utf8")));
check("a plan naming a model that is not in the table falls back to the route's pick", (() => {
  const part = { label: "A gull", prompt: "a gull", featureId: "custom-idea", w: 200, h: 200, plan: { model: "nobody/nothing", steps: [] } };
  return planFor(part).model !== null && !planFor(part).chosen;
})());
check("the step travels to the API by name, refine when unsaid", /step: input\.step \?\? "refine",/.test(refine) && /body\.step === "recreate" \? "recreate" : body\.step === "alpha" \? "alpha" : "refine"/.test(api));
check("a recreate says what it is doing, and the formation knows the step", /"Recreating the real thing…"/.test(refine) && progressOf("Recreating the real thing…") === 0.82);
check("and writes its own kind of line on the card", /const pass = input\.step === "recreate" \? "recreated" : input\.step === "alpha" \? "ground left out" : "second pass";/.test(refine) && !/`second pass · /.test(refine));
check("only the one model serves the grounded step", MODELS.filter((m) => (m.serves.recreate ?? []).length).length === 1);

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed of ${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);

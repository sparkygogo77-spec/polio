/**
 * A space: a closed line that is not yet a part.
 *
 * What a person sees, held in numbers: which loops count as a boundary and
 * which are a dot or an open line; which parts have landed inside a hole and
 * which have not; that a hole decided a moment ago is still consuming and
 * one decided a while ago is open; and what the panel beside a part inside
 * a hole will say about it: the model the route picks, the steps in order,
 * and that a person's own order and model are what it says instead.
 *
 *   node tests/space.mjs
 */
import {
  CONSUME_MS, MIN_SPACE, boundaryPath, centroid, consumed, defaultSteps, grownBoundary, isBoundary, isOpen,
  moveStep, nodeInSpace, planFor, pointInBoundary, roundBoundary, spaceOf, tidySteps,
} from "../src/features/studio/space.ts";
import { STEPS } from "../src/features/studio/imageRoute.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Which lines are a boundary                                        */
/* ------------------------------------------------------------------ */

const LOOP = [[100, 100], [300, 96], [310, 260], [98, 250], [104, 106]];
const OPEN = [[100, 100], [300, 96], [310, 260], [98, 250]].concat([[400, 400]]);
const DOT = [[10, 10], [18, 10], [18, 18], [10, 18], [10, 10]];
check("a loop drawn round a patch of the page is a boundary", isBoundary(LOOP));
check("a line that does not come back to where it started is not", !isBoundary(OPEN));
check("a tiny loop is a dot, not a space", !isBoundary(DOT), `smaller than ${MIN_SPACE}px`);
check("a round boundary from the menu is a boundary", isBoundary(roundBoundary(400, 300, 90)));

/* ------------------------------------------------------------------ */
/* 2. What has landed inside                                            */
/* ------------------------------------------------------------------ */

const ring = roundBoundary(500, 400, 120);
const space = { id: "sp1", pageId: "p", boundary: ring, kind: "hole", since: 0, prompt: "", label: "", at: 1 };
check("the middle of the ring is inside it", pointInBoundary(ring, 500, 400));
check("a point past the ring is outside it", !pointInBoundary(ring, 700, 400));
check("a part whose middle is in the ring has landed in the space", nodeInSpace(space, { pageId: "p", x: 460, y: 370, w: 80, h: 60 }));
check("a part that only touches the ring from outside has not", !nodeInSpace(space, { pageId: "p", x: 600, y: 370, w: 80, h: 60 }));
check("a part on another page has not, wherever it sits", !nodeInSpace(space, { pageId: "q", x: 460, y: 370, w: 80, h: 60 }));

const c = centroid(LOOP);
check("the centroid of a drawn loop is inside it", pointInBoundary(LOOP, c[0], c[1]), `${c.map((v) => v.toFixed(0)).join(",")}`);
const small = grownBoundary(LOOP, 0.2);
check("a boundary grown a fifth of the way sits inside the drawn one", small.every(([x, y]) => pointInBoundary(LOOP, x, y)));
check("grown all the way, it is the drawn line", grownBoundary(LOOP, 1).every(([x, y], i) => Math.abs(x - LOOP[i][0]) < 1e-6 && Math.abs(y - LOOP[i][1]) < 1e-6));
check("the path closes", /^M[\d. ]+(?: L[\d. -]+)+ Z$/.test(boundaryPath(LOOP)), boundaryPath(LOOP).slice(0, 40));

/* ------------------------------------------------------------------ */
/* 3. Consuming, and open                                               */
/* ------------------------------------------------------------------ */

const now = 10_000;
const fresh = { ...space, since: now - CONSUME_MS / 2 };
const done = { ...space, since: now - CONSUME_MS * 3 };
const box = { ...space, kind: "construct", since: now - CONSUME_MS * 3 };
const undecided = { ...space, kind: "undecided", since: null };
check("a hole decided half a beat ago is half consumed", Math.abs(consumed(fresh, now) - 0.5) < 0.01, consumed(fresh, now).toFixed(2));
check("and is not open yet", !isOpen(fresh, now));
check("a hole decided a while ago has consumed it all", consumed(done, now) === 1);
check("and is open: the area is drawing space", isOpen(done, now));
check("a construct box never consumes anything", consumed(box, now) === 0 && !isOpen(box, now));
check("a placeholder is not open", !isOpen(undecided, now));
const inside = { pageId: "p", x: 460, y: 370, w: 80, h: 60 };
check("a part inside an open hole is in that space", spaceOf([done], inside, now)?.id === "sp1");
check("a part inside a hole still consuming is not in it yet", spaceOf([fresh], inside, now) === null);
check("a part inside a construct box is not in a space", spaceOf([box], inside, now) === null);
const newer = { ...done, id: "sp2", at: 2 };
check("where two open holes overlap, the newer owns the part", spaceOf([done, newer], inside, now)?.id === "sp2");

/* ------------------------------------------------------------------ */
/* 4. What the panel says                                               */
/* ------------------------------------------------------------------ */

const part = { label: "Hero", prompt: "a warm headline over a photograph", featureId: "hero-split", w: 600, h: 320, role: null, outline: null, content: "" };
const r = planFor(part);
check("the panel names the part", r.what === "Hero");
check("and what was asked", r.asked === "a warm headline over a photograph");
check("the route picks a model for it", !!r.model, r.model?.name ?? r.why);
check("the steps start by reading the drawing", r.steps[0] === "read", r.steps.join(" › "));
check("nobody set the order, and the panel knows", !r.ordered && !r.chosen);

const mark = { ...part, label: "Mark", role: "icon", outline: null };
const cut = { ...mark, outline: { cut: "M0 0" } };
check("a mark on a bare page ends by taking the ground off", planFor(mark).steps.includes("alpha"), planFor(mark).steps.join(" › "));
check("a mark cut to a drawn line does not need that step", !planFor(cut).steps.includes("alpha"), planFor(cut).steps.join(" › "));
check("a picture never needs it", !defaultSteps("picture", false).includes("alpha"));

const ordered = planFor({ ...part, plan: { model: null, steps: ["read", "refine", "first"] } });
check("a person's order is the order shown", ordered.steps.join(",") === "read,refine,first" && ordered.ordered);
const drawn = planFor({ ...part, sketch: { words: "a lighthouse" }, prompt: "" });
check("with no prompt, what was asked is the drawing's words", drawn.asked === "a lighthouse");

const picked = r.model?.slug;
const other = planFor({ ...part, plan: { model: picked, steps: [] } });
check("naming the model the route would pick reads as chosen", other.chosen && other.model?.slug === picked);
const bogus = planFor({ ...part, plan: { model: "nobody/nothing", steps: [] } });
check("naming a model that is not in the table falls back to the route's pick, and says so", !bogus.chosen && bogus.model?.slug === picked);

check("tidying keeps only the route's own steps, once each", tidySteps(["first", "read", "first", "polish", "alpha"]).join(",") === "first,read,alpha");
check("moving a step puts it where it was dropped", moveStep(STEPS, 3, 0).join(",") === "alpha,read,first,refine");
check("moving a step nowhere changes nothing", moveStep(STEPS, 1, 9).join(",") === STEPS.join(","));

/* ------------------------------------------------------------------ */

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

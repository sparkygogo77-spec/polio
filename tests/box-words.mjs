/**
 * "box" in the words is a cube only when it is the thing drawn (inventory C7).
 *
 * Any closed stroke over 3% of the board plus the word "box" anywhere in
 * the words became a turning cube: "a text box", "a search box with a
 * button", "an info box" all drew a solid. A box on a page is a flat thing
 * far more often than a solid. Now a "box" qualified by the flat things a
 * page has (text, search, check, input, dialog, info, ...) is not a claim
 * of shape; a box on its own, a cube, a cuboid, a 3D box still are.
 *
 *   node tests/box-words.mjs
 */
import { saysCube } from "../src/features/studio/shelf/parts/cubeFaces.ts";
import { kindOfSketch } from "../src/features/studio/shapeKind.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* One closed circle, a fifth of the board: a shape that is not a box. */
const circle = { strokes: [Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return [0.5 + Math.cos(a) * 0.2, 0.5 + Math.sin(a) * 0.2]; }).concat([[0.7, 0.5]])], words: "" };
const kind = (said) => kindOfSketch(circle, said, true).kind;

/* 1. The words alone. */
const solid = ["a cube", "a 3D BOX", "a cuboid", "a box", "the box on the left", "one big box you can turn", "boxes"];
const flat = ["a text box", "a search box with a button", "a checkbox list", "an info box", "the input box", "a dialog box", "a message box", "a lightbox gallery", "a combo box", "a select box", "a list box", "a box shadow under the card", "cubicle"];
check("cube, cuboid, 3D box and a box on its own say a cube", solid.every(saysCube), solid.filter((w) => !saysCube(w)).join(", ") || "all");
check("a box qualified as a flat thing does not", flat.every((w) => !saysCube(w)), flat.filter(saysCube).join(", ") || "none");
check("a box beside a flat box still does", saysCube("a text box inside a box"), "a text box inside a box");

/* 2. With a shape drawn: a circle with words. */
check("a circle said to be a box becomes the cube (the words carry it)", kind("a box") === "cube", kind("a box"));
check("a circle said to be a text box does not", kind("a text box") !== "cube", kind("a text box"));
check("nor a search box", kind("a search box with a button") !== "cube", kind("a search box with a button"));
check("nor a checkbox", kind("a checkbox") !== "cube", kind("a checkbox"));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

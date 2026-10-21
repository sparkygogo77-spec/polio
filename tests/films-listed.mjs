/**
 * A MOVING PICTURE IS IN ELEMENTS, BY ITS NAME, UNDER THE PART IT WAS FILMED OVER.
 *
 * J (2026-10-21): a blurry copy of thesolface.site's hero lay over the
 * board, and he could not find it in Elements or in its nesting. It was the
 * hero's film (`section:nth-of-type(1)::frames`). Films are laid by
 * `captured.ts` as parts of their own, named "Moving picture of …", over the
 * part they were filmed on; the list read them by their element instead:
 *   · the hero's film by its `section` tag, a row called "Section";
 *   · the header bar's as "Picture", its words thrown away;
 *   · the SOL VISION button's as "Button: Moving picture of button …";
 * and all three at the top level, because the tree took a film's path
 * (`…::frames`) to belong to its part's holder, not to its part: only
 * `::before` and `::after` were read as an element's own.
 *
 * Now a film is a row of its own kind, "Moving picture", named as it was laid
 * ("Moving picture of …"), listed straight under its part's row, one step in.
 * In the nesting its holder is its part. Picking the row picks the film, so
 * the wheel's Delete reaches it.
 *
 *   node tests/films-listed.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const studio = join(here, "..", "src", "features", "studio");
const { attachCaptured } = await jiti.import(join(studio, "shelf", "library", "captured.ts"));
const { partList } = await jiti.import(join(studio, "partList.ts"));
const { partTree } = await jiti.import(join(studio, "partTree.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* thesolface's header and hero as the capture records them, the parts' own labels and paths. */
const part = (id, featureId, label, selector, x, y, w, h, extra = {}) => ({ id, pageId: "page_home", featureId, label, prompt: "", content: "", x, y, w, h, from: { selector, ...(extra.position ? { position: extra.position } : {}) }, ...extra });
const nodes = [
  part("header", "box", "banner · 1 inside", "body > header", 0, 14, 1440, 78, { position: "fixed" }),
  part("bar", "box", "div · 3 inside", "body > header > div", 35, 14, 1370, 78),
  part("logo", "prose", "THE SOL FACE", "body > header > div > a", 56, 28, 170, 51, { content: "THE SOL FACE" }),
  part("tools", "box", "div · 2 inside", "body > header > div > div", 1151, 27, 243, 52),
  part("vision", "cta-primary", "button “SOL VISION”", "body > header > div > div > button", 1151, 31, 98, 44, { content: "SOL VISION" }),
  part("hero", "box", "section · 7 inside", "body > main > section:nth-of-type(1)", 0, 0, 1440, 991),
  part("title", "value-prop", "THE SOL FACE", "body > main > section:nth-of-type(1) > h1", 50, 297, 708, 267, { content: "THE SOL FACE" }),
  part("halo", "box", "section::before", "body > main > section:nth-of-type(1)::before", 984, 110, 600, 600, { position: "absolute" }),
];
const pic = (n, w, h) => ({ id: `pic_${n}`, path: `assets/pictures/pic_${n}.svg`, w, h });
const behaviours = { version: 1, motion: { frames: [
  { part: "vision", box: [1151, 31, 98, 44], kind: "live", picture: pic(1, 98, 44) },
  { part: "bar", box: [35, 14, 1370, 78], kind: "scroll", picture: pic(2, 512, 29) },
  { part: "hero", box: [0, 0, 1440, 991], kind: "pointer", picture: pic(3, 512, 320) },
] } };
const all = attachCaptured(nodes, behaviours);
const films = all.filter((n) => (n.from?.selector ?? "").endsWith("::frames"));
check("three films are laid, as the capture filmed three parts", films.length === 3, films.map((f) => f.label).join(" | "));

const rows = partList(all);
const rowOf = (id) => rows.find((r) => r.ids.includes(id));
const filmOf = (host) => films.find((f) => f.from.selector === `${all.find((n) => n.id === host).from.selector}::frames`);
const heroFilm = filmOf("hero"), barFilm = filmOf("bar"), buttonFilm = filmOf("vision");

check("the hero's film is a row called by its own name", rowOf(heroFilm.id)?.name === heroFilm.label, JSON.stringify(rowOf(heroFilm.id)));
check("…of the kind Moving picture", rowOf(heroFilm.id)?.kind === "Moving picture", rowOf(heroFilm.id)?.kind);
check("the header bar's film keeps its words: “Moving picture of …”", rowOf(barFilm.id)?.name === barFilm.label, JSON.stringify(rowOf(barFilm.id)));
check("the button's film is its own row, not folded into the button's label", !!rowOf(buttonFilm.id) && rowOf(buttonFilm.id).id === buttonFilm.id && rowOf(buttonFilm.id).name === buttonFilm.label, JSON.stringify(rowOf(buttonFilm.id)));
const at = (id) => rows.findIndex((r) => r.ids.includes(id));
check("…straight under its button's row, one step in", at(buttonFilm.id) === at("vision") + 1 && rowOf(buttonFilm.id)?.depth === 1, `button row ${at("vision")}, film row ${at(buttonFilm.id)}, depth ${rowOf(buttonFilm.id)?.depth}`);
check("control: the button keeps its own row and name", rowOf("vision")?.name === "Button: SOL VISION", rowOf("vision")?.name);

/* Elements folds a component (a button and the layers stacked on it) into one row; the film laid on it is not one of its layers. */
const { foldComponentRows } = await jiti.import(join(studio, "partList.ts"));
const folded = foldComponentRows(rows, [{ id: "vision", kindWord: "Button", name: "button “SOL VISION”", parts: ["vision", buttonFilm.id] }]);
const fRow = folded.find((r) => r.ids.includes(buttonFilm.id) && r.id === buttonFilm.id);
check("folded into components as Elements lists them, the button's film keeps its own row", !!fRow && fRow.name === buttonFilm.label, JSON.stringify(folded.filter((r) => r.ids.includes(buttonFilm.id))));
check("…and the button's row does not pick the film with it", !folded.find((r) => r.id === "vision")?.ids.includes(buttonFilm.id), JSON.stringify(folded.find((r) => r.id === "vision")?.ids));

const tree = partTree(all);
check("in the nesting, the hero's film is held by the hero", tree.parent.get(heroFilm.id) === "hero", tree.parent.get(heroFilm.id));
check("…the bar's by the bar, the button's by the button", tree.parent.get(barFilm.id) === "bar" && tree.parent.get(buttonFilm.id) === "vision", `${tree.parent.get(barFilm.id)}, ${tree.parent.get(buttonFilm.id)}`);
check("control: a ::before is still its element's own", tree.parent.get("halo") === "hero", tree.parent.get("halo"));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);

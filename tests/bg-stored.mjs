/**
 * A BOX'S BACKGROUND NAMES ITS OWN PICTURE, NOT THE SITE IT CAME FROM.
 *
 * The coordinator, on a fresh thesolface import (run 39707081826): the
 * hero's splash `background` held `url("https://thesolface.site/...")`, a
 * link to the live site rather than the stored picture, so a published copy
 * breaks if the site moves the image. The converter now writes that layer as
 * the picture's own place in the published site (`picture.path`,
 * capture/site/capture/check-art.mjs), and a board already saved is repaired
 * as it is taken in or opened (`docTake.ts#storedStacks`). The board and the
 * page still draw the picture's file over that layer (`boxPicture`).
 *
 *   node tests/bg-stored.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const studio = join(here, "..", "src", "features", "studio");
const { takeDoc, storedStacks } = await jiti.import(join(studio, "docTake.ts"));
const { boxPicture } = await jiti.import(join(studio, "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const fade = "linear-gradient(90deg, rgb(8, 13, 25) 0%, rgba(8, 13, 25, 0.78) 33%)";
const picture = { id: "pic_1d3f71f4", path: "assets/pictures/pic_1d3f71f4.webp", type: "image/webp", w: 1920, h: 1080, bytes: 1, alt: "", from: "upload" };
const hero = { id: "n_box_1", pageId: "home", featureId: "box", options: {}, x: 0, y: 0, w: 1440, h: 991, picture, art: { background: `${fade}, url("https://thesolface.site/assets/bg.webp")`, backgroundOptions: ["auto, cover", "0% 0%, 50% 50%", "repeat, repeat"] } };

const taken = takeDoc({ nodes: [], pages: [], format: {}, look: {}, frameWidth: 1440 }, { nodes: [hero], pages: [{ id: "home", name: "Home", path: "/" }] }, { format: () => ({}), look: () => ({}) });
const bg = taken.nodes.find((n) => n.id === "n_box_1")?.art?.background ?? "";
check("a board taken in names the stored picture, not the live site", bg === `${fade}, url("assets/pictures/pic_1d3f71f4.webp")`, bg);
check("…its sizes kept", taken.nodes[0].art.backgroundOptions?.[0] === "auto, cover");

const data = { ...hero, id: "n_box_2", art: { background: `url("data:image/png;base64,AAAA"), ${fade}, url("https://x.test/a.png")` } };
const fixed = storedStacks([data])[0].art.background;
check("a data layer before it is left as it is", fixed === `url("data:image/png;base64,AAAA"), ${fade}, url("assets/pictures/pic_1d3f71f4.webp")`, fixed);
const drawn = boxPicture({ pic: picture, src: "blob:here" }, { background: fixed })?.backgroundImage ?? "";
check("…and the board draws the picture's file over the picture's layer, not the data one", /data:image\/png/.test(drawn) && drawn.endsWith('url("blob:here")'), drawn);

const plain = [{ ...hero, id: "n_box_3", art: { background: 'url("https://x.test/a.png")' } }, { ...hero, id: "n_box_4", picture: null }];
check("control: a list that needs nothing is handed back as it was", storedStacks(plain) === plain);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);

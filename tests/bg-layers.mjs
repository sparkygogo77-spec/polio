/**
 * A PICTURE LAYERED WITH GRADIENTS IS DRAWN IN ITS STACK.
 *
 * thesolface.site's hero (`.hero-cosmos`) lays a dark linear-gradient over
 * its splash picture. The box carried the picture and lost the gradient, so
 * the board's splash came up brighter than the page. The converter now keeps
 * the whole stack on `art.background` (capture/site/capture/check-art.mjs),
 * and the box draws it with the picture's own file in place of its address,
 * in the page's order, every other layer as it was.
 *
 *   node tests/bg-layers.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { boxPicture } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The hero as the capture recorded it. */
const fade = "linear-gradient(90deg, rgb(8, 13, 25) 0%, rgba(8, 13, 25, 0.78) 33%, rgba(9, 10, 22, 0.12) 75%, rgba(10, 11, 20, 0.28))";
const art = { background: `${fade}, url("https://thesolface.site/assets/bg.webp")`, backgroundOptions: ["auto, cover", "0% 0%, 50% 50%", "repeat, repeat"] };
const picture = { pic: { w: 1920, h: 1080 }, src: "/site/assets/bg.webp" };

const drawn = boxPicture(picture, art);
const image = drawn?.backgroundImage ?? "";
check("the fade is drawn over the picture, in the page's order", image.startsWith(fade) && image.indexOf(fade) < image.indexOf("url("), image);
check("…the picture's layer is the picture's own file", /url\("\/site\/assets\/bg\.webp"\)$/.test(image) && !/thesolface\.site/.test(image), image);
check("…and the page's sizes stand (none written over them)", drawn && drawn.backgroundSize === undefined && drawn.backgroundRepeat === undefined, JSON.stringify(drawn));

/* Controls: a picture alone covers its box as before; a stack with no gradient is the picture's. */
const alone = boxPicture(picture, null);
check("control: a picture with no stack covers its box", alone?.backgroundSize === "cover" && /bg\.webp/.test(alone?.backgroundImage ?? ""));
const plain = boxPicture(picture, { background: 'url("https://thesolface.site/assets/bg.webp")' });
check("control: a stack that is only the picture draws as a picture", plain?.backgroundSize === "cover" && !/thesolface\.site/.test(plain?.backgroundImage ?? ""));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);

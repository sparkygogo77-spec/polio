/**
 * A CAPTURED VIDEO PLAYS AS THE PAGE'S DID.
 *
 * sink keeps a video as a picture of its poster (or the frame it showed) and
 * carries `node.media`: its source, poster and how it plays. parasiteonsol.fun's
 * two videos have controls and wait for a press (no autoplay, no loop). The
 * published page and the Preview draw a real <video> with those settings
 * and the picture as its poster; one the page autoplayed plays muted, looped
 * and inline, as browsers require of autoplay. The board draws the picture.
 *
 *   node tests/video-part.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));
const { namedPictures } = await jiti.import(join(here, "..", "src", "features", "studio", "siteHead.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "light" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const pic = { id: "pic_1", path: "assets/pictures/pic_1.webp", type: "image/webp", w: 1094, h: 615, bytes: 1, alt: "", from: "upload" };
const node = (media) => ({ id: "v", pageId: "p0", featureId: "picture", label: "video", prompt: "", content: "", data: "", x: 96, y: 1108, w: 1094, h: 615, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, picture: pic, media, from: { url: "https://parasiteonsol.fun/", host: "parasiteonsol.fun", selector: "body > main > section > div > div > video" } });
const draw = (n, mode) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode, size: { w: n.w, h: n.h }, pictureAt: (p) => p.path }));
const story = { kind: "video", src: "https://parasiteonsol.fun/assets/video/parasite-story-web.mp4", poster: "https://parasiteonsol.fun/assets/video/parasite-story.webp", controls: true, playsinline: true };
const live = draw(node(story), "live");
const video = (live.match(/<video[^>]*>/) ?? [""])[0];
check("live, the captured video is a <video> playing its source", video.includes(`src="${story.src}"`), live.slice(0, 300));
check("…with the captured picture as its poster", video.includes('poster="assets/pictures/pic_1.webp"'), video);
check("…with controls, and not playing by itself (as live)", /\bcontrols=""/.test(video) && !/autoplay/i.test(video) && !/\bloop/.test(video), video);
const auto = (draw(node({ kind: "video", src: "https://example.com/loop.webm", autoplay: true, loop: true, muted: true, playsinline: true }), "live").match(/<video[^>]*>/) ?? [""])[0];
check("a video the page autoplayed plays by itself, muted, looped, inline", /autoplay=""/i.test(auto) && /loop=""/.test(auto) && /muted=""/.test(auto) && /playsinline=""/i.test(auto), auto);
const file = { id: "vid_1", path: "assets/pictures/vid_1.mp4", type: "video/mp4", w: 1094, h: 615, bytes: 4209182, alt: "", from: "upload" };
const own = (draw(node({ ...story, file }), "live").match(/<video[^>]*>/) ?? [""])[0];
check("a video whose file came with the site plays that file, not the source site's address", own.includes('src="assets/pictures/vid_1.mp4"') && !own.includes("parasiteonsol.fun"), own);
check("…and the file is one the site carries (brought in and published like a picture)", namedPictures({ nodes: [node({ ...story, file })] }).some((p) => p.id === "vid_1"));
check("control: on the board it is the picture", !/<video/.test(draw(node(story), "board")) && /<img/.test(draw(node(story), "board")));
check("control: a picture with no media is a picture", !/<video/.test(draw(node(undefined), "live")));

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);

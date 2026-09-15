/**
 * The tweet console's Render records the site that was built.
 *
 * The console sends the document with the request (`doc: studioDoc()`), and
 * the route it sent it to never read it: it opened the live preview in a
 * fresh headless browser, whose storage holds nothing, and recorded an
 * empty site. The studio's own video route was the same 220 lines with the
 * one difference that mattered, the document handed to the page before it
 * loads. The console uses that route now and the copy is gone.
 *
 *   node tests/tweet-video.mjs [url]
 */
import { existsSync, readFileSync } from "node:fs";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. The route the console renders through hands the page the document. */
const console_ = readFileSync("src/features/tweets/TweetConsole.tsx", "utf8");
const route = /fetch\("(\/api\/[a-z/-]+preview-video)"/.exec(console_)?.[1] ?? null;
check("the console renders through one route", !!route, route ?? "no preview-video fetch in TweetConsole.tsx");
const file = route ? `src/app${route}/route.ts` : "";
const handler = file && existsSync(file) ? readFileSync(file, "utf8") : "";
check("and that route exists", !!handler, file);
check("and it hands the page the document the console sent", /takeDoc\(body\.doc\)/.test(handler), `${(handler.match(/body\.doc/g) ?? []).length} reads of body.doc in ${file}`);
check("the copy that recorded an empty site is gone", !existsSync("src/app/api/tweets/preview-video/route.ts"));

/* 2. That route answers the console's own request with a video, on a
   server that can record one. What it answers when it cannot is a reason,
   and that is a failure here: this box has Playwright and its ffmpeg. */
const doc = {
  pages: [{ id: "p1", name: "Home", path: "/" }],
  nodes: [{ id: "n1", pageId: "p1", featureId: "big-headline", label: "A word to record", prompt: "", content: "RECORDED", x: 0, y: 0, w: 1440, h: 240,
    groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null,
    code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null }],
  activePageId: "p1",
};
const from = Date.now();
const res = await fetch(`${URL_}${route}`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ doc, path: "/builder/preview", device: "desktop", speed: "fast", interact: false, loops: 1, width: 640, format: "webm" }),
});
const ct = res.headers.get("content-type") ?? "";
if (ct.includes("application/json")) {
  const data = await res.json();
  check("the route answers the console's request with a video", false, `${data.reason}: ${String(data.message).slice(0, 120)}`);
} else {
  const bytes = (await res.arrayBuffer()).byteLength;
  check("the route answers the console's request with a video", res.status === 200 && ct.startsWith("video/") && bytes > 10_000, `${res.status} ${ct}, ${bytes} bytes in ${Date.now() - from}ms`);
  check("and says which browser it used", !!res.headers.get("x-tour-from"), res.headers.get("x-tour-from") ?? "no x-tour-from");
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

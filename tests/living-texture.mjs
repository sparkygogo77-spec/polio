#!/usr/bin/env node
/**
 * A PICTURE TEXTURE COMES ALIVE: CUT INTO LAYERS THAT MOVE, ON THE BOARD AND THE SITE.
 *
 * J (2026-10-09): "picture seems to remind me of how i tried to implement my
 * own backgrounds like nebulae or animated the pictured lanterns ... i
 * uploaded still images and a code chat dissected the lines of it and
 * animated it in different directions or motions which is what i want that
 * option to be for". And: "flat color though shouldnt be a texture when i
 * already have a background color option above it".
 *
 * The Texture row's Picture (`PieceTexture.tsx`) cuts the picture dropped in
 * into layers (`livingCut.ts`) and moves them on the living picture's fixed
 * keyframes (`living.ts`): Drift, Sway, Pulse or Parallax, with a direction,
 * a speed and a strength. Send the design back writes it for the hooks of
 * the parts wearing it (`styleLayer.ts#wearTextures`).
 *
 * Two halves:
 *   1. pure: the background motions' keyframes and tokens, the texture's
 *      CSS, the style layer for a part wearing it (one copy of the layers);
 *   2. on the saved PonsStars board: no Flat colour, the page pressed in the
 *      Colours preview, Picture, a picture dropped: it is cut and drifts;
 *      Direction turns it (one undo for the drag); Sway and Still.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/living-texture.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/PieceTexture.tsx, src/features/studio/living.ts, src/features/studio/livingCut.ts, src/features/studio/look/lookparts/textureCss.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/board/store/view.ts
 */
import { existsSync } from "node:fs";
import { LIVE_KEYFRAMES, liveCss, liveName, newLiving } from "../src/features/studio/living.ts";
import { textureCss } from "../src/features/studio/look/lookparts/textureCss.ts";
import { buildLayer, lookOf, wearTextures } from "../src/features/studio/send-out/styleLayer.ts";
import { openBoard } from "./lib/board.mjs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ---------------------------------------------------------------- 1. pure */
const SRC = ["data:image/webp;base64,FRONT", "data:image/webp;base64,MID", "data:image/webp;base64,BACK"];
const live = (preset, more = {}) => ({ ...newLiving(preset), layers: SRC, ...more });
check("every background motion has keyframes for 2 to 4 layers", ["drift", "sway", "pulse", "parallax"].every((p) => [2, 3, 4].every((n) => LIVE_KEYFRAMES.includes(`@keyframes polio-live-${p}-${n} `))));
check("they move only the picture's layers, never the part", ["sway", "pulse"].every((p) => !new RegExp(`polio-live-${p}-\\d \\{[^}]*\\b(translate|scale|rotate|filter|mask)`).test(LIVE_KEYFRAMES)));
check("a direction goes out as two tokens", liveCss(live("drift", { angle: 90 }))["--live-x"] === "0" && liveCss(live("drift", { angle: 90 }))["--live-y"] === "45", JSON.stringify(liveCss(live("drift", { angle: 90 }))));
check("and a part that never set one moves as it did", !("--live-x" in liveCss(live("drift"))) && LIVE_KEYFRAMES.includes("var(--live-x, 45)"));
const swayFrom = /@keyframes polio-live-sway-2 \{ from \{ background-position: ([^;]*);/.exec(LIVE_KEYFRAMES)?.[1] ?? "";
const signs = [...swayFrom.matchAll(/calc\(50% ([-+]) /g)].map((m) => m[1]).join("");
check("sway swings its layers past each other", signs === "--++", signs);
const layer = { id: "t1", kind: "image", role: "accent", scale: 160, angle: 0, opacity: 1, contrast: 0.5, blend: "normal", target: "page", on: true, src: "data:image/png;base64,X", live: live("drift", { angle: 30 }) };
const palette = { bg: "#fdf0dc", surface: "#ffffff", text: "#111111", muted: "#555555", accent: "#f0a040", highlight: "#a0ff5a" };
const css = textureCss([layer], palette, "#fdf0dc");
check("the texture paints the living picture over the page colour", css.backgroundImage === "var(--live-layers)" && css.backgroundColor === "#fdf0dc" && /^polio-live-drift-3 /.test(css.animation) && css["--live-layers"]?.includes("FRONT"), JSON.stringify(css).slice(0, 200));
check("still, it is the tiled picture again", !textureCss([{ ...layer, live: undefined }], palette, "#fdf0dc").animation && textureCss([{ ...layer, live: undefined }], palette, "#fdf0dc").backgroundImage.includes("data:image/png"));

/* Two PonsStars page parts wearing it, as brought in. */
const part = (id, hook) => { const n = { id, pageId: "play", featureId: "box", x: 0, y: 0, w: 1440, h: 400, content: "", hooks: { "data-hook": hook } }; return { ...n, texture: "t1", source: { file: "play.html", hook: { attr: "data-hook", value: hook }, was: lookOf(n) } }; };
const nodes = wearTextures([part("a", "page-top"), part("b", "page-body")], [layer]);
const source = { repo: "x/PST", ref: "main", dir: "web", files: [{ file: "play.html", pageId: "play", hooks: [{ attr: "data-hook", value: "page-top", line: 3, imported: true }, { attr: "data-hook", value: "page-body", line: 9, imported: true }], vars: [] }] };
const out = buildLayer(nodes, palette, source, { kit: true });
const rule = out.rules.find((r) => r.selector === '[data-hook="page-top"]');
check("Send the design back writes the motion for each hook wearing it", out.rules.length === 2 && rule?.declarations.some((d) => d.startsWith("animation: polio-live-drift-3")) && rule?.declarations.includes("--live-x: 38.97"), rule?.declarations.join("; ").slice(0, 240));
check("the page's is laid against the window, so the parts show one picture", rule?.declarations.includes("background-attachment: fixed, fixed, fixed"));
check("its layers go out once, named by both parts", out.css.split("data:image/webp;base64,FRONT").length === 2 && out.rules.every((r) => r.declarations.includes("--live-layers: var(--polio-live-layers-1)")));
check("with the keyframes and a still page for reduced motion", out.css.includes("@keyframes polio-live-drift-3 ") && /prefers-reduced-motion/.test(out.css));
check("a part wearing no living texture is left alone", wearTextures([{ id: "c", texture: null }], [layer])[0].art === undefined);

/* ---------------------------------------------------------------- 2. the board */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
const st = await openBoard(ui, URL_BASE, "pst");
check("PST is on the board", (st?.nodes?.length ?? 0) > 20, `${st?.nodes?.length ?? 0} parts`);
await ui.waitForTimeout(1500);
await ui.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
await ui.locator("[data-theme-preview]").first().waitFor({ timeout: 60000 }).catch(() => {});
await ui.waitForTimeout(800);
await ui.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
const row = ui.locator("[data-kind-texture]").first();
await row.waitFor({ timeout: 20000 });
check("no Flat colour among the textures", (await row.locator('[data-texture-sample="flat"]').count()) === 0 && (await row.locator('[data-texture-sample="image"]').count()) === 1);

await row.locator('[data-texture-sample="image"]').click();
await ui.waitForTimeout(500);
/* A night sky: a dark ground with bright stars and a glowing band, made in the page. */
const png = Buffer.from(await ui.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 480; c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#0a0820"; g.fillRect(0, 0, 480, 320);
  const band = g.createLinearGradient(0, 0, 480, 320); band.addColorStop(0.3, "rgba(120,60,200,0)"); band.addColorStop(0.5, "rgba(200,140,255,0.9)"); band.addColorStop(0.7, "rgba(120,60,200,0)");
  g.fillStyle = band; g.fillRect(0, 0, 480, 320);
  g.fillStyle = "#fff";
  for (let i = 0; i < 160; i++) { const x = (i * 97) % 480, y = (i * 53) % 320; g.beginPath(); g.arc(x, y, 1 + (i % 3), 0, 7); g.fill(); }
  return c.toDataURL("image/png").split(",")[1];
}), "base64");
await row.locator('[data-texture-picture] input[type="file"]').first().setInputFiles({ name: "nebula.png", mimeType: "image/png", buffer: png });
await row.locator('[data-texture-live="drift"]').waitFor({ timeout: 20000 }).catch(() => {});
const layers = Number(await row.locator("[data-texture-layers]").getAttribute("data-texture-layers").catch(() => "0"));
check("a picture dropped in is cut into layers and drifts", layers === 3, `${layers} layers`);

/** What paints the page: the parts wearing it, else the frame. */
const painted = () => ui.evaluate(() => {
  /* The page's texture worn by a part is a page-sized layer inside it (`WornTexture.tsx`); else the frame paints it. */
  const all = [...document.querySelectorAll("[data-part-texture], [data-part-texture] *, [data-frame]")];
  const el = all.find((e) => /polio-live-|^none$/.test(getComputedStyle(e).animationName) && getComputedStyle(e).backgroundImage.includes("url(")) ?? all[0];
  const c = getComputedStyle(el);
  return { n: document.querySelectorAll("[data-part-texture]").length, name: c.animationName, pos: c.backgroundPosition, x: c.getPropertyValue("--live-x").trim() };
});
const a = await painted();
await ui.waitForTimeout(1200);
const b = await painted();
check("the page wears it and its layers move", a.name === "polio-live-drift-3" && a.pos !== b.pos && a.pos.split(",").length === 3, `${a.n} parts, ${a.name}: ${a.pos} → ${b.pos}`);

const dir = row.locator('[data-texture-live] [aria-label="Direction"] [role="slider"]').first();
/* Dragged by the hand, as he would: one press, many moves, one release. */
await dir.scrollIntoViewIfNeeded();
const thumb = await dir.boundingBox();
const track = await row.locator('[data-texture-live] [aria-label="Direction"]').first().boundingBox();
await ui.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
await ui.mouse.down();
for (let i = 1; i <= 12; i++) { await ui.mouse.move(track.x + (track.width * i) / 48, thumb.y + thumb.height / 2); await ui.waitForTimeout(40); }
await ui.mouse.up();
await ui.waitForTimeout(500);
const turned = await painted();
check("Direction turns it", turned.x !== a.x && turned.x !== "" && Number(turned.x) < 44, `--live-x ${a.x || "(its own way)"} → ${turned.x}`);
await ui.keyboard.press("Escape");
await ui.locator("[data-studio-pane]").first().focus().catch(() => {});
await ui.keyboard.press("Control+z");
await ui.waitForTimeout(600);
const back = await painted();
const stillAlive = await row.locator('[data-texture-live="drift"]').count();
check("the whole drag is one undo, and it stays alive", back.x === a.x && stillAlive === 1, `--live-x ${turned.x} → ${back.x}, alive ${stillAlive}`);

await row.locator('[data-texture-motion="sway"]').click();
await ui.waitForTimeout(600);
check("Sway swings the layers", (await painted()).name === "polio-live-sway-3");
await row.locator('[data-texture-motion="still"]').click();
await ui.waitForTimeout(800);
const still = await painted();
const gone = await row.locator("[data-texture-live]").count();
check("Still: the tiled picture again, not moving", still.name === "none" && gone === 0, `${still.name}, ${gone} motion panels`);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);

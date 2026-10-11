/**
 * A SMALL CAPTURED PAGE ON THE BOARD, WITHOUT A CAPTURE.
 *
 * Tests of how the Preview and the published page re-anchor a captured part
 * (a fixed layer, a sticky band, a strip of depths) need only a handful of
 * parts with `from.selector` and `from.position` set, not a whole site. The
 * saved PST board (`board.mjs`) gives the browser everything else it holds;
 * its parts are swapped for the ones given here, and any pictures those
 * parts name are kept under their ids, as a bring-in keeps them.
 *
 *   import { boardWith, part, captured } from "./lib/seeded.mjs";
 *   const board = boardWith([part("n_sea", 0, 0, 1440, 900, captured("body > canvas", "fixed"))], { pictures: [{ id, type, bytes }] });
 *   await openBoard(ui, URL_BASE, board);
 */
import { readBoard } from "./board.mjs";

export const PAGE = "page_home";

/** A part with every field a document's part carries, at a box, with `extra` over it. */
export function part(id, x, y, w, h, extra = {}) {
  return {
    id, pageId: PAGE, featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false,
    glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null,
    kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
  };
}

/** The `from` of a captured part: its element's path, and how the page positioned it. */
export function captured(selector, position = null, inset = null) {
  return { from: { url: "https://seeded.test/", host: "seeded.test", selector, at: 1, ...(position ? { position } : {}), ...(inset ? { inset } : {}) } };
}

/** The saved PST board with these parts on its Home page instead of its own, and these pictures kept (Buffers, by the id the parts name). */
export function boardWith(nodes, { pictures = [] } = {}) {
  const board = structuredClone(readBoard("pst"));
  const put = (raw) => { const v = JSON.parse(raw); v.state.nodes = nodes; v.state.groups = []; v.state.activePageId = PAGE; return JSON.stringify(v); };
  if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.nodes) board.local["builder.studio"] = put(board.local["builder.studio"]);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (row) row.value = put(row.value);
  if (pictures.length) {
    board.idb["builder.pictures"] ??= { version: 1, stores: { files: [] } };
    board.idb["builder.pictures"].stores.files ??= [];
    for (const p of pictures) board.idb["builder.pictures"].stores.files.push({ key: p.id, blob: Buffer.from(p.bytes).toString("base64"), type: p.type });
  }
  return board;
}

/** The Preview at full size, in the window view, once its page is drawn and re-anchored. */
export async function openPreview(page, base) {
  await page.goto(`${base}/builder/preview`, { waitUntil: "networkidle" });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.querySelectorAll("[data-live-node]").length > 0)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1200);
}

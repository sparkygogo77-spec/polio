/**
 * Import: a picture or a video, and where the frame lands.
 *
 * WHAT IT WAS, measured on the tree before any of this: the background's
 * wheel had a piece called Picture. It opened a chooser whose `accept` was
 * `image/*`, so a video could not be offered at all, and whatever it got it
 * did one thing — `addTexture({ kind: "image", pattern: true, scale: 60,
 * opacity: 0.5, contrast: 0.45, target: "page" })`. A tile: the picture
 * reduced to a monochrome mask, repainted in a palette colour, half
 * transparent, repeated across the page. One destination, no choice, and no
 * way to bring a picture in as a picture.
 *
 * So these checks are about the three things that were missing: the video,
 * the frame, and the choice of where it goes.
 *
 *   node tests/import.mjs [url]
 */
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const SP = process.env.IMPORT_FIXTURES ?? "/tmp/claude-0/-home-user-polio/178f1cc3-07c7-5da2-a9b1-fc4bddcbd66f/scratchpad";
/*
 * Somewhere to put the files this suite makes.
 *
 * SP is one session's own scratchpad, and off that machine it does not
 * exist — so writing a fixture into it threw ENOENT and took the run down
 * before the check it was for. Anything written here goes to a directory
 * the suite makes for itself unless SP is really there, which keeps
 * IMPORT_FIXTURES pointing at a prepared set for anyone who has one.
 */
const OWN = existsSync(SP) ? SP : mkdtempSync(join(tmpdir(), "polio-import-"));
const fixture = (name) => join(OWN, name);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const open = async () => {
  const p = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1700);
  return p;
};
/** A right press on the bare page frame: the background's own wheel. */
const wheel = async (p) => {
  const f = await p.locator("[data-frame]").boundingBox();
  await p.mouse.move(f.x + f.width / 2, f.y + 60);
  await p.mouse.down({ button: "right" });
  await p.mouse.up({ button: "right" });
  await p.waitForTimeout(600);
};
/*
 * Offer a file to Import, and say so plainly if there is nothing to offer it
 * to. Run against a build with no Import piece this used to throw on the
 * first `setInputFiles` and take the whole run with it — one stack trace
 * instead of the list of what is missing, which is the least useful way for
 * a suite to be right.
 */
const OFFER = 'input[type=file][aria-label="Import a picture or a video"]';
const offer = async (p, file) => {
  if (await p.locator(OFFER).count() === 0) return false;
  await p.setInputFiles(OFFER, file);
  await p.waitForTimeout(1500);
  return true;
};
/** Mark a whole block red at once when Import is not there to be tested. */
const missing = (names) => names.forEach((n) => check(n, false, "this build has no Import chooser"));

const doc = (p) => p.evaluate(() => {
  const raw = localStorage.getItem("builder.studio");
  const d = raw ? JSON.parse(raw) : null;
  return { layers: d?.state?.look?.texture ?? [], nodes: d?.state?.nodes ?? [] };
});
/*
 * The document, read the way anything else reads it: out of the store the
 * app persists to. There is no test-only global to reach for, and adding
 * one would mean the checks measure a door nobody else uses.
 */
const live = doc;
/** The frame showing on the board right now, painted by `Canvas`. */
const onBoard = (p) => p.evaluate(() => {
  const el = document.querySelector("[data-import-preview]");
  if (!el) return null;
  const bg = getComputedStyle(el).backgroundImage;
  return { len: bg.length, tail: bg.slice(-64), size: getComputedStyle(el).backgroundSize,
    box: Math.round(el.getBoundingClientRect().width) + "x" + Math.round(el.getBoundingClientRect().height) };
});

/* ------------------------------------------------------------------ */
/* 1. The piece is Import, and it offers a video                       */
/* ------------------------------------------------------------------ */

{
  const p = await open();
  await wheel(p);
  const piece = await p.evaluate(() => {
    const el = document.querySelector('[data-radial] [aria-label*="Import" i], [data-radial] [title*="Import" i]');
    const any = [...document.querySelectorAll("[data-radial] *")]
      .map((e) => e.getAttribute("aria-label") || e.getAttribute("title") || "")
      .filter(Boolean);
    return { found: !!el, labels: [...new Set(any)].filter((t) => t.length < 40) };
  });
  check("the background's wheel has an Import piece", piece.found, piece.labels.join(" · "));
  check("and nothing on it still says Picture",
    !piece.labels.some((t) => /^picture$/i.test(t.trim())), piece.labels.filter((t) => /picture/i.test(t)).join(" · ") || "none");

  const input = await p.evaluate(() => {
    const el = document.querySelector('input[type=file][aria-label="Import a picture or a video"]');
    return el ? el.accept : null;
  });
  check("its chooser offers a video as well as a picture",
    !!input && /image\/\*/.test(input) && /video\/\*/.test(input), input ?? "no input at all");
  await p.close();
}

/* ------------------------------------------------------------------ */
/* 2. A video is scrubbed, and the frame is live on the background     */
/* ------------------------------------------------------------------ */

/*
 * The clip is made here when there is not one to borrow.
 *
 * This wanted `${SP}/clip.webm`, and SP defaulted to one session's own
 * scratchpad with the generator for it living there too — so everywhere
 * else the suite reported "a test video exists to scrub — missing, run
 * scratchpad/mkvideo.mjs", which is a script that is not in the
 * repository. A suite that can only pass on the machine it was written on
 * passes nowhere else, and this one went red the first time it ran here.
 *
 * So it records one: a canvas painted a frame at a time through
 * MediaRecorder, which is the browser this suite already drives writing a
 * real webm with real duration and real frames to scrub. Two and a half
 * seconds of colour with the frame number burnt into it, which is enough
 * for a scrubber to have somewhere to go and for two frames to differ.
 * IMPORT_FIXTURES still points it at a clip somebody has already made.
 */
const recordClip = async (to) => {
  const p = await browser.newPage();
  await p.goto("about:blank");
  const b64 = await p.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 180;
    const g = c.getContext("2d");
    const rec = new MediaRecorder(c.captureStream(25), { mimeType: "video/webm" });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => { rec.onstop = r; });
    rec.start();
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `hsl(${i * 6} 70% 45%)`;
      g.fillRect(0, 0, 320, 180);
      g.fillStyle = "#fff";
      g.font = "64px sans-serif";
      g.fillText(String(i), 24, 120);
      await new Promise((r) => setTimeout(r, 40));
    }
    rec.stop();
    await stopped;
    const buf = await new Blob(chunks, { type: "video/webm" }).arrayBuffer();
    const u = new Uint8Array(buf);
    let out = "";
    for (let i = 0; i < u.length; i += 1) out += String.fromCharCode(u[i]);
    return btoa(out);
  });
  await p.close();
  writeFileSync(to, Buffer.from(b64, "base64"));
  return existsSync(to);
};

let clip = `${SP}/clip.webm`;
if (!existsSync(clip)) {
  const made = fixture("clip.webm");
  const ok = await recordClip(made).catch(() => false);
  if (ok) clip = made;
  check("a test video exists to scrub", ok, ok ? `recorded one at ${made}` : "could not record one");
}
if (!existsSync(clip)) {
  check("the recorded video can be opened", false, "no clip to scrub");
} else {
  const p = await open();
  await wheel(p);
  const ready = await offer(p, clip);
  if (!ready) missing(["choosing a video opens the frame picker"]);
  else {
  check("choosing a video opens the frame picker", await p.locator("[data-import-flow]").count() === 1);
  const scrub = p.locator("[data-import-scrub]");
  check("with a scrubber on it", await scrub.count() === 1);
  const len = await scrub.evaluate((el) => Number(el.max));
  check("that knows how long the video is", len > 1, `${len.toFixed(2)}s`);

  /* Nothing is committed yet: the preview is a preview. */
  const before = await doc(p);
  check("nothing has been written to the document yet",
    before.layers.filter((l) => l.kind === "image").length === 0 && before.nodes.length === 0,
    `${before.layers.length} layers, ${before.nodes.length} parts`);

  /*
   * The frame under the playhead is on the background, full size — and it
   * CHANGES as the head moves. The clip sweeps its hue with time, so two
   * frames far apart cannot be the same bytes unless nothing is happening.
   */
  const frameAt = async (t) => {
    await scrub.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, t);
    await p.waitForTimeout(700);
    return onBoard(p);
  };
  const depthBefore = await p.evaluate(() => (window.__studioUndoDepth ? window.__studioUndoDepth() : null));
  const early = await frameAt(Math.min(0.3, len * 0.1));
  const late = await frameAt(len * 0.8);
  check("the frame under the playhead is on the background", !!early && early.len > 500,
    early ? `${early.len} bytes of frame, ${early.box}` : "nothing painted on the board");
  check("and it covers the page rather than tiling across it",
    !!early && early.size === "cover", early ? early.size : "-");
  check("dragging the scrubber changes the frame that is showing",
    !!early && !!late && early.tail !== late.tail,
    early && late ? `${early.len} → ${late.len} bytes, different bytes: ${early.tail !== late.tail}` : "-");

  /*
   * And the scrubbing itself is not an edit. The first version of this put
   * each frame through `addTexture`, which calls `push()` — one undo entry
   * per frame, and a hundred of them for one drag.
   */
  // The history lives in memory and is never persisted, so it is read
  // through the page's own seam: reading it out of storage found an empty
  // list every time and could not see a hundred entries land.
  const undos = await p.evaluate(() => (window.__studioUndoDepth ? window.__studioUndoDepth() : null));
  check("scrubbing wrote nothing to the undo history", undos !== null && undos === depthBefore, undos === null ? "no __studioUndoDepth seam on the page" : `${depthBefore} → ${undos} entries`);

  /* Leaving takes the preview away and leaves the document as it was. */
  await p.locator('[aria-label="Cancel the import"]').click();
  await p.waitForTimeout(600);
  check("cancelling takes the preview off the page", (await onBoard(p)) === null);
  const after = await live(p);
  check("and leaves the document exactly as it was",
    after.layers.filter((l) => l.kind === "image").length === 0 && after.nodes.length === 0,
    `${after.layers.length} layers, ${after.nodes.length} parts`);
  }
  await p.close();
}

/* ------------------------------------------------------------------ */
/* 3. Fit to standard: one covering picture on the page                */
/* ------------------------------------------------------------------ */

if (existsSync(clip)) {
  const p = await open();
  await wheel(p);
  if (!await offer(p, clip)) { missing(["Fit to standard leaves one covering picture on the page"]); await p.close(); }
  else {
  await p.locator("[data-import-fit]").click();
  await p.waitForTimeout(800);
  const s = await live(p);
  const pic = s.layers.find((l) => l.kind === "image");
  check("Fit to standard leaves one covering picture on the page",
    !!pic && pic.pattern === false && pic.weave === 1 && pic.opacity === 1 && pic.target === "page",
    pic ? `pattern ${pic.pattern}, weave ${pic.weave}, opacity ${pic.opacity}, ${pic.target}` : "no picture layer");
  check("and it is not the old half-opaque recoloured tile",
    !!pic && !(pic.pattern === true && pic.opacity === 0.5 && pic.scale === 60),
    pic ? `scale ${pic.scale}, contrast ${pic.contrast}` : "-");
  check("and it adds no part, because a background is not a part",
    s.nodes.length === 0, `${s.nodes.length} parts`);
  check("and nothing of the preview is left on the board", (await onBoard(p)) === null);
  check("the picker closes when it has landed", await p.locator("[data-import-flow]").count() === 0);
  await p.close();
  }
}

/* ------------------------------------------------------------------ */
/* 4. Shrink in: an ordinary part, its own aspect, resizable           */
/* ------------------------------------------------------------------ */

if (existsSync(clip)) {
  const p = await open();
  await wheel(p);
  if (!await offer(p, clip)) { missing(["Shrink in lands a part on the page"]); await p.close(); }
  else {
  await p.locator("[data-import-shrink]").click();
  /* One sample early inside the 420ms. The ease is front-loaded, so by 90ms
     it is already most of the way home and the difference is small enough to
     argue about; 40ms is still plainly in flight. */
  await p.waitForTimeout(40);
  const inflight = await p.evaluate(() => {
    const el = [...document.querySelectorAll("[data-node-id]")].pop();
    return el ? { w: Math.round(el.getBoundingClientRect().width) } : null;
  });
  await p.waitForTimeout(900);
  const s = await live(p);
  const node = s.nodes[s.nodes.length - 1];
  const worn = node ? s.layers.find((l) => l.id === node.texture) : null;
  check("Shrink in lands a part on the page", !!node, node ? `${node.featureId} ${node.w}×${node.h}` : "no part");
  check("and the part wears the frame", !!worn && (worn.src || "").length > 500,
    worn ? `${worn.src.length} bytes on layer ${worn.id}` : "the part wears no picture");
  /* 320x180 is 16:9; the part has to be the picture's shape, not a box. */
  check("at the picture's own aspect, not a default box",
    !!node && Math.abs(node.w / node.h - 320 / 180) < 0.06,
    node ? `${node.w}×${node.h} = ${(node.w / node.h).toFixed(2)}, wanted ${(320 / 180).toFixed(2)}` : "-");
  check("inset from the frame, so it reads as a thing on the page",
    !!node && node.x > 0 && node.w < 1440, node ? `x ${node.x}, ${node.w} of 1440` : "-");
  /* A part carrying a picture has to SHOW one. Without a renderer of its own
     it fell through to the dashed `Unknown` card, which paints the flat
     surface colour and drops `surfacePaint` on the floor: the picture was
     on the part and invisible. */
  const painted = await p.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"] [data-part-picture]`);
    if (!el) return null;
    const bg = getComputedStyle(el).backgroundImage;
    return { len: bg.length, has: bg.includes("url("), size: getComputedStyle(el).backgroundSize };
  }, node.id);
  check("and the part actually shows the picture, not a card about it",
    !!painted && painted.has && painted.len > 500,
    painted ? `${painted.len} bytes of background, ${painted.size}` : "no picture painted on the part");

  /*
   * "Shrink in from the edges" has to be the behaviour and not just the
   * label: the part starts covering the page and closes to its box. Caught
   * in flight — one frame after the press it must be wider than it ends up,
   * and it must settle exactly on the box, leaving no transform behind.
   */
  const settled = await p.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    return el ? { transform: getComputedStyle(el).transform, w: Math.round(el.getBoundingClientRect().width) } : null;
  }, node.id);
  /* Both widths off the screen, not one off the screen and one off the
     document: the board is drawn at about 0.63, so `node.w` and a client
     rect are two different units and comparing them called a shrink a
     failure once already. */
  check("it came in from the edges rather than appearing",
    inflight !== null && settled !== null && inflight.w > settled.w * 1.25,
    inflight && settled ? `${inflight.w}px wide in flight, ${settled.w}px at rest, both on screen` : "never caught in flight");
  check("and settled on its box with nothing left on it",
    !!settled && (settled.transform === "none" || settled.transform === "matrix(1, 0, 0, 1, 0, 0)"),
    settled ? settled.transform : "-");

  check("and nothing was left tiled across the background",
    !s.layers.some((l) => l.kind === "image" && l.target === "page"),
    s.layers.filter((l) => l.kind === "image").map((l) => l.target).join(",") || "none");
  check("the preview is gone from the board too", (await onBoard(p)) === null);

  /* An ordinary part: the board gives it handles like any other. */
  await p.locator(`[data-node-id="${node.id}"]`).click({ force: true });
  await p.waitForTimeout(500);
  const handles = await p.locator("[data-resize]").count();
  check("and it is resizable, like any other part", handles > 0, `${handles} handles`);
  await p.close();
  }
}

/* ------------------------------------------------------------------ */
/* 5. A still picture skips the scrubber                               */
/* ------------------------------------------------------------------ */

const still = `${SP}/shot.png`;
if (existsSync(still)) {
  const p = await open();
  await wheel(p);
  if (!await offer(p, still)) { missing(["a picture goes straight to where it lands"]); await p.close(); }
  else {
  check("a picture goes straight to where it lands", await p.locator("[data-import-flow]").count() === 1);
  check("with no scrubber, because there is nothing to scrub",
    await p.locator("[data-import-scrub]").count() === 0);
  check("and both landings are offered for it too",
    await p.locator("[data-import-fit]").count() === 1 && await p.locator("[data-import-shrink]").count() === 1);
  await p.close();
  }
}

/* ------------------------------------------------------------------ */
/* 6. A file this browser cannot open says so                          */
/* ------------------------------------------------------------------ */

/*
 * The chooser says `video/*`, so it will hand over a .mov of ProRes or an
 * HEIC photo, and a decode that never completes leaves `ready` false for
 * ever: two keys greyed out and nothing anywhere saying why. Silence is
 * the worst of the three answers a person can get.
 */
{
  const bad = fixture("not-really-a-video.mp4");
  writeFileSync(bad, Buffer.from("00000018667479706d70343200000000", "hex"));
  const p = await open();
  await wheel(p);
  if (!await offer(p, bad)) missing(["a file it cannot open says so"]);
  else {
    await p.waitForTimeout(7000);
    const said = await p.locator("[data-import-refused]").count();
    check("a file it cannot open says so, rather than sitting there", said === 1,
      said ? await p.locator("[data-import-refused]").innerText() : "nothing said, both keys still grey");
    const landed = await live(p);
    check("and nothing was changed by the attempt",
      landed.layers.filter((l) => l.kind === "image").length === 0 && landed.nodes.length === 0,
      `${landed.layers.length} layers, ${landed.nodes.length} parts`);
    check("and the way out is still there",
      await p.locator('[aria-label="Cancel the import"]').count() === 1);
  }
  await p.close();
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

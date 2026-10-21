/**
 * THE PAGE SCROLLED THROUGH ONCE, SLOWLY ENOUGH TO BE SEEN.
 *
 * What a page reveals on the way down (an IntersectionObserver adding
 * `in-view`, a lazy picture taking its height) needs the window to stay over
 * it for a few frames. A sweep with 40 ms between steps went past thesolface's
 * gallery without any of its six items having revealed (opacity 0, no
 * `in-view`; the page 114 px short of its height). A press-list read after
 * such a load (`fresh()` in capture-route.mjs) then found no "View … artwork"
 * button visible, and the lightbox they open was never captured.
 *
 * A step is a sixth of the window and stays 110 ms. The sweep is made again
 * (up to three times) while the page keeps growing under it, then returns to
 * the top.
 */
export const STEP_MS = 110;

/** Runs in the page: one slow pass down and back to the top. Returns the page's height. */
export async function SWEEP(stepMs) {
  const pass = async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.max(100, innerHeight / 6)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, stepMs)); }
    scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, stepMs * 2));
    return document.documentElement.scrollHeight;
  };
  let before = document.documentElement.scrollHeight, after = await pass();
  for (let again = 0; again < 2 && after !== before; again++) { before = after; after = await pass(); }
  scrollTo(0, 0);
  return after;
}

/** The page scrolled through once (see above); false when it could not be. */
export const scrollThrough = (page, stepMs = STEP_MS) => page.evaluate(SWEEP, stepMs).then(() => true, () => false);

/**
 * EVERY PICTURE LOADED AND THE PAGE'S HEIGHT STILL, BEFORE IT IS READ.
 *
 * A lazy picture (`loading="lazy"`) that the sweep brought near the window may
 * not have finished by the time the page is read, and a cached one finishes
 * between two forced layouts, so a read of thesolface.site's #community saw
 * the section at y 9106 and its three children at 9011: the page grew under
 * the walk (95 px; 10268 -> 10382 in all). Every picture is made eager, waited
 * for (up to `ms`) and decoded, then the page's height has to hold for three
 * looks 100 ms apart.
 */
export async function SETTLE_IMAGES(ms) {
  const imgs = Array.from(document.images);
  for (const i of imgs) if (i.loading === "lazy") i.loading = "eager";
  const loaded = Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))));
  await Promise.race([loaded, new Promise((r) => setTimeout(r, ms))]);
  await Promise.race([Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null))), new Promise((r) => setTimeout(r, 2000))]);
  let last = -1, same = 0;
  for (let k = 0; k < 30 && same < 3; k++) {
    const h = document.documentElement.scrollHeight;
    same = h === last ? same + 1 : 0;
    last = h;
    await new Promise((r) => setTimeout(r, 100));
  }
  return last;
}

/** The pictures loaded and the height still (see above); the page's height, or false when it could not be done. */
export const settleImages = (page, ms = 8000) => page.evaluate(SETTLE_IMAGES, ms).catch(() => false);

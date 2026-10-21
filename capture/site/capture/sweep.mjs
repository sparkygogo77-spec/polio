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

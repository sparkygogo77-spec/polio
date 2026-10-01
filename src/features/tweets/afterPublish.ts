"use client";
/**
 * A TOUR CLIP AFTER EACH PUBLISH, READY AS A DRAFT POST.
 *
 * With "Make a tour clip after each publish" on (`tweets.clipAfterPublish`),
 * the publish is followed by a clip of the site it just put up:
 *
 *   1. Update live site is pressed. A browser records a tab only straight
 *      after a press, so this is the moment it is asked, once, to record
 *      this tab (`studio:publish-start`, sent by `goLive.ts` from inside the
 *      press). The recording is held, not started.
 *   2. The site goes live (`studio:went-live`). A new draft is made, "<site>
 *      is live: <address>", the console opens on its Tour, and the tour is
 *      played and recorded with the held recording, for the clip length and
 *      to the stop the Tour is set to (`TourPanel`, intent "clip").
 *   3. The clip goes on the draft's first post when X takes it as it is;
 *      a WebM is made into a GIF first; a clip X would still refuse is kept
 *      beside the draft and the log says which limit and what to do.
 *
 * A publish that does not go live lets the held recording go, and says so
 * in the log. Turned down at step 1, the publish goes on and the log says the
 * clip could not be made. `tests/tour-after-publish.mjs`.
 */
import { useTweets } from "./store";

let held: Promise<MediaStream | null> | null = null;
let wentLive = false;

/** The recording the press asked for, once, for the clip that follows the publish. Null when there is none. */
export function takeHeldStream(): Promise<MediaStream | null> | null {
  const h = held;
  held = null;
  return h;
}
function release() {
  const h = held;
  held = null;
  void h?.then((s) => s?.getTracks().forEach((t) => t.stop()));
}

export interface AfterPublishCtx {
  getSetting: <T>(id: string) => T;
  openPanel: (p: "tweets") => void;
}

let started = false;
export function startClipAfterPublish(ctx: AfterPublishCtx): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const note = (level: "info" | "warn" | "error" | "success", title: string, body?: string) => useTweets.getState().note({ draftId: null, level, title, body });

  window.addEventListener("studio:publish-start", () => {
    if (!ctx.getSetting<boolean>("tweets.clipAfterPublish")) return;
    release();
    wentLive = false;
    if (!navigator.mediaDevices?.getDisplayMedia) { note("warn", "No tour clip this time", "This browser cannot record a tab, so no clip follows the publish. Chrome, Edge and Firefox can."); return; }
    /* Asked inside the press: the only moment a browser lets a page ask. */
    held = navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: ctx.getSetting<number>("tweets.recordFps") || 30, width: { max: 1920 }, height: { max: 1200 } },
      audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", monitorTypeSurfaces: "exclude",
    } as DisplayMediaStreamOptions).catch(() => {
      note("warn", "No tour clip this time", "Recording this tab was not allowed, so the publish goes on without a clip. Choose this tab when the browser asks, next time.");
      return null;
    });
  });

  window.addEventListener("studio:went-live", (e) => {
    if (!held) return;
    wentLive = true;
    const { url, site } = (e as CustomEvent<{ url: string; site: string }>).detail ?? { url: "", site: "" };
    const name = site?.trim() || "The site";
    const st = useTweets.getState();
    const id = st.newDraft({ title: `Live: ${name}`, posts: [{ text: `${name} is live: ${url}`, media: [] }] });
    st.focus(id);
    st.setIntent("clip");
    ctx.openPanel("tweets");
  });

  window.addEventListener("studio:publish-end", () => {
    if (held && !wentLive) { release(); note("info", "No tour clip this time", "The site did not go live, so no clip was made."); }
  });
}

import { Clock, Copy, ExternalLink, Feather, Files, Play, Send, Trash2, Video } from "lucide-react";
import { defineFeature, type MenuEntry } from "@/core/types";
import { sendDraft, apiStatus } from "./send";
import { draftTitle, useTweets, type Draft } from "./store";
import { intentUrl } from "./text";

/**
 * The tweet console.
 *
 * Not a page: it comes down over whatever you were doing, the way the
 * keys panel does, and goes away with Escape. The module exists to give
 * it a command, a shortcut, a right-click menu on its drafts, a status-bar
 * count, its settings, and the one thing that has to run whether or not the
 * console is open — the scheduler that sends what is due and retries what
 * X refused.
 */

const G = "tweets";
const s = (id: string) => `${G}.${id}`;

export const tweets = defineFeature({
  id: G,
  name: "Tweet console",
  description: "Draft, preview, schedule and send posts to X, with a recorded tour of the site to go with them.",
  icon: Feather,
  hidden: true,
  settingGroups: [{ id: G, label: "Tweet console", icon: Feather, order: 250, description: "How drafts are counted, previewed, queued and sent." }],
  settings: [
    // ---- who you are on X
    { id: s("handle"), group: G, panel: "tweets", label: "Handle", description: "Shown in the preview card, without the @.", type: "text", default: "yourhandle", order: 1 },
    { id: s("displayName"), group: G, panel: "tweets", label: "Display name", description: "Shown in the preview card. Empty uses the site's name.", type: "text", default: "", order: 2 },
    // ---- sending
    {
      id: s("sendMode"), group: G, panel: "tweets", label: "Send does", type: "select", default: "api", order: 10,
      description: "The queue always posts through the API and falls back to an Open-in-X toast when there are no keys.",
      options: [
        { value: "api", label: "Post through the X API", description: "needs keys on the server" },
        { value: "intent", label: "Open X with the words", description: "no media" },
        { value: "copy", label: "Copy the words" },
      ],
    },
    { id: s("confirmSend"), group: G, panel: "tweets", label: "Confirm before sending now", type: "toggle", default: true, order: 11 },
    { id: s("retryAttempts"), group: G, panel: "tweets", label: "Retries", description: "How many times the queue tries again when X refuses or is down. Sends by hand are never retried on their own.", type: "number", default: 5, min: 0, max: 10, step: 1, order: 12 },
    { id: s("retryBackoffSec"), group: G, panel: "tweets", label: "First retry after", description: "Doubles each time: 45 s, 90 s, 3 min…", type: "number", default: 45, min: 10, max: 900, step: 5, unit: "s", advanced: true, order: 13 },
    { id: s("tickSec"), group: G, panel: "tweets", label: "Queue check every", description: "How often due posts are looked for while the app is open.", type: "number", default: 30, min: 10, max: 300, step: 5, unit: "s", advanced: true, order: 14 },
    { id: s("sendWindowMin"), group: G, panel: "tweets", label: "Late by up to", description: "A scheduled post still goes out this long after its time if the app was closed. Later than this it is marked missed.", type: "number", default: 180, min: 5, max: 1440, step: 5, unit: "min", advanced: true, order: 15 },
    { id: s("scheduleOffsetMin"), group: G, panel: "tweets", label: "Schedule defaults to", description: "How far ahead the time is set when you press Schedule.", type: "number", default: 30, min: 1, max: 1440, step: 1, unit: "min", advanced: true, order: 16 },
    { id: s("keepSentDays"), group: G, panel: "tweets", label: "Keep sent posts for", description: "Sent drafts and their media are cleared after this.", type: "number", default: 30, min: 1, max: 365, step: 1, unit: "days", advanced: true, order: 17 },
    // ---- counting and cutting
    { id: s("charLimit"), group: G, panel: "tweets", label: "Character limit", description: "280 on a free account, 4,000 with Premium. Counted the way X counts, links as 23.", type: "number", default: 280, min: 140, max: 25000, step: 10, advanced: true, order: 20 },
    { id: s("autoThread"), group: G, panel: "tweets", label: "Offer to split long drafts", description: "Over the limit, a Split button cuts the text into a thread at paragraphs and sentences.", type: "toggle", default: true, order: 21 },
    {
      id: s("threadNumbering"), group: G, panel: "tweets", label: "Number thread posts", type: "select", default: "slash", order: 22,
      description: "Added on send, so the count stays right if you add a post.",
      options: [{ value: "none", label: "No" }, { value: "slash", label: "1/3" }, { value: "paren", label: "(1/3)" }],
    },
    {
      id: s("defaultReply"), group: G, panel: "tweets", label: "New drafts: who can reply", type: "select", default: "everyone", order: 23,
      options: [
        { value: "everyone", label: "Everyone" },
        { value: "following", label: "Accounts you follow" },
        { value: "mentionedUsers", label: "Only people mentioned" },
        { value: "verified", label: "Verified accounts" },
        { value: "subscribers", label: "Subscribers" },
      ],
    },
    { id: s("altTextRequired"), group: G, panel: "tweets", label: "Alt text before sending", description: "Blocks Send and Schedule while a picture or GIF has no alt text.", type: "toggle", default: false, order: 24 },
    { id: s("sensitiveDefault"), group: G, panel: "tweets", label: "New drafts marked sensitive", type: "toggle", default: false, advanced: true, order: 25 },
    // ---- media
    { id: s("imageMaxEdge"), group: G, panel: "tweets", label: "Pictures resized to", description: "Longest edge, on the way in. X takes 5 MB; 2048 keeps most photos well under.", type: "number", default: 2048, min: 640, max: 4096, step: 64, unit: "px", advanced: true, order: 30 },
    { id: s("imageQuality"), group: G, panel: "tweets", label: "Picture quality", type: "slider", default: 0.86, min: 0.5, max: 1, step: 0.05, format: (v) => `${Math.round(Number(v) * 100)}%`, advanced: true, order: 31 },
    // ---- preview
    { id: s("linkCard"), group: G, panel: "tweets", label: "Show a link card in the preview", description: "For the first link in the post, the way X would.", type: "toggle", default: true, advanced: true, order: 40 },
    { id: s("previewTheme"), group: G, panel: "tweets", label: "Preview card", type: "select", default: "dark", advanced: true, order: 41, options: [{ value: "dark", label: "Dark, like X" }, { value: "light", label: "Light" }] },
    // ---- the tour
    { id: s("tourDevice"), group: G, panel: "tweets", label: "Tour device", type: "select", default: "desktop", order: 50, options: [{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "phone", label: "Phone" }] },
    { id: s("tourSpeed"), group: G, panel: "tweets", label: "Tour speed", type: "select", default: "normal", order: 51, options: [{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }] },
    { id: s("tourInteract"), group: G, panel: "tweets", label: "Tour works the parts", description: "Presses tabs and opens rows as it passes them. Off, it only scrolls.", type: "toggle", default: true, order: 52 },
    { id: s("tourLoops"), group: G, panel: "tweets", label: "Tour passes", type: "number", default: 1, min: 1, max: 4, step: 1, advanced: true, order: 53 },
    { id: s("recordFps"), group: G, panel: "tweets", label: "Tab recording frame rate", type: "number", default: 30, min: 10, max: 60, step: 5, unit: "fps", advanced: true, order: 54 },
    { id: s("renderWidth"), group: G, panel: "tweets", label: "Server render width", type: "select", default: "960", advanced: true, order: 55, options: [{ value: "640", label: "640 px" }, { value: "960", label: "960 px" }, { value: "1280", label: "1280 px" }] },
    { id: s("renderFormat"), group: G, panel: "tweets", label: "Server render makes", description: "X takes GIF and MP4, not WebM. GIF needs an ffmpeg on the server; without one you get WebM anyway.", type: "select", default: "gif", advanced: true, order: 56, options: [{ value: "gif", label: "GIF" }, { value: "webm", label: "WebM" }] },
    // ---- the console
    { id: s("encase"), group: G, panel: "tweets", label: "Console size", type: "select", default: "full", advanced: true, order: 60, options: [{ value: "full", label: "Encase the screen" }, { value: "wide", label: "Wide, with a margin" }] },
    { id: s("rail"), group: G, panel: "tweets", label: "Left rail shows", type: "select", default: "both", advanced: true, order: 61, options: [{ value: "both", label: "Drafts and the log" }, { value: "drafts", label: "Drafts only" }, { value: "log", label: "The log only" }] },
    { id: s("toastOnSend"), group: G, panel: "tweets", label: "Toast when a post goes out", type: "toggle", default: true, advanced: true, order: 62 },
    { id: s("sounds"), group: G, panel: "tweets", label: "Sounds for sent and failed", type: "toggle", default: true, advanced: true, order: 63 },
  ],
  commands: [
    { id: "tweets.open", label: "Tweet console", group: "Tweets", icon: Feather, keywords: ["tweet", "x", "post", "twitter", "console", "schedule"], shortcut: "t", run: (ctx) => ctx.togglePanel("tweets") },
    {
      id: "tweets.new", label: "New tweet draft", group: "Tweets", icon: Feather, keywords: ["tweet", "draft", "compose"],
      run: (ctx) => {
        const st = useTweets.getState();
        st.newDraft({ replySettings: ctx.getSetting<Draft["replySettings"]>(s("defaultReply")), sensitive: ctx.getSetting<boolean>(s("sensitiveDefault")) });
        ctx.openPanel("tweets");
      },
    },
    { id: "tweets.record", label: "Record a tour of the site", group: "Tweets", icon: Video, keywords: ["video", "tour", "record", "preview"], run: (ctx) => { useTweets.getState().setIntent("record"); ctx.openPanel("tweets"); } },
    { id: "tweets.tick", label: "Send what is due now", group: "Tweets", icon: Send, keywords: ["queue", "scheduled", "send"], run: () => void tick(true) },
  ],
  shortcuts: [{ keys: "t", label: "Tweet console", group: "Tweets", run: (ctx) => ctx.togglePanel("tweets") }],
  contextMenus: [
    {
      scope: "tweet-draft",
      items: (target, ctx) => {
        const d = target.data as Draft | undefined;
        if (!d) return [];
        const st = () => useTweets.getState();
        const at = (ms: number) => Date.now() + ms;
        const tomorrowNine = () => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); return t.getTime(); };
        const text = d.posts.map((p) => p.text).join("\n\n");
        const queued = d.status === "scheduled" || d.status === "sending";
        const entries: MenuEntry[] = [
          { type: "label", label: draftTitle(d) },
          { id: "tweets.d.open", label: "Open in the console", icon: Feather, onSelect: () => { st().focus(d.id); ctx.openPanel("tweets"); } },
          { id: "tweets.d.send", label: "Send now", icon: Send, disabled: d.status === "sending", onSelect: () => void sendOne(d.id, true, ctx) },
          {
            id: "tweets.d.schedule", label: queued ? "Reschedule" : "Schedule", icon: Clock,
            children: [
              { id: "tweets.d.s10", label: "In 10 minutes", onSelect: () => st().schedule(d.id, at(10 * 60_000)) },
              { id: "tweets.d.s60", label: "In an hour", onSelect: () => st().schedule(d.id, at(60 * 60_000)) },
              { id: "tweets.d.s9", label: "Tomorrow at 9", onSelect: () => st().schedule(d.id, tomorrowNine()) },
              ...(queued ? [{ type: "separator" } as MenuEntry, { id: "tweets.d.unq", label: "Take off the queue", onSelect: () => st().unschedule(d.id) }] : []),
            ],
          },
          { type: "separator" },
          { id: "tweets.d.dup", label: "Duplicate", icon: Files, onSelect: () => st().duplicateDraft(d.id) },
          { id: "tweets.d.copy", label: "Copy the words", icon: Copy, onSelect: () => void ctx.copy(text, "the draft") },
          { id: "tweets.d.intent", label: "Open in X", icon: ExternalLink, hint: "no media", onSelect: () => window.open(intentUrl(d.posts[0]?.text ?? ""), "_blank", "noopener") },
          { id: "tweets.d.tour", label: "Record a tour", icon: Play, onSelect: () => { st().focus(d.id); st().setIntent("record"); ctx.openPanel("tweets"); } },
          { type: "separator" },
          {
            id: "tweets.d.delete", label: "Delete", icon: Trash2, danger: true,
            onSelect: () => void ctx.confirm({ title: `Delete “${draftTitle(d)}”?`, body: "Its pictures go with it.", danger: true, confirmLabel: "Delete" }).then((ok) => { if (ok) st().removeDraft(d.id); }),
          },
        ];
        return entries;
      },
    },
  ],
  onMount: (ctx) => {
    // Saved drafts come back before the first tick looks for anything due.
    if (!useTweets.persist.hasHydrated()) void useTweets.persist.rehydrate();
    const t = window.setTimeout(() => {
      useTweets.getState().pruneSent(ctx.getSetting<number>(s("keepSentDays")) * 86_400_000);
      void tick(false);
    }, 1500);
    let every = window.setInterval(() => void tick(false), ctx.getSetting<number>(s("tickSec")) * 1000);
    // A change to the cadence takes effect without a reload.
    let lastTick = ctx.getSetting<number>(s("tickSec"));
    const watch = window.setInterval(() => {
      const now = ctx.getSetting<number>(s("tickSec"));
      if (now !== lastTick) { lastTick = now; window.clearInterval(every); every = window.setInterval(() => void tick(false), now * 1000); }
    }, 5000);
    const wake = () => { if (!document.hidden) void tick(false); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
      window.clearInterval(watch);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  },
});

/* ------------------------------------------------------------------ */
/* The scheduler                                                       */
/* ------------------------------------------------------------------ */

let busy = false;

/** Look through the queue and send what is due. `manual` sends the retries that are still waiting. */
export async function tick(manual: boolean) {
  if (busy) return;
  busy = true;
  try {
    const { getActions } = await import("@/core/actions");
    const ctx = getActions();
    const st = useTweets.getState();
    const now = Date.now();
    const windowMs = ctx.getSetting<number>(s("sendWindowMin")) * 60_000;
    for (const d of st.drafts) {
      if (d.status !== "scheduled" || d.scheduledAt == null) continue;
      if (now < d.scheduledAt) continue;
      if (!manual && d.nextAttemptAt && now < d.nextAttemptAt) continue;
      if (d.attempts === 0 && now - d.scheduledAt > windowMs) {
        useTweets.getState().markMissed(d.id);
        ctx.publish({ key: `tweets:missed:${d.id}`, title: `Missed: ${draftTitle(d)}`, body: "The console was closed through its window. Reschedule it, or send it now.", level: "warn", source: G, toast: true, action: { label: "Open", onClick: () => { useTweets.getState().focus(d.id); ctx.openPanel("tweets"); } } });
        continue;
      }
      await sendOne(d.id, false, ctx);
    }
  } finally {
    busy = false;
  }
}

/** Send one draft through the API, with the queue's retry rules. */
export async function sendOne(id: string, manual: boolean, ctx: { getSetting: <T>(id: string) => T; publish: (i: import("@/core/types").ToastInput) => void; play: (c: import("@/core/types").CueName) => void; openPanel: (p: "tweets") => void; copy: (t: string, l?: string) => Promise<void> }) {
  const st = useTweets.getState();
  const d = st.drafts.find((x) => x.id === id);
  if (!d || d.status === "sending") return;
  const sounds = ctx.getSetting<boolean>(s("sounds"));
  const toast = ctx.getSetting<boolean>(s("toastOnSend"));
  const status = await apiStatus();
  if (!status.configured) {
    st.markFailed(id, "No X keys on the server. Open in X to post it by hand.", null, true);
    ctx.publish({
      key: `tweets:nokeys:${id}`, title: `Could not send “${draftTitle(d)}”`, body: "No X keys on the server. Open X with the words instead.", level: "warn", source: G, toast: true,
      action: { label: "Open in X", onClick: () => window.open(intentUrl(d.posts[0]?.text ?? ""), "_blank", "noopener") },
    });
    return;
  }
  st.markSending(id);
  const r = await sendDraft(d, { mode: "api", numbering: ctx.getSetting<"none" | "slash" | "paren">(s("threadNumbering")), copy: ctx.copy });
  if (r.ok) {
    useTweets.getState().markSent(id, r.ids);
    if (sounds) ctx.play("success");
    ctx.publish({ key: `tweets:sent:${id}`, title: `Sent: ${draftTitle(d)}`, body: r.ids.length > 1 ? `${r.ids.length} posts in the thread` : undefined, level: "success", source: G, toast, sound: false, href: r.ids[0] ? `https://x.com/i/status/${r.ids[0]}` : undefined });
    return;
  }
  const max = ctx.getSetting<number>(s("retryAttempts"));
  const backoff = ctx.getSetting<number>(s("retryBackoffSec")) * 1000;
  const again = !manual && r.retryable && d.attempts + 1 < max;
  const next = again ? Date.now() + backoff * Math.pow(2, d.attempts) : null;
  useTweets.getState().markFailed(id, r.error, next, !again);
  if (sounds) ctx.play("error");
  ctx.publish({
    key: `tweets:failed:${id}`,
    title: again ? `X refused “${draftTitle(d)}”, trying again` : `Could not send “${draftTitle(d)}”`,
    body: again && next ? `${r.error} · next try in ${Math.round((next - Date.now()) / 1000)} s` : r.error,
    level: again ? "warn" : "error",
    source: G,
    toast: true,
    sound: false,
    action: again ? undefined : { label: "Open in X", onClick: () => window.open(intentUrl(d.posts[0]?.text ?? ""), "_blank", "noopener") },
  });
}

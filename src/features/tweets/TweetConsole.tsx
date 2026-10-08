"use client";
/**
 * The tweet console: a drawer at the side of the screen.
 *
 * It used to come down over the whole screen, and the Builder behind it could
 * not be used while it was open. Now it is a drawer on the right that leaves
 * the board usable beside it (the "Console size" setting still offers the old
 * whole screen). Narrow, it is one column with Post, Preview and Tour as
 * tabs; when the window leaves the board room for it, the post and its
 * preview or tour sit side by side. The drafts and the log are behind the
 * Drafts key in its header.
 *
 * The tour shows the site at its real width, scaled down to fit
 * (`ScaledFrame`), works through what the site offers in a clip of the
 * length asked, and records it in this browser (`tour.ts`, `tourRules.ts`).
 *
 * Every setting the module declares is read here, and the console says what
 * each one is doing where it does it, so the reason a button is disabled is
 * always on the screen next to it. `tests/tweet-console.mjs`, `tests/tweet-tour.mjs`.
 */
import * as React from "react";
import {
  AlertTriangle, BarChart3, Check, ChevronDown, Clock, Copy, ExternalLink, Feather, FileImage, Film, Image as ImageIcon, KeyRound, Link2, Loader2, MessageCircle,
  Info, Maximize2, Minimize2, MonitorPlay, Plus, RefreshCw, Scissors, Send, Settings2, Sparkles, Square, Trash2, Upload, Video, X,
} from "lucide-react";
import site from "@site";
import { useUi } from "@/core/ui-state/store";
import { OwnSettings } from "@/core/settings/OwnSettings";
import { useActions } from "@/core/actions";
import { useSettingValue } from "@/core/settings/useSetting";
import { setSetting } from "@/core/settings/store";
import { ctxProps } from "@/core/context-menu/ctx";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Select } from "@/core/ui/select";
import { Switch } from "@/core/ui/switch";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";
import { Progress } from "@/core/ui/progress";
import { EmptyState } from "@/core/ui/empty-state";
import { livePath, useStudio, useStudioHydration } from "@/features/studio/board/store";
import { serverBrowser, studioDoc } from "@/features/studio/loop/run";
import { draftTitle, selectQueued, useTweets, useTweetsHydration, type TourIntent, type Draft, type DraftStatus, type LogEntry, type ReplySetting, type TweetMedia } from "./store";
import { firstUrl, relativeTime, splitThread, tokenise, toLocalInput, weighedLength, intentUrl } from "./text";
import { intake, kindOf, LIMITS } from "./media";
import { apiStatus, preflight, sendDraft, type ApiStatus, type SendMode } from "./send";
import { clipSeconds, recordTour, runTour, setFrameWindow, waitForFrame, type TourRun } from "./tour";
import { CLIP_MAX_S, CLIP_MIN_S, STOP_AT, VIEWPORT, fitScale, xRefuses, type StopAt } from "./tourRules";
import { videoToGif } from "./gif-browser";
import { takeHeldStream } from "./afterPublish";

const G = "tweets";
const s = (id: string) => `${G}.${id}`;
type Numbering = "none" | "slash" | "paren";
type Device = "desktop" | "tablet" | "phone";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const STATUS: Record<DraftStatus, { label: string; dot: string; badge: "default" | "accent" | "up" | "down" | "warn" | "info" }> = {
  draft: { label: "Draft", dot: "border-border bg-panel", badge: "default" },
  scheduled: { label: "Scheduled", dot: "border-accent bg-accent", badge: "accent" },
  sending: { label: "Sending", dot: "border-info bg-info animate-pulse", badge: "info" },
  sent: { label: "Sent", dot: "border-up bg-up", badge: "up" },
  failed: { label: "Failed", dot: "border-down bg-down", badge: "down" },
  missed: { label: "Missed", dot: "border-warn bg-warn", badge: "warn" },
};

/** A ring that fills as the post fills, the way X's does; red past the limit. */
function CountRing({ n, limit }: { n: number; limit: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, n / limit);
  const over = n > limit;
  const near = !over && limit - n <= 20;
  return (
    <span className={cn("num inline-flex items-center gap-1.5 text-plain", over ? "text-down" : near ? "text-warn" : "text-fg-muted")} title={`${n} of ${limit}`}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - f)} strokeLinecap="round" transform="rotate(-90 10 10)" />
      </svg>
      {over ? `−${n - limit}` : near ? limit - n : n}
    </span>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-plain font-medium text-fg-muted">{label}</span>
        {hint ? <span className="truncate text-small text-fg-faint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/** Words as X colours them: mentions, hashtags and links in accent. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {tokenise(text).map((t, i) => (t.kind === "text" ? <React.Fragment key={i}>{t.value}</React.Fragment> : <span key={i} className="text-[#1d9bf0]">{t.value}</span>))}
    </>
  );
}

function fmtBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}


/* ------------------------------------------------------------------ */
/* The rail: drafts as stops on a line, and the log                    */
/* ------------------------------------------------------------------ */

function Rail({ onNew }: { onNew: () => void }) {
  const drafts = useTweets((st) => st.drafts);
  const log = useTweets((st) => st.log);
  const filter = useTweets((st) => st.filter);
  const setFilter = useTweets((st) => st.setFilter);
  const focusedId = useTweets((st) => st.focusedId);
  const focus = useTweets((st) => st.focus);
  const railMode = useSettingValue<string>(s("rail"));
  const shown = React.useMemo(() => {
    const list = filter === "all" ? drafts : drafts.filter((d) => (filter === "drafts" ? d.status === "draft" : filter === "sent" ? d.status === "sent" : d.status !== "draft" && d.status !== "sent"));
    return [...list].sort((a, b) => {
      // What is next to go out sits on top; then the newest.
      const qa = a.status === "scheduled" || a.status === "sending" ? a.scheduledAt ?? 0 : Infinity;
      const qb = b.status === "scheduled" || b.status === "sending" ? b.scheduledAt ?? 0 : Infinity;
      if (qa !== qb) return qa - qb;
      return b.updatedAt - a.updatedAt;
    });
  }, [drafts, filter]);
  const lastLogFor = React.useMemo(() => {
    const m = new Map<string, LogEntry>();
    for (const l of log) if (l.draftId && !m.has(l.draftId)) m.set(l.draftId, l);
    return m;
  }, [log]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <Button variant="primary" size="sm" onClick={onNew} className="flex-1">
          <Plus /> New draft
        </Button>
      </div>
      {railMode !== "log" ? (
        <>
          <div className="shrink-0 px-3 pb-2">
            <Segmented size="xs" value={filter} onChange={(v) => setFilter(v as typeof filter)} className="w-full" options={[{ value: "all", label: "All" }, { value: "drafts", label: "Drafts" }, { value: "scheduled", label: "Queue" }, { value: "sent", label: "Sent" }]} />
          </div>
          <div className={cn("min-h-0 overflow-y-auto px-3", railMode === "both" ? "flex-[3]" : "flex-1")}>
            {shown.length === 0 ? (
              <EmptyState icon={Feather} title={drafts.length ? "Nothing here" : "No drafts yet"} body={drafts.length ? "Nothing matches this filter." : "Press New draft, or T from anywhere."} className="py-8" />
            ) : (
              <ol className="relative my-1 space-y-1 border-l border-border pl-4">
                {shown.map((d) => {
                  const st = STATUS[d.status];
                  const last = lastLogFor.get(d.id);
                  const when = d.status === "scheduled" || d.status === "sending" ? d.scheduledAt : d.status === "sent" ? d.sentAt : d.updatedAt;
                  return (
                    <li key={d.id} className="relative" {...ctxProps("tweet-draft", d.id, d)}>
                      <span aria-hidden className={cn("absolute -left-[21px] top-2.5 size-2.5 rounded-full border-2", st.dot)} />
                      <button
                        type="button"
                        onClick={() => focus(d.id)}
                        className={cn("tactile w-full rounded-md px-2 py-1.5 text-left hover:bg-hover", focusedId === d.id && "bg-active")}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-large font-medium text-fg">{draftTitle(d)}</span>
                          <span className="num shrink-0 text-small text-fg-faint">{when ? relativeTime(when) : ""}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant={st.badge} size="sm">{st.label}</Badge>
                          {d.posts.length > 1 ? <span className="text-small text-fg-faint">thread of {d.posts.length}</span> : null}
                          {d.posts.some((p) => p.media.length) ? <ImageIcon className="size-3 text-fg-faint" /> : null}
                          {last && d.status !== "draft" ? <span className="min-w-0 truncate text-small text-fg-faint">· {last.title}</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </>
      ) : null}
      {railMode !== "drafts" ? (
        <div className={cn("flex min-h-0 flex-col border-t border-border", railMode === "both" ? "flex-[2]" : "flex-1")}>
          <div className="shrink-0 px-3 pt-2 text-small font-semibold uppercase tracking-wide text-fg-faint">Log</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
            {log.length === 0 ? (
              <p className="py-3 text-plain text-fg-faint">Everything that happens to a draft shows here.</p>
            ) : (
              <ul className="space-y-1.5 py-1">
                {log.slice(0, 60).map((l) => (
                  <li key={l.id} className="flex gap-2 text-plain leading-snug">
                    <span aria-hidden className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", l.level === "success" ? "bg-up" : l.level === "warn" ? "bg-warn" : l.level === "error" ? "bg-down" : "bg-fg-faint")} />
                    <span className="min-w-0 flex-1">
                      <span className="text-fg">{l.title}</span>
                      {l.body ? <span className="text-fg-muted">, {l.body}</span> : null}
                      <span className="num text-fg-faint"> · {relativeTime(l.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The editor: one draft                                               */
/* ------------------------------------------------------------------ */

function MediaStrip({ draft, index, altRequired, onAdd }: { draft: Draft; index: number; altRequired: boolean; onAdd: (files: FileList | File[]) => void }) {
  const updateMedia = useTweets((st) => st.updateMedia);
  const removeMedia = useTweets((st) => st.removeMedia);
  const media = draft.posts[index]?.media ?? [];
  const fileRef = React.useRef<HTMLInputElement>(null);
  const images = media.filter((m) => m.kind === "image").length;
  const full = media.some((m) => m.kind !== "image") || images >= LIMITS.perPost.images;
  return (
    <div className="space-y-2">
      {media.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {media.map((m) => (
            <li key={m.id} className="flex gap-2 rounded-md border border-border bg-elevated p-1.5">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-active">
                {m.thumb ? <img src={m.thumb} alt="" className="size-full object-cover" /> : <Film className="absolute inset-0 m-auto size-5 text-fg-muted" />}
                <span className="absolute bottom-0.5 left-0.5 rounded-sm bg-black/60 px-1 text-fine uppercase text-white">{m.kind}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1">
                  <span className="num min-w-0 flex-1 truncate text-small text-fg-muted" title={m.name}>{m.width}×{m.height} · {fmtBytes(m.size)}</span>
                  <Button variant="ghost" size="iconXs" aria-label={`Remove ${m.name}`} onClick={() => removeMedia(draft.id, m.id)}><X /></Button>
                </div>
                {m.kind !== "video" ? (
                  <Input inputSize="sm" value={m.alt} onChange={(e) => updateMedia(draft.id, m.id, { alt: e.target.value.slice(0, 1000) })} placeholder={altRequired ? "Alt text (required)" : "Alt text"} className={cn(altRequired && !m.alt.trim() && "border-warn/60")} />
                ) : (
                  <span className="text-small text-fg-faint">Videos take no alt text on X.</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => { if (e.target.files?.length) onAdd(e.target.files); e.target.value = ""; }} />
        <Button variant="outline" size="xs" disabled={full} onClick={() => fileRef.current?.click()}>
          <Upload /> Add media
        </Button>
        <span className="text-small text-fg-faint">{full ? "This post is full: four pictures, or one GIF or video." : "Up to four pictures, or one GIF or video. Paste or drop them too."}</span>
      </div>
    </div>
  );
}

function Editor({ draft, api }: { draft: Draft; api: ApiStatus | null }) {
  const actions = useActions();
  const st = useTweets;
  const limit = useSettingValue<number>(s("charLimit"));
  const autoThread = useSettingValue<boolean>(s("autoThread"));
  const numbering = useSettingValue<Numbering>(s("threadNumbering"));
  const altRequired = useSettingValue<boolean>(s("altTextRequired"));
  const maxEdge = useSettingValue<number>(s("imageMaxEdge"));
  const quality = useSettingValue<number>(s("imageQuality"));
  const sendMode = useSettingValue<SendMode>(s("sendMode"));
  const confirmSend = useSettingValue<boolean>(s("confirmSend"));
  const offsetMin = useSettingValue<number>(s("scheduleOffsetMin"));
  const windowMin = useSettingValue<number>(s("sendWindowMin"));
  const retries = useSettingValue<number>(s("retryAttempts"));
  const toastOnSend = useSettingValue<boolean>(s("toastOnSend"));
  const sounds = useSettingValue<boolean>(s("sounds"));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showOptions, setShowOptions] = React.useState(false);
  const [tagText, setTagText] = React.useState(draft.tags.join(", "));
  React.useEffect(() => { setTagText(draft.tags.join(", ")); }, [draft.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = draft.status === "sending";
  const problems = React.useMemo(() => preflight(draft, { limit, altRequired, numbering }), [draft, limit, altRequired, numbering]);
  const effectiveMode: SendMode = sendMode === "api" && api && !api.configured ? "intent" : sendMode;

  const addFiles = React.useCallback(
    async (index: number, files: FileList | File[]) => {
      const list = Array.from(files);
      for (const f of list) {
        const kind = kindOf(f.type);
        if (!kind) { st.getState().note({ draftId: draft.id, level: "warn", title: `Skipped “${f.name}”`, body: "Not a picture, GIF or video X takes." }); continue; }
        const cap = kind === "image" ? LIMITS.image.bytes : kind === "gif" ? LIMITS.gif.bytes : LIMITS.video.bytes;
        if (kind !== "image" && f.size > cap) { st.getState().note({ draftId: draft.id, level: "warn", title: `Skipped “${f.name}”`, body: `${fmtBytes(f.size)} is over what X takes for a ${kind}.` }); continue; }
        setBusy(`Preparing ${f.name}…`);
        try {
          const m = await intake(f, { maxEdge, quality, name: f.name });
          st.getState().addMedia(draft.id, index, m);
          if (m.note) st.getState().note({ draftId: draft.id, level: "warn", title: `Added “${f.name}” without a preview`, body: m.note });
        } catch (err) {
          st.getState().note({ draftId: draft.id, level: "error", title: `Could not add “${f.name}”`, body: err instanceof Error ? err.message : String(err) });
        } finally {
          setBusy(null);
        }
      }
    },
    [draft.id, maxEdge, quality, st],
  );

  const onPaste = (index: number) => (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => kindOf(f.type));
    if (files.length) { e.preventDefault(); void addFiles(index, files); }
  };
  const onDrop = (index: number) => (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) { e.preventDefault(); void addFiles(index, files); }
  };

  const split = () => {
    const first = draft.posts[0];
    if (!first) return;
    const parts = splitThread(first.text, limit - (numbering === "none" ? 0 : 8));
    if (parts.length < 2) return;
    st.getState().setPosts(draft.id, [{ ...first, text: parts[0]! }, ...parts.slice(1).map((text) => ({ text, media: [] })), ...draft.posts.slice(1)]);
    st.getState().note({ draftId: draft.id, level: "info", title: `Split into ${parts.length} posts` });
  };

  const commitTags = () => st.getState().updateDraft(draft.id, { tags: tagText.split(",").map((t) => t.trim()).filter(Boolean) });

  const scheduleAt = (at: number) => {
    if (problems.length) return;
    st.getState().schedule(draft.id, at);
    if (sounds) actions.play("select");
  };

  const sendNow = async () => {
    if (problems.length || locked) return;
    if (confirmSend && effectiveMode === "api") {
      const ok = await actions.confirm({ title: `Post “${draftTitle(draft)}” to X now?`, body: draft.posts.length > 1 ? `${draft.posts.length} posts, one after another.` : undefined, confirmLabel: "Post" });
      if (!ok) return;
    }
    st.getState().markSending(draft.id);
    setBusy("Sending…");
    try {
      const r = await sendDraft(draft, { mode: effectiveMode, numbering, onProgress: setBusy, copy: actions.copy });
      if (r.ok && r.ids.length) {
        st.getState().markSent(draft.id, r.ids);
        if (sounds) actions.play("success");
        actions.publish({ key: `tweets:sent:${draft.id}`, title: `Sent: ${draftTitle(draft)}`, level: "success", source: G, toast: toastOnSend, sound: false, href: `https://x.com/i/status/${r.ids[0]}` });
      } else if (r.ok) {
        // Opened X or copied: the words went somewhere, but nothing was posted from here.
        st.getState().updateDraft(draft.id, { status: "draft" });
        st.getState().note({ draftId: draft.id, level: "info", title: effectiveMode === "copy" ? "Copied" : "Opened in X", body: r.note });
      } else {
        st.getState().markFailed(draft.id, r.error, null, true);
        if (sounds) actions.play("error");
      }
    } finally {
      setBusy(null);
    }
  };

  const modeLabel = effectiveMode === "api" ? "Post to X" : effectiveMode === "intent" ? "Open in X" : "Copy the words";
  const ModeIcon = effectiveMode === "api" ? Send : effectiveMode === "intent" ? ExternalLink : Copy;
  const modeNote =
    sendMode === "api" && api && !api.configured
      ? "No X keys on the server, so Send opens X with the words instead. Media does not travel that way."
      : effectiveMode === "intent"
        ? "Send does opens X with the words (a setting). Media does not travel that way."
        : effectiveMode === "copy"
          ? "Send does copies the words (a setting)."
          : null;

  return (
    <div className="flex min-h-0 flex-col">
      {/* title row */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <Input inputSize="sm" value={draft.title} onChange={(e) => st.getState().updateDraft(draft.id, { title: e.target.value })} placeholder="Name this draft (only you see it)" className="flex-1" disabled={locked} />
        <Input inputSize="sm" value={tagText} onChange={(e) => setTagText(e.target.value)} onBlur={commitTags} placeholder="tags, comma, separated" className="w-44" disabled={locked} />
        <Badge variant={STATUS[draft.status].badge}>{STATUS[draft.status].label}</Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ol className="space-y-3">
          {draft.posts.map((p, i) => {
            const n = weighedLength(p.text);
            return (
              <li key={i} className={cn("rounded-lg border border-border bg-panel p-3", draft.posts.length > 1 && "relative pl-8")} onDrop={onDrop(i)} onDragOver={(e) => e.preventDefault()}>
                {draft.posts.length > 1 ? <span className="num absolute left-2.5 top-3 text-plain font-semibold text-fg-faint">{i + 1}</span> : null}
                <Textarea
                  autoGrow
                  rows={i === 0 ? 4 : 2}
                  value={p.text}
                  disabled={locked}
                  onPaste={onPaste(i)}
                  onChange={(e) => st.getState().updatePost(draft.id, i, { text: e.target.value })}
                  placeholder={i === 0 ? "What is happening?" : "Next post in the thread…"}
                  className="min-h-[72px] border-transparent bg-transparent px-1 text-[13px] leading-relaxed hover:border-border"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <CountRing n={n} limit={limit} />
                  {autoThread && i === 0 && n > limit ? (
                    <Button variant="subtle" size="xs" onClick={split} disabled={locked}><Scissors /> Split into a thread</Button>
                  ) : null}
                  <span className="flex-1" />
                  <Button variant="ghost" size="xs" onClick={() => st.getState().addPost(draft.id, i)} disabled={locked}><Plus /> Add to thread</Button>
                  {draft.posts.length > 1 ? (
                    <Button variant="ghost" size="xs" onClick={() => st.getState().removePost(draft.id, i)} disabled={locked} aria-label={`Remove post ${i + 1}`}><Trash2 /></Button>
                  ) : null}
                </div>
                <div className="mt-2">
                  <MediaStrip draft={draft} index={i} altRequired={altRequired} onAdd={(files) => void addFiles(i, files)} />
                </div>
              </li>
            );
          })}
        </ol>

        {/* options */}
        <button type="button" onClick={() => setShowOptions((v) => !v)} className="tactile mt-3 flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-plain font-medium text-fg-muted hover:text-fg">
          <ChevronDown className={cn("size-3.5 transition-transform", showOptions && "rotate-180")} />
          Options
          <span className="font-normal text-fg-faint">
            {[draft.replySettings !== "everyone" && "reply limits", draft.poll && "poll", draft.quoteUrl && "quote", draft.replyToUrl && "reply", draft.sensitive && "sensitive"].filter(Boolean).join(" · ") || "who can reply, poll, quote, reply to, sensitive"}
          </span>
        </button>
        {showOptions ? (
          <div className="mt-1 grid grid-cols-2 gap-3 rounded-lg border border-border bg-panel p-3">
            <Field label="Who can reply" hint="new drafts take the setting's default">
              <Select
                value={draft.replySettings}
                disabled={locked}
                onChange={(v) => st.getState().updateDraft(draft.id, { replySettings: v as ReplySetting })}
                options={[
                  { value: "everyone", label: "Everyone" },
                  { value: "following", label: "Accounts you follow" },
                  { value: "mentionedUsers", label: "Only people mentioned" },
                  { value: "verified", label: "Verified accounts" },
                  { value: "subscribers", label: "Subscribers" },
                ]}
              />
            </Field>
            <Field label="Sensitive media" hint="marks the whole thread">
              <div className="flex h-7 items-center gap-2">
                <Switch size="sm" checked={draft.sensitive} disabled={locked} onCheckedChange={(v) => st.getState().updateDraft(draft.id, { sensitive: v })} />
                <span className="text-plain text-fg-muted">{draft.sensitive ? "Hidden behind a warning on X" : "Shown as normal"}</span>
              </div>
            </Field>
            <Field label="Quote a post" hint="URL or id">
              <Input inputSize="sm" left={<Link2 />} value={draft.quoteUrl} disabled={locked} onChange={(e) => st.getState().updateDraft(draft.id, { quoteUrl: e.target.value })} placeholder="https://x.com/…/status/…" />
            </Field>
            <Field label="Reply to a post" hint="the thread hangs under it">
              <Input inputSize="sm" left={<MessageCircle />} value={draft.replyToUrl} disabled={locked} onChange={(e) => st.getState().updateDraft(draft.id, { replyToUrl: e.target.value })} placeholder="https://x.com/…/status/…" />
            </Field>
            <div className="col-span-2 space-y-2 rounded-md border border-border bg-elevated/60 p-2">
              <div className="flex items-center gap-2">
                <Switch size="sm" checked={!!draft.poll} disabled={locked} onCheckedChange={(v) => st.getState().updateDraft(draft.id, { poll: v ? { options: ["", ""], durationMinutes: 1440 } : null })} />
                <span className="text-plain font-medium text-fg">Poll</span>
                <span className="text-small text-fg-faint">on the first post; cannot go with media</span>
              </div>
              {draft.poll ? (
                <div className="grid grid-cols-2 gap-2">
                  {draft.poll.options.map((o, k, all) => (
                    <div key={k} className="flex items-center gap-1">
                      <Input inputSize="sm" value={o} maxLength={25} disabled={locked} placeholder={`Choice ${k + 1}`} onChange={(e) => st.getState().updateDraft(draft.id, { poll: { ...draft.poll!, options: all.map((x, j) => (j === k ? e.target.value : x)) } })} className="flex-1" />
                      {all.length > 2 ? <Button variant="ghost" size="iconXs" aria-label="Remove choice" onClick={() => st.getState().updateDraft(draft.id, { poll: { ...draft.poll!, options: all.filter((_, j) => j !== k) } })}><X /></Button> : null}
                    </div>
                  ))}
                  {draft.poll.options.length < 4 ? (
                    <Button variant="ghost" size="xs" onClick={() => st.getState().updateDraft(draft.id, { poll: { ...draft.poll!, options: [...draft.poll!.options, ""] } })}><Plus /> Choice</Button>
                  ) : null}
                  <Field label="Runs for" className="col-span-2">
                    <Select
                      value={String(draft.poll.durationMinutes)}
                      onChange={(v) => st.getState().updateDraft(draft.id, { poll: { ...draft.poll!, durationMinutes: Number(v) } })}
                      options={[{ value: "60", label: "1 hour" }, { value: "360", label: "6 hours" }, { value: "1440", label: "1 day" }, { value: "4320", label: "3 days" }, { value: "10080", label: "7 days" }]}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* problems */}
        {problems.length ? (
          <ul className="mt-3 space-y-1 rounded-md border border-warn/30 bg-warn/8 p-2">
            {problems.map((p) => (
              <li key={p} className="flex gap-1.5 text-plain text-warn"><AlertTriangle className="mt-px size-3 shrink-0" />{p}</li>
            ))}
          </ul>
        ) : null}
        {draft.lastError && (draft.status === "failed" || draft.status === "scheduled" || draft.status === "missed") ? (
          <p className="mt-3 flex gap-1.5 rounded-md border border-down/30 bg-down/8 p-2 text-plain text-down">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            <span>
              {draft.lastError}
              {draft.nextAttemptAt && draft.status === "scheduled" ? ` Next try ${relativeTime(draft.nextAttemptAt)} (${draft.attempts} of ${retries}).` : ""}
            </span>
          </p>
        ) : null}
        {draft.status === "sent" && draft.sentIds[0] ? (
          <p className="mt-3 flex items-center gap-1.5 text-plain text-up">
            <Check className="size-3" /> Sent {draft.sentAt ? relativeTime(draft.sentAt) : ""}.
            <a className="underline underline-offset-2" href={`https://x.com/i/status/${draft.sentIds[0]}`} target="_blank" rel="noopener noreferrer">Open on X</a>
          </p>
        ) : null}
      </div>

      {/* the schedule bar */}
      <ScheduleBar draft={draft} problems={problems} busy={busy} locked={locked} offsetMin={offsetMin} windowMin={windowMin} onSchedule={scheduleAt} onSend={() => void sendNow()} modeLabel={modeLabel} ModeIcon={ModeIcon} modeNote={modeNote} />
    </div>
  );
}

function ScheduleBar({ draft, problems, busy, locked, offsetMin, windowMin, onSchedule, onSend, modeLabel, ModeIcon, modeNote }: {
  draft: Draft; problems: string[]; busy: string | null; locked: boolean; offsetMin: number; windowMin: number;
  onSchedule: (at: number) => void; onSend: () => void; modeLabel: string; ModeIcon: React.ComponentType<{ className?: string }>; modeNote: string | null;
}) {
  const actions = useActions();
  const unschedule = useTweets((st) => st.unschedule);
  const [when, setWhen] = React.useState(() => toLocalInput(draft.scheduledAt ?? Date.now() + offsetMin * 60_000));
  React.useEffect(() => { setWhen(toLocalInput(draft.scheduledAt ?? Date.now() + offsetMin * 60_000)); }, [draft.id, draft.scheduledAt, offsetMin]);
  const at = new Date(when).getTime();
  const past = Number.isFinite(at) && at < Date.now() - 60_000;
  const queued = draft.status === "scheduled" || draft.status === "sending";
  const cannot = problems.length > 0 || locked;
  const quick = [
    { label: "+10 min", ms: 10 * 60_000 },
    { label: "+1 h", ms: 60 * 60_000 },
    { label: "Tomorrow 9:00", ms: 0, fn: () => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); return t.getTime(); } },
  ];
  return (
    <div className="shrink-0 border-t border-border px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="size-3.5 text-fg-muted" />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={locked} className="num h-7 rounded-md border border-border bg-elevated px-2 text-xs text-fg outline-none focus:border-accent" aria-label="When to send" />
        {quick.map((q) => (
          <Button key={q.label} variant="ghost" size="xs" disabled={locked} onClick={() => setWhen(toLocalInput(q.fn ? q.fn() : Date.now() + q.ms))}>{q.label}</Button>
        ))}
        <span className="flex-1" />
        {queued ? (
          <Button variant="outline" size="sm" onClick={() => unschedule(draft.id)} disabled={locked}>Take off the queue</Button>
        ) : null}
        <Button variant={queued ? "outline" : "default"} size="sm" disabled={cannot || !Number.isFinite(at) || past} onClick={() => onSchedule(at)}>
          <Clock /> {queued ? "Reschedule" : "Schedule"}
        </Button>
        <Button variant="primary" size="sm" disabled={cannot} loading={!!busy} onClick={onSend}>
          <ModeIcon className="size-3.5" /> {modeLabel}
        </Button>
        <Tooltip content="Open X's compose page with the first post's words">
          <Button variant="ghost" size="icon" aria-label="Open in X" onClick={() => window.open(intentUrl(draft.posts[0]?.text ?? ""), "_blank", "noopener")}><ExternalLink /></Button>
        </Tooltip>
        <Tooltip content="Copy the whole thread">
          <Button variant="ghost" size="icon" aria-label="Copy the words" onClick={() => void actions.copy(draft.posts.map((p) => p.text).join("\n\n"), "the draft")}><Copy /></Button>
        </Tooltip>
      </div>
      <p className="mt-1.5 min-h-[14px] text-small text-fg-faint">
        {busy ?? (
          past ? "That time has passed. Pick a later one, or send now." :
          modeNote ?? (queued && draft.scheduledAt
            ? `Goes out ${relativeTime(draft.scheduledAt)} while this app is open; up to ${windowMin} min late if it was closed, then marked missed.`
            : `The queue only runs while this app is open. A post is still sent up to ${windowMin} min after its time; later, it is marked missed.`)
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The preview card                                                    */
/* ------------------------------------------------------------------ */

function MediaGrid({ media }: { media: TweetMedia[] }) {
  if (!media.length) return null;
  const n = media.length;
  return (
    <div className={cn("mt-2 grid gap-0.5 overflow-hidden rounded-xl border border-white/10", n === 1 ? "grid-cols-1" : "grid-cols-2", n === 3 && "[&>*:first-child]:row-span-2")} style={{ aspectRatio: n === 1 ? undefined : "16/9" }}>
      {media.map((m) => (
        <div key={m.id} className="relative min-h-16 bg-black/30">
          {m.thumb ? <img src={m.thumb} alt={m.alt} className={cn("size-full object-cover", n === 1 && "max-h-72")} /> : <Film className="absolute inset-0 m-auto size-6 text-white/50" />}
          {m.kind !== "image" ? <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-black/70 px-1 text-small font-semibold uppercase text-white">{m.kind}</span> : null}
          {m.alt ? <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/70 px-1 text-small font-semibold text-white">ALT</span> : null}
        </div>
      ))}
    </div>
  );
}

function PreviewCard({ draft }: { draft: Draft }) {
  const handle = useSettingValue<string>(s("handle"));
  const displayName = useSettingValue<string>(s("displayName"));
  const linkCard = useSettingValue<boolean>(s("linkCard"));
  const theme = useSettingValue<string>(s("previewTheme"));
  const numbering = useSettingValue<Numbering>(s("threadNumbering"));
  const dark = theme !== "light";
  const name = displayName.trim() || site.name;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const texts = draft.posts.map((p) => p.text);
  const numbered = numbering !== "none" && texts.length > 1;
  return (
    <div className={cn("rounded-2xl border p-4 text-[14px] leading-snug", dark ? "border-white/12 bg-black text-[#e7e9ea]" : "border-black/10 bg-white text-[#0f1419]")}>
      {draft.posts.map((p, i) => {
        const text = numbered ? `${p.text} ${numbering === "slash" ? `${i + 1}/${texts.length}` : `(${i + 1}/${texts.length})`}` : p.text;
        const url = i === 0 && linkCard ? firstUrl(p.text) : null;
        return (
          <div key={i} className={cn("flex gap-3", i > 0 && "mt-3")}>
            <div className="flex flex-col items-center">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", dark ? "bg-[#1d9bf0]/25 text-[#1d9bf0]" : "bg-[#1d9bf0]/15 text-[#1d9bf0]")}>{initials || "B"}</span>
              {i < draft.posts.length - 1 ? <span className={cn("mt-1 w-0.5 flex-1", dark ? "bg-white/15" : "bg-black/10")} /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[14px]">
                <span className="truncate font-bold">{name}</span>
                <svg viewBox="0 0 22 22" className="size-4 shrink-0 fill-[#1d9bf0]" aria-hidden><path d="M20.4 11c0-1.2-.7-2.3-1.7-2.8.2-1.1-.1-2.3-1-3.1-.8-.8-2-1.1-3.1-.9C14 3.2 12.9 2.5 11.7 2.5S9.4 3.2 8.8 4.2c-1.1-.2-2.3.1-3.1.9-.8.8-1.1 2-.9 3.1C3.8 8.8 3.1 9.9 3.1 11.1s.7 2.3 1.7 2.8c-.2 1.1.1 2.3.9 3.1.8.8 2 1.1 3.1.9.6 1 1.7 1.7 2.9 1.7s2.3-.7 2.9-1.7c1.1.2 2.3-.1 3.1-.9.8-.8 1.1-2 .9-3.1 1.1-.6 1.8-1.7 1.8-2.9zm-10.6 3.7-3.1-3.1 1.2-1.2 1.9 1.9 4.4-4.4 1.2 1.2-5.6 5.6z" /></svg>
                <span className={cn("truncate", dark ? "text-[#71767b]" : "text-[#536471]")}><span className="streamer-hidden">@{handle || "yourhandle"}</span> · now</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{text.trim() ? <RichText text={text} /> : <span className={dark ? "text-[#71767b]" : "text-[#536471]"}>What is happening?</span>}</p>
              <MediaGrid media={p.media} />
              {i === 0 && draft.poll ? (
                <div className="mt-2 space-y-1.5">
                  {draft.poll.options.map((o, k) => (
                    <div key={k} className={cn("relative h-8 overflow-hidden rounded-md border", dark ? "border-[#1d9bf0]/70" : "border-[#1d9bf0]")}>
                      <span className="absolute inset-y-0 left-0 bg-[#1d9bf0]/20" style={{ width: `${[52, 31, 11, 6][k] ?? 5}%` }} />
                      <span className="relative flex h-full items-center justify-between px-3 text-[13px] font-semibold text-[#1d9bf0]"><span>{o || `Choice ${k + 1}`}</span></span>
                    </div>
                  ))}
                  <p className={cn("text-large", dark ? "text-[#71767b]" : "text-[#536471]")}>0 votes · {draft.poll.durationMinutes >= 1440 ? `${Math.round(draft.poll.durationMinutes / 1440)} day${draft.poll.durationMinutes >= 2880 ? "s" : ""}` : `${Math.round(draft.poll.durationMinutes / 60)} hour${draft.poll.durationMinutes >= 120 ? "s" : ""}`} left</p>
                </div>
              ) : null}
              {url && !p.media.length && !draft.poll ? (
                <div className={cn("mt-2 overflow-hidden rounded-xl border", dark ? "border-white/12" : "border-black/10")}>
                  <div className={cn("h-24", dark ? "bg-white/5" : "bg-black/5")} />
                  <div className="p-2.5 text-[13px]">
                    <p className={dark ? "text-[#71767b]" : "text-[#536471]"}>{(() => { try { return new URL(url).hostname; } catch { return url; } })()}</p>
                    <p className="truncate">{draftTitle(draft)}</p>
                  </div>
                </div>
              ) : null}
              {i === 0 && draft.quoteUrl.trim() ? <div className={cn("mt-2 rounded-xl border p-2.5 text-large", dark ? "border-white/12 text-[#71767b]" : "border-black/10 text-[#536471]")}>Quoting {draft.quoteUrl.trim()}</div> : null}
              <div className={cn("mt-2 flex items-center gap-1 text-large", dark ? "text-[#71767b]" : "text-[#536471]")}>
                {draft.replySettings !== "everyone" ? <span>{{ following: "Accounts you follow", mentionedUsers: "Only people mentioned", verified: "Verified accounts", subscribers: "Subscribers" }[draft.replySettings]} can reply</span> : <span>Everyone can reply</span>}
                {draft.sensitive ? <span> · sensitive</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The tour                                                            */
/* ------------------------------------------------------------------ */

type Result = { blob: Blob; url: string; format: string; type: string; from: "tab" | "server"; seconds: number; width: number; height: number; note?: string };

const formatOf = (type: string) => (type.includes("gif") ? "gif" : type.includes("mp4") ? "mp4" : type.includes("quicktime") ? "mov" : "webm");

/**
 * The site in its box: an iframe the size of the device's real screen,
 * showing the page exactly as a visitor's browser lays it out at that width,
 * and the whole of it scaled down to fit. Squeezing the page into the box
 * laid it out for a width nobody has, which is how the tour came to show a
 * site out of joint. While recording it lifts to fill the window, at the
 * scale that fits there, without being drawn again.
 */
function ScaledFrame({ device, src, lifted, frameRef, boxRef, onLoad, children }: { device: Device; src: string; lifted: boolean; frameRef: React.RefObject<HTMLIFrameElement | null>; boxRef: React.RefObject<HTMLDivElement | null>; onLoad: () => void; children?: React.ReactNode }) {
  const v = VIEWPORT[device];
  const holder = React.useRef<HTMLDivElement>(null);
  const [room, setRoom] = React.useState({ w: 360, h: 300 });
  React.useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setRoom({ w: el.clientWidth, h: Math.max(160, Math.min(window.innerHeight * 0.55, el.clientWidth * (v.h / v.w))) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [v.w, v.h]);
  const [win, setWin] = React.useState({ w: 1440, h: 900 });
  React.useEffect(() => { if (lifted) setWin({ w: window.innerWidth, h: window.innerHeight }); }, [lifted]);
  const box = lifted ? win : room;
  const scale = fitScale(box, device);
  return (
    <div ref={holder} className={cn(lifted ? "fixed inset-0 z-[95] flex items-center justify-center bg-black" : "relative flex w-full items-start justify-center overflow-hidden rounded-lg border border-border bg-black")} style={lifted ? undefined : { height: room.h }} data-tour-frame="">
      <div ref={boxRef} data-tour-box="" data-tour-scale={scale.toFixed(4)} style={{ width: v.w * scale, height: v.h * scale, overflow: "hidden", position: "relative", flexShrink: 0 }}>
        <iframe
          ref={frameRef}
          src={src}
          title="The site, as published"
          data-tour-iframe={device}
          width={v.w}
          height={v.h}
          style={{ width: v.w, height: v.h, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, background: "white", display: "block" }}
          sandbox="allow-scripts allow-same-origin"
          onLoad={onLoad}
        />
      </div>
      {children}
    </div>
  );
}

function TourPanel({ draft, active, intent, onIntentDone }: { draft: Draft | null; active: boolean; intent: TourIntent | null; onIntentDone: () => void }) {
  useStudioHydration();
  const pages = useStudio((st) => st.pages);
  const nodes = useStudio((st) => st.nodes);
  const activePageId = useStudio((st) => st.activePageId);
  const device = useSettingValue<Device>(s("tourDevice"));
  const secondsSetting = useSettingValue<number>(s("tourSeconds"));
  const stopSetting = useSettingValue<StopAt>(s("tourStopAt"));
  const interact = useSettingValue<boolean>(s("tourInteract"));
  const fps = useSettingValue<number>(s("recordFps"));
  const clipAfter = useSettingValue<boolean>(s("clipAfterPublish"));
  const renderWidth = useSettingValue<string>(s("renderWidth"));
  const renderFormat = useSettingValue<string>(s("renderFormat"));
  const maxEdge = useSettingValue<number>(s("imageMaxEdge"));
  const quality = useSettingValue<number>(s("imageQuality"));
  const [pageId, setPageId] = React.useState<string>(activePageId);
  const [localDevice, setLocalDevice] = React.useState<Device>(device ?? "desktop");
  const [seconds, setSeconds] = React.useState<number>(clipSeconds(secondsSetting ?? 15));
  const [stopAt, setStopAt] = React.useState<StopAt>(stopSetting ?? "bottom");
  const [state, setState] = React.useState<"idle" | "playing" | "recording" | "rendering" | "converting">("idle");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lifted, setLifted] = React.useState(false);
  const [lastRun, setLastRun] = React.useState<TourRun | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => { if (device) setLocalDevice(device); }, [device]);
  React.useEffect(() => { if (secondsSetting) setSeconds(clipSeconds(secondsSetting)); }, [secondsSetting]);
  React.useEffect(() => { if (stopSetting) setStopAt(stopSetting); }, [stopSetting]);
  React.useEffect(() => { if (!pages.some((p) => p.id === pageId)) setPageId(activePageId); }, [pages, pageId, activePageId]);
  const src = React.useMemo(() => livePath(pageId), [pageId, pages]); // eslint-disable-line react-hooks/exhaustive-deps
  const featureOf = React.useMemo(() => { const m = new Map(nodes.map((n) => [n.id, n.featureId])); return (id: string) => m.get(id); }, [nodes]);

  React.useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  /* The page in its Window view, laid out at the frame's own size, whenever it loads or the device changes. */
  const settle = React.useCallback(() => { const f = iframeRef.current; if (f) void waitForFrame(f).then(() => setFrameWindow(f)).catch(() => undefined); }, []);
  React.useEffect(() => { settle(); }, [localDevice, settle]);

  const stop = React.useCallback(() => { abortRef.current?.abort(); abortRef.current = null; }, []);
  React.useEffect(() => { if (!active) stop(); }, [active, stop]);
  const failed = (err: unknown) => { if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : String(err)); };

  const begin = (st: typeof state) => { const ac = new AbortController(); abortRef.current = ac; setState(st); setError(null); setProgress(0); return ac; };
  const end = () => { setLifted(false); setState("idle"); abortRef.current = null; };

  /* Preview: the same tour, nothing recorded. */
  const play = React.useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe || state !== "idle") return;
    const ac = begin("playing");
    try {
      await waitForFrame(iframe, ac.signal);
      setFrameWindow(iframe);
      setLastRun(await runTour(iframe, { seconds, stopAt, interact, featureOf, signal: ac.signal, onProgress: setProgress }));
    } catch (err) { failed(err); } finally { end(); }
  }, [state, seconds, stopAt, interact, featureOf]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Record: this browser records this tab while the tour plays, and stops at the clip length. A publish may hand over the recording it asked for (`afterPublish.ts`). */
  const record = React.useCallback(async (stream?: MediaStream | null): Promise<Result | null> => {
    const iframe = iframeRef.current;
    if (!iframe || state !== "idle") return null;
    const ac = begin("recording");
    try {
      await waitForFrame(iframe, ac.signal);
      setFrameWindow(iframe);
      const r = await recordTour(iframe, { seconds, stopAt, interact, featureOf, fps, signal: ac.signal, onProgress: setProgress, cropTo: boxRef.current, onStart: () => setLifted(true), stream: stream ?? undefined });
      setLastRun(r.tour);
      const made: Result = { blob: r.blob, url: URL.createObjectURL(r.blob), format: formatOf(r.type), type: r.type, from: "tab", seconds: r.seconds, width: r.width, height: r.height };
      setResult((was) => { if (was) URL.revokeObjectURL(was.url); return made; });
      return made;
    } catch (err) { failed(err); return null; } finally { end(); }
  }, [state, seconds, stopAt, interact, featureOf, fps]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * Whether the server can record at all, asked once when the tour opens.
   * `null` while it is being asked.
   */
  const [canRender, setCanRender] = React.useState<boolean | null>(null);
  const [serverNote, setServerNote] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    void serverBrowser()
      .then((b) => {
        if (!alive) return;
        setCanRender(b.video);
        setServerNote(b.video ? "" : "This server cannot record (it has no full browser with video), so the recording is made here, in your browser: press Record.");
      })
      .catch(() => { if (alive) setCanRender(null); });
    return () => { alive = false; };
  }, []);

  const render = React.useCallback(async () => {
    if (state !== "idle") return;
    const ac = begin("rendering");
    const ticker = window.setInterval(() => setProgress((p) => Math.min(0.9, p + 0.02)), 800);
    try {
      const res = await fetch("/api/studio/preview-video", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc: studioDoc(), path: src, device: localDevice, speed: "normal", interact, loops: 1, width: Number(renderWidth), format: renderFormat }), signal: ac.signal });
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const data = (await res.json()) as { ok: boolean; message?: string; reason?: string };
        throw new Error(data.message ?? "The render failed.");
      }
      const blob = await res.blob();
      const note = res.headers.get("x-tour-note") ?? undefined;
      setResult((r) => { if (r) URL.revokeObjectURL(r.url); return { blob, url: URL.createObjectURL(blob), format: formatOf(blob.type || ct), type: blob.type || ct, from: "server", seconds: 0, width: 0, height: 0, note }; });
      setProgress(1);
    } catch (err) { failed(err); } finally { window.clearInterval(ticker); end(); }
  }, [state, src, localDevice, interact, renderWidth, renderFormat]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A recording X will not take as it is (WebM) turned into a GIF here, in the browser. */
  const convert = React.useCallback(async () => {
    if (!result || state !== "idle") return;
    const ac = begin("converting");
    try {
      const gif = await videoToGif(result.blob, { fps: 12, maxWidth: Math.min(640, Number(renderWidth) || 640), signal: ac.signal, onProgress: setProgress });
      setResult((r) => { if (r) URL.revokeObjectURL(r.url); return { ...result, blob: gif, url: URL.createObjectURL(gif), format: "gif", type: "image/gif", note: undefined }; });
    } catch (err) { failed(err); } finally { end(); }
  }, [result, state, renderWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * THE CLIP AFTER A PUBLISH (`afterPublish.ts`): recorded with the recording
   * the publish's press asked for, then put on the new draft. A WebM is made
   * into a GIF first; a clip X would refuse stays here with the reason.
   */
  const clipAfterPublish = React.useCallback(async () => {
    const held = takeHeldStream();
    const stream = held ? await held : null;
    if (!stream) return;
    const draftId = useTweets.getState().focusedId;
    let made = await record(stream);
    if (!made || !draftId) return;
    if (made.format === "webm") {
      try {
        const gif = await videoToGif(made.blob, { fps: 12, maxWidth: 640 });
        made = { ...made, blob: gif, url: URL.createObjectURL(gif), format: "gif", type: "image/gif" };
        const shown = made;
        setResult((r) => { if (r) URL.revokeObjectURL(r.url); return shown; });
      } catch (err) { failed(err); return; }
    }
    const refused = xRefuses({ type: made.type, bytes: made.blob.size, seconds: made.seconds, width: made.width, height: made.height });
    if (refused.length) {
      useTweets.getState().note({ draftId, level: "warn", title: "The tour clip was not attached", body: refused.join(" ") });
      return;
    }
    const m = await intake(made.blob, { maxEdge, quality, name: `tour.${made.format}` });
    useTweets.getState().addMedia(draftId, 0, m);
    useTweets.getState().note({ draftId, level: "success", title: "Tour clip attached to the new draft", body: `${made.format.toUpperCase()} · ${fmtBytes(made.blob.size)} · ${made.seconds.toFixed(1)} s` });
  }, [record, maxEdge, quality]); // eslint-disable-line react-hooks/exhaustive-deps

  // A command asked for a recording or render as the console opened.
  React.useEffect(() => {
    if (!active || !intent || state !== "idle") return;
    onIntentDone();
    if (intent === "clip") void clipAfterPublish();
    else if (intent === "record") void record();
    else if (intent === "render") void render();
    else void play();
  }, [active, intent, state, record, render, play, onIntentDone, clipAfterPublish]);

  const refuses = result ? xRefuses({ type: result.type, bytes: result.blob.size, seconds: result.seconds, width: result.width, height: result.height }) : [];
  const attach = async () => {
    if (!result || !draft || refuses.length) return;
    try {
      const m = await intake(result.blob, { maxEdge, quality, name: `tour.${result.format}` });
      useTweets.getState().addMedia(draft.id, 0, m);
      useTweets.getState().note({ draftId: draft.id, level: "info", title: "Tour attached to post 1", body: `${result.format.toUpperCase()} · ${fmtBytes(result.blob.size)}${result.seconds ? ` · ${result.seconds.toFixed(1)} s` : ""}` });
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const busy = state !== "idle";
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  return (
    <div className="flex min-h-0 flex-col gap-2" data-tour-panel="">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={pageId} onChange={setPageId} options={pages.map((p) => ({ value: p.id, label: p.name, description: p.path }))} className="min-w-28" aria-label="Page to tour" disabled={busy} />
        <Segmented size="xs" value={localDevice} onChange={(v) => setLocalDevice(v as Device)} options={[{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "phone", label: "Phone" }]} aria-label="Device" />
        <span className="num text-small text-fg-faint">{VIEWPORT[localDevice].w} wide</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-plain text-fg-muted">
        <label className="flex items-center gap-1.5">
          Clip length
          <Input type="number" min={CLIP_MIN_S} max={CLIP_MAX_S} step={1} value={seconds} disabled={busy} data-tour-seconds="" aria-label="Clip length in seconds"
            onChange={(e) => setSeconds(Number(e.target.value))} onBlur={() => { const v = clipSeconds(seconds); setSeconds(v); setSetting(s("tourSeconds"), v); }} className="h-6 w-16 text-xs" />
          seconds
        </label>
        <label className="flex items-center gap-1.5">
          Stop scrolling at
          <Select value={stopAt} onChange={(v) => { setStopAt(v as StopAt); setSetting(s("tourStopAt"), v); }} options={STOP_AT} aria-label="Stop scrolling at" disabled={busy} className="min-w-36" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-plain text-fg-muted">
        <Switch size="sm" checked={!!clipAfter} onCheckedChange={(v) => setSetting(s("clipAfterPublish"), v)} aria-label="Make a tour clip after each publish" data-clip-after-publish="" />
        <span>Make a tour clip after each publish{clipAfter ? ": Update live site asks once to record this tab, and the clip lands on a new draft" : ""}</span>
      </label>
      {seconds > CLIP_MAX_S ? <p className="text-small text-warn">X takes videos up to 140 seconds (2 minutes 20 seconds), so the clip will be 140 seconds.</p> : null}

      <ScaledFrame device={localDevice} src={src} lifted={lifted} frameRef={iframeRef} boxRef={boxRef} onLoad={settle}>
        {lifted ? (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/70 px-2 py-1 text-plain text-white">
            <span className="size-2 animate-pulse rounded-full bg-red-500" /> Recording this tab · {Math.round(progress * seconds)} of {seconds} s
          </div>
        ) : null}
      </ScaledFrame>

      <div className="flex flex-wrap items-center gap-1.5">
        {busy ? (
          <Button variant="outline" size="sm" onClick={stop} data-tour-stop=""><Square /> Stop</Button>
        ) : (
          <>
            <Tooltip content="Plays the tour here, just as it will be recorded, without recording.">
              <Button variant="default" size="sm" data-tour-preview="" onClick={() => void play()}><MonitorPlay /> Preview tour</Button>
            </Tooltip>
            <Tooltip content={canRecord ? `Your browser records this tab while the tour plays, for ${seconds} seconds, then offers the clip for the post. Choose this tab when it asks.` : "This browser cannot record a tab. Chrome, Edge and Firefox can."}>
              <span className="inline-flex"><Button variant="primary" size="sm" data-tour-record="" onClick={() => void record()} disabled={!canRecord}><Video /> Record</Button></span>
            </Tooltip>
            {canRender ? (
              <Tooltip content={`A browser on the server plays the tour at ${renderWidth} pixels wide and makes a ${renderFormat.toUpperCase()}.`}>
                <Button variant="ghost" size="sm" onClick={() => void render()}><Sparkles /> Render on server</Button>
              </Tooltip>
            ) : null}
          </>
        )}
        <span className="flex-1" />
        {busy ? <span className="flex items-center gap-1 text-plain text-fg-muted"><Loader2 className="size-3 animate-spin" />{state === "rendering" ? "Rendering…" : state === "recording" ? "Recording…" : state === "converting" ? "Making the GIF…" : "Playing the tour…"}</span> : null}
      </div>
      {busy ? <Progress value={progress} tone="accent" /> : null}
      {lastRun && !busy ? (
        <p data-tour-did="" className="text-small text-fg-faint">
          {lastRun.pressed.length ? `Pressed ${lastRun.pressed.length}: ${lastRun.pressed.join(", ")}.` : "Nothing to press here, so it scrolled."} {lastRun.dropped ? `${lastRun.dropped} more had no time in ${seconds} seconds.` : ""}
        </p>
      ) : null}
      {canRender === false ? (
        <p className="flex gap-1.5 text-small text-fg-faint"><Info className="mt-px size-3 shrink-0" />{serverNote}</p>
      ) : null}
      {error ? <p data-tour-error="" className="flex gap-1.5 rounded-md border border-down/30 bg-down/8 p-2 text-plain text-down"><AlertTriangle className="mt-px size-3 shrink-0" />{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-panel p-2" data-tour-result={result.format}>
          <div className="overflow-hidden rounded-md bg-black">
            {result.format === "gif" ? <img src={result.url} alt="The recorded tour" className="mx-auto max-h-56" /> : <video src={result.url} controls muted loop playsInline className="mx-auto max-h-56" />}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={refuses.length ? "warn" : "up"}>{result.format.toUpperCase()}</Badge>
            <span className="num text-small text-fg-muted" data-tour-clip-seconds={result.seconds ? result.seconds.toFixed(2) : ""}>
              {fmtBytes(result.blob.size)}{result.seconds ? ` · ${result.seconds.toFixed(1)} s` : ""}{result.width ? ` · ${result.width}×${result.height}` : ""} · {result.from === "tab" ? "recorded in this browser" : "from the server"}
            </span>
            {result.note ? <span className="text-small text-warn">{result.note}</span> : null}
          </div>
          {refuses.length ? (
            <ul data-tour-refused="" className="space-y-1 rounded-md border border-warn/30 bg-warn/8 p-2 text-small text-warn">
              {refuses.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {result.format === "webm" ? (
              <Tooltip content="Plays the recording through here, in the browser, and writes a GIF X will take.">
                <Button variant="subtle" size="xs" data-tour-gif="" onClick={() => void convert()} disabled={busy}><Sparkles /> Make a GIF</Button>
              </Tooltip>
            ) : null}
            <Button variant="primary" size="xs" data-tour-attach="" onClick={() => void attach()} disabled={!draft || busy || refuses.length > 0}><FileImage /> Attach to post 1</Button>
            <a href={result.url} download={`tour.${result.format}`} className="text-small text-fg-muted underline underline-offset-2 hover:text-fg">Save to this computer</a>
            <span className="flex-1" />
            <Button variant="ghost" size="xs" onClick={() => { URL.revokeObjectURL(result.url); setResult(null); }}>Discard</Button>
          </div>
          {!draft ? <p className="text-small text-fg-faint">Start a draft to attach the clip to it.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The console                                                         */
/* ------------------------------------------------------------------ */

/** The drawer's two widths: one column, or the post and its preview or tour side by side. Wide only when the window leaves the board room beside it. */
const DRAWER_NARROW = 520;
const DRAWER_WIDE = 1040;
const BOARD_KEEPS = 420;
const roomForWide = () => typeof window !== "undefined" && window.innerWidth - DRAWER_WIDE >= BOARD_KEEPS;

export function TweetConsole() {
  const open = useUi((st) => st.panels.tweets);
  const closePanel = useUi((st) => st.closePanel);
  const [showOwn, setShowOwn] = React.useState(false);
  useTweetsHydration();
  const drafts = useTweets((st) => st.drafts);
  const focusedId = useTweets((st) => st.focusedId);
  const focus = useTweets((st) => st.focus);
  const newDraft = useTweets((st) => st.newDraft);
  const intent = useTweets((st) => st.intent);
  const setIntent = useTweets((st) => st.setIntent);
  const encase = useSettingValue<string>(s("encase"));
  const defaultReply = useSettingValue<ReplySetting>(s("defaultReply"));
  const sensitiveDefault = useSettingValue<boolean>(s("sensitiveDefault"));
  const sendMode = useSettingValue<SendMode>(s("sendMode"));
  const [side, setSide] = React.useState<"post" | "preview" | "tour">("post");
  const [api, setApi] = React.useState<ApiStatus | null>(null);
  const [railOpen, setRailOpen] = React.useState(false);
  /* Wide when asked and there is room; the window is read again as it changes. */
  const [wantWide, setWantWide] = React.useState(true);
  const [room, setRoom] = React.useState(false);
  React.useEffect(() => {
    const read = () => setRoom(roomForWide());
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  const full = encase === "full";
  const wide = full || (wantWide && room);
  const draft = drafts.find((d) => d.id === focusedId) ?? null;
  const sectionRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!open) return;
    void apiStatus().then(setApi);
    if (!useTweets.getState().focusedId && useTweets.getState().drafts[0]) focus(useTweets.getState().drafts[0]!.id);
  }, [open, focus]);
  React.useEffect(() => { if (open && intent) setSide("tour"); }, [open, intent]);
  /* Side by side there is no Post tab: the post is always there. */
  React.useEffect(() => { if (wide && side === "post") setSide("preview"); }, [wide, side]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* As a drawer the board is still in use, and Escape there is the board's: only an Escape inside the console closes it. */
      if (!full && !sectionRef.current?.contains(document.activeElement)) return;
      closePanel("tweets");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel, full]);

  const create = React.useCallback(() => { newDraft({ replySettings: defaultReply, sensitive: sensitiveDefault }); }, [newDraft, defaultReply, sensitiveDefault]);
  const refreshApi = () => void apiStatus(true).then(setApi);

  const apiChip = api === null ? (
    <Badge variant="default"><Loader2 className="size-3 animate-spin" /> checking</Badge>
  ) : api.configured ? (
    <Tooltip content={`Keys on the server; media goes through the ${api.mediaApi} upload API.${api.handle ? ` Posting as @${api.handle}.` : ""}`}>
      <Badge variant="up"><KeyRound className="size-3" /> ready{api.handle ? <span className="streamer-hidden"> · @{api.handle}</span> : null}</Badge>
    </Tooltip>
  ) : (
    <Tooltip content={`Set ${(api.missing ?? []).join(", ") || "the keys"} on the server to post from here. Until then Send opens X with the words. ${sendMode === "api" ? "" : ""}`}>
      <Badge variant="warn"><KeyRound className="size-3" /> no keys</Badge>
    </Tooltip>
  );

  const editor = draft ? (
    <Editor key={draft.id} draft={draft} api={api} />
  ) : (
    <EmptyState icon={Feather} title="Nothing open" body="Pick a draft, or start one. Everything here is saved in this browser as you type." action={<Button variant="primary" size="sm" onClick={create}><Plus /> New draft</Button>} className="flex-1" />
  );

  return (
    <>
      {/* A backdrop only when it encases the screen. As a drawer the board beside it stays usable. */}
      {full ? <div aria-hidden={!open} onClick={() => closePanel("tweets")} className={cn("fixed inset-0 z-[75] bg-black/50 backdrop-blur-[2px] transition-opacity duration-(--motion-slow)", open ? "opacity-100" : "pointer-events-none opacity-0")} /> : null}
      <section
        ref={sectionRef}
        role="dialog"
        aria-label="Tweet console"
        data-tweet-console=""
        data-open={open ? "1" : "0"}
        data-layout={full ? "full" : wide ? "wide" : "narrow"}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed z-[76] flex flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-panel transition-[opacity,transform,width] duration-(--motion-slow) ease-out",
          full ? "inset-2 md:inset-4" : "bottom-2 right-2 top-[calc(var(--topbar-h)+8px)]",
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0",
        )}
        style={full ? undefined : { width: `min(${wide ? DRAWER_WIDE : DRAWER_NARROW}px, calc(100vw - 16px))` }}
      >
        <header className="flex shrink-0 items-center gap-1.5 border-b border-border px-2.5 py-1.5">
          <Feather className="size-4 shrink-0 text-accent" />
          <h2 className="shrink-0 text-sm font-semibold text-fg">Tweets</h2>
          {!full ? (
            <Tooltip content={railOpen ? "Hide the drafts and the log" : "Every draft, and what happened to each"}>
              <Button variant={railOpen ? "subtle" : "ghost"} size="xs" aria-pressed={railOpen} data-rail-toggle="" onClick={() => setRailOpen((v) => !v)}>Drafts <span className="num text-fg-faint">{drafts.length}</span></Button>
            </Tooltip>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-plain text-fg-muted">{draft ? draftTitle(draft) : ""}</span>
          {apiChip}
          <Tooltip content="Ask the server again"><Button variant="ghost" size="iconXs" aria-label="Check keys again" onClick={refreshApi}><RefreshCw /></Button></Tooltip>
          {!full ? (
            <Tooltip content={!room ? "Side by side needs a wider window: the board keeps its room." : wantWide ? "One column, narrower" : "The post and its preview or tour side by side"}>
              <span className="inline-flex">
                <Button variant="ghost" size="iconXs" aria-label={wide ? "Narrower" : "Side by side"} data-console-width={wide ? "wide" : "narrow"} disabled={!room} onClick={() => setWantWide((v) => !v)}>
                  {wide ? <Minimize2 /> : <Maximize2 />}
                </Button>
              </span>
            </Tooltip>
          ) : null}
          <Tooltip content="Tweet console settings"><Button variant={showOwn ? "subtle" : "ghost"} size="iconXs" aria-label="Settings" aria-pressed={showOwn} onClick={() => setShowOwn((v) => !v)}><Settings2 /></Button></Tooltip>
          <Button variant="ghost" size="iconXs" aria-label="Close the tweet console" onClick={() => closePanel("tweets")}><X /></Button>
        </header>

        {open && showOwn ? (
          <div className="min-h-0 shrink-0 overflow-auto border-b border-border bg-panel/60" style={{ maxHeight: "40%" }}>
            <div className="px-3 py-2 text-small uppercase tracking-wider text-fg-faint">The console's own settings</div>
            <OwnSettings panel="tweets" />
          </div>
        ) : null}

        {open ? (
          full ? (
            <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-cols-[260px_minmax(0,1fr)_minmax(360px,42%)] xl:grid-rows-1">
              <div className="row-span-2 min-h-0 border-r border-border xl:row-span-1"><div className="flex h-full min-h-0 flex-col"><Rail onNew={create} /></div></div>
              <div className="flex min-h-0 flex-col">{editor}</div>
              <div className="min-h-0 border-t border-border xl:col-start-3 xl:row-start-1 xl:border-l xl:border-t-0">
                <SideColumn draft={draft} side={side === "post" ? "preview" : side} setSide={setSide} withPost={false} active={open} intent={intent} onIntentDone={() => setIntent(null)} />
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1">
              {railOpen ? (
                <div data-console-rail="" className="absolute inset-y-0 left-0 z-10 flex w-[240px] flex-col border-r border-border bg-panel shadow-panel">
                  <Rail onNew={() => { create(); setRailOpen(false); }} />
                </div>
              ) : null}
              {wide ? (
                <div className="grid min-h-0 flex-1 grid-cols-2">
                  <div className="flex min-h-0 flex-col border-r border-border" data-console-post="">{editor}</div>
                  <SideColumn draft={draft} side={side === "post" ? "preview" : side} setSide={setSide} withPost={false} active={open} intent={intent} onIntentDone={() => setIntent(null)} />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <SideColumn draft={draft} side={side} setSide={setSide} withPost editor={editor} active={open} intent={intent} onIntentDone={() => setIntent(null)} />
                </div>
              )}
            </div>
          )
        ) : null}
      </section>
    </>
  );
}

function SideColumn({ draft, side, setSide, withPost, editor, active, intent, onIntentDone }: { draft: Draft | null; side: "post" | "preview" | "tour"; setSide: (v: "post" | "preview" | "tour") => void; withPost: boolean; editor?: React.ReactNode; active: boolean; intent: TourIntent | null; onIntentDone: () => void }) {
  const limit = useSettingValue<number>(s("charLimit"));
  const total = draft ? draft.posts.reduce((n, p) => n + weighedLength(p.text), 0) : 0;
  const options = [
    ...(withPost ? [{ value: "post", label: "Post", icon: <Feather /> }] : []),
    { value: "preview", label: "Preview", icon: <BarChart3 /> },
    { value: "tour", label: "Tour", icon: <MonitorPlay /> },
  ];
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <Segmented size="xs" value={side} onChange={(v) => setSide(v as "post" | "preview" | "tour")} options={options} aria-label="Post, preview or tour" />
        <span className="flex-1" />
        {side === "preview" && draft ? <span className="num text-small text-fg-faint">{draft.posts.length > 1 ? `${draft.posts.length} posts · ` : ""}{total} characters · limit {limit}</span> : null}
      </div>
      {side === "post" ? <div className="flex min-h-0 flex-1 flex-col">{editor}</div> : null}
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", side === "post" && "hidden")}>
        {side === "preview" ? (draft ? <PreviewCard draft={draft} /> : <EmptyState icon={BarChart3} title="No draft to preview" className="py-10" />) : null}
        {/* The tour stays mounted while another tab is in front: the site in it is not loaded again, and a recording is never cut by a tab press. */}
        <div className={side === "tour" ? "" : "hidden"}>
          <TourPanel draft={draft} active={active} intent={intent} onIntentDone={onIntentDone} />
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * The tweet console: a dashboard that comes down over the whole screen.
 *
 * Three columns. On the left, the news — every draft as a stop on one line,
 * with the log underneath, so what is queued and what happened to it reads
 * like a feed. In the middle, one draft at a time: the words, the pictures,
 * the poll, who may reply, and the bar that schedules or sends it. On the
 * right, the post as X would show it, or the tour: the live site in a frame,
 * scrolled and worked on its own, recorded from the tab or rendered on the
 * server and attached to the post with one press.
 *
 * Every setting the module declares is read here, and the console says what
 * each one is doing where it does it, so the reason a button is disabled is
 * always on the screen next to it.
 */
import * as React from "react";
import {
  AlertTriangle, BarChart3, Check, ChevronDown, Clock, Copy, ExternalLink, Feather, FileImage, Film, Image as ImageIcon, KeyRound, Link2, Loader2, MessageCircle,
  Info, MonitorPlay, Plus, RefreshCw, Scissors, Send, Settings2, Sparkles, Square, Trash2, Upload, Video, X,
} from "lucide-react";
import site from "@site";
import { useUi } from "@/core/ui-state/store";
import { useActions } from "@/core/actions";
import { useSettingValue } from "@/core/settings/useSetting";
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
import { livePath, useStudio, useStudioHydration } from "@/features/studio/store";
import { serverBrowser, studioDoc } from "@/features/studio/agent";
import { draftTitle, selectQueued, useTweets, useTweetsHydration, type Draft, type DraftStatus, type LogEntry, type ReplySetting, type TweetMedia } from "./store";
import { firstUrl, relativeTime, splitThread, tokenise, toLocalInput, weighedLength, intentUrl } from "./text";
import { intake, kindOf, LIMITS } from "./media";
import { apiStatus, preflight, sendDraft, type ApiStatus, type SendMode } from "./send";
import { recordTour, runTour, setFrameDevice, waitForFrame, type TourSpeed } from "./tour";
import { videoToGif } from "./gif-browser";

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
    <span className={cn("num inline-flex items-center gap-1.5 text-[11px]", over ? "text-down" : near ? "text-warn" : "text-fg-muted")} title={`${n} of ${limit}`}>
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
        <span className="text-[11px] font-medium text-fg-muted">{label}</span>
        {hint ? <span className="truncate text-[10px] text-fg-faint">{hint}</span> : null}
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
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg">{draftTitle(d)}</span>
                          <span className="num shrink-0 text-[10px] text-fg-faint">{when ? relativeTime(when) : ""}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant={st.badge} size="sm">{st.label}</Badge>
                          {d.posts.length > 1 ? <span className="text-[10px] text-fg-faint">thread of {d.posts.length}</span> : null}
                          {d.posts.some((p) => p.media.length) ? <ImageIcon className="size-3 text-fg-faint" /> : null}
                          {last && d.status !== "draft" ? <span className="min-w-0 truncate text-[10px] text-fg-faint">· {last.title}</span> : null}
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
          <div className="shrink-0 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Log</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
            {log.length === 0 ? (
              <p className="py-3 text-[11px] text-fg-faint">Everything that happens to a draft shows here.</p>
            ) : (
              <ul className="space-y-1.5 py-1">
                {log.slice(0, 60).map((l) => (
                  <li key={l.id} className="flex gap-2 text-[11px] leading-snug">
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
                <span className="absolute bottom-0.5 left-0.5 rounded-sm bg-black/60 px-1 text-[9px] uppercase text-white">{m.kind}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1">
                  <span className="num min-w-0 flex-1 truncate text-[10px] text-fg-muted" title={m.name}>{m.width}×{m.height} · {fmtBytes(m.size)}</span>
                  <Button variant="ghost" size="iconXs" aria-label={`Remove ${m.name}`} onClick={() => removeMedia(draft.id, m.id)}><X /></Button>
                </div>
                {m.kind !== "video" ? (
                  <Input inputSize="sm" value={m.alt} onChange={(e) => updateMedia(draft.id, m.id, { alt: e.target.value.slice(0, 1000) })} placeholder={altRequired ? "Alt text (required)" : "Alt text"} className={cn(altRequired && !m.alt.trim() && "border-warn/60")} />
                ) : (
                  <span className="text-[10px] text-fg-faint">Videos take no alt text on X.</span>
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
        <span className="text-[10px] text-fg-faint">{full ? "This post is full: four pictures, or one GIF or video." : "Up to four pictures, or one GIF or video. Paste or drop them too."}</span>
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
                {draft.posts.length > 1 ? <span className="num absolute left-2.5 top-3 text-[11px] font-semibold text-fg-faint">{i + 1}</span> : null}
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
        <button type="button" onClick={() => setShowOptions((v) => !v)} className="tactile mt-3 flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium text-fg-muted hover:text-fg">
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
                <span className="text-[11px] text-fg-muted">{draft.sensitive ? "Hidden behind a warning on X" : "Shown as normal"}</span>
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
                <span className="text-[11px] font-medium text-fg">Poll</span>
                <span className="text-[10px] text-fg-faint">on the first post; cannot go with media</span>
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
              <li key={p} className="flex gap-1.5 text-[11px] text-warn"><AlertTriangle className="mt-px size-3 shrink-0" />{p}</li>
            ))}
          </ul>
        ) : null}
        {draft.lastError && (draft.status === "failed" || draft.status === "scheduled" || draft.status === "missed") ? (
          <p className="mt-3 flex gap-1.5 rounded-md border border-down/30 bg-down/8 p-2 text-[11px] text-down">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            <span>
              {draft.lastError}
              {draft.nextAttemptAt && draft.status === "scheduled" ? ` Next try ${relativeTime(draft.nextAttemptAt)} (${draft.attempts} of ${retries}).` : ""}
            </span>
          </p>
        ) : null}
        {draft.status === "sent" && draft.sentIds[0] ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-up">
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
      <p className="mt-1.5 min-h-[14px] text-[10px] text-fg-faint">
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
          {m.kind !== "image" ? <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-black/70 px-1 text-[10px] font-semibold uppercase text-white">{m.kind}</span> : null}
          {m.alt ? <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/70 px-1 text-[10px] font-semibold text-white">ALT</span> : null}
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
                  <p className={cn("text-[12px]", dark ? "text-[#71767b]" : "text-[#536471]")}>0 votes · {draft.poll.durationMinutes >= 1440 ? `${Math.round(draft.poll.durationMinutes / 1440)} day${draft.poll.durationMinutes >= 2880 ? "s" : ""}` : `${Math.round(draft.poll.durationMinutes / 60)} hour${draft.poll.durationMinutes >= 120 ? "s" : ""}`} left</p>
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
              {i === 0 && draft.quoteUrl.trim() ? <div className={cn("mt-2 rounded-xl border p-2.5 text-[12px]", dark ? "border-white/12 text-[#71767b]" : "border-black/10 text-[#536471]")}>Quoting {draft.quoteUrl.trim()}</div> : null}
              <div className={cn("mt-2 flex items-center gap-1 text-[12px]", dark ? "text-[#71767b]" : "text-[#536471]")}>
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

type Result = { blob: Blob; url: string; format: string; from: "tab" | "server"; note?: string };

function TourPanel({ draft, active, intent, onIntentDone }: { draft: Draft | null; active: boolean; intent: "record" | "render" | "tour" | null; onIntentDone: () => void }) {
  useStudioHydration();
  const pages = useStudio((st) => st.pages);
  const activePageId = useStudio((st) => st.activePageId);
  const device = useSettingValue<Device>(s("tourDevice"));
  const speed = useSettingValue<TourSpeed>(s("tourSpeed"));
  const interact = useSettingValue<boolean>(s("tourInteract"));
  const loops = useSettingValue<number>(s("tourLoops"));
  const fps = useSettingValue<number>(s("recordFps"));
  const renderWidth = useSettingValue<string>(s("renderWidth"));
  const renderFormat = useSettingValue<string>(s("renderFormat"));
  const maxEdge = useSettingValue<number>(s("imageMaxEdge"));
  const quality = useSettingValue<number>(s("imageQuality"));
  const actions = useActions();
  const [pageId, setPageId] = React.useState<string>(activePageId);
  const [localDevice, setLocalDevice] = React.useState<Device>(device);
  const [localSpeed, setLocalSpeed] = React.useState<TourSpeed>(speed);
  const [state, setState] = React.useState<"idle" | "playing" | "recording" | "rendering" | "converting">("idle");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => { setLocalDevice(device); }, [device]);
  React.useEffect(() => { setLocalSpeed(speed); }, [speed]);
  React.useEffect(() => { if (!pages.some((p) => p.id === pageId)) setPageId(activePageId); }, [pages, pageId, activePageId]);
  const src = React.useMemo(() => livePath(pageId), [pageId, pages]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  React.useEffect(() => { if (iframeRef.current) setFrameDevice(iframeRef.current, localDevice); }, [localDevice]);

  const stop = React.useCallback(() => { abortRef.current?.abort(); abortRef.current = null; }, []);
  React.useEffect(() => { if (!active) stop(); }, [active, stop]);

  const play = React.useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe || state !== "idle") return;
    const ac = new AbortController();
    abortRef.current = ac;
    setState("playing");
    setError(null);
    setProgress(0);
    try {
      await waitForFrame(iframe, ac.signal);
      setFrameDevice(iframe, localDevice);
      await runTour(iframe, { speed: localSpeed, interact, loops, signal: ac.signal, onProgress: setProgress });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setState("idle");
      abortRef.current = null;
    }
  }, [state, localDevice, localSpeed, interact, loops]);

  const record = React.useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe || state !== "idle") return;
    const ac = new AbortController();
    abortRef.current = ac;
    setState("recording");
    setError(null);
    setProgress(0);
    try {
      await waitForFrame(iframe, ac.signal);
      setFrameDevice(iframe, localDevice);
      const blob = await recordTour(iframe, { speed: localSpeed, interact, loops, fps, signal: ac.signal, onProgress: setProgress, onStart: () => setFullscreen(true) });
      setResult((r) => { if (r) URL.revokeObjectURL(r.url); return { blob, url: URL.createObjectURL(blob), format: blob.type.includes("mp4") ? "mp4" : "webm", from: "tab" }; });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFullscreen(false);
      setState("idle");
      abortRef.current = null;
    }
  }, [state, localDevice, localSpeed, interact, loops, fps]);

  /*
   * Whether the server can record at all, asked once when the tour opens.
   *
   * `null` while it is being asked: the button stays live rather than flashing
   * off and on, and a press in that moment gets the route's own answer.
   */
  const [canRender, setCanRender] = React.useState<boolean | null>(null);
  const [serverNote, setServerNote] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    void serverBrowser()
      .then((b) => {
        if (!alive) return;
        setCanRender(b.video);
        setServerNote(
          b.video
            ? ""
            : b.open
              ? `The browser on this server (${b.from ?? "unknown"}) can open the site but cannot record it, recording needs the ffmpeg a full Playwright install ships. Record the tab instead.`
              : "There is no browser on this server, so it cannot play the tour. Record the tab instead.",
        );
      })
      .catch(() => { if (alive) setCanRender(null); });
    return () => { alive = false; };
  }, []);

  const render = React.useCallback(async () => {
    if (state !== "idle") return;
    const ac = new AbortController();
    abortRef.current = ac;
    setState("rendering");
    setError(null);
    setProgress(0);
    const ticker = window.setInterval(() => setProgress((p) => Math.min(0.9, p + 0.02)), 800);
    try {
      const res = await fetch("/api/studio/preview-video", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc: studioDoc(), path: src, device: localDevice, speed: localSpeed, interact, loops, width: Number(renderWidth), format: renderFormat }), signal: ac.signal });
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const data = (await res.json()) as { ok: boolean; message?: string; reason?: string };
        throw new Error(data.message ?? "The render failed.");
      }
      const blob = await res.blob();
      const format = res.headers.get("x-tour-format") ?? (ct.includes("gif") ? "gif" : "webm");
      const note = res.headers.get("x-tour-note") ?? undefined;
      setResult((r) => { if (r) URL.revokeObjectURL(r.url); return { blob, url: URL.createObjectURL(blob), format, from: "server", note }; });
      setProgress(1);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : String(err));
    } finally {
      window.clearInterval(ticker);
      setState("idle");
      abortRef.current = null;
    }
  }, [state, src, localDevice, localSpeed, interact, loops, renderWidth, renderFormat]);

  /** The WebM turned into a GIF here in the browser, so it can go to X. */
  const convert = React.useCallback(async () => {
    if (!result || state !== "idle") return;
    const ac = new AbortController();
    abortRef.current = ac;
    setState("converting");
    setError(null);
    setProgress(0);
    try {
      const gif = await videoToGif(result.blob, { fps: 12, maxWidth: Math.min(640, Number(renderWidth) || 640), signal: ac.signal, onProgress: setProgress });
      setResult((r) => { if (r) URL.revokeObjectURL(r.url); return { blob: gif, url: URL.createObjectURL(gif), format: "gif", from: result.from, note: undefined }; });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setState("idle");
      abortRef.current = null;
    }
  }, [result, state, renderWidth]);

  // A command asked for a recording or render as the console opened.
  React.useEffect(() => {
    if (!active || !intent || state !== "idle") return;
    onIntentDone();
    if (intent === "record") void record();
    else if (intent === "render") void render();
    else void play();
  }, [active, intent, state, record, render, play, onIntentDone]);

  const attach = async () => {
    if (!result || !draft) return;
    const ok = result.format === "gif" || result.format === "mp4";
    if (!ok) {
      const go = await actions.confirm({ title: "X does not take WebM", body: "Press Make a GIF first. Attached as it is, it sits on the post for the preview but the upload will be refused.", confirmLabel: "Attach anyway" });
      if (!go) return;
    }
    try {
      const m = await intake(result.blob, { maxEdge, quality, name: `tour.${result.format}` });
      useTweets.getState().addMedia(draft.id, 0, m);
      useTweets.getState().note({ draftId: draft.id, level: "info", title: "Tour attached to post 1", body: `${result.format.toUpperCase()} · ${fmtBytes(result.blob.size)}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const busy = state !== "idle";
  const frameHeight = localDevice === "phone" ? "aspect-[9/16] max-h-[520px]" : localDevice === "tablet" ? "aspect-[4/5] max-h-[520px]" : "aspect-[16/10]";

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={pageId} onChange={setPageId} options={pages.map((p) => ({ value: p.id, label: p.name, description: p.path }))} className="min-w-28" aria-label="Page to tour" disabled={busy} />
        <Segmented size="xs" value={localDevice} onChange={(v) => setLocalDevice(v as Device)} options={[{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "phone", label: "Phone" }]} />
        <Segmented size="xs" value={localSpeed} onChange={(v) => setLocalSpeed(v as TourSpeed)} options={[{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }]} />
        <span className="text-[10px] text-fg-faint">{interact ? "works tabs and rows" : "scroll only"} · {loops} pass{loops > 1 ? "es" : ""}</span>
      </div>

      {/* The frame. When recording it lifts to cover the screen, without remounting. */}
      <div className={cn(fullscreen ? "fixed inset-0 z-[95] bg-black" : cn("relative w-full overflow-hidden rounded-lg border border-border bg-black", frameHeight))} data-tour-frame>
        <iframe ref={iframeRef} src={src} title="Live site" className="size-full border-0 bg-white" sandbox="allow-scripts allow-same-origin" onLoad={() => { const f = iframeRef.current; if (f?.contentDocument) { void waitForFrame(f).then(() => setFrameDevice(f, localDevice)).catch(() => undefined); } }} />
        {fullscreen ? (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white">
            <span className="size-2 animate-pulse rounded-full bg-red-500" /> Recording the tab · {Math.round(progress * 100)}%
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {busy ? (
          <Button variant="outline" size="sm" onClick={stop}><Square /> Stop</Button>
        ) : (
          <>
            <Button variant="default" size="sm" onClick={() => void play()}><MonitorPlay /> Play</Button>
            <Tooltip content="Asks the browser for this tab, hides the console, plays the tour, keeps the video. WebM, or MP4 in Safari.">
              <Button variant="default" size="sm" onClick={() => void record()} disabled={typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia}><Video /> Record tab</Button>
            </Tooltip>
            <Tooltip
              content={
                canRender === false
                  ? serverNote
                  : `A headless browser on the server plays the tour at ${renderWidth} px and makes a ${renderFormat.toUpperCase()}. Needs a full Playwright there.`
              }
            >
              {/* A disabled button inside a tooltip still needs something that
                  takes a pointer, or there is nothing to hover for the reason. */}
              <span className="inline-flex">
                <Button variant="default" size="sm" disabled={canRender === false} onClick={() => void render()}><Sparkles /> Render on server</Button>
              </span>
            </Tooltip>
          </>
        )}
        <span className="flex-1" />
        {busy ? <span className="flex items-center gap-1 text-[11px] text-fg-muted"><Loader2 className="size-3 animate-spin" />{state === "rendering" ? "Rendering…" : state === "recording" ? "Recording…" : state === "converting" ? "Making the GIF…" : "Playing…"}</span> : null}
      </div>
      {busy ? <Progress value={progress} tone="accent" /> : null}
      {/*
        Said before the press, not after it. A tour that cannot be recorded
        here is not an error you find out about at the end of one, the button
        is off and this says which of the two reasons it is.
      */}
      {canRender === false ? (
        <p className="flex gap-1.5 rounded-md border border-border bg-elevated p-2 text-[11px] text-fg-muted">
          <Info className="mt-px size-3 shrink-0" />
          {serverNote}
        </p>
      ) : null}
      {error ? <p className="flex gap-1.5 rounded-md border border-down/30 bg-down/8 p-2 text-[11px] text-down"><AlertTriangle className="mt-px size-3 shrink-0" />{error}</p> : null}

      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-panel p-2">
          <div className="overflow-hidden rounded-md bg-black">
            {result.format === "gif" ? <img src={result.url} alt="The recorded tour" className="mx-auto max-h-64" /> : <video src={result.url} controls muted loop playsInline className="mx-auto max-h-64" />}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={result.format === "gif" || result.format === "mp4" ? "up" : "warn"}>{result.format.toUpperCase()}</Badge>
            <span className="num text-[10px] text-fg-muted">{fmtBytes(result.blob.size)} · {result.from === "tab" ? "from the tab" : "from the server"}</span>
            {result.note ? <span className="text-[10px] text-warn">{result.note}</span> : null}
            <span className="flex-1" />
            {result.format === "webm" ? (
              <Tooltip content="Plays the recording through twice, here in the browser, and writes a GIF X will take.">
                <Button variant="subtle" size="xs" onClick={() => void convert()} disabled={busy}><Sparkles /> Make a GIF</Button>
              </Tooltip>
            ) : null}
            <Button variant="primary" size="xs" onClick={() => void attach()} disabled={!draft || busy}><FileImage /> Attach to post 1</Button>
            <Button variant="ghost" size="xs" onClick={() => { URL.revokeObjectURL(result.url); setResult(null); }}>Discard</Button>
          </div>
          {result.format === "webm" ? <p className="text-[10px] text-fg-faint">X takes GIF and MP4, not WebM. Make a GIF of it here, or render on the server, which makes one.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The console                                                         */
/* ------------------------------------------------------------------ */

export function TweetConsole() {
  const open = useUi((st) => st.panels.tweets);
  const closePanel = useUi((st) => st.closePanel);
  const openPanel = useUi((st) => st.openPanel);
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
  const [side, setSide] = React.useState<"preview" | "tour">("preview");
  const [api, setApi] = React.useState<ApiStatus | null>(null);
  const draft = drafts.find((d) => d.id === focusedId) ?? null;

  React.useEffect(() => {
    if (!open) return;
    void apiStatus().then(setApi);
    if (!useTweets.getState().focusedId && useTweets.getState().drafts[0]) focus(useTweets.getState().drafts[0]!.id);
  }, [open, focus]);
  React.useEffect(() => { if (open && intent) setSide("tour"); }, [open, intent]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel("tweets"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  const create = React.useCallback(() => { newDraft({ replySettings: defaultReply, sensitive: sensitiveDefault }); }, [newDraft, defaultReply, sensitiveDefault]);
  const refreshApi = () => void apiStatus(true).then(setApi);

  const apiChip = api === null ? (
    <Badge variant="default"><Loader2 className="size-3 animate-spin" /> checking keys</Badge>
  ) : api.configured ? (
    <Tooltip content={`Keys on the server; media goes through the ${api.mediaApi} upload API.${api.handle ? ` Posting as @${api.handle}.` : ""}`}>
      <Badge variant="up"><KeyRound className="size-3" /> API ready{api.handle ? <span className="streamer-hidden"> · @{api.handle}</span> : null}</Badge>
    </Tooltip>
  ) : (
    <Tooltip content={`Set ${api.missing.join(", ")} on the server to post from here. Until then Send opens X with the words.`}>
      <Badge variant="warn"><KeyRound className="size-3" /> no keys · {sendMode === "api" ? "opens X instead" : sendMode === "intent" ? "opens X" : "copies"}</Badge>
    </Tooltip>
  );

  return (
    <>
      <div aria-hidden={!open} onClick={() => closePanel("tweets")} className={cn("fixed inset-0 z-[75] bg-black/50 backdrop-blur-[2px] transition-opacity duration-(--motion-slow)", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <section
        role="dialog"
        aria-label="Tweet console"
        data-tweet-console=""
        data-open={open ? "1" : "0"}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed z-[76] flex flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-panel transition-[opacity,transform] duration-(--motion-slow) ease-out",
          encase === "wide" ? "inset-x-[max(16px,6vw)] inset-y-[max(16px,5vh)]" : "inset-2 md:inset-4",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
          <Feather className="size-4 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-fg">Tweet console</h2>
            <p className="truncate text-[11px] text-fg-muted">Draft, preview, record a tour of the site, schedule, send. The queue runs while this app is open.</p>
          </div>
          {apiChip}
          <Tooltip content="Ask the server again">
            <Button variant="ghost" size="icon" aria-label="Check keys again" onClick={refreshApi}><RefreshCw /></Button>
          </Tooltip>
          <Tooltip content="Tweet console settings">
            <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => { closePanel("tweets"); openPanel("settings"); }}><Settings2 /></Button>
          </Tooltip>
          <Button variant="ghost" size="icon" aria-label="Close the tweet console" onClick={() => closePanel("tweets")}><X /></Button>
        </header>

        {open ? (
          <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-cols-[260px_minmax(0,1fr)_minmax(360px,42%)] xl:grid-rows-1">
            <div className="row-span-2 min-h-0 border-r border-border xl:row-span-1">
              <div className="flex h-full min-h-0 flex-col"><Rail onNew={create} /></div>
            </div>
            <div className="flex min-h-0 flex-col">
              {draft ? (
                <Editor key={draft.id} draft={draft} api={api} />
              ) : (
                <EmptyState
                  icon={Feather}
                  title="Nothing open"
                  body="Pick a draft on the left, or start one. Everything here is saved in this browser as you type."
                  action={<Button variant="primary" size="sm" onClick={create}><Plus /> New draft</Button>}
                  className="flex-1"
                />
              )}
            </div>
            {/* One side column, rendered once: beside the editor on a wide screen, under it on a narrow one. */}
            <div className="min-h-0 border-t border-border xl:col-start-3 xl:row-start-1 xl:border-l xl:border-t-0">
              <SideColumn draft={draft} side={side} setSide={setSide} active={open} intent={intent} onIntentDone={() => setIntent(null)} />
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

function SideColumn({ draft, side, setSide, active, intent, onIntentDone }: { draft: Draft | null; side: "preview" | "tour"; setSide: (v: "preview" | "tour") => void; active: boolean; intent: "record" | "render" | "tour" | null; onIntentDone: () => void }) {
  const limit = useSettingValue<number>(s("charLimit"));
  const total = draft ? draft.posts.reduce((n, p) => n + weighedLength(p.text), 0) : 0;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Segmented size="xs" value={side} onChange={(v) => setSide(v as "preview" | "tour")} options={[{ value: "preview", label: "Preview", icon: <BarChart3 /> }, { value: "tour", label: "Tour", icon: <MonitorPlay /> }]} />
        <span className="flex-1" />
        {side === "preview" && draft ? <span className="num text-[10px] text-fg-faint">{draft.posts.length > 1 ? `${draft.posts.length} posts · ` : ""}{total} chars · limit {limit}</span> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {side === "preview" ? (
          draft ? <PreviewCard draft={draft} /> : <EmptyState icon={BarChart3} title="No draft to preview" className="py-10" />
        ) : (
          <TourPanel draft={draft} active={active && side === "tour"} intent={intent} onIntentDone={onIntentDone} />
        )}
      </div>
    </div>
  );
}

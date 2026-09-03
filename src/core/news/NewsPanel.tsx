"use client";
import * as React from "react";
import { AlertTriangle, Bell, BellOff, CheckCheck, CheckCircle2, ExternalLink, Pin, PinOff, Trash2, X, XCircle } from "lucide-react";
import { selectUnread, useNews } from "./store";
import { useUi } from "@/core/ui-state/store";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { fmtAge } from "@/core/lib/format";
import { Button } from "@/core/ui/button";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";
import { EmptyState } from "@/core/ui/empty-state";
import { VirtualList } from "@/core/ui/virtual-list";
import { useFlashOnChange } from "@/core/feedback/useFlashOnChange";
import { ctxProps } from "@/core/context-menu/ctx";
import type { Level, NewsItem } from "@/core/types";
import { SlideOver } from "@/core/shell/SlideOver";

const LEVEL_ICON = { info: Bell, success: CheckCircle2, warn: AlertTriangle, error: XCircle } as const;
const LEVEL_COLOR: Record<Level, string> = { info: "text-info", success: "text-up", warn: "text-warn", error: "text-down" };

function Row({ item, now }: { item: NewsItem; now: number }) {
  const { markRead, togglePin, dismiss } = useNews.getState();
  const ctx = useActions();
  const ref = useFlashOnChange(item.rev);
  const Icon = item.icon ?? LEVEL_ICON[item.level];
  return (
    <div
      ref={ref}
      {...ctxProps("news-item", item.id, item)}
      onMouseEnter={() => !item.read && markRead(item.id)}
      onClick={() => {
        markRead(item.id);
        if (item.href) ctx.navigate(item.href);
        else item.action?.onClick();
      }}
      className={cn(
        "group relative flex cursor-default items-start gap-2 border-b border-border px-3 py-2 transition-colors hover:bg-hover",
        (item.href || item.action) && "cursor-pointer",
      )}
    >
      <span className={cn("absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent transition-opacity", item.read ? "opacity-0" : "opacity-100")} />
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", LEVEL_COLOR[item.level])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-xs", item.read ? "text-fg-muted" : "font-medium text-fg")}>{item.title}</span>
          {item.count > 1 ? (
            <Tooltip content={`${item.count} updates folded into this line`}>
              <span className="num rounded-xs bg-elevated px-1 text-[10px] text-fg-muted">×{item.count}</span>
            </Tooltip>
          ) : null}
          {item.pinned ? <Pin className="size-3 text-accent" /> : null}
          <span className="num ml-auto shrink-0 text-[10px] text-fg-faint">{fmtAge(item.updatedAt, now)}</span>
        </div>
        {item.diff ? (
          <div className="num mt-0.5 flex items-center gap-1 text-[11px] text-fg-muted">
            <span className="text-fg-faint line-through">{item.diff.fromLabel}</span>
            <span className="text-fg-faint">→</span>
            <span className="text-fg">{item.diff.toLabel}</span>
          </div>
        ) : null}
        {item.body ? <div className="mt-0.5 line-clamp-2 text-[11px] text-fg-muted">{item.body}</div> : null}
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-fg-faint">
          <span>{item.source}</span>
          {item.href ? <ExternalLink className="size-2.5" /> : null}
        </div>
      </div>
      <div className="absolute right-2 top-1.5 hidden items-center gap-0.5 rounded-sm border border-border bg-panel p-0.5 group-hover:flex">
        <Button variant="ghost" size="iconXs" aria-label={item.pinned ? "Unpin" : "Pin"} onClick={(e) => (e.stopPropagation(), togglePin(item.id))}>
          {item.pinned ? <PinOff /> : <Pin />}
        </Button>
        <Button variant="ghost" size="iconXs" aria-label="Dismiss" sound="close" onClick={(e) => (e.stopPropagation(), dismiss(item.id))}>
          <X />
        </Button>
      </div>
    </div>
  );
}

export function NewsPanel() {
  const open = useUi((s) => s.panels.news);
  const closePanel = useUi((s) => s.closePanel);
  const items = useNews((s) => s.items);
  const unread = useNews(selectUnread);
  const dropped = useNews((s) => s.dropped);
  const { markAllRead, clear } = useNews.getState();
  const [level, setLevel] = React.useState("all");
  const [now, setNow] = React.useState(() => Date.now());
  const ctx = useActions();

  React.useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [open]);

  const filtered = React.useMemo(() => {
    const list = level === "all" ? items : items.filter((i) => i.level === level);
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [items, level]);

  return (
    <SlideOver
      open={open}
      onClose={() => closePanel("news")}
      title="News"
      subtitle={unread ? `${unread} unread` : "All caught up"}
      icon={Bell}
      actions={
        <>
          <Tooltip content="Mark all read">
            <Button variant="ghost" size="iconXs" onClick={markAllRead} disabled={!unread} aria-label="Mark all read">
              <CheckCheck />
            </Button>
          </Tooltip>
          <Tooltip content="Clear (keeps pinned)">
            <Button
              variant="ghost"
              size="iconXs"
              aria-label="Clear"
              onClick={() => void ctx.confirm({ title: "Clear the feed?", body: "Pinned lines are kept.", danger: true, confirmLabel: "Clear" }).then((ok) => ok && clear())}
              disabled={!items.length}
            >
              <Trash2 />
            </Button>
          </Tooltip>
        </>
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <Segmented
          size="xs"
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "All" },
            { value: "info", label: "Info" },
            { value: "success", label: "OK" },
            { value: "warn", label: "Warn" },
            { value: "error", label: "Error" },
          ]}
          aria-label="Filter by level"
        />
        {dropped > 0 ? (
          <Tooltip content="Events dropped by the per-source rate limit">
            <span className="num text-[10px] text-fg-faint">{dropped} dropped</span>
          </Tooltip>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <VirtualList
          items={filtered}
          getKey={(i) => i.id}
          estimateSize={64}
          renderItem={(i) => <Row item={i} now={now} />}
          empty={<EmptyState icon={BellOff} title="Nothing yet" body="Events, setting changes and alerts land here. Repeats fold into one line." />}
        />
      </div>
    </SlideOver>
  );
}

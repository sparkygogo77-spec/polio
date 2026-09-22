"use client";
import * as React from "react";
import { AlertTriangle, Bell, CheckCircle2, X, XCircle } from "lucide-react";
import { useToasts } from "./store";
import { useSettingValue } from "@/core/settings/useSetting";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { useFlashOnChange } from "@/core/feedback/useFlashOnChange";
import type { Level, ToastItem } from "@/core/types";

const LEVEL_ICON = { info: Bell, success: CheckCircle2, warn: AlertTriangle, error: XCircle } as const;
const LEVEL_COLOR: Record<Level, string> = { info: "text-info", success: "text-up", warn: "text-warn", error: "text-down" };
const LEVEL_STRIPE: Record<Level, string> = { info: "bg-info", success: "bg-up", warn: "bg-warn", error: "bg-down" };

function Toast({ t }: { t: ToastItem }) {
  const dismiss = useToasts((s) => s.dismissToast);
  const hold = useToasts((s) => s.holdToast);
  const release = useToasts((s) => s.releaseToast);
  const pauseOnHover = useSettingValue<boolean>("behaviour.pauseOnHover");
  const Icon = t.icon ?? LEVEL_ICON[t.level];
  const ref = useFlashOnChange(t.rev);
  const [hover, setHover] = React.useState(false);
  const total = Math.max(1, t.expiresAt - t.createdAt);
  return (
    <div
      ref={ref}
      role="status"
      onMouseEnter={() => { setHover(true); if (pauseOnHover) hold(t.id); }}
      onMouseLeave={() => { setHover(false); release(t.id); }}
      className="pointer-events-auto relative w-80 overflow-hidden rounded-md border border-border glass shadow-pop animate-toast-in"
    >
      <div className={cn("absolute inset-y-0 left-0 w-0.5", LEVEL_STRIPE[t.level])} />
      <div className="flex items-start gap-2 py-2 pl-3 pr-2">
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", LEVEL_COLOR[t.level])} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Somewhere to go — a commit, a live site — used to be reachable
                by clicking the feed row. There is no feed, so the card's own
                title is the link. */}
            {t.href ? (
              <a href={t.href} target="_blank" rel="noreferrer" className="truncate text-xs font-medium text-fg underline decoration-dotted underline-offset-2 hover:text-accent">
                {t.title}
              </a>
            ) : (
              <span className="truncate text-xs font-medium text-fg">{t.title}</span>
            )}
            {t.count > 1 ? <span className="num rounded-xs bg-elevated px-1 text-small text-fg-muted">×{t.count}</span> : null}
          </div>
          {t.diff ? <div className="num mt-0.5 text-plain text-fg-muted">{`${t.diff.fromLabel} → ${t.diff.toLabel}`}</div> : t.body ? <div className="mt-0.5 truncate text-plain text-fg-muted">{t.body}</div> : null}
          {t.action ? (
            <Button variant="link" size="xs" className="mt-1 h-auto" onClick={t.action.onClick}>
              {t.action.label}
            </Button>
          ) : null}
        </div>
        <Button variant="ghost" size="iconXs" aria-label="Dismiss" sound="close" onClick={() => dismiss(t.id)}>
          <X />
        </Button>
      </div>
      <div
        key={t.rev}
        className={cn("h-px bg-accent/60 origin-left", hover && pauseOnHover && "[animation-play-state:paused]")}
        style={{ animation: `toast-drain ${total}ms linear forwards` }}
      />
      <style>{`@keyframes toast-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const position = useSettingValue<string>("feed.toastPosition");
  const pos =
    position === "top-right"
      ? "top-[calc(var(--topbar-h)+8px)] right-3 items-end"
      : position === "top-left"
        ? "top-[calc(var(--topbar-h)+8px)] left-3 items-start"
        : position === "bottom-left"
          ? "bottom-2 left-3 items-start"
          : position === "bottom-center"
            ? "bottom-2 left-1/2 -translate-x-1/2 items-center"
            : "bottom-2 right-3 items-end";
  const bottom = position?.startsWith("bottom");
  return (
    <div className={cn("pointer-events-none fixed z-[65] flex flex-col gap-2", pos, bottom ? "flex-col-reverse" : "")}>
      {toasts.map((t) => (
        <Toast key={t.id} t={t} />
      ))}
    </div>
  );
}

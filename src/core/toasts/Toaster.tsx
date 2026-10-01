"use client";
import * as React from "react";
import { AlertTriangle, Bell, CheckCircle2, ChevronDown, ChevronUp, X, XCircle } from "lucide-react";
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
  /*
   * A LONG MESSAGE CAN BE OPENED. The body was one truncated line with no way
   * to read the rest — the import's report, a refusal's reason — and the one
   * control on the card, Dismiss, sat where anything else would have gone.
   * The card now has a column of its own on the right: Dismiss at the top,
   * Open below it, never over each other, and an open card holds still until
   * it is closed again (`tests/toast-reach.mjs`).
   */
  const [open, setOpen] = React.useState(false);
  const long = !!t.body && !t.diff && (t.body.length > 44 || t.body.includes("\n"));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) hold(t.id); else release(t.id);
  };
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
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-medium text-fg underline decoration-dotted underline-offset-2 hover:text-accent">
                {t.title}
              </a>
            ) : (
              <span className="truncate text-xs font-medium text-fg">{t.title}</span>
            )}
            {t.count > 1 ? <span className="num rounded-xs bg-elevated px-1 text-small text-fg-muted">×{t.count}</span> : null}
          </div>
          {t.diff ? <div className="num mt-0.5 text-plain text-fg-muted">{`${t.diff.fromLabel} → ${t.diff.toLabel}`}</div> : t.body ? (
            <div
              data-toast-body={open ? "open" : "closed"}
              className={cn("mt-0.5 text-plain text-fg-muted", open ? "max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words" : "truncate", long && !open && "cursor-pointer")}
              onClick={long && !open ? toggle : undefined}
              title={long && !open ? "Open the whole message" : undefined}
            >
              {t.body}
            </div>
          ) : null}
          {t.action ? (
            <Button variant="link" size="xs" className="mt-1 h-auto" onClick={t.action.onClick}>
              {t.action.label}
            </Button>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <Button variant="ghost" size="iconXs" aria-label="Dismiss" data-toast-dismiss="" sound="close" onClick={() => dismiss(t.id)}>
            <X />
          </Button>
          {long ? (
            <Button variant="ghost" size="iconXs" aria-label={open ? "Close the message" : "Open the whole message"} aria-expanded={open} data-toast-expand="" onClick={toggle}>
              {open ? <ChevronUp /> : <ChevronDown />}
            </Button>
          ) : null}
        </div>
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
  /*
   * CLEAR OF WHAT IS ALREADY IN THE CORNER. The Builder keeps its phone
   * preview in the bottom-right corner, and a toast there sat over the
   * preview's own Expand button: a press meant for one hit the other's
   * Dismiss. When a corner window is there, the toasts stand above it.
   */
  const lift = useCornerLift(bottom && position !== "bottom-left" && position !== "bottom-center" && toasts.length > 0);
  return (
    <div data-toaster="" className={cn("pointer-events-none fixed z-[65] flex flex-col gap-2", pos, bottom ? "flex-col-reverse" : "")} style={lift ? { bottom: lift } : undefined}>
      {toasts.map((t) => (
        <Toast key={t.id} t={t} />
      ))}
    </div>
  );
}

/** How far above the bottom edge the toasts stand to clear a corner window (`[data-preview-window]`), or null. */
function useCornerLift(on: boolean): number | null {
  const [lift, setLift] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!on) { setLift(null); return; }
    const read = () => {
      const w = document.querySelector("[data-preview-window]") as HTMLElement | null;
      const r = w?.getBoundingClientRect();
      /* Only a window that reaches the right-hand third of the screen is in the toasts' way. */
      const next = r && r.width > 0 && r.right > window.innerWidth * 0.66 && r.bottom > window.innerHeight - 200 ? Math.round(window.innerHeight - r.top + 8) : null;
      setLift((was) => (was === next ? was : next));
    };
    read();
    const id = window.setInterval(read, 400);
    window.addEventListener("resize", read);
    return () => { window.clearInterval(id); window.removeEventListener("resize", read); };
  }, [on]);
  return lift;
}

"use client";
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { formatShortcut } from "@/core/lib/keys";
import { isMac } from "@/core/lib/env";

const noopSubscribe = () => () => {};

/**
 * The server has no platform, so it always renders the non-mac form and the
 * client corrects it after hydration. Doing this through useSyncExternalStore
 * keeps the hydration pass itself consistent instead of warning.
 */
function useIsMac() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => isMac(),
    () => false,
  );
}

/** Renders a shortcut spec ("mod+k") as key caps. Pass `raw` to skip formatting. */
export function Kbd({ children, className, raw }: { children: React.ReactNode; className?: string; raw?: boolean }) {
  const mac = useIsMac();
  const text = typeof children === "string" && !raw ? formatShortcut(children, mac) : children;
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-border bg-elevated px-1 text-[10px] font-medium text-fg-muted shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {text}
    </kbd>
  );
}

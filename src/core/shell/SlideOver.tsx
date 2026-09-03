"use client";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";

/** Right-hand panel that sits between the top bar and status bar. */
export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  if (!open) return null;
  return (
    <aside
      className={cn(
        "fixed right-0 z-[55] flex flex-col border-l border-border glass shadow-panel animate-slide-in-right",
        "top-(--topbar-h) bottom-(--statusbar-h) w-[min(var(--panel-w),100vw)]",
        className,
      )}
      style={width ? { width } : undefined}
      role="dialog"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        {Icon ? <Icon className="size-4 text-accent" /> : null}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-semibold text-fg">{title}</div>
          {subtitle ? <div className="truncate text-[10px] text-fg-muted">{subtitle}</div> : null}
        </div>
        {actions}
        <Button variant="ghost" size="iconXs" aria-label="Close" sound="close" onClick={onClose}>
          <X />
        </Button>
      </header>
      {children}
    </aside>
  );
}

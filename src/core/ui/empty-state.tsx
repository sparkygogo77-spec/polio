import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/core/lib/cn";

export function EmptyState({ icon: Icon, title, body, action, className }: { icon?: LucideIcon; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center", className)}>
      {Icon ? (
        <div className="flex size-9 items-center justify-center rounded-md border border-border bg-elevated text-fg-muted">
          <Icon className="size-4" />
        </div>
      ) : null}
      <div className="text-xs font-medium text-fg">{title}</div>
      {body ? <div className="max-w-xs text-[11px] text-fg-muted">{body}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

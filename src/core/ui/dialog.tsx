"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, size = "md", className }: DialogProps) {
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : size === "xl" ? "max-w-5xl" : "max-w-md";
  return (
    <D.Root
      open={open}
      onOpenChange={(v) => {
        play(v ? "open" : "close");
        onOpenChange(v);
      }}
    >
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[75] bg-overlay animate-fade-in backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[76] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-panel shadow-panel animate-pop outline-none",
            width,
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <D.Title className="text-sm font-semibold text-fg">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-xs text-fg-muted">{description}</D.Description> : null}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="iconXs" aria-label="Close" sound="close">
                <X />
              </Button>
            </D.Close>
          </div>
          {children ? <div className="px-4 py-3 text-xs">{children}</div> : null}
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

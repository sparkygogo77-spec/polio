"use client";
import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { Kbd } from "./kbd";
import { useSettingValue } from "@/core/settings/useSetting";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
    </T.Provider>
  );
}

export interface TooltipProps {
  content: React.ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  children: React.ReactElement;
  className?: string;
  disabled?: boolean;
}

export function Tooltip({ content, shortcut, side = "top", align = "center", children, className, disabled }: TooltipProps) {
  const hints = useSettingValue<boolean>("keyboard.hints");
  if (disabled || !content) return children;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-[80] flex max-w-xs items-center gap-2 rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-fg shadow-pop animate-pop select-none",
            className,
          )}
        >
          <span>{content}</span>
          {shortcut && hints ? <Kbd>{shortcut}</Kbd> : null}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

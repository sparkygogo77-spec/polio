"use client";
import * as React from "react";
import { Popover as P } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";

export interface PopoverProps {
  children: React.ReactElement;
  content: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  title?: React.ReactNode;
}

export function Popover({ children, content, align = "start", side = "bottom", className, open, onOpenChange, title }: PopoverProps) {
  return (
    <P.Root
      open={open}
      onOpenChange={(v) => {
        play(v ? "open" : "close");
        onOpenChange?.(v);
      }}
    >
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          /*
           * A popover never taller than the room it has.
           *
           * Radix will flip and shift to keep a panel on screen, but it will
           * not shrink one: content taller than the window stays its full
           * height and hangs off an edge. The repository panel is 428px of
           * sections and was the one that found this. `available-height` is
           * the room between the trigger and the far edge, minus the
           * collision padding, so the panel takes what there is and scrolls
           * the rest. Anything that already fits is untouched.
           */
          style={{ maxHeight: "var(--radix-popover-content-available-height)" }}
          className={cn("no-bars z-[70] w-72 overflow-y-auto rounded-md border border-border glass p-3 text-xs text-fg shadow-pop animate-pop outline-none", className)}
        >
          {title ? <div className="mb-2 text-small font-medium uppercase tracking-wider text-fg-faint">{title}</div> : null}
          {content}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

"use client";
import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { Kbd } from "./kbd";
import { useSettingValue } from "@/core/settings/useSetting";

/**
 * LABELS, NOT LITTLE PANELS: `disableHoverableContent`. With it on, Radix
 * keeps a "grace area" between an open tooltip and its trigger so the
 * pointer can travel onto the content, and while the pointer is inside
 * that area no other trigger may open. Running along a row of chips (the
 * import's counts, J 2026-10-06) every second chip stayed silent: the move
 * from one chip to the next crossed the last one's grace area. Nothing in
 * a tooltip here is meant to be pointed at, so there is no area to keep.
 */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={350} skipDelayDuration={200} disableHoverableContent>
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

/**
 * A tooltip that can be wrapped by something else that needs the same node.
 *
 * WHY IT FORWARDS A REF, which is not decoration. Radix's `asChild` triggers
 * — Popover, DropdownMenu, Tooltip itself — work by cloning their single
 * child and putting their own props and a **ref** on it, because the ref is
 * how the floating thing finds the element to position against. So a control
 * that is both a popover trigger and a tooltip trigger is written nested:
 *
 *     <Popover><Tooltip><Button/></Tooltip></Popover>
 *
 * and the Popover's trigger hands its props and ref to `Tooltip`. This was a
 * plain function component, so the ref went nowhere: it was not forwarded to
 * `T.Trigger`, so it never reached the Button, so the Popover had **no anchor
 * to measure**.
 *
 * MEASURED, before this: the repository panel behind the GitHub icon opened
 * at top -855 and bottom -428 — entirely above the window, all 15 of its rows
 * off screen, the Make button unreachable — and at exactly the same place in
 * a 900px window as in a 420px one, which is the tell. A panel that is too
 * tall drifts with the viewport; a panel with no anchor lands in the same
 * wrong place every time.
 *
 * So the incoming props and ref go onto `T.Trigger`, whose own `asChild`
 * merges them the rest of the way down onto the Button. Both triggers then
 * point at one element, which is what the nesting was always claiming.
 */
export const Tooltip = React.forwardRef<HTMLElement, TooltipProps & React.HTMLAttributes<HTMLElement>>(function Tooltip(
  { content, shortcut, side = "top", align = "center", children, className, disabled, ...rest },
  ref,
) {
  const hints = useSettingValue<boolean>("keyboard.hints");
  /* No tooltip to show, and still the only thing standing between whatever
     wrapped this and the element — so the props and the ref still have to go
     through. Returning `children` untouched is what used to drop them. */
  if (disabled || !content) {
    return React.cloneElement(children, { ...rest, ref } as React.Attributes);
  }
  return (
    <T.Root>
      <T.Trigger asChild {...rest} ref={ref as React.Ref<HTMLButtonElement>}>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-[80] flex max-w-xs items-center gap-2 rounded-md border border-border bg-panel px-2 py-1 text-plain text-fg shadow-pop animate-pop select-none",
            className,
          )}
        >
          <span>{content}</span>
          {shortcut && hints ? <Kbd>{shortcut}</Kbd> : null}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
});

"use client";
import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { getSetting } from "@/core/settings/store";
import type { CueName } from "@/core/types";
import { Kbd } from "./kbd";

export const buttonVariants = cva(
  "tactile relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none rounded-md border font-medium leading-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-elevated border-border text-fg hover:bg-hover hover:border-border-strong",
        primary:
          "bg-accent text-accent-fg border-transparent hover:bg-accent-strong shadow-[0_0_0_1px_var(--accent-soft),0_0_18px_-8px_var(--accent)]",
        ghost: "bg-transparent border-transparent text-fg-muted hover:text-fg hover:bg-hover",
        outline: "bg-transparent border-border text-fg hover:bg-hover hover:border-border-strong",
        subtle: "bg-accent-soft border-transparent text-accent hover:bg-accent/25",
        danger: "bg-down/12 border-down/30 text-down hover:bg-down/22",
        up: "bg-up/12 border-up/30 text-up hover:bg-up/22",
        link: "bg-transparent border-transparent text-accent underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        xs: "h-6 px-1.5 text-[11px] rounded-sm gap-1 [&_svg]:size-3",
        sm: "h-7 px-2 text-xs [&_svg]:size-3.5",
        md: "h-8 px-3 text-xs [&_svg]:size-3.5",
        lg: "h-9 px-4 text-sm [&_svg]:size-4",
        icon: "size-7 p-0 [&_svg]:size-3.5",
        iconXs: "size-6 p-0 rounded-sm [&_svg]:size-3",
        iconLg: "size-9 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Cue on press. Defaults to "tap"; `false` for silent. */
  sound?: CueName | false;
  /** Vibrate on press where supported. */
  haptics?: boolean;
  loading?: boolean;
  /** Shortcut hint rendered at the right edge (display only). */
  shortcut?: string;
  /** Show a done state for ~900ms after click (optimistic feedback). */
  optimistic?: boolean;
  doneLabel?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, sound = "tap", haptics = true, loading, shortcut, optimistic, doneLabel, children, onPointerDown, onPointerEnter, onKeyDown, onClick, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  const [done, setDone] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const feedback = React.useCallback(() => {
    if (sound) play(sound);
    if (haptics) haptic();
  }, [sound, haptics]);

  // Slot needs exactly one child, so `asChild` forwards the caller's element
  // untouched: loading spinners and shortcut hints are for real buttons only.
  const content = asChild ? (
    children
  ) : (
    <>
      {loading ? <Loader2 className="animate-spin" /> : null}
      {done && doneLabel !== undefined ? doneLabel : children}
      {shortcut && getSetting<boolean>("keyboard.hints") ? <Kbd className="ml-1 -mr-1 opacity-70">{shortcut}</Kbd> : null}
    </>
  );

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      data-done={done || undefined}
      // The hover tick, off by default; the engine gates it on the setting.
      onPointerEnter={(e) => { onPointerEnter?.(e); play("hover"); }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (!e.defaultPrevented && !disabled && !loading && e.button === 0) feedback();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented && (e.key === "Enter" || e.key === " ") && !e.repeat) feedback();
      }}
      onClick={(e) => {
        onClick?.(e);
        if (optimistic && !e.defaultPrevented && getSetting<boolean>("feedback.optimistic")) {
          setDone(true);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setDone(false), 900);
        }
      }}
      {...props}
    >
      {content}
    </Comp>
  );
});

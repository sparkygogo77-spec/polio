"use client";
import * as React from "react";
import { cn } from "@/core/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with the content instead of scrolling. */
  autoGrow?: boolean;
  mono?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow, mono, onInput, rows = 3, ...props },
  ref,
) {
  const inner = React.useRef<HTMLTextAreaElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [ref],
  );

  const grow = React.useCallback(() => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow]);

  React.useEffect(grow, [grow, props.value]);

  return (
    <textarea
      ref={setRefs}
      rows={rows}
      onInput={(e) => {
        grow();
        onInput?.(e);
      }}
      className={cn(
        "w-full resize-y rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-fg outline-none transition-colors placeholder:text-fg-faint hover:border-border-strong focus:border-accent focus:shadow-[0_0_0_2px_var(--accent-soft)] disabled:opacity-45",
        autoGrow && "resize-none overflow-hidden",
        mono && "font-mono",
        className,
      )}
      {...props}
    />
  );
});

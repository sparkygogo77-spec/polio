"use client";
import * as React from "react";
import { cn } from "@/core/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  left?: React.ReactNode;
  right?: React.ReactNode;
  mono?: boolean;
  inputSize?: "sm" | "md";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, left, right, mono, inputSize = "sm", ...props }, ref) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 text-xs text-fg transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_2px_var(--accent-soft)] hover:border-border-strong",
        inputSize === "sm" ? "h-7" : "h-8",
        props.disabled && "opacity-45",
        className,
      )}
    >
      {left ? <span className="flex shrink-0 items-center text-fg-muted [&_svg]:size-3.5">{left}</span> : null}
      <input
        ref={ref}
        className={cn("h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-faint", mono && "font-mono")}
        {...props}
      />
      {right ? <span className="flex shrink-0 items-center text-fg-muted">{right}</span> : null}
    </div>
  );
});

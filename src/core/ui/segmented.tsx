"use client";
import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps {
  value: string;
  onChange: (v: string) => void;
  options: SegmentedOption[];
  size?: "xs" | "sm" | "md";
  className?: string;
  silent?: boolean;
  "aria-label"?: string;
}

/** Single-choice control that reads like a terminal timeframe picker. */
export function Segmented({ value, onChange, options, size = "sm", className, silent, ...rest }: SegmentedProps) {
  const h = size === "xs" ? "h-6" : size === "sm" ? "h-7" : "h-8";
  const text = size === "xs" ? "text-[11px] px-1.5" : size === "sm" ? "text-xs px-2" : "text-xs px-3";
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (!v) return;
        if (!silent) play("select");
        onChange(v);
      }}
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5", h, className)}
      aria-label={rest["aria-label"]}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "tactile inline-flex h-full items-center gap-1 rounded-sm font-medium text-fg-muted hover:text-fg data-[state=on]:bg-panel data-[state=on]:text-fg data-[state=on]:shadow-[0_1px_0_var(--border)] disabled:opacity-45 [&_svg]:size-3.5",
            text,
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

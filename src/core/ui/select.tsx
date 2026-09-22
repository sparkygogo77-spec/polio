"use client";
import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import type { SettingOption } from "@/core/types";

export interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SettingOption[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  "aria-label"?: string;
}

export function Select({ value, onChange, options, placeholder, className, size = "sm", disabled, ...rest }: SelectProps) {
  return (
    <S.Root
      value={value}
      onValueChange={(v) => {
        play("select");
        onChange(v);
      }}
      onOpenChange={(v) => play(v ? "open" : "close")}
      disabled={disabled}
    >
      <S.Trigger
        aria-label={rest["aria-label"]}
        className={cn(
          "tactile inline-flex items-center justify-between gap-2 rounded-md border border-border bg-elevated px-2 text-xs text-fg hover:border-border-strong disabled:opacity-45 data-[placeholder]:text-fg-faint",
          size === "sm" ? "h-7" : "h-8",
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="size-3.5 text-fg-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-[70] min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-border glass p-1 text-xs shadow-pop animate-pop">
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex h-[26px] cursor-default select-none items-center rounded-sm pl-6 pr-2 outline-none data-[highlighted]:bg-hover data-[disabled]:opacity-40"
              >
                <S.ItemIndicator className="absolute left-1.5 inline-flex">
                  <Check className="size-3.5 text-accent" />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
                {o.description ? <span className="ml-2 text-small text-fg-faint">{o.description}</span> : null}
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

"use client";
import * as React from "react";
import { Switch as S } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof S.Root> {
  size?: "sm" | "md";
  silent?: boolean;
}

export const Switch = React.forwardRef<React.ComponentRef<typeof S.Root>, SwitchProps>(function Switch(
  { className, size = "md", silent, onCheckedChange, ...props },
  ref,
) {
  const dims = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const thumb = size === "sm" ? "size-3 data-[state=checked]:translate-x-3" : "size-4 data-[state=checked]:translate-x-4";
  return (
    <S.Root
      ref={ref}
      className={cn(
        "tactile relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-active p-0.5 data-[state=checked]:bg-accent disabled:opacity-45 disabled:cursor-not-allowed",
        dims,
        className,
      )}
      onCheckedChange={(v) => {
        if (!silent) play(v ? "toggleOn" : "toggleOff");
        haptic();
        onCheckedChange?.(v);
      }}
      {...props}
    >
      <S.Thumb
        className={cn(
          "block rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.4)] transition-transform duration-(--motion-base) ease-out translate-x-0",
          thumb,
        )}
      />
    </S.Root>
  );
});

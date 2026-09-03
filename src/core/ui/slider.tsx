"use client";
import * as React from "react";
import { Slider as S } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";

export interface SliderProps extends React.ComponentPropsWithoutRef<typeof S.Root> {
  /** Render the current value to the right. */
  readout?: (v: number) => string;
  silent?: boolean;
}

export const Slider = React.forwardRef<React.ComponentRef<typeof S.Root>, SliderProps>(function Slider(
  { className, readout, silent, onValueChange, value, defaultValue, ...props },
  ref,
) {
  const current = value ?? defaultValue ?? [0];
  return (
    <div className={cn("flex w-full items-center gap-3", className)}>
      <S.Root
        ref={ref}
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={value}
        defaultValue={defaultValue}
        onValueChange={(v) => {
          if (!silent) play("tick");
          onValueChange?.(v);
        }}
        {...props}
      >
        <S.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-active">
          <S.Range className="absolute h-full bg-accent" />
        </S.Track>
        {current.map((_, i) => (
          <S.Thumb
            key={i}
            className="tactile block size-3.5 rounded-full border border-border-strong bg-fg shadow-[0_1px_3px_oklch(0_0_0/0.4)] hover:scale-110 focus-visible:outline-2"
          />
        ))}
      </S.Root>
      {readout ? <span className="num w-12 shrink-0 text-right text-[11px] text-fg-muted">{readout(current[0] ?? 0)}</span> : null}
    </div>
  );
});

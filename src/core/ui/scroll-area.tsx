"use client";
import * as React from "react";
import { ScrollArea as S } from "radix-ui";
import { cn } from "@/core/lib/cn";

export function ScrollArea({ className, children, viewportClassName, ...props }: React.ComponentPropsWithoutRef<typeof S.Root> & { viewportClassName?: string }) {
  return (
    <S.Root className={cn("relative overflow-hidden", className)} {...props}>
      <S.Viewport className={cn("size-full rounded-[inherit] [&>div]:block!", viewportClassName)}>{children}</S.Viewport>
      <S.Scrollbar orientation="vertical" className="flex w-2 touch-none select-none p-px">
        <S.Thumb className="relative flex-1 rounded-full bg-[var(--scrollbar)]" />
      </S.Scrollbar>
      <S.Scrollbar orientation="horizontal" className="flex h-2 touch-none select-none flex-col p-px">
        <S.Thumb className="relative flex-1 rounded-full bg-[var(--scrollbar)]" />
      </S.Scrollbar>
      <S.Corner />
    </S.Root>
  );
}

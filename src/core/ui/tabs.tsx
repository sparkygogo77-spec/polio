"use client";
import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";

export const Tabs = T.Root;

export const TabsList = React.forwardRef<React.ComponentRef<typeof T.List>, React.ComponentPropsWithoutRef<typeof T.List>>(
  function TabsList({ className, ...props }, ref) {
    return <T.List ref={ref} className={cn("inline-flex h-8 items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5", className)} {...props} />;
  },
);

export const TabsTrigger = React.forwardRef<React.ComponentRef<typeof T.Trigger>, React.ComponentPropsWithoutRef<typeof T.Trigger>>(
  function TabsTrigger({ className, onPointerDown, ...props }, ref) {
    return (
      <T.Trigger
        ref={ref}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          play("select");
        }}
        className={cn(
          "tactile inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 text-xs font-medium text-fg-muted hover:text-fg data-[state=active]:bg-panel data-[state=active]:text-fg data-[state=active]:shadow-[0_1px_0_var(--border)] disabled:opacity-45",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TabsContent = React.forwardRef<React.ComponentRef<typeof T.Content>, React.ComponentPropsWithoutRef<typeof T.Content>>(
  function TabsContent({ className, ...props }, ref) {
    return <T.Content ref={ref} className={cn("mt-3 animate-fade-in outline-none", className)} {...props} />;
  },
);

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/core/lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] font-medium leading-4 whitespace-nowrap num", {
  variants: {
    variant: {
      default: "bg-elevated border-border text-fg-muted",
      accent: "bg-accent-soft border-accent/30 text-accent",
      up: "bg-up/12 border-up/30 text-up",
      down: "bg-down/12 border-down/30 text-down",
      warn: "bg-warn/12 border-warn/30 text-warn",
      info: "bg-info/12 border-info/30 text-info",
      outline: "bg-transparent border-border-strong text-fg",
      solid: "bg-accent border-transparent text-accent-fg",
    },
    size: { sm: "text-[10px] px-1 py-0", md: "", lg: "text-xs px-2 py-0.5" },
  },
  defaultVariants: { variant: "default", size: "md" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

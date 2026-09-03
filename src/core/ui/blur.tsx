"use client";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { useSetting } from "@/core/settings/useSetting";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

/** Wrap sensitive numbers. Blurs when privacy.blur is on (or `force`). Hover reveals. */
export function Blur({ children, className, force, as: Tag = "span" }: { children: React.ReactNode; className?: string; force?: boolean; as?: "span" | "div" }) {
  return (
    <Tag className={cn("blurrable", force && "blur-[6px] hover:blur-0 transition-[filter]", className)}>{children}</Tag>
  );
}

/** Eye toggle bound to the global privacy.blur setting. */
export function BlurToggle({ className }: { className?: string }) {
  const [on, set] = useSetting<boolean>("privacy.blur");
  return (
    <Tooltip content={on ? "Reveal amounts" : "Blur amounts"} shortcut="mod+shift+b">
      <Button variant="ghost" size="iconXs" className={className} onClick={() => set(!on)} aria-pressed={on} aria-label="Toggle blur">
        {on ? <EyeOff /> : <Eye />}
      </Button>
    </Tooltip>
  );
}

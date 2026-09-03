"use client";
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";
import { useActions } from "@/core/actions";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  text: string;
  /** Label used in the toast, e.g. "Contract address". */
  label?: string;
  children?: React.ReactNode;
  tooltip?: string;
}

/** One-click copy with instant check-mark feedback and a coalesced toast. */
export function CopyButton({ text, label, children, className, size = "iconXs", variant = "ghost", tooltip = "Copy", ...props }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const actions = useActions();
  const timer = React.useRef<number | null>(null);
  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return (
    <Tooltip content={copied ? "Copied" : tooltip}>
      <Button
        variant={variant}
        size={size}
        sound="copy"
        className={cn(copied && "text-up", className)}
        onClick={(e) => {
          e.stopPropagation();
          void actions.copy(text, label);
          setCopied(true);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1200);
        }}
        aria-label={tooltip}
        {...props}
      >
        {copied ? <Check /> : <Copy />}
        {children}
      </Button>
    </Tooltip>
  );
}

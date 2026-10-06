"use client";

import * as React from "react";
import { cn } from "@/core/lib/cn";
import { splitHint } from "./split-hint";

export { splitHint };

/**
 * An explanation cut to its first sentence, with a "?" that shows the rest.
 *
 * The Look tab was a wall of paragraphs: every section opened with three
 * lines saying how it works. The first sentence is what the section is; the
 * rest is for when you ask. Text that is one sentence already shows as it
 * is, with no "?". `tests/decide-count.mjs`.
 */
export interface MoreHintProps extends Omit<React.HTMLAttributes<HTMLParagraphElement>, "children"> {
  text: string;
}

export function MoreHint({ text, className, ...props }: MoreHintProps) {
  return (
    <p className={className} {...props}>
      <MoreHintSpan text={text} />
    </p>
  );
}

/** For hints that are not their own paragraph (a checkbox's line under its name). */
export function MoreHintSpan({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [lead, rest] = splitHint(text);
  return (
    <span data-more-hint={open ? "open" : rest ? "shut" : "whole"} className={cn(className)}>
      {lead}
      {rest ? (
        <>
          {open ? <> {rest}</> : null}
          <button
            type="button"
            data-more-hint-toggle=""
            aria-expanded={open}
            aria-label={open ? "Show less" : "Tell me more"}
            title={open ? "Show less" : "Tell me more"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
            className="ml-1 inline-flex size-3.5 items-center justify-center rounded-full border border-border align-[-1px] text-[9px] font-bold leading-none text-fg-muted hover:border-border-strong hover:text-fg"
          >
            {open ? "−" : "?"}
          </button>
        </>
      ) : null}
    </span>
  );
}

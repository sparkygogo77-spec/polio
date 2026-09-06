"use client";
/**
 * One screen, and then out of the way.
 *
 * The old landing page was a scroll of feature cards nobody read twice. What
 * someone actually wants on arriving is the door to the Builder and a way to
 * see what changed since they were last here, so that is all this is: the
 * pitch in a sentence, the door, and the updates panel one click away.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRight, LayoutTemplate, Sparkles } from "lucide-react";
import site from "@site";
import { useUi } from "@/core/ui-state/store";
import { Button } from "@/core/ui/button";
import { Kbd } from "@/core/ui/kbd";
import { ctxProps } from "@/core/context-menu/ctx";
import { RELEASES, CURRENT } from "@/features/updates/changelog";

export function HomePage() {
  const openPanel = useUi((s) => s.openPanel);
  const latest = RELEASES[0]!;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-10" {...ctxProps("home", "page", null)}>
      <div className="w-full max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel/60 px-2.5 py-1 text-[11px] text-fg-muted">
          <Sparkles className="size-3 text-accent" />
          <span className="num">v{CURRENT}</span>
          <span className="text-fg-faint">·</span>
          {latest.title}
        </span>

        <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">
          {site.home.hero.title}
        </h1>
        <p className="mt-3 max-w-xl text-balance text-sm leading-relaxed text-fg-muted">
          Lay a page out at real size, say what each part is for, and hand the whole thing to a model as a
          blueprint it can build from. Where you put something is part of the specification.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button asChild size="md">
            <Link href="/builder">
              <LayoutTemplate />
              Open the Builder
              <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" size="md" onClick={() => openPanel("updates")}>
            <Sparkles />
            What&rsquo;s new
          </Button>
          <span className="text-[11px] text-fg-faint">
            or press <Kbd>u</Kbd>
          </span>
        </div>

        {/* The most recent additions, as a taste of the panel rather than a copy of it. */}
        <ul className="mt-8 space-y-1.5 border-t border-border pt-5">
          {latest.added.slice(0, 3).map((line) => (
            <li key={line} className="flex gap-2 text-[12px] leading-snug text-fg-muted">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" />
              {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => openPanel("updates")}
          className="mt-3 text-[11px] text-accent hover:underline"
        >
          Everything that changed →
        </button>
      </div>
    </div>
  );
}

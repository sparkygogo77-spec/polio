"use client";
/**
 * The swap, in the top bar.
 *
 * The Builds page is where a site is named, pointed at a repository and
 * thrown away. None of that is what you want mid-edit: mid-edit you want the
 * other site, now, without leaving the canvas. So the same list comes down as
 * a small popup — every site, the open one marked, one press to swap — with
 * the page one line away for everything else.
 */
import * as React from "react";
import Link from "next/link";
import { Check, FolderGit2, Layers, Plus } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Popover } from "@/core/ui/popover";
import { cn } from "@/core/lib/cn";
import { fmtAge } from "@/core/lib/format";
import { useBuilds } from "./store";

export function SwitchButton() {
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    void useBuilds.persist.rehydrate()?.then?.(() => useBuilds.getState().adopt());
  }, []);

  const active = projects.find((p) => p.id === activeId) ?? null;
  // One site is not a switcher. The button appears when there is something to
  // switch to, and the Builds page is still there for the first one.
  if (projects.length < 2) return null;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-64 bg-panel p-1.5"
      content={
        <>
          <div className="px-1.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-faint">Sites</div>
          <ul className="max-h-72 overflow-y-auto">
            {projects.map((p) => {
              const on = p.id === activeId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { if (!on) useBuilds.getState().open(p.id); setOpen(false); }}
                    className={cn(
                      "tactile flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left",
                      on ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
                    )}
                  >
                    <span className="flex size-3.5 shrink-0 items-center justify-center text-accent">
                      {on ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{p.name}</span>
                      <span className="block truncate text-[10px] text-fg-faint">
                        {p.repo ? `${p.repo.owner}/${p.repo.name}` : "no repository"}
                        {on ? "" : ` · ${fmtAge(p.updatedAt)} ago`}
                      </span>
                    </span>
                    {p.repo ? <FolderGit2 className="size-3 shrink-0 text-fg-faint" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center gap-1 border-t border-border pt-1.5">
            <Button size="xs" variant="ghost" className="flex-1 justify-start" onClick={() => { useBuilds.getState().create(); setOpen(false); }}>
              <Plus />
              New site
            </Button>
            <Button asChild size="xs" variant="ghost" onClick={() => setOpen(false)}>
              {/* /builds, not /: once a site is published "/" redirects to
                  /site before the router ever sees it, and this has to keep
                  working from inside a published site's own Builder. */}
              <Link href="/builds">All builds</Link>
            </Button>
          </div>
        </>
      }
    >
      <Button variant="ghost" size="sm" className="max-w-40 gap-1.5" aria-label="Switch site">
        <Layers />
        <span className="truncate">{active?.name ?? "Sites"}</span>
      </Button>
    </Popover>
  );
}

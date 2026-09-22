"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, ExternalLink } from "lucide-react";
import site from "@site";
import { registry, resolveRoute } from "@/core/registry";
import { useUi } from "@/core/ui-state/store";
import { useSettingValue } from "@/core/settings/useSetting";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Tooltip } from "@/core/ui/tooltip";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";

export function Sidebar() {
  const pathname = usePathname();
  const mode = useSettingValue<string>("appearance.sidebar");
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);
  const route = resolveRoute(pathname);
  if (mode === "hidden" || route?.route.fullBleed) return null;
  const rail = mode === "collapsible" && collapsed;
  const entries = registry.nav.filter((n) => n.placement !== "top");
  // A rail with nothing on it is a stripe of chrome down the side of the
  // window that does nothing: when no module asks for a side entry, there is
  // no sidebar, and the page has the width.
  if (!entries.length) return null;
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const g = e.group ?? "";
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }

  return (
    <aside
      className={cn("relative z-[50] hidden shrink-0 flex-col border-r border-border bg-panel/60 transition-[width] duration-(--motion-base) md:flex", rail ? "w-(--rail-w)" : "w-(--sidebar-w)")}
      aria-label="Sidebar"
    >
      <nav className="flex-1 overflow-y-auto p-1.5">
        {[...groups.entries()].map(([g, list]) => (
          <div key={g} className="mb-2">
            {g && !rail ? <div className="px-2 pb-1 pt-2 text-small font-medium uppercase tracking-wider text-fg-faint">{g}</div> : null}
            {list.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              const Icon = n.icon;
              const link = (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => play("navigate")}
                  className={cn(
                    "tactile relative flex h-8 items-center gap-2 rounded-md px-2 text-xs text-fg-muted hover:bg-hover hover:text-fg",
                    active && "bg-accent-soft text-fg",
                    rail && "justify-center px-0",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={cn("absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent transition-opacity", active ? "opacity-100" : "opacity-0")} />
                  {Icon ? <Icon className={cn("size-4 shrink-0", active && "text-accent")} /> : <span className="size-4" />}
                  {!rail ? <span className="flex-1 truncate">{n.label}</span> : null}
                  {!rail && n.badge ? (
                    <Badge variant="accent" size="sm">
                      {n.badge}
                    </Badge>
                  ) : null}
                </Link>
              );
              return rail ? (
                <Tooltip key={n.href} content={n.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>
      <div className={cn("flex items-center gap-1 border-t border-border p-1.5", rail ? "flex-col" : "")}>
        {!rail
          ? site.links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noreferrer" : undefined}
                className="tactile flex h-6 items-center gap-1 rounded-sm px-1.5 text-small text-fg-faint hover:bg-hover hover:text-fg"
              >
                {l.label}
                {l.external ? <ExternalLink className="size-2.5" /> : null}
              </a>
            ))
          : null}
        {mode === "collapsible" ? (
          <Tooltip content={rail ? "Expand" : "Collapse"} side="right">
            <Button variant="ghost" size="iconXs" className="ml-auto" aria-label="Toggle sidebar width" onClick={() => setCollapsed(!collapsed)}>
              {rail ? <ChevronsRight /> : <ChevronsLeft />}
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </aside>
  );
}

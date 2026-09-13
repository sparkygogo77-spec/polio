"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Moon, Search, Settings, Sun, Volume2, VolumeX } from "lucide-react";
import { registry, resolveRoute } from "@/core/registry";
import { useActions } from "@/core/actions";
import { useUi } from "@/core/ui-state/store";
import { selectUnread, useNews } from "@/core/news/store";
import { useSetting, useSettingValue } from "@/core/settings/useSetting";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { Kbd } from "@/core/ui/kbd";
import { Badge } from "@/core/ui/badge";

export function TopBar() {
  const pathname = usePathname();
  const ctx = useActions();
  const unread = useNews(selectUnread);
  const panels = useUi((s) => s.panels);
  const [sound, setSound] = useSetting<boolean>("audio.enabled");
  const [mode, setMode] = useSetting<string>("appearance.mode");
  const topTabs = useSettingValue<boolean>("appearance.topTabs");
  const tabs = registry.nav.filter((n) => n.placement !== "side");
  const ownSearch = !!resolveRoute(pathname)?.route.ownSearch;
  const dark = mode !== "light";

  return (
    <header className="relative z-[56] flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-border glass px-2">
      {/*
        No wordmark.
        
        It sat top left saying the name of the tool you were already inside,
        beside a tab row that has gone and above a bar that says which site is
        open. The way home is the Builds button at the head of that bar.
      */}

      {topTabs ? (
        <nav className="ml-2 hidden h-full items-end gap-0.5 md:flex" aria-label="Primary">
          {tabs.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => play("navigate")}
                className={cn("tactile relative flex h-8 items-center gap-1.5 rounded-t-md px-2.5 text-xs text-fg-muted hover:bg-hover hover:text-fg", active && "text-fg")}
              >
                {Icon ? <Icon className="size-3.5" /> : null}
                {n.label}
                {n.badge ? (
                  <Badge variant="accent" size="sm">
                    {n.badge}
                  </Badge>
                ) : null}
                <span className={cn("absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent transition-opacity", active ? "opacity-100" : "opacity-0")} />
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        {/* A route that carries its own search does not get this one as well. */}
        {ownSearch ? null : (
          <>
            <button
              type="button"
              onClick={() => ctx.togglePanel("commands")}
              className="tactile hidden h-7 w-64 items-center gap-2 rounded-md border border-border bg-elevated px-2 text-[11px] text-fg-faint hover:border-border-strong hover:text-fg-muted sm:flex"
            >
              <Search className="size-3.5" />
              <span className="flex-1 truncate text-left">Search or run a command…</span>
              <Kbd>mod+k</Kbd>
            </button>
            <Tooltip content="Search" shortcut="mod+k">
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => ctx.togglePanel("commands")}>
                <Search />
              </Button>
            </Tooltip>
          </>
        )}

        {/* What a module wants *shown* rather than pressed, on the near side
            of the bell: work in flight, and anything else that is a glance
            rather than a control. The bar knows none of them by name. */}
        {registry.topBarItems.filter((i) => i.slot === "status").map((i) => (
          <i.component key={i.id} />
        ))}

        <Tooltip content="News" shortcut="mod+i">
          <Button variant={panels.news ? "subtle" : "ghost"} size="icon" aria-label="News" onClick={() => ctx.togglePanel("news")} className="relative">
            <Bell />
            {unread > 0 ? (
              <span className="num absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-fg animate-ping-dot">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Button>
        </Tooltip>

        <Tooltip content={sound ? "Mute" : "Unmute"} shortcut="mod+.">
          <Button variant="ghost" size="icon" aria-label="Toggle sound" aria-pressed={sound} sound={false} onClick={() => setSound(!sound)}>
            {sound ? <Volume2 /> : <VolumeX className="text-fg-faint" />}
          </Button>
        </Tooltip>

        <Tooltip content={dark ? "Light theme" : "Dark theme"} shortcut="mod+shift+l">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" sound={false} onClick={() => setMode(dark ? "light" : "dark")}>
            {dark ? <Sun /> : <Moon />}
          </Button>
        </Tooltip>

        {/* What the modules put here: the repository, the key vault. The bar
            knows none of them by name. */}
        {registry.topBarItems.filter((i) => i.slot !== "status").map((i) => (
          <i.component key={i.id} />
        ))}

        <Tooltip content="Settings" shortcut="mod+,">
          <Button variant={panels.settings ? "subtle" : "ghost"} size="icon" aria-label="Settings" onClick={() => ctx.togglePanel("settings")}>
            <Settings />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}

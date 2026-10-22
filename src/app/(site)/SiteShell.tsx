"use client";
import * as React from "react";
import { installAudioUnlock } from "@/core/audio/engine";
import { useSettings } from "@/core/settings/store";
import { useSettingValue } from "@/core/settings/useSetting";
import { ThemeProvider } from "@/core/theme/ThemeProvider";
import { TooltipProvider } from "@/core/ui/tooltip";
import { cn } from "@/core/lib/cn";

/**
 * What the published page needs of the Builder's shell, and nothing else.
 *
 * Same settings start, same theme on <html>, same audio unlock and the same
 * boxes round the page as `AppShell`, so the page lays out exactly as it did
 * inside it. Left out, because a visitor has no use for them: the top bar and
 * side bar (hidden on /site already), the Builder's keyboard shortcuts and
 * right-click menu, the panels and dialogs, and the feature modules' start-up
 * work (account sync, keys, drafts), which is what pulled the registry, and
 * with it the whole Builder, into this route.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const width = useSettingValue<string>("appearance.contentWidth");
  React.useEffect(() => {
    void useSettings.persist.rehydrate();
    useSettings.getState().markHydrated();
    return installAudioUnlock();
  }, []);
  return (
    <TooltipProvider>
      <ThemeProvider />
      <div className="relative z-[1] flex h-dvh flex-col">
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1 overflow-auto transition-[padding] duration-(--motion-base)">
            <div className={cn("min-h-full", width === "narrow" && "mx-auto max-w-3xl", width === "wide" && "mx-auto max-w-7xl")}>{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

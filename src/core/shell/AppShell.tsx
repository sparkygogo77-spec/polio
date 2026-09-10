"use client";
import * as React from "react";
import { ActionsProvider } from "@/core/actions";
import { TooltipProvider } from "@/core/ui/tooltip";
import { ContextMenuProvider } from "@/core/context-menu/ContextMenuProvider";
import { ThemeProvider } from "@/core/theme/ThemeProvider";
import { AppBootstrap } from "@/core/bootstrap";
import { useShortcuts } from "@/core/commands/useShortcuts";
import { CommandPalette } from "@/core/commands/CommandPalette";
import { ShortcutsSheet } from "@/core/commands/ShortcutsSheet";
import { NewsPanel } from "@/core/news/NewsPanel";
import { Toaster } from "@/core/news/Toaster";
import { SettingsDrawer } from "@/core/settings/SettingsDrawer";
import { TweetConsole } from "@/features/tweets/TweetConsole";
import { KeysPanel } from "@/features/keys/KeysPanel";
import { Tour } from "@/features/tour/Tour";
import { useSettingValue } from "@/core/settings/useSetting";
import { useUi } from "@/core/ui-state/store";
import { cn } from "@/core/lib/cn";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ConfirmDialog } from "./ConfirmDialog";

function Shortcuts() {
  useShortcuts();
  return null;
}

/** Only one right-hand panel at a time: opening settings closes news and vice versa. */
function PanelExclusivity() {
  const panels = useUi((s) => s.panels);
  const closePanel = useUi((s) => s.closePanel);
  const last = React.useRef<"settings" | "news" | null>(null);
  React.useEffect(() => {
    if (panels.settings && panels.news) closePanel(last.current === "settings" ? "settings" : "news");
    if (panels.settings) last.current = "settings";
    else if (panels.news) last.current = "news";
  }, [panels.settings, panels.news, closePanel]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const width = useSettingValue<string>("appearance.contentWidth");
  const panelOpen = useUi((s) => s.panels.settings || s.panels.news);
  return (
    <ActionsProvider>
      <TooltipProvider>
        <ContextMenuProvider>
          <AppBootstrap />
          <ThemeProvider />
          <Shortcuts />
          <PanelExclusivity />
          <div className="relative z-[1] flex h-dvh flex-col">
            <TopBar />
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              <main className={cn("relative min-w-0 flex-1 overflow-auto transition-[padding] duration-(--motion-base)", panelOpen && "xl:pr-(--panel-w)")}>
                <div className={cn("min-h-full", width === "narrow" && "mx-auto max-w-3xl", width === "wide" && "mx-auto max-w-7xl")}>{children}</div>
              </main>
            </div>
            <StatusBar />
          </div>
          <NewsPanel />
          <SettingsDrawer />
          <TweetConsole />
          <KeysPanel />
          <Tour />
          <CommandPalette />
          <ShortcutsSheet />
          <ConfirmDialog />
          <Toaster />
        </ContextMenuProvider>
      </TooltipProvider>
    </ActionsProvider>
  );
}

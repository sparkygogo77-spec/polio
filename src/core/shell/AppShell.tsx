"use client";
import * as React from "react";
import { BuildGuard } from "./BuildGuard";
import { ActionsProvider } from "@/core/actions";
import { TooltipProvider } from "@/core/ui/tooltip";
import { ContextMenuProvider } from "@/core/context-menu/ContextMenuProvider";
import { ThemeProvider } from "@/core/theme/ThemeProvider";
import { AppBootstrap } from "@/core/bootstrap";
import { useShortcuts } from "@/core/commands/useShortcuts";
import { CommandPalette } from "@/core/commands/CommandPalette";
import { ShortcutsSheet } from "@/core/commands/ShortcutsSheet";
import { Toaster } from "@/core/toasts/Toaster";
import { SettingsDrawer } from "@/core/settings/SettingsDrawer";
import { TweetConsole } from "@/features/tweets/TweetConsole";
import { KeysPanel } from "@/features/keys/KeysPanel";
import { Tour } from "@/features/tour/Tour";
import { useSettingValue } from "@/core/settings/useSetting";
import { useUi } from "@/core/ui-state/store";
import { cn } from "@/core/lib/cn";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ConfirmDialog } from "./ConfirmDialog";

function Shortcuts() {
  useShortcuts();
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const width = useSettingValue<string>("appearance.contentWidth");
  const panelOpen = useUi((s) => s.panels.settings);
  return (
    <ActionsProvider>
      <TooltipProvider>
        <ContextMenuProvider>
          <AppBootstrap />
          <ThemeProvider />
          <Shortcuts />
          <div className="relative z-[1] flex h-dvh flex-col">
            <BuildGuard />
            <TopBar />
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              <main className={cn("relative min-w-0 flex-1 overflow-auto transition-[padding] duration-(--motion-base)", panelOpen && "xl:pr-(--panel-w)")}>
                <div className={cn("min-h-full", width === "narrow" && "mx-auto max-w-3xl", width === "wide" && "mx-auto max-w-7xl")}>{children}</div>
              </main>
            </div>
          </div>
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

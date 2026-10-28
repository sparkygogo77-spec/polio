"use client";
import * as React from "react";
import { BuildGuard } from "./BuildGuard";
import { ActionsProvider } from "@/core/actions";
import { TooltipProvider } from "@/core/ui/tooltip";
import { ContextMenuProvider } from "@/core/context-menu/ContextMenuProvider";
import { ThemeProvider } from "@/core/theme/ThemeProvider";
import { AppBootstrap } from "@/core/bootstrap";
import { useShortcuts } from "@/core/commands/useShortcuts";
import { Toaster } from "@/core/toasts/Toaster";
import { SettingsDrawer } from "@/core/settings/SettingsDrawer";
import { KeysPanel } from "@/features/keys/KeysPanel";
import dynamic from "next/dynamic";
import { useSettingValue } from "@/core/settings/useSetting";
import { useUi } from "@/core/ui-state/store";
import { cn } from "@/core/lib/cn";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ConfirmDialog } from "./ConfirmDialog";

/*
 * Mounted closed on every Builder page and opened by a key or a press, so
 * none of them is needed to draw the page: they load after it, not with it.
 * (`SettingsDrawer` stays: `OwnSettings` draws with its controls. `KeysPanel`
 * stays: its button is in the top bar, from the same file.)
 */
const CommandPalette = dynamic(() => import("@/core/commands/CommandPalette").then((m) => m.CommandPalette), { ssr: false });
const ShortcutsSheet = dynamic(() => import("@/core/commands/ShortcutsSheet").then((m) => m.ShortcutsSheet), { ssr: false });
const TweetConsole = dynamic(() => import("@/features/tweets/TweetConsole").then((m) => m.TweetConsole), { ssr: false });
const Tour = dynamic(() => import("@/features/tour/Tour").then((m) => m.Tour), { ssr: false });
/* New controls pointed out once after an update (`features/whatsnew`): the one place it is mounted. */
const WhatsNew = dynamic(() => import("@/features/whatsnew/WhatsNew").then((m) => m.WhatsNew), { ssr: false });

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
          <WhatsNew />
          <CommandPalette />
          <ShortcutsSheet />
          <ConfirmDialog />
          <Toaster />
        </ContextMenuProvider>
      </TooltipProvider>
    </ActionsProvider>
  );
}

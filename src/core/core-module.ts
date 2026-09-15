/**
 * The template's own contributions: global commands, shortcuts and the
 * right-click menu every page gets. Feature modules add to these, never
 * replace them.
 */
import {
  Bell,
  Command,
  Copy,
  Home,
  Keyboard,
  LayoutPanelLeft,
  Link2,
  Moon,
  PanelLeft,
  RefreshCw,
  Rows3,
  Settings,
  Sun,
  Volume2,
  VolumeX,
  Eye,
} from "lucide-react";
import { defineFeature, type ActionContext, type MenuEntry } from "./types";

function toggleTheme(ctx: ActionContext) {
  const mode = ctx.getSetting<string>("appearance.mode");
  const resolved = mode === "system" ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  ctx.setSetting("appearance.mode", resolved === "dark" ? "light" : "dark");
}

export const coreModule = defineFeature({
  id: "core",
  name: "Core",
  hidden: true,
  commands: [
    { id: "core.commands", label: "Command palette", group: "Navigate", icon: Command, shortcut: "mod+k", run: (c) => c.togglePanel("commands") },
    { id: "core.home", label: "Go home", group: "Navigate", icon: Home, shortcut: "g h", run: (c) => c.navigate("/") },
    { id: "core.settings", label: "Open settings", group: "Panels", icon: Settings, shortcut: "mod+,", run: (c) => c.togglePanel("settings") },
    { id: "core.news", label: "Open news feed", group: "Panels", icon: Bell, shortcut: "mod+i", run: (c) => c.togglePanel("news") },
    { id: "core.shortcuts", label: "Keyboard shortcuts", group: "Panels", icon: Keyboard, shortcut: "/", run: (c) => c.togglePanel("shortcuts") },
    {
      id: "core.theme",
      label: "Toggle dark / light",
      group: "Appearance",
      icon: Moon,
      shortcut: "mod+shift+l",
      keywords: ["theme", "dark", "light"],
      run: toggleTheme,
    },
    {
      id: "core.density",
      label: "Toggle density",
      group: "Appearance",
      icon: Rows3,
      shortcut: "mod+shift+d",
      keywords: ["compact", "comfortable"],
      run: (c) => c.setSetting("appearance.density", c.getSetting("appearance.density") === "compact" ? "comfortable" : "compact"),
    },
    {
      id: "core.sound",
      label: "Toggle sound",
      group: "Appearance",
      icon: Volume2,
      shortcut: "mod+.",
      keywords: ["mute", "audio"],
      run: (c) => c.setSetting("audio.enabled", !c.getSetting<boolean>("audio.enabled")),
    },
    {
      id: "core.blur",
      label: "Toggle blur amounts",
      group: "Appearance",
      icon: Eye,
      shortcut: "mod+shift+b",
      keywords: ["privacy", "stream", "hide"],
      run: (c) => c.setSetting("privacy.blur", !c.getSetting<boolean>("privacy.blur")),
    },
    {
      id: "core.sidebar",
      label: "Toggle sidebar",
      group: "Appearance",
      icon: PanelLeft,
      shortcut: "mod+b",
      run: (c) => {
        const cur = c.getSetting<string>("appearance.sidebar");
        c.setSetting("appearance.sidebar", cur === "hidden" ? "collapsible" : "hidden");
      },
    },
    { id: "core.copyUrl", label: "Copy page link", group: "Page", icon: Link2, run: (c) => void c.copy(window.location.href, "page link") },
    { id: "core.reload", label: "Reload", group: "Page", icon: RefreshCw, run: () => window.location.reload() },
    { id: "core.resetLayout", label: "Reset appearance to defaults", group: "Appearance", icon: LayoutPanelLeft, run: (c) => {
      for (const id of ["appearance.mode", "appearance.accentHue", "appearance.density", "appearance.radius", "appearance.font", "appearance.fontScale", "appearance.sidebar", "appearance.contentWidth"]) {
        // set() to the def default is what reset does; use the registry-free path through settings.
        c.setSetting(id, undefined);
      }
    } },
  ],
  shortcuts: [
    { keys: "mod+k", label: "Command palette", group: "General", run: (c) => c.togglePanel("commands"), allowInInput: true },
    { keys: "mod+,", label: "Settings", group: "General", run: (c) => c.togglePanel("settings"), allowInInput: true },
    { keys: "mod+i", label: "News feed", group: "General", run: (c) => c.togglePanel("news") },
    { keys: "/", label: "Shortcut cheat sheet", group: "General", run: (c) => c.togglePanel("shortcuts") },
    { keys: "escape", label: "Close panels", group: "General", run: (c) => c.closePanel(), passive: true, allowInInput: true },
    { keys: "mod+shift+l", label: "Toggle theme", group: "Appearance", run: toggleTheme },
    { keys: "mod+shift+d", label: "Toggle density", group: "Appearance", run: (c) => c.setSetting("appearance.density", c.getSetting("appearance.density") === "compact" ? "comfortable" : "compact") },
    { keys: "mod+.", label: "Toggle sound", group: "Appearance", run: (c) => c.setSetting("audio.enabled", !c.getSetting<boolean>("audio.enabled")) },
    { keys: "mod+shift+b", label: "Toggle blur", group: "Appearance", run: (c) => c.setSetting("privacy.blur", !c.getSetting<boolean>("privacy.blur")) },
    { keys: "mod+b", label: "Toggle sidebar", group: "Appearance", run: (c) => c.setSetting("appearance.sidebar", c.getSetting<string>("appearance.sidebar") === "hidden" ? "collapsible" : "hidden") },
    { keys: "g h", label: "Go home", group: "Navigate", run: (c) => c.navigate("/") },
  ],
  contextMenus: [
    {
      scope: "*",
      order: 1000,
      items: (target, ctx) => {
        const selection = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
        const soundOn = ctx.getSetting<boolean>("audio.enabled");
        const dark = ctx.getSetting<string>("appearance.mode") !== "light";
        const items: MenuEntry[] = [];
        if (target.stack.length > 0) items.push({ type: "separator", id: "core-sep-top" });
        if (selection) items.push({ id: "core.copySelection", label: "Copy selection", icon: Copy, onSelect: () => void ctx.copy(selection, "selection") });
        items.push(
          { id: "core.copyUrl", label: "Copy page link", icon: Link2, onSelect: () => void ctx.copy(window.location.href, "page link") },
          {
            id: "core.view",
            label: "View",
            icon: LayoutPanelLeft,
            children: [
              { id: "core.theme", label: dark ? "Light theme" : "Dark theme", icon: dark ? Sun : Moon, shortcut: "mod+shift+l", onSelect: () => toggleTheme(ctx) },
              { id: "core.density", label: "Density", icon: Rows3, shortcut: "mod+shift+d", checked: ctx.getSetting("appearance.density") === "comfortable", hint: "comfortable", onSelect: () => ctx.setSetting("appearance.density", ctx.getSetting("appearance.density") === "compact" ? "comfortable" : "compact") },
              { id: "core.sound", label: "Sound", icon: soundOn ? Volume2 : VolumeX, shortcut: "mod+.", checked: soundOn, onSelect: () => ctx.setSetting("audio.enabled", !soundOn) },
              { id: "core.blur", label: "Blur amounts", icon: Eye, shortcut: "mod+shift+b", checked: ctx.getSetting<boolean>("privacy.blur"), onSelect: () => ctx.setSetting("privacy.blur", !ctx.getSetting<boolean>("privacy.blur")) },
            ],
          },
          { id: "core.settings", label: "Settings", icon: Settings, shortcut: "mod+,", onSelect: () => ctx.openPanel("settings") },
          { id: "core.shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: "/", onSelect: () => ctx.openPanel("shortcuts") },
        );
        return items;
      },
    },
  ],
});

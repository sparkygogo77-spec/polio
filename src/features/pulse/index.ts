import { Activity, Ban, Copy, Eye, EyeOff, ExternalLink, Search, Star, StarOff, Zap } from "lucide-react";
import { defineFeature, type MenuEntry } from "@/core/types";
import { PulsePage } from "./PulsePage";
import { PRESETS, startSimulation, usePulse, type Token } from "./sim";
import { StreamRate } from "./StreamRate";

/**
 * Three-column live discovery feed in the style of Axiom Pulse / Photon
 * Memescope, driven by a simulated stream. Demonstrates: streaming rows,
 * insert flash, pause-on-hover with queued rows, presets, quick buy, blur,
 * filters, per-row context menus, sound alerts and module settings.
 */
export const pulse = defineFeature({
  id: "pulse",
  name: "Pulse",
  description: "Live three-column launch feed with quick-buy presets, pause-on-hover, filters and row context menus.",
  icon: Activity,
  tags: ["terminal", "streaming", "demo"],
  demo: true,
  routes: [{ path: "/pulse", component: PulsePage, title: "Pulse" }],
  nav: [{ label: "Pulse", href: "/pulse", icon: Activity, order: 10, group: "Trade", badge: "live" }],
  settingGroups: [{ id: "pulse", label: "Pulse feed", icon: Activity, order: 100, description: "Stream speed, alerts and quick-buy behaviour." }],
  settings: [
    { id: "pulse.soundNewRow", group: "pulse", label: "Tick on new row", type: "toggle", default: false, order: 1 },
    { id: "pulse.soundMigrate", group: "pulse", label: "Alert on graduation", type: "toggle", default: true, order: 2 },
    { id: "pulse.speed", group: "pulse", label: "Stream speed", type: "slider", default: 1, min: 0.25, max: 4, step: 0.25, format: (v) => `${v}×`, order: 3 },
    { id: "pulse.maxRows", group: "pulse", label: "Rows per column", type: "slider", default: 60, min: 20, max: 500, step: 10, advanced: true, order: 4 },
    { id: "pulse.confirmBuy", group: "pulse", label: "Confirm quick buys", description: "Off is how terminals ship it. On is safer.", type: "toggle", default: false, order: 5 },
    { id: "pulse.showSparkline", group: "pulse", label: "Sparklines in rows", type: "toggle", default: true, advanced: true, order: 6 },
  ],
  statusItems: [{ id: "pulse.rate", side: "left", order: 10, component: StreamRate }],
  commands: [
    { id: "pulse.toggle", label: "Pulse: pause / resume stream", group: "Pulse", icon: Activity, shortcut: "p", keywords: ["feed", "stream"], run: () => usePulse.getState().setRunning(!usePulse.getState().running) },
    { id: "pulse.clear", label: "Pulse: clear columns", group: "Pulse", icon: Ban, run: (c) => void c.confirm({ title: "Clear all columns?", danger: true, confirmLabel: "Clear" }).then((ok) => ok && usePulse.getState().clear()) },
    { id: "pulse.preset1", label: "Pulse: preset P1", group: "Pulse", icon: Zap, shortcut: "1", run: () => usePulse.getState().setPreset(1) },
    { id: "pulse.preset2", label: "Pulse: preset P2", group: "Pulse", icon: Zap, shortcut: "2", run: () => usePulse.getState().setPreset(2) },
    { id: "pulse.preset3", label: "Pulse: preset P3", group: "Pulse", icon: Zap, shortcut: "3", run: () => usePulse.getState().setPreset(3) },
  ],
  shortcuts: [
    { keys: "g p", label: "Go to Pulse", group: "Navigate", run: (c) => c.navigate("/pulse") },
    { keys: "p", label: "Pause / resume stream", group: "Pulse", when: onPulse, run: () => usePulse.getState().setRunning(!usePulse.getState().running) },
    { keys: "1", label: "Preset P1", group: "Pulse", when: onPulse, run: () => usePulse.getState().setPreset(1) },
    { keys: "2", label: "Preset P2", group: "Pulse", when: onPulse, run: () => usePulse.getState().setPreset(2) },
    { keys: "3", label: "Preset P3", group: "Pulse", when: onPulse, run: () => usePulse.getState().setPreset(3) },
  ],
  contextMenus: [
    {
      scope: "token",
      items: (target, ctx) => {
        const t = target.data as Token | undefined;
        if (!t) return [];
        const s = usePulse.getState();
        const watched = s.watch.has(t.address);
        const pos = s.positions[t.address];
        const entries: MenuEntry[] = [
          { type: "label", label: `${t.ticker} · ${t.name}` },
          {
            id: "buy",
            label: "Quick buy",
            icon: Zap,
            children: ([1, 2, 3] as const).map((p) => ({
              id: `buy-${p}`,
              label: `P${p} · ${PRESETS[p]} ETH`,
              shortcut: String(p),
              onSelect: () => s.buy(t, PRESETS[p]),
            })),
          },
        ];
        if (pos) {
          entries.push({
            id: "sell",
            label: `Sell (${pos.eth.toFixed(2)} ETH)`,
            icon: Zap,
            children: [25, 50, 100].map((pct) => ({ id: `sell-${pct}`, label: `${pct}%`, danger: pct === 100, onSelect: () => s.sell(t, pct) })),
          });
        }
        entries.push(
          { type: "separator" },
          { id: "copy", label: "Copy contract address", icon: Copy, shortcut: "mod+c", onSelect: () => void ctx.copy(t.address, "contract address") },
          { id: "x", label: "Search X for CA", icon: Search, onSelect: () => ctx.navigate(`https://x.com/search?q=${t.address}`) },
          { id: "explorer", label: "Open on explorer", icon: ExternalLink, onSelect: () => ctx.navigate(`https://etherscan.io/address/${t.address}`) },
          { type: "separator" },
          { id: "watch", label: watched ? "Remove from watchlist" : "Add to watchlist", icon: watched ? StarOff : Star, onSelect: () => {
            s.toggleWatch(t.address);
            ctx.publish({ key: `pulse:watch:${t.address}`, title: watched ? `Unwatched ${t.ticker}` : `Watching ${t.ticker}`, level: "info", source: "pulse", toast: true, sound: watched ? "toggleOff" : "toggleOn" });
          } },
          { id: "hide", label: "Hide token", icon: EyeOff, onSelect: () => {
            s.hide(t.address);
            ctx.publish({ key: `pulse:hide:${t.address}`, title: `Hidden ${t.ticker}`, level: "info", source: "pulse", toast: true, sound: "close" });
          } },
          { id: "blacklist", label: "Blacklist deployer", icon: Ban, danger: true, onSelect: () => void ctx.confirm({ title: `Blacklist ${t.ticker}'s deployer?`, body: "Every token from this wallet disappears from the feed.", danger: true, confirmLabel: "Blacklist" }).then((ok) => {
            if (!ok) return;
            s.blacklistDev(t.creator);
            ctx.publish({ key: `pulse:blacklist:${t.creator}`, title: "Deployer blacklisted", body: t.creator.slice(0, 10) + "…", level: "warn", source: "pulse", toast: true });
          }) },
        );
        return entries;
      },
    },
    {
      scope: "pulse-column",
      items: (target) => {
        const col = target.id as "new" | "final" | "migrated";
        const s = usePulse.getState();
        return [
          { id: "pause", label: s.paused[col] ? "Resume column" : "Pause column", icon: s.paused[col] ? Eye : EyeOff, onSelect: () => s.setPaused(col, !s.paused[col]) },
          { id: "clear-col", label: "Clear column", icon: Ban, danger: true, onSelect: () => usePulse.setState((st) => ({ columns: { ...st.columns, [col]: [] } })) },
        ];
      },
    },
  ],
  onMount: () => startSimulation(),
});

function onPulse() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/pulse");
}

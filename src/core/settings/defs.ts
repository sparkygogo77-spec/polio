/**
 * Core setting definitions. Feature modules add their own via
 * `settings` / `settingGroups` on the module manifest.
 *
 * Rule of thumb: anything a power user might want but a new user doesn't
 * need to see goes under `advanced: true`. That is how "every option" and
 * "hides away options" coexist.
 */
import {
  Bell,
  Eye,
  Keyboard,
  MousePointerClick,
  Palette,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { SettingDef, SettingGroupDef } from "@/core/types";
import site from "@site";
import { hasNav } from "@/core/nav-gate";

export const CORE_SETTING_GROUPS: SettingGroupDef[] = [
  { id: "appearance", label: "Appearance", icon: Palette, order: 10, description: "Theme, colour and type." },
  { id: "effects", label: "Effects", icon: Sparkles, order: 20, description: "Motion, ambience and flashes." },
  { id: "feedback", label: "Feedback", icon: MousePointerClick, order: 40, description: "Optimism and confirmations." },
  { id: "feed", label: "Toasts", icon: Bell, order: 50, description: "How events are coalesced and shown." },
  { id: "behaviour", label: "Behaviour", icon: Workflow, order: 60, description: "Small workflow preferences." },
  { id: "keyboard", label: "Keyboard", icon: Keyboard, order: 70, description: "Shortcuts and hints." },
  { id: "privacy", label: "Privacy", icon: Eye, order: 80, description: "Blur and streamer mode." },
];

const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;
const ms = (v: unknown) => `${Number(v)}ms`;
const secs = (v: unknown) => `${(Number(v) / 1000).toFixed(0)}s`;
const px = (v: unknown) => `${Number(v)}px`;

export const CORE_SETTINGS: SettingDef[] = [
  /* Appearance ----------------------------------------------------- */
  {
    id: "appearance.mode",
    group: "appearance",
    label: "Theme",
    type: "segmented",
    default: site.theme.defaultMode,
    options: [
      { value: "dark", label: "Dark" },
      { value: "light", label: "Light" },
      { value: "system", label: "System" },
    ],
    order: 1,
    tags: ["dark", "light", "colour", "color"],
  },
  { id: "appearance.accentHue", group: "appearance", label: "Accent hue", type: "hue", default: site.theme.accentHue, min: 0, max: 360, step: 1, order: 2, tags: ["colour", "color", "brand"] },
  { id: "appearance.radius", group: "appearance", label: "Corner radius", type: "slider", default: site.theme.radius, min: 0, max: 16, step: 1, format: px, order: 4 },
  {
    id: "appearance.font",
    group: "appearance",
    label: "Font",
    type: "segmented",
    default: site.theme.font,
    options: [
      { value: "system", label: "System" },
      { value: "inter", label: "Inter-like" },
      { value: "mono", label: "Mono" },
    ],
    advanced: true,
    order: 5,
  },
  { id: "appearance.fontScale", group: "appearance", label: "Font scale", type: "slider", default: 1, min: 0.85, max: 1.25, step: 0.05, format: (v) => `${Math.round(Number(v) * 100)}%`, advanced: true, order: 6 },
  { id: "appearance.contrast", group: "appearance", label: "High contrast", description: "Stronger borders and text.", type: "toggle", default: false, advanced: true, order: 7 },
  {
    id: "appearance.sidebar",
    group: "appearance",
    label: "Sidebar",
    type: "segmented",
    default: site.layout.sidebar,
    options: [
      { value: "collapsible", label: "Rail" },
      { value: "fixed", label: "Fixed" },
      { value: "hidden", label: "Hidden" },
    ],
    advanced: true,
    // Offered only while a module declares a nav entry: see `nav-gate.ts`.
    when: hasNav,
    order: 8,
  },
  {
    id: "appearance.contentWidth",
    group: "appearance",
    label: "Content width",
    type: "segmented",
    default: site.layout.contentWidth,
    options: [
      { value: "full", label: "Full" },
      { value: "wide", label: "Wide" },
      { value: "narrow", label: "Narrow" },
    ],
    advanced: true,
    order: 9,
  },
  { id: "appearance.topTabs", group: "appearance", label: "Route tabs in top bar", type: "toggle", default: site.layout.topTabs, advanced: true, when: hasNav, order: 10 },

  /* Effects -------------------------------------------------------- */
  {
    id: "effects.motion",
    group: "effects",
    label: "Motion",
    description: "Off disables every non-essential animation.",
    type: "segmented",
    default: "full",
    options: [
      { value: "full", label: "Full" },
      { value: "reduced", label: "Reduced" },
      { value: "off", label: "Off" },
    ],
    order: 1,
    tags: ["animation", "reduce"],
  },
  { id: "effects.glow", group: "effects", label: "Accent glow", type: "toggle", default: site.theme.effects.glow, order: 3 },
  { id: "effects.flash", group: "effects", label: "Flash on change", description: "Values flash green/red when they move.", type: "toggle", default: true, order: 4 },
  { id: "effects.flashDurationMs", group: "effects", label: "Flash duration", type: "slider", default: 700, min: 150, max: 2000, step: 50, format: ms, advanced: true, order: 5 },
  { id: "effects.pressScale", group: "effects", label: "Press scale", description: "How much buttons shrink when pressed.", type: "slider", default: 0.96, min: 0.9, max: 1, step: 0.01, advanced: true, order: 6 },
  { id: "effects.scanlines", group: "effects", label: "Scanlines", type: "toggle", default: site.theme.effects.scanlines, advanced: true, order: 7 },
  { id: "effects.noise", group: "effects", label: "Film grain", type: "toggle", default: site.theme.effects.noise, advanced: true, order: 8 },
  { id: "effects.glass", group: "effects", label: "Translucent panels", type: "toggle", default: true, advanced: true, order: 9 },

  /* Audio ---------------------------------------------------------- */

  /* Feedback ------------------------------------------------------- */
  { id: "feedback.optimistic", group: "feedback", label: "Optimistic actions", description: "Show actions as done the instant you click.", type: "toggle", default: true, order: 3 },
  { id: "feedback.confirmDestructive", group: "feedback", label: "Confirm destructive actions", type: "toggle", default: true, order: 4 },
  { id: "feedback.copyToast", group: "feedback", label: "Toast on copy", type: "toggle", default: true, advanced: true, order: 5 },

  /* Feed ----------------------------------------------------------- */
  { id: "feed.toasts", group: "feed", label: "Toasts", type: "toggle", default: true, order: 1 },
  {
    id: "feed.toastPosition",
    group: "feed",
    label: "Toast position",
    type: "select",
    default: site.feed.toastPosition,
    options: [
      { value: "bottom-right", label: "Bottom right" },
      { value: "bottom-left", label: "Bottom left" },
      { value: "bottom-center", label: "Bottom centre" },
      { value: "top-right", label: "Top right" },
      { value: "top-left", label: "Top left" },
    ],
    order: 2,
  },
  { id: "feed.toastDurationMs", group: "feed", label: "Toast duration", type: "slider", default: site.feed.toastDurationMs, min: 1000, max: 10000, step: 250, format: ms, order: 3 },
  { id: "feed.maxToasts", group: "feed", label: "Max visible toasts", type: "slider", default: site.feed.maxToasts, min: 1, max: 8, step: 1, advanced: true, order: 5 },
  {
    id: "feed.coalesceMs",
    group: "feed",
    label: "Coalesce window",
    description: "Same-key events inside this window fold into one line instead of repeating.",
    type: "slider",
    default: site.feed.coalesceMs,
    min: 0,
    max: 60000,
    step: 1000,
    format: secs,
    advanced: true,
    order: 6,
  },
  { id: "feed.collapseReverts", group: "feed", label: "Drop reverted changes", description: "If a value goes 1 → 2 → 1 while the card is up, the card disappears.", type: "toggle", default: true, advanced: true, order: 7 },
  { id: "feed.settingsInFeed", group: "feed", label: "Say when a setting changes", type: "toggle", default: true, advanced: true, order: 8 },

  /* Behaviour ------------------------------------------------------ */
  { id: "behaviour.pauseOnHover", group: "behaviour", label: "Pause feeds on hover", description: "Rows never slide away mid-click.", type: "toggle", default: true, order: 1 },
  { id: "behaviour.externalNewTab", group: "behaviour", label: "Open external links in a new tab", type: "toggle", default: true, advanced: true, order: 3 },

  /* Keyboard ------------------------------------------------------- */
  { id: "keyboard.hints", group: "keyboard", label: "Show shortcut hints", type: "toggle", default: true, order: 1 },
  { id: "keyboard.chords", group: "keyboard", label: "Two-key chords", description: 'Enable "g then p" style navigation.', type: "toggle", default: true, advanced: true, order: 2 },
  { id: "keyboard.enterSubmits", group: "keyboard", label: "Enter confirms dialogs", type: "toggle", default: true, advanced: true, order: 3 },

  /* Privacy -------------------------------------------------------- */
  { id: "privacy.blur", group: "privacy", label: "Blur amounts", description: "Screen-share safe. Hover to reveal.", type: "toggle", default: false, order: 1, tags: ["stream", "hide"] },
  { id: "privacy.streamer", group: "privacy", label: "Streamer mode", description: "Also hides addresses and identifiers.", type: "toggle", default: false, advanced: true, order: 2 },

  /* Developer ------------------------------------------------------ */
];

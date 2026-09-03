/**
 * ============================================================================
 *  SITE CONFIG — the one file to edit to re-centre this template on anything.
 * ============================================================================
 *
 * Agents: change copy, theme defaults and nav style here. Do NOT put feature
 * logic here; features live in `src/features/<id>/` and register themselves.
 * See AGENTS.md for the full contract.
 */
import { defineSite } from "@/core/site";

export default defineSite({
  name: "Polio",
  tagline: "A terminal-grade UI foundation you can point an agent at.",
  description:
    "Right-click everywhere, instant tactile feedback, audio cues, a news feed that never repeats itself, and every option tucked away until you need it.",
  logoMark: "P",
  version: "0.1.0",

  layout: {
    topTabs: true,
    sidebar: "collapsible",
    statusBar: true,
    contentWidth: "full",
  },

  theme: {
    defaultMode: "dark",
    accentHue: 160,
    radius: 6,
    density: "compact",
    font: "system",
    effects: { grid: true, glow: true, scanlines: false, noise: false },
  },

  audio: { enabled: true, volume: 0.35 },

  feed: {
    coalesceMs: 15_000,
    toastDurationMs: 3_500,
    toastPosition: "bottom-right",
    maxToasts: 4,
  },

  home: {
    hero: {
      eyebrow: "Template",
      title: "Build the site you actually want on top of a terminal.",
      subtitle:
        "Every interaction is already tactile, every option already has a home, and every event is already deduplicated. Drop in a feature module and the shell picks it up.",
      primaryCta: { label: "Open the live feed demo", href: "/pulse" },
      secondaryCta: { label: "Browse every component", href: "/showcase" },
    },
    showModuleGrid: true,
    showAgentGuide: true,
  },

  links: [{ label: "GitHub", href: "https://github.com/sparkygogo77-spec/polio", external: true }],

  // Demo modules are safe to remove once you have your own features.
  demoModules: ["pulse", "showcase"],
});

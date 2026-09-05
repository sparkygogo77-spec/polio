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
  tagline: "Draw what a site should be, then say what it is.",
  description:
    "A visual builder on top of a universal component foundation: place features on a canvas, give each one its own prompt, set the format, and compile it into a build brief any agent can act on.",
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
    accentHue: 235,
    radius: 6,
    density: "compact",
    font: "system",
    effects: { grid: false, glow: false, scanlines: false, noise: false },
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
      title: "Lay out the site. Then tell it what to be.",
      subtitle:
        "218 common web features you can drop onto a canvas, draw around, group and connect — each with its own prompt. Position carries meaning, so where you put something is part of the spec. Compile it and hand the brief to any agent.",
      primaryCta: { label: "Open the Builder", href: "/builder" },
      secondaryCta: { label: "See how it fits together", href: "/showcase" },
    },
    showModuleGrid: true,
    showAgentGuide: true,
  },

  links: [{ label: "GitHub", href: "https://github.com/sparkygogo77-spec/polio", external: true }],

  // Demo modules are safe to remove once you have your own features.
  demoModules: ["showcase"],
});

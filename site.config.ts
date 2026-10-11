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
  name: "Builder",
  tagline: "Lay out a site, then say what it is.",
  description:
    "A visual builder on top of a universal component foundation: 236 parts you place on a canvas, give each one its own prompt, set the format, and compile it into a build brief any agent can act on.",
  logoMark: "◆",
  version: "0.1.0",
  // The GitHub mark in the top bar opens this. Publishing to it still needs
  // GITHUB_TOKEN and GITHUB_REPO on the server; see .env.example.
  repository: "https://github.com/sparkygogo77-spec/polio",

  layout: {
    topTabs: true,
    sidebar: "collapsible",
    contentWidth: "full",
  },

  theme: {
    defaultMode: "dark",
    accentHue: 235,
    radius: 6,
    font: "system",
    effects: { glow: false, scanlines: false, noise: false },
  },

  audio: { enabled: true, volume: 0.35 },

  feed: {
    coalesceMs: 15_000,
    toastDurationMs: 3_500,
    toastPosition: "bottom-right",
    maxToasts: 4,
  },


  // Demo modules are safe to remove once you have your own features.
  demoModules: ["showcase"],
});

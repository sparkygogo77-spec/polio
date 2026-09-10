/**
 * Site configuration schema. The root `site.config.ts` is the single place an
 * agent edits to re-centre the whole site on a new idea: name, copy, theme
 * defaults, navigation style, and which demo modules stay on.
 */
import type { LucideIcon } from "lucide-react";

export interface SiteLink {
  label: string;
  href: string;
  icon?: LucideIcon;
  external?: boolean;
}

export interface HeroConfig {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Small live stats under the hero, e.g. [{label:"Modules", value:"3"}]. */
  stats?: { label: string; value: string }[];
}

export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  /** One or two characters shown in the logo tile. */
  logoMark: string;
  version: string;
  /**
   * Where this site's code lives, as a URL. The GitHub mark in the top bar
   * opens it. Nothing else reads it: publishing needs a token on the server.
   */
  repository?: string;
  /** Where the top-level nav lives. */
  layout: {
    /** Show route tabs in the top bar. */
    topTabs: boolean;
    /** "collapsible" keeps a rail; "hidden" removes the sidebar entirely. */
    sidebar: "collapsible" | "fixed" | "hidden";
    /** Bottom status bar with clock, latency, sound state. */
    statusBar: boolean;
    /** Max content width; "full" for edge-to-edge terminals. */
    contentWidth: "full" | "wide" | "narrow";
  };
  theme: {
    defaultMode: "dark" | "light" | "system";
    /** 0-360 hue for the accent colour. 160 = green terminal, 255 = blue, 20 = orange. */
    accentHue: number;
    /** px */
    radius: number;
    density: "compact" | "comfortable";
    font: "system" | "mono" | "inter";
    /** Ambient effects on by default. */
    effects: { grid: boolean; glow: boolean; scanlines: boolean; noise: boolean };
  };
  audio: {
    enabled: boolean;
    /** 0-1 */
    volume: number;
  };
  feed: {
    /** Same-key publishes inside this window fold into one line. */
    coalesceMs: number;
    toastDurationMs: number;
    toastPosition: "top-right" | "bottom-right" | "bottom-left" | "top-left" | "bottom-center";
    maxToasts: number;
  };
  home: {
    hero: HeroConfig;
    /** Render a card per feature module. */
    showModuleGrid: boolean;
    /** Render the "make it yours" agent instructions block. */
    showAgentGuide: boolean;
  };
  links: SiteLink[];
  /** Which demo modules to load. Set to [] once you have your own. */
  demoModules: string[];
}

export type SiteInput = Omit<Partial<SiteConfig>, "layout" | "theme" | "audio" | "feed" | "home"> & {
  name: string;
  tagline: string;
  layout?: Partial<SiteConfig["layout"]>;
  theme?: Partial<Omit<SiteConfig["theme"], "effects">> & { effects?: Partial<SiteConfig["theme"]["effects"]> };
  audio?: Partial<SiteConfig["audio"]>;
  feed?: Partial<SiteConfig["feed"]>;
  home?: Partial<Omit<SiteConfig["home"], "hero">> & { hero?: Partial<HeroConfig> };
};

export function defineSite(input: SiteInput): SiteConfig {
  return {
    name: input.name,
    tagline: input.tagline,
    description: input.description ?? input.tagline,
    logoMark: input.logoMark ?? input.name.slice(0, 1).toUpperCase(),
    version: input.version ?? "0.1.0",
    ...(input.repository ? { repository: input.repository } : {}),
    layout: {
      topTabs: true,
      sidebar: "collapsible",
      statusBar: true,
      contentWidth: "full",
      ...input.layout,
    },
    theme: {
      defaultMode: "dark",
      accentHue: 235,
      radius: 6,
      density: "compact",
      font: "system",
      ...input.theme,
      effects: { grid: false, glow: false, scanlines: false, noise: false, ...input.theme?.effects },
    },
    audio: { enabled: true, volume: 0.35, ...input.audio },
    feed: {
      coalesceMs: 15_000,
      toastDurationMs: 3_500,
      toastPosition: "bottom-right",
      maxToasts: 4,
      ...input.feed,
    },
    home: {
      showModuleGrid: true,
      showAgentGuide: true,
      ...input.home,
      hero: {
        title: input.name,
        subtitle: input.tagline,
        ...input.home?.hero,
      },
    },
    links: input.links ?? [],
    demoModules: input.demoModules ?? ["showcase"],
  };
}

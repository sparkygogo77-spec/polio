/**
 * Site format options — the declarative knobs that describe the site being
 * built (as opposed to `core/settings`, which configures the builder itself).
 *
 * These are declared, not hand-built: the Format panel renders every field
 * generically and the compiler writes every non-default value into the brief.
 * Adding an option here is a one-line change that shows up in both.
 */
import type { LucideIcon } from "lucide-react";
import { Blend, Boxes, Compass, Layers, MousePointerClick, Sparkles, Type, Wrench } from "lucide-react";

export type FormatFieldType = "select" | "slider" | "toggle" | "text";

export interface FormatField {
  id: string;
  group: string;
  label: string;
  type: FormatFieldType;
  default: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** Hidden until "all options" is switched on. */
  advanced?: boolean;
  placeholder?: string;
}

export interface FormatGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

export const FORMAT_GROUPS: FormatGroup[] = [
  { id: "concept", label: "Concept", icon: Compass, blurb: "What this is and who it's for." },
  { id: "pages", label: "Pages & Navigation", icon: Layers, blurb: "How many pages and how you move between them." },
  { id: "scroll", label: "Scroll", icon: Boxes, blurb: "What scrolling down feels like." },
  { id: "type", label: "Type & Text Boxes", icon: Type, blurb: "Typography and how text blocks are set." },
  { id: "layout", label: "Layout", icon: Layers, blurb: "Grid, width, spacing, shape." },
  { id: "palette", label: "Colour", icon: Blend, blurb: "Theme, accent and background treatment." },
  { id: "motion", label: "Motion", icon: Sparkles, blurb: "How much things move." },
  { id: "feel", label: "Feel", icon: MousePointerClick, blurb: "Sound, haptics, menus, shortcuts." },
  { id: "build", label: "Build", icon: Wrench, blurb: "Stack, data, deployment, quality bars." },
];

const sel = (id: string, group: string, label: string, options: string[], extra: Partial<FormatField> = {}): FormatField =>
  ({ id, group, label, type: "select", default: options[0]!, options, ...extra });
const num = (id: string, group: string, label: string, def: number, min: number, max: number, step = 1, extra: Partial<FormatField> = {}): FormatField =>
  ({ id, group, label, type: "slider", default: def, min, max, step, ...extra });
const bool = (id: string, group: string, label: string, def: boolean, extra: Partial<FormatField> = {}): FormatField =>
  ({ id, group, label, type: "toggle", default: def, ...extra });
const txt = (id: string, group: string, label: string, extra: Partial<FormatField> = {}): FormatField =>
  ({ id, group, label, type: "text", default: "", ...extra });

export const FORMAT_FIELDS: FormatField[] = [
  /* concept */
  sel("concept.kind", "concept", "Kind of site", ["marketing site", "portfolio", "web app", "dashboard", "online store", "documentation", "blog / publication", "community", "game or toy", "single landing page", "experiment / art piece", "internal tool"]),
  txt("concept.audience", "concept", "Audience", { placeholder: "who is this for?" }),
  sel("concept.tone", "concept", "Tone", ["confident", "playful", "minimal", "editorial", "technical", "luxurious", "brutalist", "warm", "mysterious", "retro", "clinical"]),
  txt("concept.reference", "concept", "Feels like", { placeholder: "a site or era to echo", advanced: true }),
  txt("concept.avoid", "concept", "Avoid", { placeholder: "what this must not become", advanced: true }),

  /* pages */
  sel("pages.routing", "pages", "Routing", ["multi-page", "single page, scrolled", "hybrid"], { hint: "Pages you add on the canvas become routes." }),
  sel("pages.nav", "pages", "Navigation style", ["top bar", "sidebar", "top + sidebar", "floating dock", "hidden / minimal", "full-screen menu"]),
  sel("pages.transition", "pages", "Page transition", ["fade", "none", "slide", "shared element", "curtain wipe"], { advanced: true }),
  sel("pages.footer", "pages", "Footer", ["standard", "minimal", "rich sitemap", "none"], { advanced: true }),
  bool("pages.breadcrumbs", "pages", "Breadcrumbs", false, { advanced: true }),
  bool("pages.search", "pages", "Site search", false),
  sel("pages.notFound", "pages", "404 page", ["helpful", "playful", "plain", "redirect home"], { advanced: true }),

  /* scroll */
  sel("scroll.mode", "scroll", "Scroll behaviour", ["normal", "snap to sections", "smooth / inertial", "horizontal", "scroll-driven story", "paged"]),
  sel("scroll.depth", "scroll", "Page length", ["medium", "short", "long", "very long"]),
  sel("scroll.reveal", "scroll", "Reveal on scroll", ["fade up", "none", "stagger", "blur in", "scale in", "clip wipe"]),
  bool("scroll.progress", "scroll", "Scroll progress indicator", false),
  bool("scroll.parallax", "scroll", "Parallax layers", false),
  bool("scroll.backToTop", "scroll", "Back to top", false, { advanced: true }),
  bool("scroll.infinite", "scroll", "Infinite scroll", false, { advanced: true }),
  bool("scroll.anchors", "scroll", "Deep-linkable anchors", true, { advanced: true }),
  sel("scroll.header", "scroll", "Header on scroll", ["stays", "shrinks", "hides then shows", "blurs", "none"], { advanced: true }),

  /* type & text boxes */
  sel("type.headingFamily", "type", "Heading font", ["geometric sans", "grotesque sans", "serif", "display", "condensed", "monospace", "handwritten"]),
  sel("type.bodyFamily", "type", "Body font", ["system sans", "humanist sans", "serif", "monospace"]),
  sel("type.scale", "type", "Type scale", ["1.25 major third", "1.2 minor third", "1.333 perfect fourth", "1.5 perfect fifth", "1.618 golden"]),
  num("type.baseSize", "type", "Base size", 16, 13, 22, 1, { unit: "px" }),
  num("type.lineHeight", "type", "Line height", 1.55, 1.1, 2, 0.05),
  num("type.measure", "type", "Line length", 66, 40, 100, 1, { unit: "ch", hint: "Characters per line before wrapping." }),
  sel("type.align", "type", "Text alignment", ["left", "center", "justified"]),
  sel("type.textBox", "type", "Text box style", ["plain", "bordered", "filled", "card", "underlined", "quoted", "inset shadow"], { hint: "How blocks of text are framed." }),
  num("type.boxPadding", "type", "Text box padding", 16, 0, 48, 2, { unit: "px", advanced: true }),
  num("type.paragraphSpacing", "type", "Paragraph spacing", 16, 4, 48, 2, { unit: "px", advanced: true }),
  sel("type.headingCase", "type", "Heading case", ["sentence case", "title case", "UPPERCASE", "lowercase"], { advanced: true }),
  sel("type.letterSpacing", "type", "Letter spacing", ["normal", "tight", "wide", "very wide"], { advanced: true }),
  sel("type.linkStyle", "type", "Link style", ["underline on hover", "always underlined", "colour only", "bracketed", "highlighted"], { advanced: true }),
  sel("type.listStyle", "type", "List style", ["standard", "dashes", "custom markers", "numbered emphasis"], { advanced: true }),
  bool("type.dropCap", "type", "Drop caps", false, { advanced: true }),
  bool("type.balance", "type", "Balance headings", true, { advanced: true }),
  bool("type.hyphenate", "type", "Hyphenate body text", false, { advanced: true }),

  /* layout */
  sel("layout.width", "layout", "Content width", ["readable", "wide", "full bleed", "narrow"]),
  sel("layout.density", "layout", "Density", ["balanced", "airy", "dense"]),
  num("layout.radius", "layout", "Corner radius", 10, 0, 32, 1, { unit: "px" }),
  sel("layout.grid", "layout", "Grid", ["12 column", "8 column", "bento", "freeform", "single column"]),
  num("layout.gap", "layout", "Spacing", 24, 4, 80, 2, { unit: "px", advanced: true }),
  sel("layout.borders", "layout", "Borders", ["hairline", "none", "heavy", "dashed"], { advanced: true }),
  sel("layout.shadow", "layout", "Shadows", ["soft", "none", "hard", "glow"], { advanced: true }),
  sel("layout.imagery", "layout", "Imagery", ["photography", "illustration", "3D render", "abstract shapes", "none"], { advanced: true }),

  /* palette */
  sel("palette.mode", "palette", "Theme", ["dark", "light", "both", "follows system"]),
  num("palette.accentHue", "palette", "Accent hue", 265, 0, 360, 1, { unit: "°" }),
  sel("palette.scheme", "palette", "Colour scheme", ["duotone", "monochrome", "vibrant", "pastel", "high contrast", "earthy", "neon", "muted"]),
  sel("palette.background", "palette", "Background", ["flat", "subtle gradient", "grid", "noise / grain", "mesh gradient", "image", "animated"]),
  sel("palette.contrast", "palette", "Contrast", ["standard", "high", "soft"], { advanced: true }),

  /* motion */
  sel("motion.level", "motion", "Motion", ["moderate", "rich", "minimal", "none"]),
  sel("motion.easing", "motion", "Easing", ["natural", "snappy", "gentle", "springy", "linear"], { advanced: true }),
  num("motion.duration", "motion", "Base duration", 240, 60, 800, 20, { unit: "ms", advanced: true }),
  sel("motion.hover", "motion", "Hover response", ["lift", "none", "glow", "tilt", "magnetic", "colour shift"], { advanced: true }),
  sel("motion.loading", "motion", "Loading state", ["skeleton", "spinner", "progress bar", "none"], { advanced: true }),

  /* feel */
  bool("feel.contextMenus", "feel", "Right-click menus everywhere", true, { hint: "Custom menus on every meaningful element." }),
  bool("feel.commandPalette", "feel", "Command palette", true),
  bool("feel.shortcuts", "feel", "Keyboard shortcuts", true),
  bool("feel.sound", "feel", "Sound cues", false),
  bool("feel.haptics", "feel", "Haptics", false, { advanced: true }),
  bool("feel.optimistic", "feel", "Optimistic feedback", true, { advanced: true }),
  bool("feel.toasts", "feel", "Toasts that never repeat", true, { advanced: true }),
  sel("feel.cursor", "feel", "Cursor", ["default", "custom dot", "trail", "spotlight", "magnetic"], { advanced: true }),

  /* build */
  sel("build.stack", "build", "Stack", ["extend this template (Next.js + Tailwind)", "fresh Next.js app", "static HTML/CSS/JS", "Astro", "Vite + React", "SvelteKit", "whatever fits best"]),
  sel("build.data", "build", "Data", ["none / static", "local JSON", "database", "external API", "CMS", "user-generated"]),
  bool("build.auth", "build", "Accounts & auth", false),
  sel("build.a11y", "build", "Accessibility bar", ["WCAG AA", "WCAG AAA", "best effort"], { advanced: true }),
  sel("build.perf", "build", "Performance bar", ["fast on mid-range mobile", "desktop first", "no constraint"], { advanced: true }),
  bool("build.seo", "build", "SEO & metadata", true, { advanced: true }),
  bool("build.analytics", "build", "Analytics", false, { advanced: true }),
  bool("build.i18n", "build", "Multiple languages", false, { advanced: true }),
  bool("build.tests", "build", "Tests", false, { advanced: true }),
];

export type FormatValues = Record<string, string | number | boolean>;

export function formatDefaults(): FormatValues {
  const out: FormatValues = {};
  for (const x of FORMAT_FIELDS) out[x.id] = x.default;
  return out;
}

export function formatLabel(field: FormatField, value: string | number | boolean): string {
  if (field.type === "toggle") return value ? "yes" : "no";
  if (field.type === "slider") return `${value}${field.unit ?? ""}`;
  return String(value);
}

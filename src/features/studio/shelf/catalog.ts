/**
 * ============================================================================
 *  UNIVERSAL FEATURE CATALOG
 * ============================================================================
 *
 * The vocabulary the Studio canvas is built from. These are the *common*
 * building blocks that show up across good websites of every kind — not
 * terminal-specific. Terminal/power-UI lives in its own category because it is
 * one flavour among many, not the default.
 *
 * Agents: adding a feature here immediately makes it draggable onto the canvas,
 * searchable in the palette, right-clickable, and part of the compiled brief.
 * Nothing else needs to change. Keep `blurb` short — it is shown in the palette
 * and copied into the build brief.
 */
import type { LucideIcon } from "lucide-react";
import { SHELF_GROUPS, isWorkKey } from "./shelfGroups.ts";
import {
  Accessibility, Activity, AlignLeft, Archive, ArrowDown, AtSign, Award, BadgeCheck, BarChart3,
  Bell, Blend, Bookmark, BookOpen, Bot, Box, Boxes, Brain, Brush, Calendar, Camera, CaseSensitive,
  Check, CheckSquare, ChevronsDown, Circle, Clapperboard, Clock, Cloud, Code2, Cog, Coins, Columns3, Cpu,
  Command, Component, Compass, Contrast, Copy, CreditCard, Crown, Database, Dices, DollarSign,
  Download, Droplet, Eye, Feather, Film, Filter, Fingerprint, Flag, FlaskConical, Footprints,
  Gamepad2, Gauge, Ghost, GitBranch, Globe, GraduationCap, Grid2x2, Hand, Hash, Heading, Heart,
  HelpCircle, Highlighter, History as HistoryIcon, Home, Hourglass, Image as ImageIcon, Images, Inbox, Info, Keyboard,
  Languages, Layers, LayoutGrid, LayoutTemplate, Lightbulb, LineChart, Link2, List, ListOrdered,
  Lock, LoaderCircle, Magnet, Mail, Map as MapIcon, MapPin, Megaphone, Menu, MessageSquare, Mic, Milestone, Minus, Monitor,
  Moon, MousePointer2, MousePointerClick, Move, Music, Navigation as NavigationIcon, Network, Newspaper, Orbit,
  Package, Palette, PanelLeft, PanelTop, Paperclip, PenTool, Percent, PieChart, Pin, Podcast,
  Printer, Puzzle, QrCode, Quote, Radar, Radio, RefreshCw, Rocket, RotateCw, Route, Rows3, Rss,
  Scan, ScrollText, Search, Send, Server, Share2, Shapes, Shield, ShieldCheck, ShoppingCart,
  Signature, Signpost, SlidersHorizontal, Smartphone, Sparkles, Spline, Square, Sticker, Store,
  StretchHorizontal, Sun, Sunrise, Table2, Tag, Target, Telescope, Terminal, Timer, ToggleLeft,
  TrendingUp, Triangle, Trophy, Type, Undo2, Upload, User, Users, Verified, Video, Volume2, Wallet, Wand2,
  Waves, Waypoints, Wifi, Workflow, WrapText, Zap,
} from "lucide-react";

export interface FeatureOption {
  id: string;
  label: string;
  /** First value is the default. */
  values: string[];
  /**
   * "one" (the default) is a pick from a list. "set" is any number of them at
   * once, stored as a comma-separated string and drawn as chips you switch on
   * and off — which is what "these links, and this one, not that one" needs
   * to be. `values` is then the whole shelf of presets on offer, and
   * `preset` is what a part arrives with.
   */
  kind?: "one" | "set" | "range";
  /** For a set: what is on when the part is first placed. */
  preset?: string;
  /**
   * For a range: a number on a slider rather than a pick from a list.
   *
   * Some things a part can be told are not a short list of names — how big,
   * how far over, what colour, how much glow — and a list of five sizes is a
   * list of five compromises. A range keeps `values` as a single entry, the
   * default, so everything that reads `values[0]` still works; the slider
   * runs from `min` to `max` and the value is stored as the number in a
   * string, like every other option.
   */
  range?: { min: number; max: number; step?: number; unit?: string };
}

/** A range option, written the way the parts read it. */
export function range(id: string, label: string, def: number, min: number, max: number, extra: { step?: number; unit?: string } = {}): FeatureOption {
  return { id, label, kind: "range", values: [String(def)], range: { min, max, step: extra.step ?? 1, unit: extra.unit } };
}

/**
 * The options that are about how a part *moves* rather than how it is laid
 * out. The wheel puts these under Animation, as Behaviour; every other option
 * is under Edit.
 */
export const MOTION_OPTION_IDS: ReadonlySet<string> = new Set(["speed", "autoplay", "motion", "sticky", "onScroll"]);

export interface FeatureDef {
  id: string;
  name: string;
  category: CategoryId;
  icon: LucideIcon;
  /** One line, shown in the palette and copied into the brief. */
  blurb: string;
  tags?: string[];
  /** Seed text for the element's own prompt when it is dropped. */
  hint?: string;
  options?: FeatureOption[];
  /**
   * What this part CONTAINS, typed as a comma-separated list or free text —
   * tab labels, nav links, what a search box searches over. The board draws
   * whatever is typed here, so the part looks like itself.
   */
  content?: { label: string; placeholder: string };
  /** What it is and when you would want it — shown on hover, for parts whose name isn't enough. */
  explain?: string;
  /** Default footprint on a 1440-wide page. Category defaults apply when unset. */
  w?: number;
  h?: number;
  /**
   * This part is a preset of another one.
   *
   * A repository's elements arrive as presets: a real library part, with
   * the words, colours, type and layout measured off the page it came
   * from. `basedOn` names the part that actually draws, and `preset` is
   * what the node arrives wearing. Nothing else in the app had to learn a
   * new kind of part — a preset drops as an ordinary node.
   */
  basedOn?: string;
  preset?: {
    content?: string;
    options?: Record<string, string>;
    colour?: unknown;
    font?: unknown;
    prompt?: string;
    label?: string;
  };
  /** Where it came from, for the one line the card says under its name. */
  from?: string;
}

/**
 * The twelve kinds of part. A kind says what a part IS (a picture, a first
 * screen, something you press), and code reads it for that: a picture lays
 * out as media, a press feature takes the press. Shop lives inside Forms
 * (both are the visitor handing you something); the dense views and the
 * terminal live with Data, the keyboard-first parts with Interaction.
 */
export type BuiltInCategory =
  | "structure" | "nav" | "hero" | "content" | "media" | "motion" | "interact"
  | "forms" | "data" | "social" | "ai" | "platform";
/**
 * The shelf's six categories, and the ones a connected repository brings
 * with it.
 *
 * SIX, BY PURPOSE. Twelve was too many to find anything in (builder audit,
 * section 3), so the shelf shows six and every kind is filed in one of them
 * (`SHELF_OF`). A part keeps its kind; only where the shelf shows it moved.
 *
 * A repository's elements land in a category of their own, named after the
 * repository — that was the ask, and a category is a string id from the
 * shelf's point of view. `(string & {})` keeps the twelve in autocomplete
 * while letting `repo:owner/name` through, so nothing that reads a
 * category id had to be widened by hand.
 */
export type CategoryId = BuiltInCategory | (string & {});

export interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  blurb: string;
  /**
   * The colour that says which kind of part this is.
   *
   * At least 30 degrees apart, spread all the way round: below about 25 at
   * this chroma two categories read as one. When twelve became six, each
   * kept the colour it had (Layout blue, Motion cyan, Words yellow, Engine
   * orange); Data moved 10 so the six still reach every quarter of the
   * wheel.
   */
  hue: number;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "structure", label: "Layout and menus", icon: LayoutTemplate, blurb: "How the page is divided, and how people move around it.", hue: 200 },
  { id: "content", label: "Words and pictures", icon: Type, blurb: "The first screen, words, pictures, video and 3D.", hue: 80 },
  { id: "motion", label: "Motion and interaction", icon: Waves, blurb: "What moves, and what answers a press, a hover or a key.", hue: 170 },
  { id: "forms", label: "Forms and shop", icon: CheckSquare, blurb: "Capturing what people type, and selling things.", hue: 110 },
  { id: "data", label: "Data", icon: BarChart3, blurb: "Numbers made legible, and the dense views.", hue: 270 },
  { id: "platform", label: "People, AI and engine", icon: Cpu, blurb: "People and their traces, artificial intelligence (AI), and the things that make it real.", hue: 20 },
];

/** The shelf category each kind is filed in. A kind not named here is a category of its own. */
export const SHELF_OF: Readonly<Record<string, string>> = {
  nav: "structure", hero: "content", media: "content", interact: "motion", social: "platform", ai: "platform",
};
/** The shelf category a kind (or a category) is shown in. */
export const shelfCategoryOf = (kind: CategoryId): string => SHELF_OF[kind] ?? kind;

const f = (
  id: string, name: string, category: CategoryId, icon: LucideIcon, blurb: string,
  extra: Partial<FeatureDef> = {},
): FeatureDef => ({ id, name, category, icon, blurb, ...extra });

/** Reusable option sets. */
const density: FeatureOption = { id: "density", label: "Density", values: ["balanced", "airy", "dense"] };
const emphasis: FeatureOption = { id: "emphasis", label: "Emphasis", values: ["standard", "hero", "subtle"] };
const columns: FeatureOption = { id: "columns", label: "Columns", values: ["3", "2", "4", "auto"] };
const position: FeatureOption = { id: "position", label: "Position", values: ["top", "bottom", "left", "right", "inline"] };

const RAW: FeatureDef[] = [
  /* ---------------------------------------------------------------- structure */
  f("section-stack", "Stacked sections", "structure", Rows3, "Full-width sections stacked down the page.", { options: [density], hint: "Sections in this order, each one screen tall unless noted." }),
  f("bento-grid", "Tile grid", "structure", Grid2x2, "Mixed-size tiles in one grid, the modern feature showcase.", { options: [columns, density] }),
  f("split-screen", "Split screen", "structure", Columns3, "Two halves, often one sticky and one scrolling.", { options: [{ id: "sticky", label: "Sticky half", values: ["left", "right", "none"] }] }),
  f("masonry", "Staggered grid", "structure", LayoutGrid, "Uneven heights packed without gaps.", { options: [columns] }),
  f("sidebar-layout", "Sidebar", "structure", PanelLeft, "Persistent side rail beside the content.", { options: [{ id: "side", label: "Side", values: ["left", "right"] }, { id: "behaviour", label: "Behaviour", values: ["collapsible", "fixed", "overlay"] }] }),
  f("holy-grail", "Header, body, footer", "structure", LayoutTemplate, "The dependable three-band page.", {}),
  f("box", "Box", "structure", Square, "A plain box: its colour, its edge, its padding and the words you put in it, and nothing of its own.", { tags: ["plain", "container", "div", "frame", "import", "captured"] }),
  f("card-grid", "Card grid", "structure", Boxes, "Repeating cards from a list of items.", { options: [columns, density] }),
  f("tabs-panel", "Tabs", "structure", Component, "Switch between panels in place.", { options: [{ id: "style", label: "Style", values: ["underline", "pill", "segmented"] }] }),
  f("accordion", "Expanding rows", "structure", ChevronsDown, "Collapsible rows that expand one at a time.", {}),
  f("modal", "Popup window", "structure", Box, "Focused overlay for one task.", { options: [{ id: "size", label: "Size", values: ["medium", "small", "large", "full"] }] }),
  f("drawer", "Slide-in panel", "structure", PanelTop, "Panel that slides in from an edge.", { options: [position] }),
  f("multi-page", "Several pages", "structure", Layers, "More than one route, with shared chrome.", { hint: "List each page and what lives on it." }),
  f("footer", "Footer", "structure", Milestone, "Links, legal, contact, social, as thin or as full as you want.", {
    options: [
      { id: "shape", label: "Shape", values: ["Thin bar", "Two rows", "Columns"] },
      { id: "social", label: "Social", kind: "set", preset: "X, GitHub, Instagram", values: ["X", "GitHub", "Instagram", "YouTube", "LinkedIn", "TikTok", "Discord", "Mastodon", "Bluesky", "RSS", "Email"] },
      { id: "legal", label: "Legal line", values: ["Copyright", "Copyright + policies", "None"] },
    ],
  }),
  f("container-width", "Content width", "structure", StretchHorizontal, "How wide text and blocks are allowed to run.", { options: [{ id: "width", label: "Width", values: ["readable", "wide", "full-bleed"] }] }),

  /* -------------------------------------------------------------------- nav */
  f("sticky-header", "Sticky top bar", "nav", PanelTop, "Nav that stays put, often shrinking on scroll.", { options: [{ id: "onScroll", label: "On scroll", values: ["shrink", "hide-then-show", "static", "blur"] }] }),
  f("mega-menu", "Big dropdown menu", "nav", Menu, "Wide dropdown with grouped links and previews.", {}),
  f("breadcrumbs", "Breadcrumb trail", "nav", Signpost, "Where you are in the hierarchy.", {}),
  f("scrollspy-nav", "Section tracker", "nav", ScrollText, "Side nav that highlights the section you're in.", {}),
  f("mobile-nav", "Phone menu", "nav", Smartphone, "Hamburger, bottom bar or full-screen menu.", { options: [{ id: "style", label: "Style", values: ["sheet", "bottom-bar", "fullscreen"] }] }),
  f("page-transitions", "Page transitions", "motion", Spline, "Animated movement between routes.", { options: [{ id: "style", label: "Style", values: ["fade", "slide", "shared-element", "curtain"] }] }),
  f("search-nav", "Search box", "nav", Search, "Search across all content with results as you type.", {}),
  f("toc", "Table of contents", "nav", List, "Generated outline of a long document.", {}),
  f("pagination", "Page numbers", "nav", ListOrdered, "Page-by-page rather than endless scroll.", {}),
  f("back-to-top", "Back to top", "motion", ArrowDown, "Return to the start of a long page.", {}),
  f("sitemap-page", "Site map", "nav", MapIcon, "One page listing everything.", {}),

  /* ------------------------------------------------------------------- hero */
  f("hero-split", "Split hero", "hero", Columns3, "Headline one side, visual the other.", { options: [emphasis], w: 150 }),
  f("hero-video", "Video hero", "hero", Clapperboard, "Full-bleed muted video behind the headline.", {}),
  f("hero-gradient", "Moving gradient", "hero", Blend, "Slow-moving mesh gradient background.", {}),
  f("hero-typewriter", "Rotating headline", "hero", CaseSensitive, "Headline that types or cycles through phrases.", {}),
  f("hero-particles", "Particle background", "hero", Orbit, "Reactive dots/lines behind the fold.", {}),
  f("hero-3d", "Tilting solid object", "hero", Boxes, "An object behind the headline that turns or tilts as the visitor moves.", {}),
  f("hero-scroll-cue", "Scroll hint", "hero", ChevronsDown, "A hint that there's more below.", {}),
  f("value-prop", "One-line pitch", "hero", Target, "One sentence saying what this is and who it's for.", { hint: "Say the promise in one sentence." }),
  f("cta-primary", "Main button", "hero", Rocket, "The single most important button.", { options: [emphasis] }),
  f("invite-panel", "Invitation panel", "hero", Megaphone, "The panel a page ends on: a label, a headline and one button, in a box.", { tags: ["cta", "banner", "join", "newsletter", "footer call"] }),
  f("social-proof-strip", "Trust strip", "hero", Verified, "Logos or numbers right under the fold.", {}),

  /* ---------------------------------------------------------------- content */
  f("prose", "Text block", "content", AlignLeft, "Long-form text with proper rhythm and hierarchy.", { options: [{ id: "measure", label: "Measure", values: ["66ch", "58ch", "76ch", "full"] }] }),
  f("eyebrow-rule", "Eyebrow label", "content", Minus, "A small line of type over a heading, with a rule beside it.", { tags: ["kicker", "label", "overline", "mono"] }),
  f("heading-scale", "Heading sizes", "content", Heading, "Consistent heading sizes and weights.", { options: [{ id: "ratio", label: "Ratio", values: ["1.25 major third", "1.2 minor third", "1.333 perfect fourth", "1.5 perfect fifth"] }] }),
  f("fluid-type", "Text that scales", "content", WrapText, "Type that scales smoothly with the viewport.", {}),
  f("drop-cap", "Big first letter", "content", Type, "Oversized opening letter.", {}),
  f("pull-quote", "Pulled quote", "content", Quote, "A line lifted out and set large.", {}),
  f("highlight", "Highlighted text", "content", Highlighter, "Marker-pen emphasis on key phrases.", {}),
  f("kinetic-type", "Animated text", "content", Sparkles, "Text that animates as it enters.", {}),
  f("marquee", "Scrolling ticker", "content", Radio, "Continuously scrolling strip of text.", { options: [{ id: "speed", label: "Speed", values: ["slow", "medium", "fast"] }] }),
  f("code-block", "Code box", "content", Code2, "Syntax-highlighted code with copy.", {}),
  f("callout", "Note boxes", "content", Info, "Note / warning / tip boxes inside prose.", {}),
  f("faq", "Questions & answers", "content", HelpCircle, "Questions people actually ask, answered.", {}),
  f("changelog", "What's new list", "content", HistoryIcon, "Dated list of what changed.", {}),
  f("blog-index", "Articles", "content", Newspaper, "Index plus article pages.", {}),
  f("docs", "Documentation", "content", BookOpen, "Structured reference with nav and search.", {}),
  f("reading-time", "Reading time", "content", Clock, "Estimated minutes to read.", {}),
  f("footnotes", "Footnotes", "content", Paperclip, "Sourced claims with references.", {}),
  f("rss", "Feed / newsletter", "content", Rss, "Syndicate the content.", {}),
  f("textbox-format", "Text box style", "content", CaseSensitive, "Padding, borders, alignment and rhythm for text blocks.", { options: [{ id: "style", label: "Style", values: ["plain", "bordered", "filled", "card", "underlined"] }, { id: "align", label: "Align", values: ["left", "center", "justify"] }] }),

  /* ------------------------------------------------------------------ media */
  f("gallery", "Image gallery", "media", Images, "Grid of images that open larger.", { options: [columns] }),
  f("lightbox", "Full-screen viewer", "media", ImageIcon, "Full-screen viewer with keyboard nav.", {}),
  /*
   * What an import lands as, when it shrinks in rather than covering.
   *
   * A picture brought in from a file used to have one destination: a tiled
   * pattern layer across the whole page, half-transparent and repainted in
   * a palette colour. That is a *texture*, and it is the right answer when
   * somebody wants a background. It is the wrong answer, and the only
   * answer, when somebody wants a picture — so this is the part the picture
   * becomes: its own size, its own aspect, dragged and resized like any
   * other. It wears the picture through `node.texture`, which is the
   * mechanism parts already have for carrying one.
   */
  f("picture", "Picture", "media", ImageIcon, "One picture at its own size, dragged and resized like any part.", { tags: ["photo", "image", "import", "still", "frame"] }),
  f("carousel", "Slideshow", "media", Film, "Swipeable horizontal set of slides.", { options: [{ id: "autoplay", label: "Autoplay", values: ["off", "on"] }] }),
  f("before-after", "Before / after slider", "media", Contrast, "Draggable comparison slider.", {}),
  f("video-player", "Video player", "media", Video, "Custom player with chapters and captions.", {}),
  f("audio-player", "Audio player", "media", Music, "Waveform or minimal audio playback.", {}),
  f("podcast", "Episode list", "media", Podcast, "Episode list with inline playback.", {}),
  f("image-blur-up", "Blur-in images", "media", Droplet, "Low-res placeholder that sharpens.", {}),
  f("3d-viewer", "Model viewer", "media", Boxes, "A model of an object the visitor can turn round with the mouse.", {}),
  f("map-embed", "Map", "media", MapPin, "Interactive map with pins.", {}),
  f("photo-credit", "Captions & credits", "media", Camera, "Attribution under media.", {}),
  f("avatar-stack", "Profile picture row", "media", Users, "Overlapping profile pictures.", {}),

  /* ----------------------------------------------------------------- motion */
  f("scroll-snap", "Snap scrolling", "motion", Magnet, "Sections lock into place as you scroll.", { options: [{ id: "axis", label: "Axis", values: ["vertical", "horizontal"] }] }),
  f("parallax", "Depth scrolling", "motion", Layers, "Backgrounds move slower than foregrounds.", { options: [{ id: "strength", label: "Strength", values: ["subtle", "medium", "strong"] }] }),
  f("reveal-on-scroll", "Appear on scroll", "motion", Sunrise, "Elements fade/slide in as they enter.", { options: [{ id: "style", label: "Style", values: ["fade-up", "fade", "scale", "blur", "stagger"] }] }),
  f("sticky-story", "Pinned scroll story", "motion", ScrollText, "Pinned visual while text scrolls past.", {}),
  f("horizontal-scroll", "Sideways scrolling", "motion", StretchHorizontal, "A section that scrolls sideways.", {}),
  f("scroll-progress", "Scroll progress bar", "motion", LoaderCircle, "Bar or ring showing position in the page.", {}),
  f("scroll-video", "Scroll-controlled animation", "motion", Film, "Playhead tied to scroll position.", {}),
  f("infinite-scroll", "Endless scrolling", "motion", RefreshCw, "Load more as you reach the bottom.", {}),
  f("smooth-scroll", "Smooth scrolling", "motion", Waves, "Eased, inertial scrolling.", { options: [{ id: "strength", label: "Strength", values: ["light", "off", "heavy"] }] }),
  f("cursor-effects", "Custom cursor", "motion", MousePointer2, "Trail, magnet or spotlight cursor.", { options: [{ id: "style", label: "Style", values: ["dot", "trail", "spotlight", "picture"] }] }),
  f("hover-tilt", "Tilt on hover", "motion", Move, "Cards that tilt toward the pointer.", {}),
  f("page-load", "Opening animation", "motion", Hourglass, "Intro sequence on first paint.", {}),
  f("morph-transition", "Morphing transition", "motion", Spline, "An element that flies between views.", {}),
  f("confetti", "Celebration burst", "motion", Sparkles, "Confetti or burst on success.", {}),

  /* -------------------------------------------------------------- interact */
  f("context-menus", "Right-click menus", "interact", MousePointerClick, "Custom menus on every meaningful element.", { hint: "Say which elements get menus and what's in them." }),
  f("command-palette", "Command search", "interact", Command, "One keyboard shortcut opens a search that reaches everything.", {}),
  f("shortcuts", "Keyboard shortcuts", "interact", Keyboard, "Hotkeys with a cheat sheet.", {}),
  f("toasts", "Pop-up notices", "interact", Bell, "Transient feedback that doesn't stack up.", {}),
  f("optimistic-ui", "Instant feedback", "interact", Zap, "Actions read as done immediately.", {}),
  f("sound-cues", "Sound effects", "interact", Volume2, "Audio feedback for key actions.", { options: [{ id: "default", label: "Default", values: ["off", "on"] }] }),
  f("haptics", "Vibration", "interact", Smartphone, "Vibration on supported devices.", {}),
  f("drag-drop", "Drag & drop", "interact", Hand, "Rearrange or move things by dragging.", {}),
  f("inline-edit", "Edit in place", "interact", PenTool, "Edit in place rather than in a form.", {}),
  f("undo-redo", "Undo / redo", "interact", Undo2, "Reversible actions with history.", {}),
  f("copy-button", "Copy button", "interact", Copy, "One-click copy with confirmation.", {}),
  f("hover-card", "Hover preview", "interact", Sticker, "Rich preview on hover.", {}),
  f("tooltips", "Tooltips", "interact", Info, "Short explanations on demand.", {}),
  f("skeletons", "Loading placeholders", "interact", LoaderCircle, "Shape-of-the-content placeholders.", {}),
  f("empty-states", "Empty screens", "interact", Inbox, "What it looks like with no data yet.", {}),
  f("onboarding-tour", "First-time tour", "interact", Footprints, "Guided first run.", {}),
  f("whats-new", "What's new card", "interact", Megaphone, "Steps that show a visitor what the site has, live.", {}),
  f("magnetic-buttons", "Magnetic buttons", "interact", Magnet, "Buttons that lean toward the cursor.", {}),

  /* ----------------------------------------------------------------- forms */
  f("contact-form", "Contact form", "forms", Mail, "Name, message, and a reply path.", {}),
  f("multi-step-form", "Step-by-step form", "forms", Route, "Long form broken into steps with progress.", {}),
  f("inline-validation", "Live error checking", "forms", Check, "Errors shown as you type, not on submit.", {}),
  f("autosave", "Auto-save", "forms", RotateCw, "Never lose what was typed.", {}),
  f("file-upload", "File drop zone", "forms", Upload, "Drag files in, with progress.", {}),
  f("search-autocomplete", "Search suggestions", "forms", Search, "Suggestions as you type.", {}),
  f("filter-panel", "Filters", "forms", SlidersHorizontal, "Narrow a list by several criteria.", {}),
  f("date-picker", "Date picker", "forms", Calendar, "Pick dates, ranges or slots.", {}),
  f("rating", "Star rating", "forms", Heart, "Stars, hearts or thumbs.", {}),
  f("field", "Field", "forms", Keyboard, "One box to type in, or a list to choose from, as a page had it: the real input, its label and the name its code finds it by.", { tags: ["input", "text box", "textarea", "select", "dropdown", "import", "captured"], content: { label: "Its label", placeholder: "Your email address" }, w: 320, h: 64 }),
  f("checkbox", "Checkbox", "forms", CheckSquare, "One tick box (or a radio) with its words beside it, as a page had it.", { tags: ["check", "tick", "radio", "toggle", "import", "captured"], content: { label: "Its words", placeholder: "I agree to the terms" }, w: 300, h: 32 }),
  f("newsletter", "Email signup", "forms", Send, "Email capture with confirmation.", {}),
  f("booking", "Booking", "forms", Timer, "Pick a slot and confirm.", {}),
  f("survey", "Quiz / survey", "forms", CheckSquare, "Question flow with a result.", {}),
  f("captcha", "Spam protection", "forms", Shield, "Keep bots out without punishing people.", {}),

  /* -------------------------------------------------------------- commerce */
  f("product-grid", "Product grid", "forms", Store, "Browsable catalogue.", { options: [columns] }),
  f("product-detail", "Product page", "forms", Package, "Gallery, options, price, add to cart.", {}),
  f("cart-drawer", "Cart", "forms", ShoppingCart, "Slide-over cart with running total.", {}),
  f("checkout", "Checkout", "forms", CreditCard, "Address, payment, confirmation.", {}),
  f("pricing-table", "Pricing table", "forms", DollarSign, "Tiers side by side with a recommended one.", { options: [{ id: "tiers", label: "Tiers", values: ["3", "2", "4"] }] }),
  f("comparison-table", "Comparison table", "forms", Table2, "Feature-by-feature against alternatives.", {}),
  f("testimonials", "Testimonials", "hero", Quote, "Real quotes with names and faces.", {}),
  f("logo-cloud", "Logo row", "hero", BadgeCheck, "Customers or press logos.", {}),
  f("trust-badges", "Trust badges", "hero", ShieldCheck, "Guarantees, security, returns.", {}),
  f("countdown", "Countdown", "hero", Timer, "Time-limited offer.", {}),
  f("discount", "Promo codes", "forms", Percent, "Apply a code at checkout.", {}),
  f("wishlist", "Wishlist", "forms", Bookmark, "Save for later.", {}),
  f("subscription", "Subscriptions", "forms", Wallet, "Recurring plans and management.", {}),
  f("invoice", "Receipts", "forms", Printer, "Downloadable proof of purchase.", {}),
  f("affiliate", "Referral links", "forms", Share2, "Share links with attribution.", {}),

  /* ------------------------------------------------------------------ data */
  f("charts", "Charts", "data", LineChart, "Lines, bars, areas, legible in both themes.", { options: [{ id: "kind", label: "Kind", values: ["line", "bar", "area", "mixed"] }] }),
  f("stat-tiles", "Number tiles", "data", TrendingUp, "Headline numbers with change indicators.", { options: [columns] }),
  f("details-table", "Details table", "data", ListOrdered, "Label and value down a page, ruled, each one copyable.", { tags: ["facts", "specs", "contract", "copy", "key value"] }),
  f("data-table", "Data table", "data", Table2, "Sortable, filterable, paginated rows.", { options: [{ id: "rows", label: "Row count", values: ["hundreds", "dozens", "thousands+"] }] }),
  f("pie-breakdown", "Pie chart", "data", PieChart, "How a whole splits into parts.", {}),
  f("sparkline", "Mini trend lines", "data", Activity, "Tiny trend inline with a number.", {}),
  f("dashboard", "Dashboard", "data", Gauge, "Several linked views on one screen.", {}),
  f("timeline", "Timeline", "data", Milestone, "Events along an axis.", {}),
  f("kanban", "Board with columns", "data", Columns3, "Cards in columns you can drag between.", {}),
  f("calendar-view", "Calendar", "data", Calendar, "Month/week/day scheduling grid.", {}),
  f("live-feed", "Live feed", "data", Activity, "Streaming updates without refresh.", {}),
  f("export", "Download data", "data", Download, "Lets visitors download the numbers as a spreadsheet or document file.", {}),
  f("heatmap", "Heat map", "data", Grid2x2, "Density over two dimensions.", {}),
  f("leaderboard", "Leaderboard", "data", Trophy, "Ranked list with movement.", {}),
  f("progress-tracker", "Progress tracker", "data", Target, "How far toward a goal.", {}),

  /* ---------------------------------------------------------------- social */
  f("profiles", "Profiles", "social", User, "Public identity pages.", {}),
  f("comments", "Comments", "social", MessageSquare, "Threaded discussion with moderation.", {}),
  f("reactions", "Reactions", "social", Heart, "Lightweight response to content.", {}),
  f("share-sheet", "Share buttons", "social", Share2, "Share to platforms and copy link.", {}),
  f("activity-feed", "Activity feed", "social", Rss, "What people are doing, deduplicated.", {}),
  f("chat", "Chat", "social", MessageSquare, "Real-time conversation.", {}),
  f("follow", "Follow button", "social", Bell, "Opt into someone's updates.", {}),
  f("mentions", "@mentions & #tags", "social", AtSign, "Reference people and topics.", {}),
  f("moderation", "Moderation tools", "social", Shield, "Report, hide, block.", {}),
  f("community-badges", "Badges", "social", Award, "Earned status markers.", {}),
  f("forum", "Forum", "social", Hash, "Topic-first discussion.", {}),
  f("guestbook", "Guestbook", "social", Signature, "Leave a mark on the site.", {}),

  /* -------------------------------------------------------------------- ai */
  f("ai-chat", "AI chat", "ai", Bot, "Chat panel grounded in this site's content.", {}),
  f("ai-prompt-box", "Prompt box", "ai", Wand2, "A single input that generates something.", { hint: "Say what the prompt produces." }),
  f("ai-search", "Smart search", "ai", Telescope, "Meaning-based rather than keyword search.", {}),
  f("ai-summarize", "Summarise button", "ai", Feather, "Condense long content on demand.", {}),
  f("ai-generate-content", "AI-written section", "ai", Sparkles, "A region whose content the model writes.", {}),
  f("ai-recommend", "Recommendations", "ai", Lightbulb, "Suggest what to look at next.", {}),
  f("ai-autofill", "Smart auto-fill", "ai", Zap, "Model fills in fields from context.", {}),
  f("ai-moderation", "AI moderation", "ai", ShieldCheck, "Screen submissions automatically.", {}),
  f("ai-translate", "Auto translate", "ai", Languages, "Localise content on the fly.", {}),
  f("ai-voice", "Voice input", "ai", Mic, "Talk to it instead of typing.", {}),

  /* ----------------------------------------------------------------- power */
  f("virtualised-list", "Huge list", "data", List, "Thousands of rows without lag.", {}),
  f("dense-tables", "Dense rows", "data", Rows3, "Maximum information per pixel.", {}),
  f("multi-column-feed", "Side-by-side feeds", "data", Columns3, "Parallel live streams side by side.", { options: [columns] }),
  f("presets", "Saved presets", "interact", Bookmark, "Named configurations, switchable in one click.", {}),
  f("hotkey-first", "Keyboard-first", "interact", Keyboard, "Every action reachable without a mouse.", {}),
  f("status-bar", "Status bar", "data", Activity, "Persistent state along the bottom edge.", {}),
  f("blur-privacy", "Privacy blur", "interact", Eye, "Hide sensitive numbers for screen sharing.", {}),
  f("quick-action", "One-click action", "interact", Zap, "Execute with no confirmation dialog.", {}),
  f("split-panes", "Resizable panes", "data", Columns3, "Drag the divider between regions.", {}),
  f("terminal-console", "Command console", "data", Terminal, "Type commands, see output.", {}),
  f("realtime-stream", "Live data stream", "data", Wifi, "Push updates instead of polling.", {}),
  f("diff-view", "Change comparison", "data", GitBranch, "Side-by-side or inline change comparison.", {}),

  /* -------------------------------------------------------------- platform */
  f("dark-mode", "Dark / light mode", "platform", Moon, "Both themes, respecting the system setting.", { options: [{ id: "default", label: "Default", values: ["system", "dark", "light"] }] }),
  f("theming", "Theme picker", "platform", Palette, "User-adjustable colour and density.", {}),
  f("responsive", "Works on phones", "platform", Monitor, "Deliberate phone, tablet and desktop layouts.", {}),
  f("a11y", "Accessibility", "platform", Accessibility, "Keyboard, contrast, labels, focus order.", {}),
  f("i18n", "Languages", "platform", Globe, "Multiple languages and locales.", {}),
  f("seo", "Search engine setup", "platform", Radar, "Titles, descriptions, share pictures and a site map, so search engines and link previews show the site properly.", {}),
  f("analytics", "Analytics", "platform", BarChart3, "Track what people actually do.", {}),
  f("auth", "Accounts & login", "platform", Lock, "Sign in, sessions, permissions.", {}),
  f("database", "Saved data", "platform", Database, "Where the data actually lives.", {}),
  f("api", "Data for other apps", "platform", Server, "Lets other software read from and write to your site.", {}),
  f("pwa", "Works offline", "platform", Cloud, "Installable and usable without a connection.", {}),
  f("perf", "Speed budget", "platform", Gauge, "Fast on a mid-range phone.", {}),
  f("error-handling", "Error screens", "platform", Info, "What happens when things break.", {}),
  f("cookie-consent", "Cookie consent", "platform", Fingerprint, "Ask before tracking.", {}),
  f("email", "Automatic emails", "platform", Mail, "Receipts, resets, notifications.", {}),
  f("cms", "Content editing", "platform", PenTool, "Let non-developers change copy.", {}),
  f("versioning", "Drafts & versions", "platform", HistoryIcon, "Draft, publish, roll back.", {}),
  f("testing", "Tests", "platform", FlaskConical, "Prove it still works.", {}),

  /* ------------------------------------------------------------- wildcards */
  f("custom-idea", "New idea", "content", Lightbulb, "A feature that doesn't exist yet, describe it in the prompt.", { hint: "Describe the idea in your own words. This is the placeholder for something new.", tags: ["custom", "new", "idea", "blank"] }),
  f("gimmick", "Central idea", "content", Crown, "The one unusual thing this site is built around.", { hint: "The single idea everything else serves.", tags: ["core", "hook", "concept"], w: 150 }),
  f("wildcard", "Surprise me", "content", Dices, "Surprise me, let the model choose.", { tags: ["random", "surprise"] }),
  f("note", "Note", "content", Pin, "A written instruction pinned to the canvas.", { hint: "Anything the builder should know.", tags: ["comment", "annotation"] }),
  f("mood", "Mood / reference", "content", Palette, "Tone, era, or a site to feel like.", { hint: "Reference points and the feeling to aim for.", tags: ["style", "vibe", "reference"] }),
  f("constraint", "Rule", "content", Flag, "Something the build must not do.", { hint: "A hard limit: no frameworks, must load in 1s, no scroll-jacking…", tags: ["limit", "rule"] }),
  f("scan-region", "Named area", "structure", Scan, "A named area of the page, so several parts can be talked about together.", { tags: ["frame", "zone"], w: 150 }),
  f("integration", "Connect a service", "platform", Puzzle, "Connect to a third-party service.", { hint: "Which service, and what it does here." }),
  f("gamification", "Points & levels", "interact", Gamepad2, "Points, streaks, levels, unlocks.", {}),
  f("easter-egg", "Hidden surprise", "interact", Ghost, "A hidden thing for people who poke around.", {}),
  f("generative-art", "Generated artwork", "media", Shapes, "Code-drawn artwork, seeded and unique.", {}),
  f("orb-css", "Orb, drawn", "media", Circle, "A planet drawn by the page itself, no picture needed: it turns on its own and drags round any way, with orbit rings and a tag.", { tags: ["sphere", "ball", "planet", "gradient", "css"] }),
  f("orb-webgl", "Orb, turnable", "media", Globe, "A real sphere drawn by the graphics card that turns and relights under the pointer.", { tags: ["sphere", "three", "webgl", "3d", "planet"] }),
  f("orb-image", "Orb, from a picture", "media", Orbit, "A planet with your picture wrapped round it: it turns on its own and drags round any way, with orbit rings, a glow and a tag.", { tags: ["sphere", "photo", "render", "planet"] }),
  f("shape-sphere", "Sphere", "media", Globe, "A ball you can turn: drag it round any way to see every side. A picture wraps round it.", { hint: "A picture to wrap round it, as an address or a path.", tags: ["sphere", "ball", "globe", "planet", "3d", "turn", "rotate", "shape"], w: 420, h: 420 }),
  f("shape-cube", "Cube", "media", Box, "A cube you can turn: drag it round any way to see every side, with a picture on each face.", { hint: "Pictures, one per face: front, right, back, left, top, bottom. Fewer go round again.", tags: ["cube", "box", "3d", "turn", "rotate", "shape", "dice"], w: 420, h: 420 }),
  f("shape-pyramid", "Pyramid", "media", Triangle, "A pyramid you can turn: drag it round any way to see every side, with a picture on each face.", { hint: "Pictures, one per face: the four sides, then the base. Fewer go round again.", tags: ["pyramid", "triangle", "3d", "turn", "rotate", "shape"], w: 420, h: 420 }),
  f("cube-3d", "Word cube", "media", Box, "Six faces in real depth: drag to turn it, arrow keys to step round, and words on every side.", { hint: "One line per face, in the order you want them: front, right, back, left, top, bottom.", tags: ["cube", "box", "3d", "isometric", "faces", "turn", "rotate"], w: 420, h: 420 }),
  f("mesh-3d", "Solid", "media", Boxes, "A drawing made into a thing you can turn: a real mesh, dragged round with the pointer or the arrow keys.", { tags: ["3d", "solid", "mesh", "model", "turn", "rotate", "object", "sculpt"], w: 420, h: 420 }),
  f("drawn-icon", "Your drawing, as an icon", "media", PenTool, "The lines you drew, small and crisp, in whatever colour they sit on. Drops onto a button.", { hint: "Draw it on the board and make it real; this shows the drawing itself.", tags: ["icon", "glyph", "mark", "logo", "drawn", "vector", "symbol"], w: 96, h: 96 }),
  f("corner-glow", "Corner glow", "media", Sun, "A wash of colour blurred into a corner, the way a light off-screen falls on a dark page.", { tags: ["vignette", "glow", "gradient", "atmosphere"] }),
  f("physics", "Physics", "motion", Orbit, "Things that move like they have mass.", {}),
  f("weather-time", "Time & weather aware", "platform", Sun, "Changes with the visitor's clock or weather.", {}),
  f("qr-bridge", "Phone hand-off code", "platform", QrCode, "A square code the phone camera reads, to carry what is open from computer to phone.", {}),
  f("print", "Print layout", "platform", Printer, "Looks right on paper or saved as a document file.", {}),
  f("archive-mode", "Archive", "platform", Archive, "Everything that came before, browsable.", {}),
  f("network-graph", "Connection map", "data", Network, "Nodes and edges you can explore.", {}),
  f("workflow-builder", "Workflow builder", "interact", Workflow, "Let users wire steps together.", {}),
  f("collab-cursors", "Live cursors", "social", Users, "See other people's cursors live.", {}),
  f("brand-system", "Brand kit", "platform", Brush, "Logo, palette, type, voice, applied consistently.", {}),
  f("waypoint", "Where paths meet", "structure", Waypoints, "A note marking the point where several journeys through the site meet.", {}),
  f("micro-copy", "Tone of voice", "content", Feather, "How buttons, errors and empties are worded.", { hint: "The voice: dry, warm, playful, terse…" }),
  f("cog-settings", "Settings panel", "interact", Cog, "Let people change how the site behaves.", {}),
  f("compass-onboard", "First visit", "interact", Compass, "What a brand-new visitor sees.", {}),
  f("home-anchor", "Home", "nav", Home, "The page everything returns to.", {}),
  f("tagging", "Tags", "content", Tag, "Organise and cross-link content.", {}),
  f("graduation", "Simple then deep", "interact", GraduationCap, "Simple by default, deep when you dig.", {}),
  f("coin-economy", "Points / currency", "forms", Coins, "An in-site economy.", {}),
];

/* ------------------------------------------------------------------ */
/* Real sizes, shapes and contents                                     */
/* ------------------------------------------------------------------ */

/** Footprints on a 1440-wide page: [width, height]. */
const CATEGORY_SIZE: Record<CategoryId, [number, number]> = {
  structure: [1440, 360],
  nav: [1440, 64],
  hero: [1440, 520],
  content: [720, 260],
  media: [1200, 360],
  motion: [420, 88],
  interact: [420, 88],
  forms: [520, 340],
  data: [680, 340],
  social: [560, 260],
  ai: [520, 320],
  platform: [420, 88],
};

const shape: FeatureOption = { id: "shape", label: "Shape", values: ["rounded", "pill", "square", "underlined"] };
/*
 * The button's own two options. They are read by the one component behind
 * cta-primary, quick-action and follow, and were offered by the first alone,
 * so the other two could be drawn solid and nothing else — an option a part
 * honours and the catalog does not offer is a control nobody can reach.
 */
const variant: FeatureOption = { id: "variant", label: "Variant", values: ["solid", "outline", "ghost"] };
const btnSize: FeatureOption = { id: "size", label: "Size", values: ["medium", "small", "large"] };

/**
 * Where a display line changes colour: nowhere, at its last word, or at its
 * last sentence. Two lines that turn on the second is what a headline on a
 * dark page nearly always does, and it could not be said at all.
 */
const turnOption = (def: string): FeatureOption => ({
  id: "turn",
  label: "Turns colour",
  values: [def, ...["none", "last word accent", "last word muted", "second sentence accent", "second sentence muted"].filter((v) => v !== def)],
});

const yesNo = (id: string, label: string, def: "yes" | "no"): FeatureOption => ({ id, label, values: def === "yes" ? ["yes", "no"] : ["no", "yes"] });

/** Per-part overrides: real size, shape options, and what it contains. */
const DETAILS: Record<string, Partial<FeatureDef>> = {
  // Sizes kept from the categories these parts left in the regroup: the
  // move changed where a part is found, never its footprint on the page.
  "product-detail": { w: 1200, h: 420 },
  "wishlist": { w: 1200, h: 420 },
  "comparison-table": { w: 1200, h: 420 },
  "cart-drawer": { w: 1200, h: 420 },
  "checkout": { w: 1200, h: 420 },
  "discount": { w: 1200, h: 420 },
  "invoice": { w: 1200, h: 420 },
  "subscription": { w: 1200, h: 420 },
  "affiliate": { w: 1200, h: 420 },
  "coin-economy": { w: 1200, h: 420 },
  "countdown": { w: 1200, h: 420 },
  "trust-badges": { w: 1200, h: 420 },
  "dense-tables": { w: 420, h: 88 },
  "virtualised-list": { w: 420, h: 88 },
  "multi-column-feed": { w: 420, h: 88 },
  "realtime-stream": { w: 420, h: 88 },
  "terminal-console": { w: 420, h: 88 },
  "status-bar": { w: 420, h: 88 },
  "split-panes": { w: 420, h: 88 },
  "diff-view": { w: 420, h: 88 },
  "hotkey-first": { w: 420, h: 88 },
  "presets": { w: 420, h: 88 },
  "blur-privacy": { w: 420, h: 88 },
  "wildcard": { w: 1440, h: 360 },
  "page-transitions": { w: 1440, h: 64 },
  "back-to-top": { w: 44, h: 44 },
  /*
   * The orbs. Three ways to draw the same object, so what each way can do is
   * a comparison rather than an argument: the same four sliders on all three
   * — how big it sits in its box, how far it leans, what colour the light is,
   * how far the glow reaches — and the same rings and tag around it.
   */
  "orb-css": {
    w: 560, h: 560,
    options: [
      range("size", "Size", 76, 30, 100, { unit: "%" }),
      range("tilt", "Tilt", -22, -60, 60, { unit: "\u00b0" }),
      range("hue", "Colour", 96, 0, 360, { unit: "\u00b0" }),
      range("glow", "Glow", 55, 0, 100, { unit: "%" }),
      { id: "rings", label: "Rings", values: ["two", "one", "three", "none"] },
      yesNo("spin", "Turning", "yes"),
    ],
    content: { label: "The tag", placeholder: "The signal is live" },
  },
  /*
   * The cube. The one part a traced drawing cannot be: a picture of a cube
   * does not turn, and what is written on its sides has to still be text
   * afterwards. The faces live on the node, not here, because they are the
   * author's words and are edited long after the part exists.
   */
  /*
   * The drawing itself, wearing the colour of whatever it stands on. The
   * options are the two things that decide whether a trace survives being
   * sixteen pixels wide: how many paths it keeps, and whether it is filled
   * or stroked.
   */
  "drawn-icon": {
    w: 96, h: 96,
    options: [
      range("size", "Size", 82, 20, 100, { unit: "%" }),
      range("paths", "Paths kept", 6, 1, 24),
      { id: "drawn as", label: "Drawn as", values: ["solid", "line"] },
    ],
  },
  "mesh-3d": {
    w: 420, h: 420,
    options: [
      range("size", "Size", 86, 30, 100, { unit: "%" }),
      { id: "turning", label: "Turning", values: ["when you turn it", "on its own"] },
    ],
  },
  "shape-sphere": {
    w: 420, h: 420,
    options: [
      range("size", "Size", 80, 30, 100, { unit: "%" }),
      range("hue", "Colour", 96, 0, 360, { unit: "\u00b0" }),
      yesNo("spin", "Turning on its own", "yes"),
    ],
    content: { label: "A picture", placeholder: "/planet.png" },
  },
  "shape-cube": {
    w: 420, h: 420,
    options: [
      range("size", "Size", 80, 30, 100, { unit: "%" }),
      range("hue", "Colour", 200, 0, 360, { unit: "\u00b0" }),
      yesNo("spin", "Turning on its own", "yes"),
    ],
    content: { label: "Pictures, one per face", placeholder: "/front.png, /right.png, /back.png" },
  },
  "shape-pyramid": {
    w: 420, h: 420,
    options: [
      range("size", "Size", 80, 30, 100, { unit: "%" }),
      range("hue", "Colour", 38, 0, 360, { unit: "\u00b0" }),
      yesNo("spin", "Turning on its own", "yes"),
    ],
    content: { label: "Pictures, one per face", placeholder: "/side.png, /base.png" },
  },
  "cube-3d": {
    w: 420, h: 420,
    options: [
      range("size", "Size", 74, 30, 100, { unit: "%" }),
      { id: "empty faces", label: "Empty faces", values: ["hold their place", "are not drawn"] },
    ],
    content: { label: "The faces", placeholder: "One per face: Speed, Proof, Reach" },
  },
  "orb-webgl": {
    w: 560, h: 560,
    options: [
      range("size", "Size", 76, 30, 100, { unit: "%" }),
      range("tilt", "Tilt", -22, -60, 60, { unit: "\u00b0" }),
      range("hue", "Colour", 96, 0, 360, { unit: "\u00b0" }),
      range("glow", "Glow", 55, 0, 100, { unit: "%" }),
      { id: "rings", label: "Rings", values: ["two", "one", "three", "none"] },
      { id: "surface", label: "Surface", values: ["glass", "metal", "matte"] },
      yesNo("spin", "Turning", "yes"),
    ],
    content: { label: "The tag", placeholder: "The signal is live" },
  },
  "orb-image": {
    w: 560, h: 560,
    options: [
      range("size", "Size", 76, 30, 100, { unit: "%" }),
      range("tilt", "Tilt", -22, -60, 60, { unit: "\u00b0" }),
      range("hue", "Colour", 96, 0, 360, { unit: "\u00b0" }),
      range("glow", "Glow", 55, 0, 100, { unit: "%" }),
      { id: "rings", label: "Rings", values: ["two", "one", "three", "none"] },
      { id: "recolour", label: "Recolour the picture", values: ["no", "yes"] },
      yesNo("wrap", "Wrap it round", "yes"),
      yesNo("float", "Turning", "yes"),
    ],
    content: { label: "Picture, then the tag", placeholder: "/orb.png, The signal is live" },
  },
  "corner-glow": {
    w: 1440, h: 900,
    options: [
      { id: "corner", label: "Corner", values: ["top right", "top left", "bottom left", "bottom right", "middle"] },
      range("hue", "Colour", 96, 0, 360, { unit: "\u00b0" }),
      range("reach", "Reach", 46, 10, 100, { unit: "%" }),
      range("strength", "Strength", 22, 0, 100, { unit: "%" }),
      { id: "second", label: "A second light", values: ["opposite", "none", "beside it"] },
    ],
  },
  "eyebrow-rule": {
    w: 420, h: 24,
    options: [
      { id: "rule", label: "Rule", values: ["before", "after", "both", "none"] },
      { id: "type", label: "Type", values: ["monospace", "the site's"] },
      range("tracking", "Letter spacing", 25, 0, 60, { unit: "/100em" }),
    ],
    content: { label: "The words", placeholder: "Built for the next block" },
  },
  "details-table": {
    w: 720, h: 300,
    options: [
      { id: "rules", label: "Rules", values: ["between", "under each", "none"] },
      { id: "values", label: "Values", values: ["monospace", "the site's"] },
      yesNo("copy", "Copy button", "yes"),
    ],
    content: { label: "Label: value, one a line", placeholder: "Contract: 0x0000…0000\nNetwork: Robinhood Chain 4663\nSupply: 1,000,000,000" },
  },
  // These three are one component, and it has read `variant` and `size`
  // since it was written; only cta-primary offered them, so the other two
  // could be drawn solid and nothing else. An option a part honours and the
  // catalog does not offer is a control nobody can reach.
  "invite-panel": {
    w: 1280, h: 240,
    options: [shape, turnOption("second sentence accent"), { id: "variant", label: "Button", values: ["outline", "solid"] }],
    content: { label: "Label, heading, button", placeholder: "label: Join the transmission, heading: Stay in the loop., button: Follow on X" },
  },
  "search-nav": { w: 420, h: 48, options: [shape, yesNo("button", "Search button", "no")], content: { label: "Searches over", placeholder: "pages, products, articles" } },
  "search-autocomplete": { w: 420, h: 48, options: [shape], content: { label: "Suggests", placeholder: "products, categories, recent searches" } },
  "ai-search": { w: 480, h: 48, options: [shape], content: { label: "Searches over", placeholder: "everything on the site" } },
  "sticky-header": { w: 1440, h: 64, options: [{ id: "onScroll", label: "On scroll", values: ["shrink", "hide-then-show", "static", "blur"] }, yesNo("button", "Right-hand button", "yes")], content: { label: "Links, and the wordmark", placeholder: "logo: $BORB, Vision, Token, Community, button: Connect wallet" } },
  "mega-menu": { w: 1440, h: 64, content: { label: "Top-level items", placeholder: "Products, Solutions, Pricing, Docs" } },
  "mobile-nav": { w: 390, h: 56, content: { label: "Links", placeholder: "Home, Work, About" } },
  breadcrumbs: { w: 320, h: 32, content: { label: "Trail", placeholder: "Home, Shop, Shoes" } },
  /* A list down the side, tall enough for its entries: at the default 88px its four lines were squeezed into a strip. */
  toc: { w: 280, h: 180 },
  "tabs-panel": { w: 720, h: 260, options: [{ id: "style", label: "Style", values: ["underline", "pill", "segmented", "boxed"] }], content: { label: "Tab labels", placeholder: "Overview, Details, Reviews" } },
  accordion: { w: 720, h: 220, content: { label: "Row titles", placeholder: "How it works, Pricing, Support" } },
  faq: { w: 720, h: 260, content: { label: "Questions", placeholder: "How does it work?, What does it cost?, Can I cancel?" } },
  modal: { w: 520, h: 300, options: [{ id: "size", label: "Size", values: ["medium", "small", "large", "full"] }], content: { label: "Title", placeholder: "Confirm your order" } },
  drawer: { w: 400, h: 560, options: [{ id: "position", label: "Slides in from", values: ["right", "left", "bottom", "top"] }], content: { label: "Title", placeholder: "Your cart" } },
  "hero-split": { w: 1440, h: 520, content: { label: "Headline, subline", placeholder: "Build the site you mean, Then say what it is" } },
  "hero-video": { w: 1440, h: 600, content: { label: "Headline, subline", placeholder: "Headline, One supporting line" } },
  "hero-gradient": { w: 1440, h: 520, content: { label: "Headline, subline", placeholder: "Headline, One supporting line" } },
  "hero-typewriter": { w: 1440, h: 480, content: { label: "Phrases it cycles through", placeholder: "Design faster, Ship sooner, Sleep better" } },
  "hero-particles": { w: 1440, h: 560, content: { label: "Headline, subline", placeholder: "Headline, One supporting line" } },
  "hero-3d": { w: 1440, h: 560, content: { label: "Headline, subline", placeholder: "Headline, One supporting line" } },
  "value-prop": { w: 880, h: 120, options: [turnOption("none")], content: { label: "The sentence", placeholder: "One line that says what this is and who it's for" } },
  "cta-primary": { w: 220, h: 56, options: [shape, { id: "variant", label: "Look", values: ["solid", "outline", "ghost"] }, { id: "size", label: "Size", values: ["medium", "small", "large"] }], content: { label: "Label", placeholder: "Get started" } },
  "quick-action": { w: 180, h: 48, options: [shape, variant, btnSize], content: { label: "Label", placeholder: "Buy now" } },
  "follow": { w: 180, h: 48, options: [shape, { id: "variant", label: "Variant", values: ["outline", "solid", "ghost"] }, btnSize], content: { label: "Label", placeholder: "Follow" } },
  "social-proof-strip": { w: 1440, h: 96, content: { label: "Names or numbers", placeholder: "Acme, Globex, Initech, 12,000 users" } },
  "logo-cloud": { w: 1200, h: 100, content: { label: "Logos", placeholder: "Acme, Globex, Initech, Umbrella" } },
  prose: { w: 720, h: 320, content: { label: "Paragraphs", placeholder: "Type the actual words, one paragraph per line" } },
  "pull-quote": { w: 720, h: 160, content: { label: "The quote", placeholder: "One line worth setting large" } },
  /* Words to set: without a field for them the part published empty, whatever was meant. */
  highlight: { w: 720, h: 160, content: { label: "The paragraph", placeholder: "A paragraph whose first line is marked…" } },
  footnotes: { w: 720, h: 220, content: { label: "The paragraph", placeholder: "A paragraph with its notes below…" } },
  "reading-time": { w: 720, h: 160, content: { label: "The article", placeholder: "The article whose reading time is shown…" } },
  "drop-cap": { w: 720, h: 260, content: { label: "Opening paragraph", placeholder: "The first paragraph…" } },
  "textbox-format": { w: 720, h: 200, content: { label: "Sample text", placeholder: "A paragraph to show the box style" } },
  marquee: { w: 1440, h: 56, options: [{ id: "speed", label: "Speed", values: ["slow", "medium", "fast"] }], content: { label: "Phrases", placeholder: "Ships fast, Reads well, Feels right" } },
  "code-block": { w: 720, h: 180, content: { label: "Code", placeholder: "const x = 1;" } },
  callout: { w: 720, h: 80, content: { label: "Note", placeholder: "Something the reader should not miss" } },
  gallery: { w: 1200, h: 520, options: [{ id: "columns", label: "Columns", values: ["3", "2", "4"] }], content: { label: "Captions", placeholder: "Optional, one per image" } },
  carousel: { w: 1200, h: 480, options: [yesNo("autoplay", "Autoplay", "no")] },
  "video-player": { w: 960, h: 540 },
  "map-embed": { w: 960, h: 420 },
  "audio-player": { w: 560, h: 96 },
  "3d-viewer": { w: 720, h: 520 },
  "whats-new": { w: 440, h: 520, options: [{ id: "place", label: "Where it stands", values: ["centre", "corner"] }, { id: "backdrop", label: "Behind it", values: ["dim", "blur", "none"] }, { id: "width", label: "Width", values: ["regular", "compact"] }] },
  charts: { w: 680, h: 340, options: [{ id: "kind", label: "Kind", values: ["bar", "line", "area", "mixed"] }], content: { label: "Title", placeholder: "Revenue by month" } },
  "stat-tiles": { w: 1200, h: 130, content: { label: "Tile labels", placeholder: "Users, Revenue, Uptime, Orders" } },
  "data-table": { w: 1200, h: 320, content: { label: "Columns", placeholder: "Name, Status, Amount, Updated" } },
  leaderboard: { w: 720, h: 320, content: { label: "Columns", placeholder: "Rank, Player, Score" } },
  "contact-form": { w: 520, h: 420, options: [shape], content: { label: "Fields", placeholder: "Name, Email, Message" } },
  "multi-step-form": { w: 640, h: 440, content: { label: "Steps", placeholder: "Details, Address, Payment, Confirm" } },
  newsletter: { w: 520, h: 56, options: [shape], content: { label: "Field", placeholder: "Email" } },
  booking: { w: 560, h: 400, content: { label: "Fields", placeholder: "Date, Time, Party size" } },
  survey: { w: 640, h: 400, content: { label: "Questions", placeholder: "Question one, Question two" } },
  "pricing-table": { w: 1200, h: 440, content: { label: "Tier names", placeholder: "Free, Pro, Team" } },
  "product-grid": { w: 1200, h: 520, options: [{ id: "columns", label: "Columns", values: ["4", "3", "2"] }], content: { label: "Product names", placeholder: "Optional, one per card" } },
  "card-grid": { w: 1200, h: 460, options: [{ id: "columns", label: "Columns", values: ["3", "2", "4"] }, { id: "card", label: "Card", values: ["boxed", "ruled", "plain"] }], content: { label: "Card titles", placeholder: "Fast by design: Move at the speed of the network" } },
  "bento-grid": { w: 1200, h: 520, options: [{ id: "columns", label: "Columns", values: ["3", "4", "2"] }], content: { label: "Tile titles", placeholder: "Optional, one per tile" } },
  masonry: { w: 1200, h: 520, options: [{ id: "columns", label: "Columns", values: ["3", "2", "4"] }] },
  "blog-index": { w: 1200, h: 460, content: { label: "Article titles", placeholder: "Optional, one per card" } },
  testimonials: { w: 1200, h: 300, content: { label: "Names", placeholder: "Ana, Ben, Chloe" } },
  footer: { w: 1440, h: 96, content: { label: "Links, and the wordmark", placeholder: "logo: $BORB, About, Docs, Contact" } },
  "split-screen": { w: 1440, h: 520, content: { label: "Left side items", placeholder: "Section one, Section two" } },
  "sidebar-layout": { w: 1440, h: 640, options: [{ id: "side", label: "Side", values: ["left", "right"] }], content: { label: "Sidebar items", placeholder: "Overview, Settings, Billing" } },
  "section-stack": { w: 1440, h: 480, content: { label: "Sections in order", placeholder: "Intro, Details, Proof, Call to action" } },
  "holy-grail": { w: 1440, h: 480, content: { label: "Bands", placeholder: "Header, Content, Footer" } },
  "scan-region": { w: 720, h: 320, content: { label: "Name", placeholder: "Above the fold" } },
  "ai-chat": { w: 420, h: 520, content: { label: "Opening line", placeholder: "How can I help?" } },
  chat: { w: 420, h: 520, content: { label: "Opening line", placeholder: "Hey!" } },
  "ai-prompt-box": { w: 640, h: 64, content: { label: "Placeholder", placeholder: "Describe what you want…" } },
  comments: { w: 720, h: 320, content: { label: "Sample names", placeholder: "Ana, Ben" } },
  "custom-idea": { w: 480, h: 200, content: { label: "What it is", placeholder: "Describe the idea in your own words" } },
  gimmick: { w: 880, h: 120, content: { label: "The idea", placeholder: "The one unusual thing this site is built around" } },
  note: { w: 320, h: 120, content: { label: "Note", placeholder: "Anything the builder should know" } },
  box: { w: 640, h: 200, content: { label: "Words", placeholder: "What the box holds; blank draws nothing" } },
  mood: { w: 320, h: 140, content: { label: "References", placeholder: "Sites, eras, feelings" } },
  constraint: { w: 320, h: 100, content: { label: "The rule", placeholder: "Must load in under a second" } },
};


/** What a part is and when you would want it — for the ones whose name is not enough. */
const EXPLAIN: Record<string, string> = {
  "scroll-snap": "Sections lock to the top as you scroll, one screen at a time. Use it when each section is a statement and you want people to land on it squarely, not halfway.",
  "parallax": "Background layers move slower than the content in front, so the page feels deep. Use it sparingly behind a hero; on a whole page it makes people seasick.",
  "reveal-on-scroll": "Things fade or slide in as they come into view instead of being there already. Use it to pace a long page; skip it if people are scanning for information.",
  "sticky-story": "A picture stays pinned while text scrolls past it, changing as you go. Use it to explain something in steps against one visual.",
  "horizontal-scroll": "One section scrolls sideways while the page scrolls down. Use it for a gallery or a timeline; never for something people need to read.",
  "scroll-progress": "A thin bar or ring showing how far down the page you are. Use it on long reading pages so people know how much is left.",
  "scroll-video": "A video or animation whose playhead follows your scroll position \u2014 scroll down, it plays; scroll up, it rewinds. Heavy to make; use it for one showpiece.",
  "infinite-scroll": "More items load when you reach the bottom instead of a Next button. Use it for feeds; avoid it when people need to find their way back to something.",
  "smooth-scroll": "Scrolling eases and glides rather than jumping. Use it when the site should feel unhurried; some people find it disorienting.",
  "cursor-effects": "The mouse pointer is replaced or followed by something \u2014 a dot, a trail, a spotlight. Purely a mood choice, and it does nothing on a phone.",
  "hover-tilt": "Cards tip towards the pointer as it passes over them, like they are on a hinge. A small touch of life on a grid of cards.",
  "page-load": "A short intro that plays the first time the site paints \u2014 a logo settling, a wipe. Use it once; people who visit often will hate a long one.",
  "morph-transition": "One element appears to fly and reshape into another when you navigate \u2014 a small card growing into the full page you clicked. Use it to keep people oriented between two views.",
  "confetti": "A burst of shapes on a moment of success. Use it once per journey, at the end.",
  "physics": "Things carry weight and momentum: they overshoot, settle and bounce. Use it when the site should feel like objects rather than pages.",
  "context-menus": "Your own menu when someone right-clicks, instead of the browser's. Use it when a site has real actions per item.",
  "command-palette": "A keyboard shortcut (Control or Command with K) opens a search box that runs any action on the site. Use it when there is more to do than a nav bar can hold.",
  "shortcuts": "Keyboard keys for the common actions, with a cheat sheet. Use it when people will be here every day.",
  "toasts": "Small messages that appear, say one thing, and go \u2014 without stacking up or repeating.",
  "optimistic-ui": "The screen shows the action as done immediately and quietly fixes itself if the server disagrees. Makes everything feel instant.",
  "sound-cues": "Short sounds on key actions. Use it when the site is a tool people work in; default it off.",
  "haptics": "A short vibration on phones that support it, for confirmations.",
  "drag-drop": "Rearrange or move things by dragging them. Use it when order or grouping is the point.",
  "inline-edit": "Click text and change it in place instead of opening a form. Use it when editing is frequent and small.",
  "undo-redo": "Actions can be taken back, with a history. Use it anywhere a mistake would otherwise be permanent.",
  "copy-button": "One click copies a value and says so. Use it for anything people retype.",
  "hover-card": "A richer preview appears when you rest on a link or a name. Use it to answer \"what is this\" without a page load.",
  "tooltips": "A short label on demand. For icons whose meaning is not obvious.",
  "skeletons": "Grey shapes the size of the content that is loading, instead of a spinner. Makes waits feel shorter.",
  "whats-new": "A card over the page, like the update cards on trading sites: each step shows a part the site really has, live, with a title, two or three lines and one button that does what it says. A visitor sees each update once.",
  "onboarding-tour": "A guided first run pointing at things in order. Use it only if the site cannot explain itself.",
  "magnetic-buttons": "Buttons lean towards the cursor as it approaches. A playful touch on a small number of buttons.",
  "gamification": "Points, streaks, levels and things to unlock. Use it when coming back regularly is the goal.",
  "easter-egg": "Something hidden for people who poke around. One is charming; five is noise.",
  "workflow-builder": "Let people wire steps together themselves, on the finished site. A big feature \u2014 say what the steps are.",
  "cog-settings": "A place where visitors change how the site behaves for them \u2014 theme, density, sound.",
  "compass-onboard": "What a brand-new visitor sees before they have done anything. Say what the empty state should teach them.",
  "graduation": "Simple by default, with the depth appearing as people get comfortable. Say what is hidden at first and what reveals it.",
  "empty-states": "What a list or page shows when there is nothing in it yet. Worth designing \u2014 it is the first thing new people see.",
  "dark-mode": "Both a light and a dark version, following the visitor's system setting unless they choose.",
  "theming": "Visitors can change colour and density themselves, and it is remembered.",
  "responsive": "Deliberate phone, tablet and desktop layouts rather than one squeezed.",
  "a11y": "Keyboard reachable, readable contrast, labelled controls, sensible focus order. Not optional if anyone else uses the site.",
  "i18n": "More than one language, with dates and numbers in local form.",
  "seo": "Titles, descriptions, share images and a sitemap so links look right and search can find it.",
  "analytics": "Recording what people actually do, so you can tell what works.",
  "auth": "Sign in, sessions and who is allowed to do what. Needs a server.",
  "database": "Where the data actually lives between visits. Needs a server.",
  "api": "Letting other software talk to your site.",
  "pwa": "Installable to a home screen and usable with no connection.",
  "perf": "A speed target \u2014 fast on a mid-range phone, not just on yours.",
  "error-handling": "What people see when something breaks, instead of a blank page.",
  "cookie-consent": "Asking before tracking, where the law requires it.",
  "email": "Automatic email: receipts, password resets, notifications.",
  "cms": "Letting someone who does not write code change the words.",
  "versioning": "Draft, publish and roll back changes.",
  "testing": "Automated checks that it still works after a change.",
  "integration": "Connecting to a third-party service. Name the service.",
  "weather-time": "The site changes with the visitor's clock or weather \u2014 a night theme after dark, rain on the header.",
  "qr-bridge": "A code that hands the current thing from desktop to phone or back.",
  "print": "Looks right on paper or saved as a document file.",
  "brand-system": "Logo, palette, type and voice applied consistently everywhere rather than page by page.",
  "ai-chat": "A chat panel that answers using this site's own content. Needs a server and a model.",
  "ai-prompt-box": "One input where someone describes what they want and the site makes it.",
  "ai-summarize": "A button that condenses something long on demand.",
  "ai-generate-content": "A section whose words the model writes, rather than you.",
  "ai-recommend": "Suggests what to look at next based on what someone has done.",
  "ai-moderation": "Screens what people submit before it appears.",
  "ai-translate": "Translates content on the fly rather than keeping separate copies.",
  "ai-voice": "Talk to it instead of typing.",
  "virtualised-list": "Thousands of rows that scroll without slowing down, because only what is on screen exists.",
  "dense-tables": "Rows packed tight, for people reading a lot at once rather than browsing.",
  "multi-column-feed": "Several live streams side by side, each scrolling on its own.",
  "presets": "Named setups people can switch between in one click.",
  "hotkey-first": "Everything reachable from the keyboard, mouse optional.",
  "status-bar": "A thin strip along the bottom that always shows the current state \u2014 connection, counts, mode.",
  "blur-privacy": "A toggle that blurs sensitive numbers so you can share your screen.",
  "split-panes": "Regions divided by a bar you can drag to give one more room.",
  "terminal-console": "A place to type commands and see output, for people who prefer typing to clicking.",
  "realtime-stream": "Updates pushed the instant they happen rather than checked for periodically.",
  "page-transitions": "How one page becomes the next \u2014 a fade, a slide, a wipe. Set it once; it applies to every navigation.",
  "back-to-top": "A button that appears once you have scrolled, taking you back to the start.",
  "scan-region": "A named area you draw on the board so several parts can be referred to together.",
  "waypoint": "A marker for a point where several journeys meet. Use it to note a junction rather than to draw one.",
  "container-width": "How wide text and blocks are allowed to run before they stop growing.",
  "wildcard": "Let the model choose. Use it when you want a suggestion rather than a decision.",
  "section-stack": "Full-width bands stacked down the page, one idea each. The plainest way to build a page and the hardest to get wrong.",
  "bento-grid": "Tiles of different sizes packed into one grid, like a bento box. Use it to show several features at once without ranking them in a list.",
  "split-screen": "The screen cut in two, often with one half still and one half scrolling. Use it when a picture and its explanation belong side by side.",
  "masonry": "A grid where items keep their own heights and pack together without gaps, like a brick wall. Use it for photos of mixed shapes.",
  "sidebar-layout": "A rail down one side that stays put while the middle scrolls. Use it for navigation in an app or a documentation site.",
  "holy-grail": "The dependable three-band page: a header on top, content in the middle, a footer at the bottom. Start here when in doubt.",
  "card-grid": "The same card repeated from a list of things, a picture, a title, a line of text. Use it whenever you are showing many of one kind.",
  "tabs-panel": "Several panels in the same space, one shown at a time. Use it when the panels are alternatives, not steps.",
  "accordion": "Rows that open to show their answer and close again. Use it when most people only want one of the answers.",
  "modal": "A window over the page that takes all the attention until it is dealt with. Use it for one decision; never for a whole form if you can avoid it.",
  "drawer": "A panel that slides in from an edge and pushes nothing aside. Use it for a cart, filters, or details you dip into.",
  "multi-page": "More than one page, sharing the same header and footer. Say what each page is for and the blueprint carries it.",
  "footer": "The bottom of every page: links, legal, contact, social. The place people look when they cannot find something.",
  "sticky-header": "The top bar stays visible as you scroll, usually shrinking or blurring. Use it when navigation matters more than the extra strip of screen.",
  "mega-menu": "A wide dropdown holding grouped links, and sometimes pictures. Use it when a plain menu would be thirty items long.",
  "breadcrumbs": "The trail showing where you are, Home › Guides › This page. Use it on anything more than two levels deep.",
  "scrollspy-nav": "A side list of the sections on the page that highlights the one you are reading. Use it on long documents.",
  "mobile-nav": "What the menu becomes on a phone: a hamburger, a bar along the bottom, or a full-screen sheet.",
  "search-nav": "A box that searches the site. Say what it searches over and it will draw those things.",
  "toc": "A list of what is on this page, with links to each part. Use it on anything longer than a screen or two.",
  "pagination": "Numbered pages at the bottom of a long list. Use it instead of endless scrolling when people need to come back to page four.",
  "sitemap-page": "One page listing every page on the site. Useful for people and for search engines.",
  "home-anchor": "The logo or name in the corner that always takes you back to the front page.",
  "hero-split": "The first screen cut in two: words on one side, a picture or product on the other.",
  "hero-video": "The first screen with video playing behind the headline. Looks expensive; costs bandwidth, so keep it short and silent.",
  "hero-gradient": "The first screen over a slow-moving colour wash instead of a picture. Cheap, fast, and always on-brand.",
  "hero-typewriter": "A headline where one word or phrase swaps for another on a loop, “Ship sooner”, “Sleep better”. Use it when the site does several things.",
  "hero-particles": "Dots or shapes drifting behind the first screen. Atmospheric; keep it slow or it competes with the words.",
  "hero-3d": "A three-dimensional object on the first screen that turns as you move the pointer. Use it when the product is a thing you can hold.",
  "hero-scroll-cue": "The little arrow or word at the bottom of the first screen telling people there is more below.",
  "value-prop": "One sentence saying what this is and who it is for. If you write nothing else, write this.",
  "cta-primary": "The one button the page is built around. There should be exactly one on a screen.",
  "social-proof-strip": "The band under the fold with logos, numbers or names, the reason to believe you.",
  "logo-cloud": "A row of customer or press logos. Recognisable names do more work than adjectives.",
  "trust-badges": "Guarantees, returns, security marks. Use them near the moment someone has to pay or sign up.",
  "prose": "A block of body text set properly: measure, line height, spacing. The default place words go.",
  "heading-scale": "Shows how headings step down in size, one, two, three. Use it to fix the rhythm of a long page.",
  "fluid-type": "Text that grows and shrinks with the width of the window instead of jumping at breakpoints.",
  "drop-cap": "An oversized first letter starting a passage, as in a book. A small, cheap piece of character.",
  "pull-quote": "A line lifted out of the text and set large. Use it to break up a long read and to say the best sentence twice.",
  "highlight": "A few words marked as if with a highlighter pen. Use it to make one phrase impossible to miss.",
  "kinetic-type": "Text that moves, words appearing one at a time, or changing colour in sequence. Use it once, for effect.",
  "marquee": "A strip of words scrolling sideways forever. Use it for a list of short claims, not for anything anyone must read.",
  "code-block": "A box of code in a monospaced font, with a copy button. Use it wherever you tell people what to type.",
  "callout": "A boxed note the reader should not skip, a warning, a tip, a caveat.",
  "faq": "Questions with answers that open one at a time. Write the questions people actually ask, in their words.",
  "changelog": "A dated list of what changed, newest first. Proof that the thing is alive.",
  "blog-index": "The list of articles, each with a date and a first line.",
  "docs": "A documentation layout: a rail of sections on the left, the page in the middle.",
  "reading-time": "“4 min read” under the title. A small kindness on a long page.",
  "footnotes": "Numbered notes at the bottom for asides and sources.",
  "rss": "A feed people can subscribe to, or a box that takes their email. The way people come back without you chasing them.",
  "textbox-format": "Sets how text boxes look across the site, plain, bordered, filled, card, quoted. One choice, applied everywhere.",
  "micro-copy": "The small words: button labels, placeholders, error messages, empty states. Write them as one voice and the site sounds like a person.",
  "tagging": "Short labels on articles or items that people can click to see the rest of that kind.",
  "gallery": "A grid of pictures, each opening larger when clicked.",
  "lightbox": "The full-screen view a picture opens into, with arrows to move between them.",
  "carousel": "One picture at a time with next and previous. Easy to build, easy to ignore, people rarely press next, so put the important one first.",
  "before-after": "Two images with a handle you drag across to compare them. Use it for a repair, a redesign, a filter.",
  "video-player": "A video with the usual controls, a poster frame and captions.",
  "audio-player": "A track with play, a scrub bar and a running time.",
  "podcast": "A list of episodes, each playable in place.",
  "image-blur-up": "Pictures arrive as a blurred smudge that sharpens as they load, so the layout never jumps.",
  "3d-viewer": "A model you can spin and zoom, in the page.",
  "mesh-3d": "A solid made from a drawing, turned with the pointer. Use it when the thing is a thing rather than a picture of one.",
  "map-embed": "A map with your places marked on it.",
  "photo-credit": "Captions under pictures and the credit line the photographer is owed.",
  "avatar-stack": "A row of overlapping profile pictures with “+12 more” at the end. Use it to show a crowd in very little space.",
  "generative-art": "A pattern drawn by code rather than a picture file, different every time, and weightless to load.",
  "contact-form": "Name, email, message, send. The plainest way to be reachable.",
  "multi-step-form": "A long form broken into steps with progress shown. Use it when asking for more than about six things.",
  "inline-validation": "Errors appear beside the field as you leave it, not all at once when you press send.",
  "autosave": "What has been typed is kept without pressing save, and says when it last saved.",
  "file-upload": "A box you drop files onto, with progress and the ability to remove one.",
  "search-autocomplete": "Suggestions appearing under the search box as you type.",
  "filter-panel": "Checkboxes, ranges and prices down one side that narrow a list of results.",
  "date-picker": "A little calendar for choosing a day, or a range of days.",
  "rating": "Stars people click to score something, and the average shown back.",
  "field": "A box people type in, or a list they choose from, that keeps the name the page's code reads it by.",
  "checkbox": "A tick box with its words beside it: pressing the words ticks it, as on any page.",
  "newsletter": "One field and a button, asking for an email address. Say what they will get and how often.",
  "booking": "Pick a day, pick a time, confirm. Needs a real calendar behind it.",
  "survey": "A set of questions with answers to choose from, and the result at the end.",
  "captcha": "The check that a person, not a script, is sending the form. It stands in for a real service.",
  "product-grid": "The catalogue: a grid of things with a picture, a name, a price and a way to add each one.",
  "product-detail": "One product on its own page: several views, the options, the price, and the button.",
  "cart-drawer": "What has been added, with quantities that change the total, sliding in from the side.",
  "checkout": "Address, payment, confirmation. Needs a payment service behind it; the card number is really checked here so the flow can be walked through.",
  "pricing-table": "Plans side by side with one marked as the one to choose, and a monthly/yearly switch.",
  "comparison-table": "You against the alternatives, feature by feature. Be honest in it or nobody believes any of it.",
  "testimonials": "Quotes with a name and a face. Real ones with a surname beat five anonymous ones.",
  "countdown": "A clock ticking down to a deadline. Use it when the deadline is real.",
  "discount": "A box for a promo code, and whether it worked.",
  "wishlist": "Things saved for later, and moved to the cart when the moment comes.",
  "subscription": "The plan someone is on, what it costs, and how to change or cancel it.",
  "invoice": "A receipt with line items and a total, printable or downloadable.",
  "affiliate": "A link someone can share that credits them for whoever follows it.",
  "coin-economy": "Points, credits or coins earned and spent inside the site, with a balance and a history. Decide early what earns them and what they buy.",
  "charts": "Lines, bars or areas over time, legible in both light and dark. Say what the axes are and the shape follows.",
  "stat-tiles": "The headline numbers in a row, each with whether it is up or down.",
  "data-table": "Rows you can sort, filter and page through. Handles thousands without slowing down because only the visible rows exist.",
  "pie-breakdown": "How a whole splits into parts. Good for three or four slices; useless for twelve.",
  "sparkline": "A tiny line beside a number showing its recent trend. No axes, no labels, just the shape.",
  "dashboard": "Several views on one screen: the numbers, the trend, the recent list. Use it when someone checks in daily.",
  "timeline": "Events along a line, in order. Use it for a history, a roadmap or a process.",
  "kanban": "Cards in columns that you drag from one to the next, To do, Doing, Done.",
  "calendar-view": "A month, week or day grid with things on it.",
  "live-feed": "Rows arriving on their own without a refresh. Needs a live connection behind it.",
  "export": "A way to take the data away as a spreadsheet or document file. Small feature, big trust.",
  "heatmap": "A grid where colour is the value, busier squares are darker. Use it for activity by day and hour.",
  "leaderboard": "A ranked list with movement since last time. Only motivating if the ranking is fair.",
  "progress-tracker": "How far along something is against a target, as a bar and a pair of numbers.",
  "network-graph": "Things as dots and their relationships as lines between them. Use it when the connections are the point.",
  "profiles": "A public page for a person: picture, name, a line about them, and their numbers.",
  "comments": "Replies under something, with the box to add one. Decide up front who can post and who can remove.",
  "reactions": "A row of emoji people can tap, with counts. Cheaper to give than a comment, so far more people do.",
  "share-sheet": "Buttons to share this to platforms, and to copy the link.",
  "activity-feed": "What people have been doing, with repeats folded into one line rather than twenty.",
  "chat": "A conversation with a box to type in. Needs a real connection behind it to be live.",
  "follow": "A button to opt into someone's updates.",
  "mentions": "Typing @ offers people and # offers topics, and inserts the one you pick.",
  "moderation": "The queue of reported things, with allow, hide and block. Needed the moment strangers can post.",
  "community-badges": "Marks people earn and display, first post, hundred replies, early member.",
  "forum": "Discussion organised by topic rather than by person, with reply counts and last activity.",
  "guestbook": "A place to leave a short message that stays on the site. An old idea that still works.",
  "collab-cursors": "Other people's pointers, with their names, moving in real time. Needs a live connection.",
  "ai-search": "Search that understands what you meant rather than matching the words you typed.",
  "ai-autofill": "Fields filled in from what the model already knows about the context, for the person to correct.",
  "quick-action": "A button that does the thing straight away with no confirmation dialog. Only for things that can be undone.",
  "diff-view": "Two versions side by side or inline, with what was added and removed marked.",
  "archive-mode": "Everything that came before, still browsable. Nothing you publish has to disappear.",

  /* The last ten with nothing to say on hover. Each one says what the part
     DOES once the site is finished, in the present tense, rather than what
     kind of thing it is — the name already says that, and a hover that
     repeats the name is a hover that was not worth waiting for. */
  "invite-panel": "Asks one person in by name or by link, and shows who is already in. For anything behind a door rather than open to the street.",
  "eyebrow-rule": "The small line above a heading that says which section you are in, with a rule under it. Reads as a label, never as a second heading.",
  "picture": "One image, at the size and crop you set, that stays sharp on a phone and never pushes the text about while it loads.",
  "details-table": "Rows of name and value for one thing — a spec sheet, a listing, an order. Stays readable on a phone by stacking rather than scrolling sideways.",
  "orb-css": "A lit planet that turns slowly and can be dragged round to see every side, drawn by the page itself. Costs nothing to load and works everywhere.",
  "orb-webgl": "The same sphere with real light and depth on the graphics card: it catches highlights and refracts what is behind it. Falls back to the drawn one where the graphics card cannot help.",
  "orb-image": "A planet wearing a picture you give it, wrapped all the way round: it turns slowly and drags round to see every side. For a logo or a planet rather than an abstract shape.",
  "cube-3d": "A cube you can turn with the pointer, each face carrying its own heading, words, or a whole page of the site. Turning it is how you read the other five.",
  "drawn-icon": "An icon drawn from your own description rather than picked from a set, so it matches the site instead of the library it came from.",
  "corner-glow": "A wash of light bleeding in from one corner, behind everything else. Sets a mood without being a thing on the page.",
  "custom-idea": "Something not in the library. Name it and describe it, and it goes into the blueprint as your own part.",
  "gimmick": "The one idea the whole site hangs on. Write it in a sentence; everything else is downstream of it.",
  "note": "A note to yourself or to whoever builds this. It goes into the blueprint but is not part of the page.",
  "box": "A box and nothing else: the colour, edge, padding and words it is given, with no edge, label or kind of its own. What a captured page's wrappers land as.",
  "mood": "A reference, a site, a feeling, a picture in words. Steers the look without prescribing it.",
  "constraint": "A rule the build must not break, a budget, a colour, a deadline, an accessibility floor.",
};

export const FEATURES: FeatureDef[] = RAW.map((x) => {
  const [cw, ch] = CATEGORY_SIZE[x.category as BuiltInCategory] ?? [420, 88];
  const d = DETAILS[x.id] ?? {};
  return { ...x, w: x.w ?? cw, h: x.h ?? ch, ...d, options: d.options ?? x.options, explain: d.explain ?? EXPLAIN[x.id] };
});

export const FEATURES_BY_ID = new Map(FEATURES.map((x) => [x.id, x]));

/* ------------------------------------------------------------------ */
/* What a connected repository brought with it                         */
/* ------------------------------------------------------------------ */

/**
 * The library is the twelve categories above plus whatever a repository
 * has been connected and brought in. Those are the document's, not this
 * file's — they change while the app is running and they are saved with
 * the site — so the store hands them here whenever they change, and every
 * reader below sees one library rather than two.
 *
 * A brought part is a **preset**: it names a real part of the library in
 * `basedOn` and carries the measurements taken off the page in `preset`.
 * Nothing in the render chain had to learn a new kind of part, and
 * dropping one puts down an ordinary node that the Inspector edits, the
 * wheel repaints and the publish ships.
 */
let brought: FeatureDef[] = [];
let broughtCats: CategoryDef[] = [];
let broughtById = new Map<string, FeatureDef>();

export function setBrought(cats: CategoryDef[], feats: FeatureDef[]): void {
  broughtCats = cats;
  brought = feats;
  broughtById = new Map(feats.map((x) => [x.id, x]));
}

/** Every part on offer: the library's, and the ones a repository brought. */
export function allFeatures(): FeatureDef[] {
  return brought.length ? [...FEATURES, ...brought] : FEATURES;
}

/** Every category on offer, the six first and the repositories after them. */
export function allCategories(): CategoryDef[] {
  return broughtCats.length ? [...CATEGORIES, ...broughtCats] : CATEGORIES;
}

export function getFeature(id: string): FeatureDef | undefined {
  return FEATURES_BY_ID.get(id) ?? broughtById.get(id);
}

/** The parts a shelf category shows: every kind filed in it (`SHELF_OF`). A kind is read as the category it is filed in. */
export function featuresByCategory(category: CategoryId): FeatureDef[] {
  const shelf = shelfCategoryOf(category);
  return allFeatures().filter((x) => shelfCategoryOf(x.category) === shelf);
}

export function searchFeatures(query: string): FeatureDef[] {
  const q = query.trim().toLowerCase();
  const all = allFeatures();
  if (!q) return all;
  return all.filter((x) =>
    [x.name, x.blurb, x.id, x.category, ...(x.tags ?? [])].some((s) => s.toLowerCase().includes(q)),
  );
}

/** The shelf category a kind or category id is shown in: its label, its colour. */
export function categoryOf(id: CategoryId): CategoryDef {
  const shelf = shelfCategoryOf(id);
  return allCategories().find((c) => c.id === shelf) ?? CATEGORIES[0]!;
}

/**
 * Sub-groups inside a category, so all 236 parts are reachable in three clicks: a card, or a version on a card's detail.
 * Projected from `shelfGroups.ts`, which says where every item sits and in
 * what order; a group lists only catalogue ids here (the working features it
 * also holds are `work:` keys there). An id missing from every group is a
 * variation of an item that is listed, or was taken off the shelf, and
 * `shelfPlan.ts` says which. `tests/shelf-reach.mjs` holds every id to one.
 */
export interface SubGroup { id: string; emoji: string; label: string; ids: string[] }

export const SUBGROUPS: Record<string, SubGroup[]> = Object.fromEntries(
  Object.entries(SHELF_GROUPS).map(([category, groups]) => [
    category,
    groups.map((g) => ({ id: g.id, emoji: g.emoji, label: g.label, ids: g.items.filter((i) => !isWorkKey(i)) })),
  ]),
);

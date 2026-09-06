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
import {
  Accessibility, Activity, AlignLeft, Archive, ArrowDown, AtSign, Award, BadgeCheck, BarChart3,
  Bell, Blend, Bookmark, BookOpen, Bot, Box, Boxes, Brain, Brush, Calendar, Camera, CaseSensitive,
  Check, CheckSquare, ChevronsDown, Clapperboard, Clock, Cloud, Code2, Cog, Coins, Columns3,
  Command, Component, Compass, Contrast, Copy, CreditCard, Crown, Database, Dices, DollarSign,
  Download, Droplet, Eye, Feather, Film, Filter, Fingerprint, Flag, FlaskConical, Footprints,
  Gamepad2, Gauge, Ghost, GitBranch, Globe, GraduationCap, Grid2x2, Hand, Hash, Heading, Heart,
  HelpCircle, Highlighter, History as HistoryIcon, Home, Hourglass, Image as ImageIcon, Images, Inbox, Info, Keyboard,
  Languages, Layers, LayoutGrid, LayoutTemplate, Lightbulb, LineChart, Link2, List, ListOrdered,
  Lock, LoaderCircle, Magnet, Mail, Map as MapIcon, MapPin, Menu, MessageSquare, Mic, Milestone, Monitor,
  Moon, MousePointer2, MousePointerClick, Move, Music, Navigation as NavigationIcon, Network, Newspaper, Orbit,
  Package, Palette, PanelLeft, PanelTop, Paperclip, PenTool, Percent, PieChart, Pin, Podcast,
  Printer, Puzzle, QrCode, Quote, Radar, Radio, RefreshCw, Rocket, RotateCw, Route, Rows3, Rss,
  Scan, ScrollText, Search, Send, Server, Share2, Shapes, Shield, ShieldCheck, ShoppingCart,
  Signature, Signpost, SlidersHorizontal, Smartphone, Sparkles, Spline, Sticker, Store,
  StretchHorizontal, Sun, Sunrise, Table2, Tag, Target, Telescope, Terminal, Timer, ToggleLeft,
  TrendingUp, Trophy, Type, Undo2, Upload, User, Users, Verified, Video, Volume2, Wallet, Wand2,
  Waves, Waypoints, Wifi, Workflow, WrapText, Zap,
} from "lucide-react";

export interface FeatureOption {
  id: string;
  label: string;
  /** First value is the default. */
  values: string[];
}

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
}

export type CategoryId =
  | "structure" | "nav" | "hero" | "content" | "media" | "motion" | "interact"
  | "forms" | "commerce" | "data" | "social" | "ai" | "power" | "platform";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  blurb: string;
  hue: number;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "structure", label: "Layout", icon: LayoutTemplate, blurb: "How the page is divided.", hue: 210 },
  { id: "nav", label: "Navigation", icon: NavigationIcon, blurb: "How people move around.", hue: 230 },
  { id: "hero", label: "First screen", icon: Sunrise, blurb: "The first screen.", hue: 30 },
  { id: "content", label: "Text", icon: Type, blurb: "Words, and how they are set.", hue: 60 },
  { id: "media", label: "Media", icon: Images, blurb: "Images, video, audio, 3D.", hue: 300 },
  { id: "motion", label: "Motion", icon: Waves, blurb: "What happens as you scroll.", hue: 190 },
  { id: "interact", label: "Interaction", icon: MousePointerClick, blurb: "Feedback, menus, shortcuts.", hue: 160 },
  { id: "forms", label: "Forms", icon: CheckSquare, blurb: "Capturing what people type.", hue: 130 },
  { id: "commerce", label: "Shop", icon: ShoppingCart, blurb: "Selling things.", hue: 100 },
  { id: "data", label: "Data", icon: BarChart3, blurb: "Numbers made legible.", hue: 265 },
  { id: "social", label: "Social", icon: Users, blurb: "People and their traces.", hue: 340 },
  { id: "ai", label: "AI", icon: Sparkles, blurb: "Model-powered surfaces.", hue: 280 },
  { id: "power", label: "Dense & keyboard", icon: Terminal, blurb: "Tools that reward fast hands.", hue: 155 },
  { id: "platform", label: "Under the hood", icon: ShieldCheck, blurb: "The things that make it real.", hue: 20 },
];

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
  f("bento-grid", "Tile grid", "structure", Grid2x2, "Mixed-size tiles in one grid — the modern feature showcase.", { options: [columns, density] }),
  f("split-screen", "Split screen", "structure", Columns3, "Two halves, often one sticky and one scrolling.", { options: [{ id: "sticky", label: "Sticky half", values: ["left", "right", "none"] }] }),
  f("masonry", "Staggered grid", "structure", LayoutGrid, "Uneven heights packed without gaps.", { options: [columns] }),
  f("sidebar-layout", "Sidebar", "structure", PanelLeft, "Persistent side rail beside the content.", { options: [{ id: "side", label: "Side", values: ["left", "right"] }, { id: "behaviour", label: "Behaviour", values: ["collapsible", "fixed", "overlay"] }] }),
  f("holy-grail", "Header, body, footer", "structure", LayoutTemplate, "The dependable three-band page.", {}),
  f("card-grid", "Card grid", "structure", Boxes, "Repeating cards from a list of items.", { options: [columns, density] }),
  f("tabs-panel", "Tabs", "structure", Component, "Switch between panels in place.", { options: [{ id: "style", label: "Style", values: ["underline", "pill", "segmented"] }] }),
  f("accordion", "Expanding rows", "structure", ChevronsDown, "Collapsible rows that expand one at a time.", {}),
  f("modal", "Popup window", "structure", Box, "Focused overlay for one task.", { options: [{ id: "size", label: "Size", values: ["medium", "small", "large", "full"] }] }),
  f("drawer", "Slide-in panel", "structure", PanelTop, "Panel that slides in from an edge.", { options: [position] }),
  f("multi-page", "Several pages", "structure", Layers, "More than one route, with shared chrome.", { hint: "List each page and what lives on it." }),
  f("footer", "Footer", "structure", Milestone, "Sitemap, legal, contact, social.", { options: [columns] }),
  f("container-width", "Content width", "structure", StretchHorizontal, "How wide text and blocks are allowed to run.", { options: [{ id: "width", label: "Width", values: ["readable", "wide", "full-bleed"] }] }),

  /* -------------------------------------------------------------------- nav */
  f("sticky-header", "Sticky top bar", "nav", PanelTop, "Nav that stays put, often shrinking on scroll.", { options: [{ id: "onScroll", label: "On scroll", values: ["shrink", "hide-then-show", "static", "blur"] }] }),
  f("mega-menu", "Big dropdown menu", "nav", Menu, "Wide dropdown with grouped links and previews.", {}),
  f("breadcrumbs", "Breadcrumb trail", "nav", Signpost, "Where you are in the hierarchy.", {}),
  f("scrollspy-nav", "Section tracker", "nav", ScrollText, "Side nav that highlights the section you're in.", {}),
  f("mobile-nav", "Phone menu", "nav", Smartphone, "Hamburger, bottom bar or full-screen menu.", { options: [{ id: "style", label: "Style", values: ["sheet", "bottom-bar", "fullscreen"] }] }),
  f("page-transitions", "Page transitions", "nav", Spline, "Animated movement between routes.", { options: [{ id: "style", label: "Style", values: ["fade", "slide", "shared-element", "curtain"] }] }),
  f("search-nav", "Search box", "nav", Search, "Search across all content with results as you type.", {}),
  f("toc", "Table of contents", "nav", List, "Generated outline of a long document.", {}),
  f("pagination", "Page numbers", "nav", ListOrdered, "Page-by-page rather than endless scroll.", {}),
  f("back-to-top", "Back to top", "nav", ArrowDown, "Return to the start of a long page.", {}),
  f("sitemap-page", "Site map", "nav", MapIcon, "One page listing everything.", {}),

  /* ------------------------------------------------------------------- hero */
  f("hero-split", "Split hero", "hero", Columns3, "Headline one side, visual the other.", { options: [emphasis], w: 150 }),
  f("hero-video", "Video hero", "hero", Clapperboard, "Full-bleed muted video behind the headline.", {}),
  f("hero-gradient", "Moving gradient", "hero", Blend, "Slow-moving mesh gradient background.", {}),
  f("hero-typewriter", "Rotating headline", "hero", CaseSensitive, "Headline that types or cycles through phrases.", {}),
  f("hero-particles", "Particle background", "hero", Orbit, "Reactive dots/lines behind the fold.", {}),
  f("hero-3d", "Tilting 3D object", "hero", Boxes, "A rotatable or parallax-tilting object.", {}),
  f("hero-scroll-cue", "Scroll hint", "hero", ChevronsDown, "A hint that there's more below.", {}),
  f("value-prop", "One-line pitch", "hero", Target, "One sentence saying what this is and who it's for.", { hint: "Say the promise in one sentence." }),
  f("cta-primary", "Main button", "hero", Rocket, "The single most important button.", { options: [emphasis] }),
  f("social-proof-strip", "Trust strip", "hero", Verified, "Logos or numbers right under the fold.", {}),

  /* ---------------------------------------------------------------- content */
  f("prose", "Text block", "content", AlignLeft, "Long-form text with proper rhythm and hierarchy.", { options: [{ id: "measure", label: "Measure", values: ["66ch", "58ch", "76ch", "full"] }] }),
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
  f("carousel", "Slideshow", "media", Film, "Swipeable horizontal set of slides.", { options: [{ id: "autoplay", label: "Autoplay", values: ["off", "on"] }] }),
  f("before-after", "Before / after slider", "media", Contrast, "Draggable comparison slider.", {}),
  f("video-player", "Video player", "media", Video, "Custom player with chapters and captions.", {}),
  f("audio-player", "Audio player", "media", Music, "Waveform or minimal audio playback.", {}),
  f("podcast", "Episode list", "media", Podcast, "Episode list with inline playback.", {}),
  f("image-blur-up", "Blur-in images", "media", Droplet, "Low-res placeholder that sharpens.", {}),
  f("3d-viewer", "3D model viewer", "media", Boxes, "Orbitable model in the page.", {}),
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
  f("cursor-effects", "Custom cursor", "motion", MousePointer2, "Trail, magnet or spotlight cursor.", { options: [{ id: "style", label: "Style", values: ["dot", "trail", "spotlight", "magnetic"] }] }),
  f("hover-tilt", "Tilt on hover", "motion", Move, "Cards that tilt toward the pointer.", {}),
  f("page-load", "Opening animation", "motion", Hourglass, "Intro sequence on first paint.", {}),
  f("morph-transition", "Morphing transition", "motion", Spline, "An element that flies between views.", {}),
  f("confetti", "Celebration burst", "motion", Sparkles, "Confetti or burst on success.", {}),

  /* -------------------------------------------------------------- interact */
  f("context-menus", "Right-click menus", "interact", MousePointerClick, "Custom menus on every meaningful element.", { hint: "Say which elements get menus and what's in them." }),
  f("command-palette", "Command search", "interact", Command, "Ctrl/Cmd-K to reach everything.", {}),
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
  f("newsletter", "Email signup", "forms", Send, "Email capture with confirmation.", {}),
  f("booking", "Booking", "forms", Timer, "Pick a slot and confirm.", {}),
  f("survey", "Quiz / survey", "forms", CheckSquare, "Question flow with a result.", {}),
  f("captcha", "Spam protection", "forms", Shield, "Keep bots out without punishing people.", {}),

  /* -------------------------------------------------------------- commerce */
  f("product-grid", "Product grid", "commerce", Store, "Browsable catalogue.", { options: [columns] }),
  f("product-detail", "Product page", "commerce", Package, "Gallery, options, price, add to cart.", {}),
  f("cart-drawer", "Cart", "commerce", ShoppingCart, "Slide-over cart with running total.", {}),
  f("checkout", "Checkout", "commerce", CreditCard, "Address, payment, confirmation.", {}),
  f("pricing-table", "Pricing table", "commerce", DollarSign, "Tiers side by side with a recommended one.", { options: [{ id: "tiers", label: "Tiers", values: ["3", "2", "4"] }] }),
  f("comparison-table", "Comparison table", "commerce", Table2, "Feature-by-feature against alternatives.", {}),
  f("testimonials", "Testimonials", "commerce", Quote, "Real quotes with names and faces.", {}),
  f("logo-cloud", "Logo row", "commerce", BadgeCheck, "Customers or press logos.", {}),
  f("trust-badges", "Trust badges", "commerce", ShieldCheck, "Guarantees, security, returns.", {}),
  f("countdown", "Countdown", "commerce", Timer, "Time-limited offer.", {}),
  f("discount", "Promo codes", "commerce", Percent, "Apply a code at checkout.", {}),
  f("wishlist", "Wishlist", "commerce", Bookmark, "Save for later.", {}),
  f("subscription", "Subscriptions", "commerce", Wallet, "Recurring plans and management.", {}),
  f("invoice", "Receipts", "commerce", Printer, "Downloadable proof of purchase.", {}),
  f("affiliate", "Referral links", "commerce", Share2, "Share links with attribution.", {}),

  /* ------------------------------------------------------------------ data */
  f("charts", "Charts", "data", LineChart, "Lines, bars, areas — legible in both themes.", { options: [{ id: "kind", label: "Kind", values: ["line", "bar", "area", "mixed"] }] }),
  f("stat-tiles", "Number tiles", "data", TrendingUp, "Headline numbers with change indicators.", { options: [columns] }),
  f("data-table", "Data table", "data", Table2, "Sortable, filterable, paginated rows.", { options: [{ id: "rows", label: "Row count", values: ["hundreds", "dozens", "thousands+"] }] }),
  f("pie-breakdown", "Pie chart", "data", PieChart, "How a whole splits into parts.", {}),
  f("sparkline", "Mini trend lines", "data", Activity, "Tiny trend inline with a number.", {}),
  f("dashboard", "Dashboard", "data", Gauge, "Several linked views on one screen.", {}),
  f("timeline", "Timeline", "data", Milestone, "Events along an axis.", {}),
  f("kanban", "Board with columns", "data", Columns3, "Cards in columns you can drag between.", {}),
  f("calendar-view", "Calendar", "data", Calendar, "Month/week/day scheduling grid.", {}),
  f("live-feed", "Live feed", "data", Activity, "Streaming updates without refresh.", {}),
  f("export", "Download data", "data", Download, "CSV, JSON or PDF out.", {}),
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
  f("virtualised-list", "Huge list", "power", List, "Thousands of rows without lag.", {}),
  f("dense-tables", "Dense rows", "power", Rows3, "Maximum information per pixel.", {}),
  f("multi-column-feed", "Side-by-side feeds", "power", Columns3, "Parallel live streams side by side.", { options: [columns] }),
  f("presets", "Saved presets", "power", Bookmark, "Named configurations, switchable in one click.", {}),
  f("hotkey-first", "Keyboard-first", "power", Keyboard, "Every action reachable without a mouse.", {}),
  f("status-bar", "Status bar", "power", Activity, "Persistent state along the bottom edge.", {}),
  f("blur-privacy", "Privacy blur", "power", Eye, "Hide sensitive numbers for screen sharing.", {}),
  f("quick-action", "One-click action", "power", Zap, "Execute with no confirmation dialog.", {}),
  f("split-panes", "Resizable panes", "power", Columns3, "Drag the divider between regions.", {}),
  f("terminal-console", "Command console", "power", Terminal, "Type commands, see output.", {}),
  f("realtime-stream", "Live data stream", "power", Wifi, "Push updates instead of polling.", {}),
  f("diff-view", "Change comparison", "power", GitBranch, "Side-by-side or inline change comparison.", {}),

  /* -------------------------------------------------------------- platform */
  f("dark-mode", "Dark / light mode", "platform", Moon, "Both themes, respecting the system setting.", { options: [{ id: "default", label: "Default", values: ["system", "dark", "light"] }] }),
  f("theming", "Theme picker", "platform", Palette, "User-adjustable colour and density.", {}),
  f("responsive", "Works on phones", "platform", Monitor, "Deliberate phone, tablet and desktop layouts.", {}),
  f("a11y", "Accessibility", "platform", Accessibility, "Keyboard, contrast, labels, focus order.", {}),
  f("i18n", "Languages", "platform", Globe, "Multiple languages and locales.", {}),
  f("seo", "Search engine setup", "platform", Radar, "Titles, descriptions, open graph, sitemap.", {}),
  f("analytics", "Analytics", "platform", BarChart3, "Track what people actually do.", {}),
  f("auth", "Accounts & login", "platform", Lock, "Sign in, sessions, permissions.", {}),
  f("database", "Saved data", "platform", Database, "Where the data actually lives.", {}),
  f("api", "Public API", "platform", Server, "Let other software talk to it.", {}),
  f("pwa", "Works offline", "platform", Cloud, "Installable and usable without a connection.", {}),
  f("perf", "Speed budget", "platform", Gauge, "Fast on a mid-range phone.", {}),
  f("error-handling", "Error screens", "platform", Info, "What happens when things break.", {}),
  f("cookie-consent", "Cookie consent", "platform", Fingerprint, "Ask before tracking.", {}),
  f("email", "Automatic emails", "platform", Mail, "Receipts, resets, notifications.", {}),
  f("cms", "Content editing", "platform", PenTool, "Let non-developers change copy.", {}),
  f("versioning", "Drafts & versions", "platform", HistoryIcon, "Draft, publish, roll back.", {}),
  f("testing", "Tests", "platform", FlaskConical, "Prove it still works.", {}),

  /* ------------------------------------------------------------- wildcards */
  f("custom-idea", "New idea", "structure", Lightbulb, "A feature that doesn't exist yet — describe it in the prompt.", { hint: "Describe the idea in your own words. This is the placeholder for something new.", tags: ["custom", "new", "idea", "blank"] }),
  f("gimmick", "Central idea", "structure", Crown, "The one unusual thing this site is built around.", { hint: "The single idea everything else serves.", tags: ["core", "hook", "concept"], w: 150 }),
  f("wildcard", "Surprise me", "structure", Dices, "Surprise me — let the model choose.", { tags: ["random", "surprise"] }),
  f("note", "Note", "structure", Pin, "A written instruction pinned to the canvas.", { hint: "Anything the builder should know.", tags: ["comment", "annotation"] }),
  f("mood", "Mood / reference", "structure", Palette, "Tone, era, or a site to feel like.", { hint: "Reference points and the feeling to aim for.", tags: ["style", "vibe", "reference"] }),
  f("constraint", "Rule", "structure", Flag, "Something the build must not do.", { hint: "A hard limit: no frameworks, must load in 1s, no scroll-jacking…", tags: ["limit", "rule"] }),
  f("scan-region", "Region", "structure", Scan, "A named area of the page other elements sit inside.", { tags: ["frame", "zone"], w: 150 }),
  f("integration", "Connect a service", "platform", Puzzle, "Connect to a third-party service.", { hint: "Which service, and what it does here." }),
  f("gamification", "Points & levels", "interact", Gamepad2, "Points, streaks, levels, unlocks.", {}),
  f("easter-egg", "Hidden surprise", "interact", Ghost, "A hidden thing for people who poke around.", {}),
  f("generative-art", "Generated artwork", "media", Shapes, "Code-drawn artwork, seeded and unique.", {}),
  f("physics", "Physics", "motion", Orbit, "Things that move like they have mass.", {}),
  f("weather-time", "Time & weather aware", "platform", Sun, "Changes with the visitor's clock or weather.", {}),
  f("qr-bridge", "QR code hand-off", "platform", QrCode, "Hand off between phone and desktop.", {}),
  f("print", "Print layout", "platform", Printer, "Looks right on paper or as PDF.", {}),
  f("archive-mode", "Archive", "platform", Archive, "Everything that came before, browsable.", {}),
  f("network-graph", "Connection map", "data", Network, "Nodes and edges you can explore.", {}),
  f("workflow-builder", "Workflow builder", "interact", Workflow, "Let users wire steps together.", {}),
  f("collab-cursors", "Live cursors", "social", Users, "See other people's cursors live.", {}),
  f("brand-system", "Brand kit", "platform", Brush, "Logo, palette, type, voice — applied consistently.", {}),
  f("waypoint", "Junction", "structure", Waypoints, "A junction where several flows meet.", {}),
  f("micro-copy", "Tone of voice", "content", Feather, "How buttons, errors and empties are worded.", { hint: "The voice: dry, warm, playful, terse…" }),
  f("cog-settings", "Settings panel", "interact", Cog, "Let people change how the site behaves.", {}),
  f("compass-onboard", "First visit", "interact", Compass, "What a brand-new visitor sees.", {}),
  f("home-anchor", "Home", "nav", Home, "The page everything returns to.", {}),
  f("tagging", "Tags", "content", Tag, "Organise and cross-link content.", {}),
  f("graduation", "Simple then deep", "interact", GraduationCap, "Simple by default, deep when you dig.", {}),
  f("coin-economy", "Points / currency", "commerce", Coins, "An in-site economy.", {}),
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
  commerce: [1200, 420],
  data: [680, 340],
  social: [560, 260],
  ai: [520, 320],
  power: [420, 88],
  platform: [420, 88],
};

const shape: FeatureOption = { id: "shape", label: "Shape", values: ["rounded", "pill", "square", "underlined"] };
const yesNo = (id: string, label: string, def: "yes" | "no"): FeatureOption => ({ id, label, values: def === "yes" ? ["yes", "no"] : ["no", "yes"] });

/** Per-part overrides: real size, shape options, and what it contains. */
const DETAILS: Record<string, Partial<FeatureDef>> = {
  "search-nav": { w: 420, h: 48, options: [shape, yesNo("button", "Search button", "no")], content: { label: "Searches over", placeholder: "pages, products, articles" } },
  "search-autocomplete": { w: 420, h: 48, options: [shape], content: { label: "Suggests", placeholder: "products, categories, recent searches" } },
  "ai-search": { w: 480, h: 48, options: [shape], content: { label: "Searches over", placeholder: "everything on the site" } },
  "sticky-header": { w: 1440, h: 64, options: [{ id: "onScroll", label: "On scroll", values: ["shrink", "hide-then-show", "static", "blur"] }, yesNo("button", "Right-hand button", "yes")], content: { label: "Links", placeholder: "Home, Work, About, Contact" } },
  "mega-menu": { w: 1440, h: 64, content: { label: "Top-level items", placeholder: "Products, Solutions, Pricing, Docs" } },
  "mobile-nav": { w: 390, h: 56, content: { label: "Links", placeholder: "Home, Work, About" } },
  breadcrumbs: { w: 480, h: 32, content: { label: "Trail", placeholder: "Home, Shop, Shoes" } },
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
  "value-prop": { w: 880, h: 120, content: { label: "The sentence", placeholder: "One line that says what this is and who it's for" } },
  "cta-primary": { w: 220, h: 56, options: [shape, { id: "variant", label: "Look", values: ["solid", "outline", "ghost"] }, { id: "size", label: "Size", values: ["medium", "small", "large"] }], content: { label: "Label", placeholder: "Get started" } },
  "quick-action": { w: 180, h: 48, options: [shape], content: { label: "Label", placeholder: "Buy now" } },
  "social-proof-strip": { w: 1440, h: 96, content: { label: "Names or numbers", placeholder: "Acme, Globex, Initech, 12,000 users" } },
  "logo-cloud": { w: 1200, h: 100, content: { label: "Logos", placeholder: "Acme, Globex, Initech, Umbrella" } },
  prose: { w: 720, h: 320, content: { label: "Paragraphs", placeholder: "Type the actual words, one paragraph per line" } },
  "pull-quote": { w: 720, h: 160, content: { label: "The quote", placeholder: "One line worth setting large" } },
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
  "card-grid": { w: 1200, h: 460, options: [{ id: "columns", label: "Columns", values: ["3", "2", "4"] }], content: { label: "Card titles", placeholder: "Optional, one per card" } },
  "bento-grid": { w: 1200, h: 520, options: [{ id: "columns", label: "Columns", values: ["3", "4", "2"] }], content: { label: "Tile titles", placeholder: "Optional, one per tile" } },
  masonry: { w: 1200, h: 520, options: [{ id: "columns", label: "Columns", values: ["3", "2", "4"] }] },
  "blog-index": { w: 1200, h: 460, content: { label: "Article titles", placeholder: "Optional, one per card" } },
  testimonials: { w: 1200, h: 300, content: { label: "Names", placeholder: "Ana, Ben, Chloe" } },
  footer: { w: 1440, h: 240, content: { label: "Column headings", placeholder: "Product, Company, Resources, Legal" } },
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
  "command-palette": "Ctrl/Cmd-K opens a search box that runs any action on the site. Use it when there is more to do than a nav bar can hold.",
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
  "print": "Looks right on paper or saved as a PDF.",
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
};

export const FEATURES: FeatureDef[] = RAW.map((x) => {
  const [cw, ch] = CATEGORY_SIZE[x.category];
  const d = DETAILS[x.id] ?? {};
  return { ...x, w: x.w ?? cw, h: x.h ?? ch, ...d, options: d.options ?? x.options, explain: d.explain ?? EXPLAIN[x.id] };
});

export const FEATURES_BY_ID = new Map(FEATURES.map((x) => [x.id, x]));

export function getFeature(id: string): FeatureDef | undefined {
  return FEATURES_BY_ID.get(id);
}

export function featuresByCategory(category: CategoryId): FeatureDef[] {
  return FEATURES.filter((x) => x.category === category);
}

export function searchFeatures(query: string): FeatureDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return FEATURES;
  return FEATURES.filter((x) =>
    [x.name, x.blurb, x.id, x.category, ...(x.tags ?? [])].some((s) => s.toLowerCase().includes(q)),
  );
}

export function categoryOf(id: CategoryId): CategoryDef {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;
}

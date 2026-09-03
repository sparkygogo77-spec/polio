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
  /** Default canvas footprint. */
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
  { id: "structure", label: "Structure", icon: LayoutTemplate, blurb: "How the page is divided.", hue: 210 },
  { id: "nav", label: "Navigation", icon: NavigationIcon, blurb: "How people move around.", hue: 230 },
  { id: "hero", label: "Hero & Landing", icon: Sunrise, blurb: "The first screen.", hue: 30 },
  { id: "content", label: "Content & Text", icon: Type, blurb: "Words, and how they are set.", hue: 60 },
  { id: "media", label: "Media", icon: Images, blurb: "Images, video, audio, 3D.", hue: 300 },
  { id: "motion", label: "Motion & Scroll", icon: Waves, blurb: "What happens as you scroll.", hue: 190 },
  { id: "interact", label: "Interaction", icon: MousePointerClick, blurb: "Feedback, menus, shortcuts.", hue: 160 },
  { id: "forms", label: "Forms & Input", icon: CheckSquare, blurb: "Capturing what people type.", hue: 130 },
  { id: "commerce", label: "Commerce", icon: ShoppingCart, blurb: "Selling things.", hue: 100 },
  { id: "data", label: "Data & Dashboards", icon: BarChart3, blurb: "Numbers made legible.", hue: 265 },
  { id: "social", label: "Social & Community", icon: Users, blurb: "People and their traces.", hue: 340 },
  { id: "ai", label: "AI", icon: Sparkles, blurb: "Model-powered surfaces.", hue: 280 },
  { id: "power", label: "Power UI / Terminal", icon: Terminal, blurb: "Dense, keyboard-first tools.", hue: 155 },
  { id: "platform", label: "Platform & Quality", icon: ShieldCheck, blurb: "The things that make it real.", hue: 20 },
];

const f = (
  id: string, name: string, category: CategoryId, icon: LucideIcon, blurb: string,
  extra: Partial<FeatureDef> = {},
): FeatureDef => ({ id, name, category, icon, blurb, w: 132, h: 76, ...extra });

/** Reusable option sets. */
const density: FeatureOption = { id: "density", label: "Density", values: ["balanced", "airy", "dense"] };
const emphasis: FeatureOption = { id: "emphasis", label: "Emphasis", values: ["standard", "hero", "subtle"] };
const columns: FeatureOption = { id: "columns", label: "Columns", values: ["3", "2", "4", "auto"] };
const position: FeatureOption = { id: "position", label: "Position", values: ["top", "bottom", "left", "right", "inline"] };

export const FEATURES: FeatureDef[] = [
  /* ---------------------------------------------------------------- structure */
  f("section-stack", "Section Stack", "structure", Rows3, "Full-width sections stacked down the page.", { options: [density], hint: "Sections in this order, each one screen tall unless noted." }),
  f("bento-grid", "Bento Grid", "structure", Grid2x2, "Mixed-size tiles in one grid — the modern feature showcase.", { options: [columns, density] }),
  f("split-screen", "Split Screen", "structure", Columns3, "Two halves, often one sticky and one scrolling.", { options: [{ id: "sticky", label: "Sticky half", values: ["left", "right", "none"] }] }),
  f("masonry", "Masonry Layout", "structure", LayoutGrid, "Uneven heights packed without gaps.", { options: [columns] }),
  f("sidebar-layout", "Sidebar Layout", "structure", PanelLeft, "Persistent side rail beside the content.", { options: [{ id: "side", label: "Side", values: ["left", "right"] }, { id: "behaviour", label: "Behaviour", values: ["collapsible", "fixed", "overlay"] }] }),
  f("holy-grail", "Header / Content / Footer", "structure", LayoutTemplate, "The dependable three-band page.", {}),
  f("card-grid", "Card Grid", "structure", Boxes, "Repeating cards from a list of items.", { options: [columns, density] }),
  f("tabs-panel", "Tabs", "structure", Component, "Switch between panels in place.", { options: [{ id: "style", label: "Style", values: ["underline", "pill", "segmented"] }] }),
  f("accordion", "Accordion", "structure", ChevronsDown, "Collapsible rows that expand one at a time.", {}),
  f("modal", "Modal Dialog", "structure", Box, "Focused overlay for one task.", { options: [{ id: "size", label: "Size", values: ["medium", "small", "large", "full"] }] }),
  f("drawer", "Slide-over Drawer", "structure", PanelTop, "Panel that slides in from an edge.", { options: [position] }),
  f("multi-page", "Multiple Pages", "structure", Layers, "More than one route, with shared chrome.", { hint: "List each page and what lives on it." }),
  f("footer", "Footer", "structure", Milestone, "Sitemap, legal, contact, social.", { options: [columns] }),
  f("container-width", "Content Width", "structure", StretchHorizontal, "How wide text and blocks are allowed to run.", { options: [{ id: "width", label: "Width", values: ["readable", "wide", "full-bleed"] }] }),

  /* -------------------------------------------------------------------- nav */
  f("sticky-header", "Sticky Header", "nav", PanelTop, "Nav that stays put, often shrinking on scroll.", { options: [{ id: "onScroll", label: "On scroll", values: ["shrink", "hide-then-show", "static", "blur"] }] }),
  f("mega-menu", "Mega Menu", "nav", Menu, "Wide dropdown with grouped links and previews.", {}),
  f("breadcrumbs", "Breadcrumbs", "nav", Signpost, "Where you are in the hierarchy.", {}),
  f("scrollspy-nav", "Scrollspy Nav", "nav", ScrollText, "Side nav that highlights the section you're in.", {}),
  f("mobile-nav", "Mobile Nav", "nav", Smartphone, "Hamburger, bottom bar or full-screen menu.", { options: [{ id: "style", label: "Style", values: ["sheet", "bottom-bar", "fullscreen"] }] }),
  f("page-transitions", "Page Transitions", "nav", Spline, "Animated movement between routes.", { options: [{ id: "style", label: "Style", values: ["fade", "slide", "shared-element", "curtain"] }] }),
  f("search-nav", "Site Search", "nav", Search, "Search across all content with results as you type.", {}),
  f("toc", "Table of Contents", "nav", List, "Generated outline of a long document.", {}),
  f("pagination", "Pagination", "nav", ListOrdered, "Page-by-page rather than endless scroll.", {}),
  f("back-to-top", "Back to Top", "nav", ArrowDown, "Return to the start of a long page.", {}),
  f("sitemap-page", "Sitemap", "nav", MapIcon, "One page listing everything.", {}),

  /* ------------------------------------------------------------------- hero */
  f("hero-split", "Split Hero", "hero", Columns3, "Headline one side, visual the other.", { options: [emphasis], w: 150 }),
  f("hero-video", "Video Hero", "hero", Clapperboard, "Full-bleed muted video behind the headline.", {}),
  f("hero-gradient", "Animated Gradient", "hero", Blend, "Slow-moving mesh gradient background.", {}),
  f("hero-typewriter", "Typewriter Headline", "hero", CaseSensitive, "Headline that types or cycles through phrases.", {}),
  f("hero-particles", "Particle Field", "hero", Orbit, "Reactive dots/lines behind the fold.", {}),
  f("hero-3d", "3D / Tilt Object", "hero", Boxes, "A rotatable or parallax-tilting object.", {}),
  f("hero-scroll-cue", "Scroll Cue", "hero", ChevronsDown, "A hint that there's more below.", {}),
  f("value-prop", "Value Proposition", "hero", Target, "One sentence saying what this is and who it's for.", { hint: "Say the promise in one sentence." }),
  f("cta-primary", "Primary CTA", "hero", Rocket, "The single most important button.", { options: [emphasis] }),
  f("social-proof-strip", "Social Proof Strip", "hero", Verified, "Logos or numbers right under the fold.", {}),

  /* ---------------------------------------------------------------- content */
  f("prose", "Rich Prose", "content", AlignLeft, "Long-form text with proper rhythm and hierarchy.", { options: [{ id: "measure", label: "Measure", values: ["66ch", "58ch", "76ch", "full"] }] }),
  f("heading-scale", "Type Scale", "content", Heading, "Consistent heading sizes and weights.", { options: [{ id: "ratio", label: "Ratio", values: ["1.25 major third", "1.2 minor third", "1.333 perfect fourth", "1.5 perfect fifth"] }] }),
  f("fluid-type", "Fluid Typography", "content", WrapText, "Type that scales smoothly with the viewport.", {}),
  f("drop-cap", "Drop Cap", "content", Type, "Oversized opening letter.", {}),
  f("pull-quote", "Pull Quote", "content", Quote, "A line lifted out and set large.", {}),
  f("highlight", "Text Highlight", "content", Highlighter, "Marker-pen emphasis on key phrases.", {}),
  f("kinetic-type", "Kinetic Typography", "content", Sparkles, "Text that animates as it enters.", {}),
  f("marquee", "Marquee Ticker", "content", Radio, "Continuously scrolling strip of text.", { options: [{ id: "speed", label: "Speed", values: ["slow", "medium", "fast"] }] }),
  f("code-block", "Code Block", "content", Code2, "Syntax-highlighted code with copy.", {}),
  f("callout", "Callouts", "content", Info, "Note / warning / tip boxes inside prose.", {}),
  f("faq", "FAQ", "content", HelpCircle, "Questions people actually ask, answered.", {}),
  f("changelog", "Changelog", "content", HistoryIcon, "Dated list of what changed.", {}),
  f("blog-index", "Blog / Articles", "content", Newspaper, "Index plus article pages.", {}),
  f("docs", "Documentation", "content", BookOpen, "Structured reference with nav and search.", {}),
  f("reading-time", "Reading Time", "content", Clock, "Estimated minutes to read.", {}),
  f("footnotes", "Footnotes & Citations", "content", Paperclip, "Sourced claims with references.", {}),
  f("rss", "RSS / Newsletter Feed", "content", Rss, "Syndicate the content.", {}),
  f("textbox-format", "Text Box Formatting", "content", CaseSensitive, "Padding, borders, alignment and rhythm for text blocks.", { options: [{ id: "style", label: "Style", values: ["plain", "bordered", "filled", "card", "underlined"] }, { id: "align", label: "Align", values: ["left", "center", "justify"] }] }),

  /* ------------------------------------------------------------------ media */
  f("gallery", "Gallery", "media", Images, "Grid of images that open larger.", { options: [columns] }),
  f("lightbox", "Lightbox", "media", ImageIcon, "Full-screen viewer with keyboard nav.", {}),
  f("carousel", "Carousel", "media", Film, "Swipeable horizontal set of slides.", { options: [{ id: "autoplay", label: "Autoplay", values: ["off", "on"] }] }),
  f("before-after", "Before / After", "media", Contrast, "Draggable comparison slider.", {}),
  f("video-player", "Video Player", "media", Video, "Custom player with chapters and captions.", {}),
  f("audio-player", "Audio Player", "media", Music, "Waveform or minimal audio playback.", {}),
  f("podcast", "Podcast Episodes", "media", Podcast, "Episode list with inline playback.", {}),
  f("image-blur-up", "Blur-up Loading", "media", Droplet, "Low-res placeholder that sharpens.", {}),
  f("3d-viewer", "3D Model Viewer", "media", Boxes, "Orbitable model in the page.", {}),
  f("map-embed", "Map", "media", MapPin, "Interactive map with pins.", {}),
  f("photo-credit", "Captions & Credits", "media", Camera, "Attribution under media.", {}),
  f("avatar-stack", "Avatar Stack", "media", Users, "Overlapping profile pictures.", {}),

  /* ----------------------------------------------------------------- motion */
  f("scroll-snap", "Scroll Snap", "motion", Magnet, "Sections lock into place as you scroll.", { options: [{ id: "axis", label: "Axis", values: ["vertical", "horizontal"] }] }),
  f("parallax", "Parallax Layers", "motion", Layers, "Backgrounds move slower than foregrounds.", { options: [{ id: "strength", label: "Strength", values: ["subtle", "medium", "strong"] }] }),
  f("reveal-on-scroll", "Reveal on Scroll", "motion", Sunrise, "Elements fade/slide in as they enter.", { options: [{ id: "style", label: "Style", values: ["fade-up", "fade", "scale", "blur", "stagger"] }] }),
  f("sticky-story", "Sticky Scroll Story", "motion", ScrollText, "Pinned visual while text scrolls past.", {}),
  f("horizontal-scroll", "Horizontal Section", "motion", StretchHorizontal, "A section that scrolls sideways.", {}),
  f("scroll-progress", "Scroll Progress", "motion", LoaderCircle, "Bar or ring showing position in the page.", {}),
  f("scroll-video", "Scroll-linked Animation", "motion", Film, "Playhead tied to scroll position.", {}),
  f("infinite-scroll", "Infinite Scroll", "motion", RefreshCw, "Load more as you reach the bottom.", {}),
  f("smooth-scroll", "Smooth Scrolling", "motion", Waves, "Eased, inertial scrolling.", { options: [{ id: "strength", label: "Strength", values: ["light", "off", "heavy"] }] }),
  f("cursor-effects", "Custom Cursor", "motion", MousePointer2, "Trail, magnet or spotlight cursor.", { options: [{ id: "style", label: "Style", values: ["dot", "trail", "spotlight", "magnetic"] }] }),
  f("hover-tilt", "Hover Tilt", "motion", Move, "Cards that tilt toward the pointer.", {}),
  f("page-load", "Page Load Animation", "motion", Hourglass, "Intro sequence on first paint.", {}),
  f("morph-transition", "Shared Element Morph", "motion", Spline, "An element that flies between views.", {}),
  f("confetti", "Celebration Moment", "motion", Sparkles, "Confetti or burst on success.", {}),

  /* -------------------------------------------------------------- interact */
  f("context-menus", "Right-click Menus", "interact", MousePointerClick, "Custom menus on every meaningful element.", { hint: "Say which elements get menus and what's in them." }),
  f("command-palette", "Command Palette", "interact", Command, "Ctrl/Cmd-K to reach everything.", {}),
  f("shortcuts", "Keyboard Shortcuts", "interact", Keyboard, "Hotkeys with a cheat sheet.", {}),
  f("toasts", "Toasts & Notices", "interact", Bell, "Transient feedback that doesn't stack up.", {}),
  f("optimistic-ui", "Optimistic UI", "interact", Zap, "Actions read as done immediately.", {}),
  f("sound-cues", "Sound Cues", "interact", Volume2, "Audio feedback for key actions.", { options: [{ id: "default", label: "Default", values: ["off", "on"] }] }),
  f("haptics", "Haptics", "interact", Smartphone, "Vibration on supported devices.", {}),
  f("drag-drop", "Drag & Drop", "interact", Hand, "Rearrange or move things by dragging.", {}),
  f("inline-edit", "Inline Editing", "interact", PenTool, "Edit in place rather than in a form.", {}),
  f("undo-redo", "Undo / Redo", "interact", Undo2, "Reversible actions with history.", {}),
  f("copy-button", "Copy to Clipboard", "interact", Copy, "One-click copy with confirmation.", {}),
  f("hover-card", "Hover Preview", "interact", Sticker, "Rich preview on hover.", {}),
  f("tooltips", "Tooltips", "interact", Info, "Short explanations on demand.", {}),
  f("skeletons", "Loading Skeletons", "interact", LoaderCircle, "Shape-of-the-content placeholders.", {}),
  f("empty-states", "Empty States", "interact", Inbox, "What it looks like with no data yet.", {}),
  f("onboarding-tour", "Onboarding Tour", "interact", Footprints, "Guided first run.", {}),
  f("magnetic-buttons", "Magnetic Buttons", "interact", Magnet, "Buttons that lean toward the cursor.", {}),

  /* ----------------------------------------------------------------- forms */
  f("contact-form", "Contact Form", "forms", Mail, "Name, message, and a reply path.", {}),
  f("multi-step-form", "Multi-step Form", "forms", Route, "Long form broken into steps with progress.", {}),
  f("inline-validation", "Inline Validation", "forms", Check, "Errors shown as you type, not on submit.", {}),
  f("autosave", "Autosave", "forms", RotateCw, "Never lose what was typed.", {}),
  f("file-upload", "File Dropzone", "forms", Upload, "Drag files in, with progress.", {}),
  f("search-autocomplete", "Autocomplete Search", "forms", Search, "Suggestions as you type.", {}),
  f("filter-panel", "Filters", "forms", SlidersHorizontal, "Narrow a list by several criteria.", {}),
  f("date-picker", "Date & Time Picker", "forms", Calendar, "Pick dates, ranges or slots.", {}),
  f("rating", "Rating Input", "forms", Heart, "Stars, hearts or thumbs.", {}),
  f("newsletter", "Newsletter Signup", "forms", Send, "Email capture with confirmation.", {}),
  f("booking", "Booking / Scheduling", "forms", Timer, "Pick a slot and confirm.", {}),
  f("survey", "Survey / Quiz", "forms", CheckSquare, "Question flow with a result.", {}),
  f("captcha", "Spam Protection", "forms", Shield, "Keep bots out without punishing people.", {}),

  /* -------------------------------------------------------------- commerce */
  f("product-grid", "Product Grid", "commerce", Store, "Browsable catalogue.", { options: [columns] }),
  f("product-detail", "Product Detail", "commerce", Package, "Gallery, options, price, add to cart.", {}),
  f("cart-drawer", "Cart", "commerce", ShoppingCart, "Slide-over cart with running total.", {}),
  f("checkout", "Checkout", "commerce", CreditCard, "Address, payment, confirmation.", {}),
  f("pricing-table", "Pricing Table", "commerce", DollarSign, "Tiers side by side with a recommended one.", { options: [{ id: "tiers", label: "Tiers", values: ["3", "2", "4"] }] }),
  f("comparison-table", "Comparison Table", "commerce", Table2, "Feature-by-feature against alternatives.", {}),
  f("testimonials", "Testimonials", "commerce", Quote, "Real quotes with names and faces.", {}),
  f("logo-cloud", "Logo Cloud", "commerce", BadgeCheck, "Customers or press logos.", {}),
  f("trust-badges", "Trust Signals", "commerce", ShieldCheck, "Guarantees, security, returns.", {}),
  f("countdown", "Countdown / Urgency", "commerce", Timer, "Time-limited offer.", {}),
  f("discount", "Promo Codes", "commerce", Percent, "Apply a code at checkout.", {}),
  f("wishlist", "Wishlist", "commerce", Bookmark, "Save for later.", {}),
  f("subscription", "Subscriptions", "commerce", Wallet, "Recurring plans and management.", {}),
  f("invoice", "Receipts & Invoices", "commerce", Printer, "Downloadable proof of purchase.", {}),
  f("affiliate", "Referrals", "commerce", Share2, "Share links with attribution.", {}),

  /* ------------------------------------------------------------------ data */
  f("charts", "Charts", "data", LineChart, "Lines, bars, areas — legible in both themes.", { options: [{ id: "kind", label: "Kind", values: ["line", "bar", "area", "mixed"] }] }),
  f("stat-tiles", "Stat Tiles", "data", TrendingUp, "Headline numbers with change indicators.", { options: [columns] }),
  f("data-table", "Data Table", "data", Table2, "Sortable, filterable, paginated rows.", { options: [{ id: "rows", label: "Row count", values: ["hundreds", "dozens", "thousands+"] }] }),
  f("pie-breakdown", "Distribution", "data", PieChart, "How a whole splits into parts.", {}),
  f("sparkline", "Sparklines", "data", Activity, "Tiny trend inline with a number.", {}),
  f("dashboard", "Dashboard", "data", Gauge, "Several linked views on one screen.", {}),
  f("timeline", "Timeline", "data", Milestone, "Events along an axis.", {}),
  f("kanban", "Board / Kanban", "data", Columns3, "Cards in columns you can drag between.", {}),
  f("calendar-view", "Calendar View", "data", Calendar, "Month/week/day scheduling grid.", {}),
  f("live-feed", "Live Feed", "data", Activity, "Streaming updates without refresh.", {}),
  f("export", "Export / Download", "data", Download, "CSV, JSON or PDF out.", {}),
  f("heatmap", "Heatmap", "data", Grid2x2, "Density over two dimensions.", {}),
  f("leaderboard", "Leaderboard", "data", Trophy, "Ranked list with movement.", {}),
  f("progress-tracker", "Progress Tracker", "data", Target, "How far toward a goal.", {}),

  /* ---------------------------------------------------------------- social */
  f("profiles", "Profiles", "social", User, "Public identity pages.", {}),
  f("comments", "Comments", "social", MessageSquare, "Threaded discussion with moderation.", {}),
  f("reactions", "Reactions", "social", Heart, "Lightweight response to content.", {}),
  f("share-sheet", "Share", "social", Share2, "Share to platforms and copy link.", {}),
  f("activity-feed", "Activity Feed", "social", Rss, "What people are doing, deduplicated.", {}),
  f("chat", "Chat / Messaging", "social", MessageSquare, "Real-time conversation.", {}),
  f("follow", "Follow / Subscribe", "social", Bell, "Opt into someone's updates.", {}),
  f("mentions", "Mentions & Tags", "social", AtSign, "Reference people and topics.", {}),
  f("moderation", "Moderation Tools", "social", Shield, "Report, hide, block.", {}),
  f("community-badges", "Badges & Achievements", "social", Award, "Earned status markers.", {}),
  f("forum", "Forum / Threads", "social", Hash, "Topic-first discussion.", {}),
  f("guestbook", "Guestbook", "social", Signature, "Leave a mark on the site.", {}),

  /* -------------------------------------------------------------------- ai */
  f("ai-chat", "AI Assistant", "ai", Bot, "Chat panel grounded in this site's content.", {}),
  f("ai-prompt-box", "Prompt Box", "ai", Wand2, "A single input that generates something.", { hint: "Say what the prompt produces." }),
  f("ai-search", "Semantic Search", "ai", Telescope, "Meaning-based rather than keyword search.", {}),
  f("ai-summarize", "Summarise", "ai", Feather, "Condense long content on demand.", {}),
  f("ai-generate-content", "Generated Content Slot", "ai", Sparkles, "A region whose content the model writes.", {}),
  f("ai-recommend", "Recommendations", "ai", Lightbulb, "Suggest what to look at next.", {}),
  f("ai-autofill", "Smart Autofill", "ai", Zap, "Model fills in fields from context.", {}),
  f("ai-moderation", "AI Moderation", "ai", ShieldCheck, "Screen submissions automatically.", {}),
  f("ai-translate", "Auto Translation", "ai", Languages, "Localise content on the fly.", {}),
  f("ai-voice", "Voice Input", "ai", Mic, "Talk to it instead of typing.", {}),

  /* ----------------------------------------------------------------- power */
  f("virtualised-list", "Virtualised List", "power", List, "Thousands of rows without lag.", {}),
  f("dense-tables", "Dense Data Rows", "power", Rows3, "Maximum information per pixel.", {}),
  f("multi-column-feed", "Multi-column Feed", "power", Columns3, "Parallel live streams side by side.", { options: [columns] }),
  f("presets", "Saved Presets", "power", Bookmark, "Named configurations, switchable in one click.", {}),
  f("hotkey-first", "Keyboard-first Flow", "power", Keyboard, "Every action reachable without a mouse.", {}),
  f("status-bar", "Status Bar", "power", Activity, "Persistent state along the bottom edge.", {}),
  f("blur-privacy", "Privacy Blur", "power", Eye, "Hide sensitive numbers for screen sharing.", {}),
  f("quick-action", "One-click Action", "power", Zap, "Execute with no confirmation dialog.", {}),
  f("split-panes", "Resizable Panes", "power", Columns3, "Drag the divider between regions.", {}),
  f("terminal-console", "Console / REPL", "power", Terminal, "Type commands, see output.", {}),
  f("realtime-stream", "WebSocket Stream", "power", Wifi, "Push updates instead of polling.", {}),
  f("diff-view", "Diff View", "power", GitBranch, "Side-by-side or inline change comparison.", {}),

  /* -------------------------------------------------------------- platform */
  f("dark-mode", "Dark / Light Mode", "platform", Moon, "Both themes, respecting the system setting.", { options: [{ id: "default", label: "Default", values: ["system", "dark", "light"] }] }),
  f("theming", "Theme Customisation", "platform", Palette, "User-adjustable colour and density.", {}),
  f("responsive", "Responsive Layout", "platform", Monitor, "Deliberate phone, tablet and desktop layouts.", {}),
  f("a11y", "Accessibility", "platform", Accessibility, "Keyboard, contrast, labels, focus order.", {}),
  f("i18n", "Internationalisation", "platform", Globe, "Multiple languages and locales.", {}),
  f("seo", "SEO & Metadata", "platform", Radar, "Titles, descriptions, open graph, sitemap.", {}),
  f("analytics", "Analytics", "platform", BarChart3, "Track what people actually do.", {}),
  f("auth", "Accounts & Auth", "platform", Lock, "Sign in, sessions, permissions.", {}),
  f("database", "Persistence", "platform", Database, "Where the data actually lives.", {}),
  f("api", "Public API", "platform", Server, "Let other software talk to it.", {}),
  f("pwa", "Offline / PWA", "platform", Cloud, "Installable and usable without a connection.", {}),
  f("perf", "Performance Budget", "platform", Gauge, "Fast on a mid-range phone.", {}),
  f("error-handling", "Error States", "platform", Info, "What happens when things break.", {}),
  f("cookie-consent", "Consent & Privacy", "platform", Fingerprint, "Ask before tracking.", {}),
  f("email", "Transactional Email", "platform", Mail, "Receipts, resets, notifications.", {}),
  f("cms", "Content Editing", "platform", PenTool, "Let non-developers change copy.", {}),
  f("versioning", "Versioning", "platform", HistoryIcon, "Draft, publish, roll back.", {}),
  f("testing", "Tests", "platform", FlaskConical, "Prove it still works.", {}),

  /* ------------------------------------------------------------- wildcards */
  f("custom-idea", "New Idea", "structure", Lightbulb, "A feature that doesn't exist yet — describe it in the prompt.", { hint: "Describe the idea in your own words. This is the placeholder for something new.", tags: ["custom", "new", "idea", "blank"] }),
  f("gimmick", "Central Gimmick", "structure", Crown, "The one unusual thing this site is built around.", { hint: "The single idea everything else serves.", tags: ["core", "hook", "concept"], w: 150 }),
  f("wildcard", "Wildcard", "structure", Dices, "Surprise me — let the model choose.", { tags: ["random", "surprise"] }),
  f("note", "Note", "structure", Pin, "A written instruction pinned to the canvas.", { hint: "Anything the builder should know.", tags: ["comment", "annotation"] }),
  f("mood", "Mood / Reference", "structure", Palette, "Tone, era, or a site to feel like.", { hint: "Reference points and the feeling to aim for.", tags: ["style", "vibe", "reference"] }),
  f("constraint", "Constraint", "structure", Flag, "Something the build must not do.", { hint: "A hard limit: no frameworks, must load in 1s, no scroll-jacking…", tags: ["limit", "rule"] }),
  f("scan-region", "Region", "structure", Scan, "A named area of the page other elements sit inside.", { tags: ["frame", "zone"], w: 150 }),
  f("integration", "Integration", "platform", Puzzle, "Connect to a third-party service.", { hint: "Which service, and what it does here." }),
  f("gamification", "Game Mechanic", "interact", Gamepad2, "Points, streaks, levels, unlocks.", {}),
  f("easter-egg", "Easter Egg", "interact", Ghost, "A hidden thing for people who poke around.", {}),
  f("generative-art", "Generative Visual", "media", Shapes, "Code-drawn artwork, seeded and unique.", {}),
  f("physics", "Physics / Simulation", "motion", Orbit, "Things that move like they have mass.", {}),
  f("weather-time", "Time & Place Aware", "platform", Sun, "Changes with the visitor's clock or weather.", {}),
  f("qr-bridge", "QR / Device Bridge", "platform", QrCode, "Hand off between phone and desktop.", {}),
  f("print", "Print Stylesheet", "platform", Printer, "Looks right on paper or as PDF.", {}),
  f("archive-mode", "Archive / History", "platform", Archive, "Everything that came before, browsable.", {}),
  f("network-graph", "Relationship Graph", "data", Network, "Nodes and edges you can explore.", {}),
  f("workflow-builder", "Workflow Builder", "interact", Workflow, "Let users wire steps together.", {}),
  f("collab-cursors", "Multiplayer Presence", "social", Users, "See other people's cursors live.", {}),
  f("brand-system", "Brand System", "platform", Brush, "Logo, palette, type, voice — applied consistently.", {}),
  f("waypoint", "Waypoint", "structure", Waypoints, "A junction where several flows meet.", {}),
  f("micro-copy", "Microcopy Voice", "content", Feather, "How buttons, errors and empties are worded.", { hint: "The voice: dry, warm, playful, terse…" }),
  f("cog-settings", "Settings Panel", "interact", Cog, "Let people change how the site behaves.", {}),
  f("compass-onboard", "First-run Experience", "interact", Compass, "What a brand-new visitor sees.", {}),
  f("home-anchor", "Home", "nav", Home, "The page everything returns to.", {}),
  f("tagging", "Tags & Categories", "content", Tag, "Organise and cross-link content.", {}),
  f("graduation", "Progressive Disclosure", "interact", GraduationCap, "Simple by default, deep when you dig.", {}),
  f("coin-economy", "Points / Currency", "commerce", Coins, "An in-site economy.", {}),
];

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

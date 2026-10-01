/**
 * The parts registry. One line per catalog id; the `DEFS` array is the source
 * of truth for which archetype draws which part and whether it can link.
 *
 * Adding a part: write an archetype (or add a branch to one), then add its id
 * here. Every id in the catalog appears exactly once below; an id with no line
 * falls back to a labelled box in `blocks.tsx`, which should never happen.
 */
import { Accordion } from "./Accordion";
import { Behaviour, Captcha } from "./Behaviour";
import { Cart, CoinEconomy, Checkout, Comparison, Countdown, Discount, Invoice, Pricing, ProductDetail, ProductGrid, Subscription, Testimonials } from "./Commerce";
import { Chart, Dashboard, DataTable, DetailsTable, Heatmap, Kanban, Leaderboard, LiveFeed, NetworkGraph, Pie, StatTiles, Timeline } from "./Data";
import { AiAction, AiChat, AiModeration, AiRecommend, AiVoice, PromptBox } from "./Ai";
import { ActivityFeed, Badges, Chat, CollabCursors, Comments, Forum, Mentions, Moderation, Profile, Reactions, ShareSheet } from "./Social";
import { Analytics, Api, Cms, Database, EmailPreview, Integration, MetaPreview, Perf, Pwa, Testing, Versions } from "./Ops";
import { A11y, Auth, BrandKit, CookieConsent, ErrorScreen, Languages, PrintLayout, QrBridge, Responsive, ThemePicker, WeatherTime } from "./Platform";
import { BlurPrivacy, Console, HotkeyFirst, MultiColumnFeed, Presets, SplitPanes, StatusBar, VirtualList } from "./Power";
import { WhatsNew } from "./WhatsNew";
import { CommandPalette, ContextMenus, CopyButton, DragDrop, EasterEgg, Gamification, Graduation, Haptics, HoverCard, MagneticButton, Onboarding, OptimisticUi, SettingsPanel, Skeletons, SoundCues, Toasts, Tooltips, UndoRedo, WorkflowBuilder } from "./Interact";
import { MotionPart } from "./Motion";
import { Cta, InvitePanel } from "./Cta";
import { Header } from "./Header";
import { Hero, ProofStrip, ValueProp } from "./Hero";
import { Breadcrumbs, Footer, Grid, Note, Outline, Overlay, Pagination, PlainBox, Sections, Split } from "./Layout";
import { ArticleList, Callout, CodeBlock, Eyebrow, Marquee, Prose } from "./Text";
import { Art, AvatarStack, BeforeAfter, Carousel, CornerGlow, Gallery, Picture, Player, Viewer } from "./Media";
import { DatePicker, FileDrop, FilterPanel, Form, Newsletter, Rating } from "./Forms";
import { SearchBox } from "./SearchBox";
import { Cube } from "./Cube";
import { Mesh } from "./Mesh";
import { DrawnIcon } from "./DrawnIcon";
import { Orb } from "./Orb";
import { Tabs } from "./Tabs";
import type { PartDef } from "./types";

export const DEFS: PartDef[] = [
  /* ---------------------------------------------------------- navigation */
  { component: Header, ids: ["sticky-header", "mega-menu", "mobile-nav", "home-anchor"], tier: "A", linkable: true },
  { component: SearchBox, ids: ["search-nav", "search-autocomplete", "ai-search"], tier: "A" },
  { component: Breadcrumbs, ids: ["breadcrumbs"], tier: "A" },
  { component: Outline, ids: ["toc", "scrollspy-nav"], tier: "A" },
  { component: Pagination, ids: ["pagination"], tier: "A" },

  /* ------------------------------------------------------------- layout */
  { component: Sections, ids: ["section-stack", "holy-grail", "scan-region", "container-width", "multi-page", "waypoint"], tier: "A" },
  { component: Grid, ids: ["card-grid", "bento-grid", "masonry"], tier: "A", linkable: true, linkWhole: true },
  { component: Split, ids: ["split-screen", "sidebar-layout", "docs"], tier: "A" },
  { component: Tabs, ids: ["tabs-panel"], tier: "A" },
  { component: Accordion, ids: ["accordion", "faq"], tier: "A" },
  { component: Overlay, ids: ["modal", "drawer"], tier: "A" },
  { component: Footer, ids: ["footer", "sitemap-page"], tier: "A", linkable: true },
  { component: Note, ids: ["custom-idea", "wildcard", "note", "mood", "constraint"], tier: "A" },
  /* A box that draws nothing of its own: what a captured page's wrappers land as. */
  { component: PlainBox, ids: ["box"], tier: "A" },

  /* -------------------------------------------------------- first screen */
  { component: Hero, ids: ["hero-split", "hero-video", "hero-gradient", "hero-typewriter", "hero-particles", "hero-3d", "hero-scroll-cue"], tier: "A", linkable: true },
  { component: ValueProp, ids: ["value-prop", "gimmick"], tier: "A" },
  { component: Cta, ids: ["cta-primary", "quick-action", "follow"], tier: "A", linkable: true },
  { component: InvitePanel, ids: ["invite-panel"], tier: "A", linkable: true },
  { component: ProofStrip, ids: ["social-proof-strip", "logo-cloud", "trust-badges"], tier: "A" },

  /* --------------------------------------------------------------- text */
  { component: Prose, ids: ["prose", "heading-scale", "fluid-type", "drop-cap", "pull-quote", "highlight", "kinetic-type", "textbox-format", "micro-copy", "reading-time", "footnotes"], tier: "A" },
  { component: Marquee, ids: ["marquee"], tier: "A" },
  { component: Eyebrow, ids: ["eyebrow-rule"], tier: "A" },
  { component: CodeBlock, ids: ["code-block", "diff-view"], tier: "A" },
  { component: Callout, ids: ["callout", "empty-states"], tier: "A" },
  { component: ArticleList, ids: ["blog-index", "changelog", "tagging", "archive-mode"], tier: "A", linkable: true, linkWhole: true },

  /* -------------------------------------------------------------- media */
  { component: Gallery, ids: ["gallery", "lightbox", "image-blur-up", "photo-credit"], tier: "A" },
  /* One picture at its own size: what an import lands as when it shrinks in. */
  { component: Picture, ids: ["picture"], tier: "A" },
  { component: Carousel, ids: ["carousel"], tier: "A" },
  { component: BeforeAfter, ids: ["before-after"], tier: "A" },
  { component: Player, ids: ["video-player", "audio-player", "podcast"], tier: "A" },
  { component: Viewer, ids: ["map-embed", "3d-viewer"], tier: "A" },
  { component: AvatarStack, ids: ["avatar-stack"], tier: "A" },
  { component: Art, ids: ["generative-art"], tier: "A" },
  { component: Orb, ids: ["orb-css", "orb-webgl", "orb-image"], tier: "A" },
  { component: Cube, ids: ["cube-3d"], tier: "A" },
  { component: Mesh, ids: ["mesh-3d"], tier: "A" },
  { component: DrawnIcon, ids: ["drawn-icon"], tier: "A" },
  { component: CornerGlow, ids: ["corner-glow"], tier: "A" },

  /* -------------------------------------------------------------- forms */
  { component: Form, ids: ["contact-form", "multi-step-form", "inline-validation", "autosave", "booking", "survey", "ai-autofill"], tier: "A" },
  { component: Newsletter, ids: ["newsletter", "rss"], tier: "A" },
  { component: FileDrop, ids: ["file-upload"], tier: "A" },
  { component: FilterPanel, ids: ["filter-panel"], tier: "A" },
  { component: DatePicker, ids: ["date-picker", "calendar-view"], tier: "A" },
  { component: Rating, ids: ["rating"], tier: "A" },

  /* --------------------------------------------------------------- shop */
  { component: ProductGrid, ids: ["product-grid", "wishlist"], tier: "A", linkable: true, linkWhole: true },
  { component: ProductDetail, ids: ["product-detail"], tier: "A" },
  { component: Cart, ids: ["cart-drawer"], tier: "A", linkable: true },
  { component: Checkout, ids: ["checkout"], tier: "C" },
  { component: Pricing, ids: ["pricing-table"], tier: "A" },
  { component: Comparison, ids: ["comparison-table"], tier: "A" },
  { component: Testimonials, ids: ["testimonials"], tier: "A" },
  { component: Countdown, ids: ["countdown"], tier: "A" },
  { component: Discount, ids: ["discount", "affiliate"], tier: "A" },
  { component: Subscription, ids: ["subscription"], tier: "C" },
  { component: Invoice, ids: ["invoice"], tier: "C" },
  { component: CoinEconomy, ids: ["coin-economy"], tier: "A" },

  /* --------------------------------------------------------------- data */
  { component: Chart, ids: ["charts", "sparkline"], tier: "A" },
  { component: Pie, ids: ["pie-breakdown"], tier: "A" },
  { component: Heatmap, ids: ["heatmap"], tier: "A" },
  { component: StatTiles, ids: ["stat-tiles", "progress-tracker"], tier: "A" },
  { component: DataTable, ids: ["data-table", "dense-tables", "export"], tier: "A" },
  { component: DetailsTable, ids: ["details-table"], tier: "A" },
  { component: Leaderboard, ids: ["leaderboard"], tier: "A" },
  { component: Dashboard, ids: ["dashboard"], tier: "A" },
  { component: Timeline, ids: ["timeline"], tier: "A" },
  { component: Kanban, ids: ["kanban"], tier: "A" },
  { component: LiveFeed, ids: ["live-feed", "realtime-stream"], tier: "A" },
  { component: NetworkGraph, ids: ["network-graph"], tier: "A" },

  /* ------------------------------------------------------------- social */
  { component: Profile, ids: ["profiles"], tier: "A" },
  { component: Comments, ids: ["comments", "guestbook"], tier: "A" },
  { component: Reactions, ids: ["reactions"], tier: "A" },
  { component: ShareSheet, ids: ["share-sheet"], tier: "A" },
  { component: ActivityFeed, ids: ["activity-feed"], tier: "A" },
  { component: Chat, ids: ["chat"], tier: "A" },
  { component: Mentions, ids: ["mentions"], tier: "A" },
  { component: Moderation, ids: ["moderation"], tier: "C" },
  { component: Badges, ids: ["community-badges"], tier: "A" },
  { component: Forum, ids: ["forum"], tier: "A", linkable: true, linkWhole: true },
  { component: CollabCursors, ids: ["collab-cursors"], tier: "A" },

  /* ----------------------------------------------------------------- ai */
  { component: AiChat, ids: ["ai-chat"], tier: "C" },
  { component: PromptBox, ids: ["ai-prompt-box", "ai-generate-content"], tier: "C" },
  { component: AiAction, ids: ["ai-summarize", "ai-translate"], tier: "C" },
  { component: AiRecommend, ids: ["ai-recommend"], tier: "C", linkable: true, linkWhole: true },
  { component: AiModeration, ids: ["ai-moderation"], tier: "C" },
  { component: AiVoice, ids: ["ai-voice"], tier: "C" },

  /* --------------------------------------------------- dense & keyboard */
  { component: VirtualList, ids: ["virtualised-list"], tier: "A" },
  { component: MultiColumnFeed, ids: ["multi-column-feed"], tier: "A" },
  { component: Presets, ids: ["presets"], tier: "A" },
  { component: HotkeyFirst, ids: ["hotkey-first"], tier: "A" },
  { component: StatusBar, ids: ["status-bar"], tier: "A" },
  { component: BlurPrivacy, ids: ["blur-privacy"], tier: "A" },
  { component: SplitPanes, ids: ["split-panes"], tier: "A" },
  { component: Console, ids: ["terminal-console"], tier: "A" },

  /* ------------------------------------------------------ under the hood */
  { component: Auth, ids: ["auth"], tier: "C" },
  { component: CookieConsent, ids: ["cookie-consent"], tier: "C" },
  { component: ErrorScreen, ids: ["error-handling"], tier: "A" },
  { component: Languages, ids: ["i18n"], tier: "C" },
  { component: ThemePicker, ids: ["theming", "dark-mode"], tier: "C" },
  { component: BrandKit, ids: ["brand-system"], tier: "A" },
  { component: QrBridge, ids: ["qr-bridge"], tier: "C" },
  { component: WeatherTime, ids: ["weather-time"], tier: "C" },
  { component: PrintLayout, ids: ["print"], tier: "C" },
  { component: Responsive, ids: ["responsive"], tier: "A" },
  { component: A11y, ids: ["a11y"], tier: "A" },
  { component: MetaPreview, ids: ["seo"], tier: "C" },
  { component: Analytics, ids: ["analytics"], tier: "C" },
  { component: Database, ids: ["database"], tier: "C" },
  { component: Api, ids: ["api"], tier: "C" },
  { component: Pwa, ids: ["pwa"], tier: "C" },
  { component: Perf, ids: ["perf"], tier: "C" },
  { component: Testing, ids: ["testing"], tier: "C" },
  { component: EmailPreview, ids: ["email"], tier: "C" },
  { component: Cms, ids: ["cms"], tier: "C" },
  { component: Versions, ids: ["versioning"], tier: "C" },
  { component: Integration, ids: ["integration"], tier: "C" },

  /* -------------------------------------------------------- interaction */
  { component: CommandPalette, ids: ["command-palette"], tier: "A" },
  { component: Toasts, ids: ["toasts"], tier: "A" },
  { component: OptimisticUi, ids: ["optimistic-ui"], tier: "A" },
  { component: SoundCues, ids: ["sound-cues"], tier: "A" },
  { component: Haptics, ids: ["haptics"], tier: "A" },
  { component: ContextMenus, ids: ["context-menus"], tier: "A" },
  { component: CopyButton, ids: ["copy-button"], tier: "A" },
  { component: HoverCard, ids: ["hover-card"], tier: "A" },
  { component: Tooltips, ids: ["tooltips"], tier: "A" },
  { component: Skeletons, ids: ["skeletons"], tier: "A" },
  { component: DragDrop, ids: ["drag-drop"], tier: "A" },
  { component: UndoRedo, ids: ["undo-redo"], tier: "A" },
  { component: Gamification, ids: ["gamification"], tier: "A" },
  { component: WorkflowBuilder, ids: ["workflow-builder"], tier: "A" },
  { component: SettingsPanel, ids: ["cog-settings"], tier: "A" },
  { component: Onboarding, ids: ["onboarding-tour", "compass-onboard"], tier: "A" },
  { component: WhatsNew, ids: ["whats-new"], tier: "A", overlay: true },
  { component: MagneticButton, ids: ["magnetic-buttons"], tier: "A", linkable: true },
  { component: EasterEgg, ids: ["easter-egg"], tier: "A" },
  { component: Graduation, ids: ["graduation"], tier: "A" },
  { component: HotkeyFirst, ids: ["shortcuts"], tier: "A" },
  { component: Cms, ids: ["inline-edit"], tier: "A" },

  /* ------------------------------------------------------------- motion */
  { component: MotionPart, ids: [
    "scroll-snap", "parallax", "reveal-on-scroll", "sticky-story", "horizontal-scroll",
    "scroll-progress", "scroll-video", "infinite-scroll", "smooth-scroll", "cursor-effects",
    "hover-tilt", "page-load", "morph-transition", "confetti", "physics",
  ], tier: "B" },

  /* ------------------------------------- behaviours and platform mocks */
  { component: Behaviour, ids: ["page-transitions", "back-to-top"], tier: "B" },
  { component: Captcha, ids: ["captcha"], tier: "C" },
];

export const PARTS: Record<string, PartDef> = Object.fromEntries(DEFS.flatMap((d) => d.ids.map((id) => [id, d])));

export function resolvePart(featureId: string): PartDef | null {
  return PARTS[featureId] ?? null;
}

/** A part standing over the page rather than in it (`PartDef.overlay`). */
export function isOverlay(featureId: string): boolean {
  return resolvePart(featureId)?.overlay === true;
}

export function isLinkable(featureId: string): boolean {
  return resolvePart(featureId)?.linkable === true;
}

export type { NodeLink, Part, PartDef, PartEvent, PartMode, PartProps, PartTour, PartTourStep } from "./types";
export { opt } from "./types";
export { items, themeFrom, titled, type Theme } from "./theme";

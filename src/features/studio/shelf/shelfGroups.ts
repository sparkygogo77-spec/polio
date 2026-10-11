/**
 * Where everything on the parts shelf sits: each category's groups, in the
 * order a person reads them, and the items in each.
 *
 * GROUPED BY WHAT A PERSON IS TRYING TO DO, the most useful first. An item
 * is a catalogue id (`catalog.ts`) or a working feature from the library
 * (`work:<id>`, `library/works.ts`). The near-copies an item stands for are
 * its variations (`shelfPlan.ts`), so they are not listed here: the shelf
 * shows one card per thing, and the card offers its versions.
 *
 * Pure data with no imports, so `catalog.ts` can project it into the
 * catalogue's `SUBGROUPS` without a cycle, and the checks read it as written.
 * Group ids are the moon marks' keys (`moons.tsx`); regrouping never moves
 * an id, because a saved page holds ids, not categories.
 */
import { OWN_FEATURE } from "./library/works.ts";
export interface ShelfGroup {
  id: string;
  emoji: string;
  label: string;
  /** Catalogue ids and `work:<id>` keys, in the order they are shown. */
  items: string[];
}

export const SHELF_GROUPS: Record<string, ShelfGroup[]> = {
  structure: [
    { id: "page-shape", emoji: "🧱", label: "Page layouts", items: ["section-stack", "box"] },
    { id: "grids", emoji: "🔲", label: "Grids of cards", items: ["card-grid"] },
    { id: "split-layouts", emoji: "↔️", label: "Side by side", items: ["split-screen"] },
    { id: "switchers", emoji: "🗂️", label: "Tabs and folding rows", items: ["tabs-panel", "accordion"] },
    { id: "overlays", emoji: "🪟", label: "Pop-ups and slide-ins", items: ["modal"] },
    { id: "footer", emoji: "🦶", label: "Footer", items: ["footer"] },
    { id: "top-bars", emoji: "🧭", label: "Menu bars", items: ["sticky-header"] },
    { id: "where-am-i", emoji: "🪜", label: "Show where you are", items: ["breadcrumbs", "toc"] },
    { id: "finding-things", emoji: "🔎", label: "Search", items: ["search-nav"] },
    { id: "between-pages", emoji: "📄", label: "Page numbers", items: ["pagination"] },
  ],
  content: [
    { id: "heroes", emoji: "🌅", label: "Opening banners", items: ["hero-split", "hero-scroll-cue"] },
    { id: "the-pitch", emoji: "💬", label: "One-line pitch", items: ["value-prop"] },
    { id: "the-button", emoji: "🚀", label: "Main buttons", items: ["cta-primary", "invite-panel"] },
    { id: "proof", emoji: "🏅", label: "Reasons to believe", items: ["social-proof-strip", "testimonials", "countdown"] },
    { id: "body-text", emoji: "📖", label: "Paragraphs", items: ["prose"] },
    { id: "type-treatment", emoji: "🔠", label: "Headings and labels", items: ["eyebrow-rule"] },
    { id: "moving-words", emoji: "💫", label: "Moving words", items: ["marquee", "kinetic-type"] },
    { id: "lists-of-things", emoji: "📰", label: "Article lists", items: ["blog-index"] },
    { id: "boxes", emoji: "💡", label: "Notes and code", items: ["callout", "code-block"] },
    { id: "your-notes", emoji: "📝", label: "Notes for the builder", items: ["custom-idea", "note"] },
    { id: "shapes-3d", emoji: "🧊", label: "Shapes you can turn", items: ["shape-sphere", "shape-cube", "shape-pyramid"] },
    { id: "pictures", emoji: "🖼️", label: "Pictures", items: ["picture", "gallery"] },
    { id: "moving-through", emoji: "🎠", label: "Slideshows", items: ["carousel", "before-after"] },
    { id: "sound-and-video", emoji: "▶️", label: "Video and sound", items: ["video-player"] },
    { id: "embeds", emoji: "🌍", label: "Maps and embeds", items: ["work:embed", "map-embed"] },
    { id: "generated", emoji: "🎨", label: "Decoration", items: ["corner-glow", "work:dust-canvas", "work:screen-filter", "generative-art", "avatar-stack"] },
    { id: "orbs", emoji: "🔮", label: "Glowing spheres", items: ["orb-css"] },
    { id: "solids", emoji: "🎲", label: "More things to turn", items: ["cube-3d", "mesh-3d"] },
    { id: "drawn", emoji: "✏️", label: "Your drawings", items: ["drawn-icon"] },
  ],
  motion: [
    { id: "on-scroll", emoji: "📜", label: "As you scroll", items: ["reveal-on-scroll", "scroll-progress", "parallax", "smooth-scroll", "scroll-snap", "sticky-story", "horizontal-scroll", "scroll-video", "infinite-scroll"] },
    { id: "on-pointer", emoji: "🖱️", label: "Under the pointer", items: ["hover-tilt", "work:turn-3d", "work:hover-lift", "work:press-push", "cursor-effects"] },
    { id: "on-its-own", emoji: "🪐", label: "Moves on its own", items: ["work:spin", "work:float", "work:blink"] },
    { id: "moments", emoji: "✨", label: "Openings and one-off effects", items: ["page-load", "work:switch-on", "page-transitions", "back-to-top", "confetti", "morph-transition", "physics"] },
    { id: "direct-handling", emoji: "✋", label: "Copy, drag and edit", items: ["copy-button", "drag-drop", "undo-redo", "inline-edit"] },
    { id: "on-hover", emoji: "👀", label: "On hover", items: ["tooltips", "hover-card", "magnetic-buttons"] },
    { id: "press-to-show", emoji: "👆", label: "Press to show", items: ["work:world-dialogs"] },
    { id: "keyboard-and-menus", emoji: "⌨️", label: "Keyboard and menus", items: ["command-palette", "shortcuts", "context-menus", "presets"] },
    { id: "feedback", emoji: "🔔", label: "Messages and feedback", items: ["toasts", "optimistic-ui", "sound-cues", "haptics", "skeletons"] },
    { id: "first-run", emoji: "🧑‍🏫", label: "First visit help", items: ["whats-new", "onboarding-tour"] },
    { id: "play", emoji: "🎮", label: "Games and extras", items: ["easter-egg", "gamification", "workflow-builder", "cog-settings", "blur-privacy"] },
  ],
  forms: [
    { id: "forms", emoji: "✉️", label: "Forms", items: ["contact-form", "inline-validation", "captcha"] },
    { id: "signup", emoji: "📧", label: "Email sign-up", items: ["newsletter"] },
    { id: "inputs", emoji: "📥", label: "Form fields", items: ["field", "checkbox", "date-picker", "rating", "filter-panel", "file-upload"] },
    { id: "browsing", emoji: "🛍️", label: "Products", items: ["product-grid", "product-detail", "comparison-table"] },
    { id: "plans", emoji: "💳", label: "Prices and plans", items: ["pricing-table", "subscription"] },
    { id: "buying", emoji: "🛒", label: "Cart and checkout", items: ["cart-drawer", "checkout", "discount", "invoice"] },
    { id: "economy", emoji: "🪙", label: "Points and credits", items: ["coin-economy"] },
  ],
  data: [
    { id: "charts", emoji: "📈", label: "Charts", items: ["charts", "pie-breakdown", "heatmap"] },
    { id: "numbers", emoji: "🔢", label: "Key numbers", items: ["stat-tiles", "work:sol-price", "leaderboard"] },
    { id: "tables", emoji: "📋", label: "Tables", items: ["details-table", "data-table"] },
    { id: "arrangements", emoji: "🗺️", label: "Boards, timelines, calendars", items: ["timeline", "calendar-view", "dashboard", "network-graph", "kanban"] },
    { id: "live", emoji: "📡", label: "Live updates", items: ["live-feed"] },
    { id: "dense-views", emoji: "📊", label: "Very long lists", items: ["virtualised-list"] },
    { id: "terminal", emoji: "🖥️", label: "Command line", items: ["status-bar", "terminal-console", "split-panes"] },
  ],
  platform: [
    { id: "reacting", emoji: "❤️", label: "Likes, shares, follows", items: ["share-sheet", "reactions", "follow"] },
    { id: "talking", emoji: "💬", label: "Comments and chat", items: ["comments", "chat", "forum", "mentions"] },
    { id: "people", emoji: "🧑", label: "Profiles and badges", items: ["profiles", "community-badges", "activity-feed"] },
    { id: "keeping-order", emoji: "🛠️", label: "Keeping it civil", items: ["moderation"] },
    { id: "together", emoji: "👥", label: "Together, live", items: ["collab-cursors"] },
    { id: "conversation", emoji: "🤖", label: "Talk to it", items: ["ai-chat", "ai-voice"] },
    { id: "writing", emoji: "✍️", label: "Writes for you", items: ["ai-prompt-box", "ai-summarize"] },
    { id: "suggesting", emoji: "🎯", label: "Finds and suggests", items: ["ai-search", "ai-recommend", "ai-autofill"] },
    { id: "appearance", emoji: "🎨", label: "Light, dark and print", items: ["dark-mode", "print"] },
    { id: "reach", emoji: "🌐", label: "Languages, search engines, access", items: ["seo", "a11y", "i18n"] },
    { id: "running-it", emoji: "📉", label: "Errors, speed, visitor stats, tests", items: ["error-handling", "perf", "analytics", "testing", "pwa"] },
    { id: "talking-out", emoji: "📬", label: "Cookies, email, outside services", items: ["cookie-consent", "email", "integration", "weather-time", "qr-bridge"] },
    { id: "accounts-and-data", emoji: "🔐", label: "Accounts and saved data", items: ["auth", "database", "cms", "versioning", "api"] },
  ],
};

/** `work:<id>` is a working feature from the library; anything else is a catalogue id. */
export const isWorkKey = (key: string) => key.startsWith("work:");
/**
 * Shelf parts that carry a library feature of their own, placed with it
 * ("What's new card": the card is the part, the feature opens it). The
 * part is the card on the shelf; the feature is placed by it.
 */
export const CARRIES: Readonly<Record<string, string>> = OWN_FEATURE;
/** The library feature a shelf key stands for: "work:<id>", or a part that carries its own. */
export const workIdOf = (key: string) => (isWorkKey(key) ? key.slice(5) : CARRIES[key] ?? key);

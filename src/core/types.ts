/**
 * The shared contract every feature module and core system speaks.
 *
 * Agents: this file is the vocabulary of the template. If you add a new kind
 * of contribution (e.g. a "widget" slot), add its type here, collect it in
 * `core/registry.ts`, and render it from the shell. Keep everything
 * serialisable except React components and callbacks.
 */
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

export type Level = "info" | "success" | "warn" | "error";

export type CueName =
  | "tap"
  | "tick"
  | "hover"
  | "toggleOn"
  | "toggleOff"
  | "select"
  | "navigate"
  | "open"
  | "close"
  | "copy"
  | "confirm"
  | "deny"
  | "success"
  | "error"
  | "warn"
  | "alert"
  | "notify"
  | "newRow"
  | "priceUp"
  | "priceDown";

export type CueCategory = "ui" | "feedback" | "alerts" | "feed";

export type PanelName = "settings" | "commands" | "shortcuts" | "tweets" | "keys";

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export interface ToastDiff {
  /** What changed, e.g. "Slippage". Defaults to the toast title. */
  field?: string;
  from: unknown;
  to: unknown;
  /** Optional formatter for both sides, e.g. (v) => `${v}%`. */
  format?: (v: unknown) => string;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  /**
   * Coalescing key. Publishing again with the same key while the toast is
   * still up UPDATES that card instead of adding a second one. Use stable
   * keys like "setting:audio.master" or "token:<address>:mc".
   */
  key?: string;
  title: string;
  body?: string;
  level?: Level;
  /** Module id or subsystem name. Used for rate limiting. */
  source?: string;
  icon?: LucideIcon;
  diff?: ToastDiff;
  /**
   * Show a card. Nothing is kept anywhere, so a publish without this says
   * nothing: it costs its rate-limit slot and returns null.
   */
  toast?: boolean | { durationMs?: number };
  /** Cue to play. `false` for silent. Defaults by level. */
  sound?: CueName | false;
  action?: ToastAction;
  /** Somewhere to go: the card's title becomes the link. */
  href?: string;
  /** Override the coalesce window for this key. `Infinity` = always coalesce. */
  coalesceMs?: number;
}

export interface ToastItem {
  id: string;
  key: string | null;
  title: string;
  body: string | null;
  level: Level;
  icon: LucideIcon | null;
  action: ToastAction | null;
  href: string | null;
  diff: { field: string; fromLabel: string; toLabel: string; from: unknown; to: unknown } | null;
  createdAt: number;
  /** When it was last published onto, which is what its time runs from. */
  updatedAt: number;
  expiresAt: number;
  /** When a pointer came to rest on it; held toasts are not swept. */
  heldAt?: number;
  /** Bumped every update so the card can re-flash. */
  rev: number;
  /** How many publishes were folded into this card. */
  count: number;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type SettingType = "toggle" | "select" | "segmented" | "slider" | "number" | "text" | "color" | "hue";

export interface SettingOption {
  value: string;
  label: string;
  description?: string;
}

export interface SettingDef<V = unknown> {
  /** Dotted id, e.g. "audio.master". Namespaced by group or module. */
  id: string;
  /** Group id. Must exist in core groups or a module's `settingGroups`. */
  group: string;
  label: string;
  description?: string;
  type: SettingType;
  default: V;
  options?: SettingOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Hidden until the user reveals advanced options. Put most knobs here. */
  advanced?: boolean;
  /** Offered only while this is true: a knob for chrome no module has asked for is a knob on nothing. */
  when?: () => boolean;
  /**
   * The panel that owns this control, when it is not the settings drawer.
   *
   * A module with a console of its own keeps its own knobs there, beside the
   * thing they act on, rather than in a drawer across the app. The drawer
   * skips anything with this set; the named panel renders exactly those.
   */
  panel?: string;
  /** Extra search terms. */
  tags?: string[];
  order?: number;
  /** Human formatter for toast lines and slider readouts. */
  format?: (v: V) => string;
  /** Don't publish a feed line when this changes (e.g. very chatty values). */
  silent?: boolean;
  /**
   * A setting whose truth lives somewhere else.
   *
   * WHY THIS EXISTS. Every setting above is the *Builder's* own: it dresses
   * the app you are working in and belongs in this browser, which is where
   * the settings store puts it. Some settings are not about the Builder at
   * all — they are about the site being built, and that site is a document
   * he publishes, opens on another machine, hands to someone else. A corner
   * radius for the site cannot live in this browser's localStorage; it has
   * to live in the document, or it is lost the moment the site moves.
   *
   * So a definition may name its own source of truth. Give all three and the
   * drawer reads, writes and re-renders from there instead of from the
   * settings store: `read` for the value now, `write` for a change, and
   * `subscribe` so the row repaints when the value moves for any other
   * reason — the Format panel, the part menu, loading a different site.
   * `default` is still declared, because that is what the reset dot and the
   * "changed from default" count compare against.
   *
   * Core knows nothing about where it points. The feature that owns the
   * document supplies the three functions.
   */
  read?: () => V;
  write?: (value: V) => void;
  subscribe?: (onChange: () => void) => () => void;
}

export interface SettingGroupDef {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  /**
   * The group's own colour, as an OKLCH hue, 0-360.
   *
   * His words: "also give icons color especially those in the side panel
   * categories". Every group's icon was the app's one accent, so a strip of
   * eight categories read as eight copies of the same mark and the icon did
   * no work at all — the label was carrying it alone. A hue per group means
   * the mark itself says which category you are in, which is the rule the
   * parts shelf already lives by (`CATEGORIES` in the studio catalogue, and
   * its twelve hues 30 degrees apart).
   *
   * Unset falls back to the accent, so a module that contributes a group
   * without choosing a colour looks exactly as it did.
   */
  hue?: number;
  order?: number;
}

/* ------------------------------------------------------------------ */
/* Commands, shortcuts, menus                                          */
/* ------------------------------------------------------------------ */

/** Everything a command / menu item / shortcut can reach without importing stores. */
export interface ActionContext {
  navigate: (href: string) => void;
  publish: (input: ToastInput) => void;
  play: (cue: CueName) => void;
  getSetting: <T = unknown>(id: string) => T;
  setSetting: (id: string, value: unknown) => void;
  openPanel: (panel: PanelName) => void;
  closePanel: (panel?: PanelName) => void;
  togglePanel: (panel: PanelName) => void;
  copy: (text: string, label?: string) => Promise<void>;
  confirm: (opts: { title: string; body?: string; danger?: boolean; confirmLabel?: string }) => Promise<boolean>;
}

export interface CommandDef {
  id: string;
  label: string;
  group?: string;
  icon?: LucideIcon;
  keywords?: string[];
  /** Display-only hint; register a ShortcutDef to make it work. */
  shortcut?: string;
  run: (ctx: ActionContext) => void | Promise<void>;
  when?: () => boolean;
}

export interface ShortcutDef {
  keys: string;
  label: string;
  group?: string;
  run: (ctx: ActionContext) => void;
  when?: () => boolean;
  /** Fire even while typing in an input. */
  allowInInput?: boolean;
  /** Don't call preventDefault. */
  passive?: boolean;
}

export interface MenuItemDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** When defined renders as a checkbox item. */
  checked?: boolean;
  hint?: string;
  children?: MenuEntry[];
  onSelect?: (target: ContextTarget, ctx: ActionContext) => void;
}

export type MenuEntry = MenuItemDef | { type: "separator"; id?: string } | { type: "label"; id?: string; label: string };

export interface ContextTarget<T = unknown> {
  scope: string;
  id: string;
  data: T;
  /** The element carrying the scope. `Element`, not `HTMLElement`: SVG icons can carry scopes too. */
  element: Element;
  /** All scopes under the cursor, innermost first. */
  stack: ContextTarget[];
  x: number;
  y: number;
}

export interface ContextMenuContribution {
  /** Scope name from `ctxProps(scope, ...)`, or "*" for every right-click. */
  scope: string;
  order?: number;
  items: (target: ContextTarget, ctx: ActionContext) => MenuEntry[];
}

/* ------------------------------------------------------------------ */
/* Routing, nav, status bar                                            */
/* ------------------------------------------------------------------ */

export interface RouteProps {
  path: string;
  params: Record<string, string>;
}

export interface RouteDef {
  /** "/pulse", "/token/:address", "/docs/*" */
  path: string;
  component: ComponentType<RouteProps>;
  title?: string;
  /** Hide the sidebar for this route. */
  fullBleed?: boolean;
  /**
   * This route puts the command search somewhere of its own, so the top bar
   * leaves it out rather than showing two of them.
   *
   * The Builder's toolbar is a row of things you do to the page; the search
   * for a tool belongs in that row, beside them, not in the window's chrome
   * a floor above.
   */
  ownSearch?: boolean;
}

export interface NavEntry {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Sidebar section. */
  group?: string;
  order?: number;
  /** Where to show it. Default: both. */
  placement?: "top" | "side" | "both";
  /** Static badge text, e.g. "beta" or "live". */
  badge?: string;
  external?: boolean;
}

/**
 * A control a module puts in the top bar, beside search and settings.
 *
 * The bar is core and knows nothing about any feature, so anything that has
 * to live up there — a link out to the repository, the keys panel — arrives
 * this way rather than by importing a feature into the shell.
 */
export interface TopBarItemDef {
  id: string;
  order?: number;
  /**
   * Which side of the controls it sits on.
   *
   * `action` is the default and the old behaviour: a control, over on the
   * right with the theme and the settings. `status` is for something that
   * *shows* rather than does — it sits ahead of them, where the eye already
   * goes to find out what is happening.
   */
  slot?: "status" | "action";
  component: ComponentType;
}

/* ------------------------------------------------------------------ */
/* Feature module                                                      */
/* ------------------------------------------------------------------ */

export interface FeatureModule {
  /** Stable kebab-case id. Also the default toast source and settings namespace. */
  id: string;
  name: string;
  description?: string;
  icon?: LucideIcon;
  /** Shown on the home grid and in docs. */
  tags?: string[];
  routes?: RouteDef[];
  nav?: NavEntry[];
  commands?: CommandDef[];
  shortcuts?: ShortcutDef[];
  contextMenus?: ContextMenuContribution[];
  settingGroups?: SettingGroupDef[];
  settings?: SettingDef[];
  topBarItems?: TopBarItemDef[];
  /** Runs once on the client when the shell mounts. Return a cleanup. */
  onMount?: (ctx: ActionContext) => void | (() => void);
  /** Keep out of nav and the home grid (still routable). */
  hidden?: boolean;
  /** Removing this module is safe; used to mark demos. */
  demo?: boolean;
}

export function defineFeature(mod: FeatureModule): FeatureModule {
  return mod;
}

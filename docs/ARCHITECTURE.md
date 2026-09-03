# Architecture

```
site.config.ts                 declarative site spec (defineSite)
src/app/
  layout.tsx                   <html> with pre-paint theme script, wraps AppShell
  page.tsx                     RouteView "/"
  [...slug]/page.tsx           RouteView for everything else
  globals.css                  tokens, Tailwind v4 theme bridge, keyframes, utilities
src/core/
  types.ts                     the contract: FeatureModule, NewsInput, SettingDef, MenuEntry, ActionContext…
  registry.ts                  collects modules → routes/nav/commands/shortcuts/menus/settings
  core-module.ts               the shell's own commands, shortcuts, global right-click items
  actions.tsx                  ActionContext provider (navigate, publish, play, settings, panels, copy, confirm)
  bootstrap.tsx                hydrates stores, wires settings→audio/news, unlocks audio, runs module onMount
  site.ts                      SiteConfig schema + defaults
  audio/engine.ts              Web Audio synthesis of every cue; config injected by settings
  settings/defs.ts             core setting groups + definitions
  settings/store.ts            persisted zustand store, change listeners, registration API
  settings/SettingsDrawer.tsx  searchable, grouped, advanced-gated drawer with import/export
  news/store.ts                coalescing feed + toast upsert + rate limit
  news/NewsPanel.tsx           slide-over feed with filters, pin, dismiss
  news/Toaster.tsx             positional toasts with drain bar and hover-hold
  context-menu/ctx.ts          ctxProps(scope,id,data) + data lookup
  context-menu/ContextMenuProvider.tsx  window-level right-click → stacked scopes → Radix menu
  commands/useShortcuts.ts     combo + chord matcher
  commands/CommandPalette.tsx  cmdk over commands + pages + toggles + setting groups
  commands/ShortcutsSheet.tsx  cheat sheet dialog
  theme/ThemeProvider.tsx      settings → data-* attributes and CSS vars on <html>
  ui-state/store.ts            panels open/closed, sidebar collapsed, confirm queue
  feedback/                    haptics, useFlashOnChange/flashElement
  shell/                       AppShell, TopBar, Sidebar, StatusBar, SlideOver, RouteView, NotFound, ConfirmDialog
  ui/                          primitives (Button, Switch, Slider, Tabs, Segmented, Dialog, Popover, Dropdown,
                               Select, Input, Card, Badge, Kbd, Tooltip, ScrollArea, Skeleton, Progress,
                               Sparkline, NumberTicker, VirtualList, CopyButton, Blur, EmptyState)
src/features/
  index.ts                     module list
  home/                        landing page from site config + registry
  pulse/                       demo: three-column live feed (sim.ts is the fake stream)
  showcase/                    demo: every primitive and subsystem
scripts/new-feature.mjs        scaffolder
docs/                          this file, PROMPTS.md, FEATURE-CATALOG.md
```

## Data flow

1. **Settings** are the root of most behaviour. `useSettings` persists sparse
   overrides; definitions are registered by core and modules. `ThemeProvider`
   projects them onto `<html>`. `bootstrap.tsx` bridges changes into a cue and
   a coalesced feed line. `engine.ts` reads audio settings lazily on each play.
2. **Actions** (`ActionContext`) are the only API feature code needs for
   side effects. Commands, shortcuts and menu items receive one; components
   get it via `useActions()`.
3. **News** is a single in-memory store. `publish` decides whether to insert,
   update, suppress or remove based on `key`, then optionally upserts a toast
   and plays a cue.
4. **Context menus** are resolved at right-click time by walking the DOM for
   `data-ctx` ancestors and asking the registry for contributions per scope.
5. **Routing** is registry-based. Next.js only knows `/` and `/*`; modules
   own their paths.

## Why these choices

- **Radix + Tailwind v4 + zustand + cmdk + react-virtual**: small, well-known
  to LLMs, no framework lock-in beyond Next.js.
- **Synthesised audio**: zero assets, instant, tunable in code, no licensing.
- **Runtime CSS tokens**: one hue recolours everything; density and radius
  are live; light/dark is an attribute flip with no re-render.
- **Catch-all routing**: an agent adds a page by editing one manifest, never
  the app directory.

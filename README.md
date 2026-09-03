# Polio — a terminal-grade UI foundation

A Next.js 16 template that already behaves like a trading terminal: right-click
menus everywhere, ⌘K command palette, two-key chord shortcuts, synthesised audio
cues, tactile buttons with instant optimistic feedback, a news feed that folds
repeats into one line, dozens of persisted settings hidden behind an Advanced
switch, live theming (hue, density, radius, motion, ambience), virtualised lists
and blur-for-streaming.

It is meant to be **pointed at by an agent**. Edit `site.config.ts`, drop a
module into `src/features/`, and the shell picks it up. Read `AGENTS.md` for
the contract and `docs/PROMPTS.md` for copy-paste recipes.

```bash
npm install
npm run dev              # http://localhost:3000
npm run new:feature blog # scaffold + register a module
npm run check            # typecheck + build
```

## What's inside

| Area | Highlights |
|---|---|
| Shell | Top bar with route tabs, collapsible sidebar rail, status bar (latency, clock, density, sound), slide-over panels |
| Interaction | Global right-click with stacked scopes, ⌘K palette (commands + pages + toggles), chords like `g p`, cheat sheet on `?` |
| Feedback | Sound on pointer-down, haptics, press scale, flash-on-change, number tweening, optimistic done states |
| News | Key-based coalescing, diff lines (`1% → 3%`), revert collapsing, rate limiting, toasts that update instead of stacking |
| Settings | ~60 options across appearance, effects, audio, feedback, feed, behaviour, keyboard, privacy, developer; search, groups, advanced, import/export |
| Theming | Single accent hue, dark/light/system, density, radius, font, scale, contrast, grid/glow/scanlines/grain |
| Demos | `pulse`: three-column streaming feed with presets, filters, pause-on-hover, row menus. `showcase`: every primitive live |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
radix-ui · zustand · cmdk · @tanstack/react-virtual · lucide-react.

## Layout

See `docs/ARCHITECTURE.md`. Short version: `src/core` is the shell,
`src/features/<id>` is where you build, `site.config.ts` is the one file that
re-centres the whole site.

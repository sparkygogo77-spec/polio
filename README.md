# Polio — draw a website, then say what it is

A Next.js 16 template with two halves that fit together:

**The Studio** (`/studio`) is a visual builder in two stages. First you **pick**:
browse or right-click your way through **218 common web features** and shortlist
what this site needs — no arranging, no prompting, just in or out. Then you
**design**: the canvas opens with only your picks in the palette. Drag them onto
the page, draw regions around them, connect them with arrows, group what belongs
together, and give every single element **its own prompt**.
Where you put something is part of the specification — vertical position is
reading order, a shared band is a row, a frame is a region, an arrow is a
relationship. Set the format (how many pages, how scrolling behaves, how text
boxes are set, ~70 options in all), write the one prompt that says what the
site *is*, and compile it into a build brief any agent can act on. Optionally
hand it straight to Claude from the page.

**The foundation** underneath is a shell that already behaves well: right-click
menus everywhere, a ⌘K palette, chord shortcuts, synthesised audio cues, tactile
buttons with optimistic feedback, a news feed that folds repeats into one line,
~60 persisted settings behind an Advanced switch, live theming, and virtualised
lists.

It is not a terminal template — dense keyboard-first UI is one category in the
catalogue, not the house style. Read `AGENTS.md` for the contract and
`docs/PROMPTS.md` for copy-paste recipes.

```bash
npm install
npm run dev              # http://localhost:3000 — the Studio is at /studio
npm run new:feature blog # scaffold + register a module
npm run check            # typecheck + build

# optional: lets the Studio call Claude directly instead of copying the brief
cp .env.example .env.local && echo "ANTHROPIC_API_KEY=sk-ant-…" >> .env.local
```

## What's inside

| Area | Highlights |
|---|---|
| Studio | Two stages — pick from 218 features across 14 categories, then design with only your shortlist. Freehand drawing, regions, arrows, groups, per-element prompts, ~70 format options, page manager, compiled markdown/JSON brief, optional Claude call |
| Shell | Top bar with route tabs, collapsible sidebar rail, status bar (latency, clock, density, sound), slide-over panels |
| Interaction | Global right-click with stacked scopes, ⌘K palette (commands + pages + toggles), chords like `g p`, cheat sheet on `?` |
| Feedback | Sound on pointer-down, haptics, press scale, flash-on-change, number tweening, optimistic done states |
| News | Key-based coalescing, diff lines (`1% → 3%`), revert collapsing, rate limiting, toasts that update instead of stacking |
| Settings | ~60 options across appearance, effects, audio, feedback, feed, behaviour, keyboard, privacy, developer; search, groups, advanced, import/export |
| Theming | Single accent hue, dark/light/system, density, radius, font, scale, contrast, grid/glow/scanlines/grain |
| Demos | `pulse`: three-column streaming feed with presets, filters, pause-on-hover, row menus. `showcase`: every primitive live. Both removable via `demoModules: []` |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
radix-ui · zustand · cmdk · @tanstack/react-virtual · lucide-react.

## Layout

See `docs/ARCHITECTURE.md`. Short version: `src/core` is the shell,
`src/features/<id>` is where you build, `site.config.ts` is the one file that
re-centres the whole site.

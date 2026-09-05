# Polio — draw a website, then say what it is

A Next.js 16 template with two halves that fit together:

**The Builder** (`/builder`) is a visual builder in one workspace. A library of
**218 common web parts** with plain names — *Search box*, *Rotating headline*,
*Text block* — sits beside a board with a **page frame** on it (desktop,
tablet or phone width). Parts land inside the frame at real size and draw what
they'll be: a search box is a search box, tabs are tabs with the labels you
typed. Snap them to the edges, resize them, draw regions around them, connect
them with arrows, group what belongs together, say what each container holds,
and give every single part **its own prompt**. Where you put something is part
of the specification: vertical position is reading order, a shared band is a
row, width in the frame is width on the site, a drawn region is a region, an
arrow is a relationship. Nothing is reflowed to fit. A live preview pinned to
the board shows the frame as you work. Set the format (pages, scroll behaviour, typography and text-box
treatment, ~70 options), write the one prompt that says what the site *is*, and
compile it into a blueprint any agent can act on — or hand it to Claude from
the page.

**The foundation** underneath is a shell that already behaves well: right-click
menus everywhere, a ⌘K palette, chord shortcuts, synthesised audio cues, tactile
buttons with optimistic feedback, a news feed that folds repeats into one line,
~60 persisted settings behind an Advanced switch, live theming, and virtualised
lists.

It is not a terminal template — dense keyboard-first UI is one category in the
library, not the house style. The look is neutral charcoal with one accent. Read `AGENTS.md` for the contract and
`docs/PROMPTS.md` for copy-paste recipes.

```bash
npm install
npm run dev              # http://localhost:3000 — the Builder is at /builder
npm run new:feature blog # scaffold + register a module
npm run check            # typecheck + build

# optional: lets the Builder call Claude directly instead of copying the blueprint
cp .env.example .env.local && echo "ANTHROPIC_API_KEY=sk-ant-…" >> .env.local
```

## What's inside

| Area | Highlights |
|---|---|
| Builder | One workspace: library of 218 plain-named parts, a page frame at desktop/tablet/phone width, parts at real size with typed contents and shape options, snapping and resizing, freehand drawing, regions, arrows and groups, a prompt per part, live preview, ~70 format options, page manager, compiled markdown/JSON blueprint, optional Claude call |
| Shell | Top bar with route tabs, collapsible sidebar rail, status bar (latency, clock, density, sound), slide-over panels |
| Interaction | Global right-click with stacked scopes, ⌘K palette (commands + pages + toggles), chords like `g p`, cheat sheet on `?` |
| Feedback | Sound on pointer-down, haptics, press scale, flash-on-change, number tweening, optimistic done states |
| News | Key-based coalescing, diff lines (`1% → 3%`), revert collapsing, rate limiting, toasts that update instead of stacking |
| Settings | ~60 options across appearance, effects, audio, feedback, feed, behaviour, keyboard, privacy, developer; search, groups, advanced, import/export |
| Theming | Single accent hue, dark/light/system, density, radius, font, scale, contrast, grid/glow/scanlines/grain |
| Reference | `showcase`: every core primitive live, hidden from nav at `/showcase`. Removable via `demoModules: []` |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
radix-ui · zustand · cmdk · @tanstack/react-virtual · lucide-react.

## Layout

See `docs/ARCHITECTURE.md`. Short version: `src/core` is the shell,
`src/features/<id>` is where you build, `site.config.ts` is the one file that
re-centres the whole site.

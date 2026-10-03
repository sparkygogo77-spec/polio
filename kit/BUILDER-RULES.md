# Builder rules

Every code chat that builds or changes a site designed in J's Polio builder follows these rules.
The builder writes this file, and the same list machine-readable as `"rules"` in `builder.json`,
into every Export for code and into the kit. They sit on top of `BUILDER-CONTRACT.md`, the
contract `kit:check` enforces.

The rules exist so that J can see and design everything a person sees. They are not a list of
designs you may not build. When the code needs a look or a setting the builder can't edit yet, the
answer is never to drop the design or to work around the builder: add a slot (rule 4) so the
builder learns it.

A rule marked **(checked)** fails `npm run kit:check` (or the command named), and so fails the pull
request, when it is broken. If a check fails, fix the code, not the check.

## What the builder can and can't do

It can: select, move, resize and restyle every element that has a `data-hook`; edit every token in
`tokens.css`; show each hidden part and preview screen as a state; edit the settings (slots) a part
lists; place the one allowed embed as a box.

It can't: see what only a script makes (elements outside any part, styles a script writes), see
pictures CSS draws by itself (`::before`, `::after`), edit inside a `<canvas>`, a picture or an
embed, or edit a literal value in a script. Each rule below says what to do instead, and none of
them means "don't build it".

## 1. Everything a person sees is a real tagged element

**(checked)** Text, icons, dividers, badges, glows and frames are each a real element with its own
`data-hook`, so the builder can select and style them. A `<canvas>` is one part: what it draws
takes its colours and sizes from tokens (and slots), and the builder sees the canvas as a box.

## 2. What a script shows later is a state of a part the builder can see

**(checked)** Anything a script shows later is built inside a part the builder can see, as a state
of that part, never as a separate element outside it.

Example: the "Connecting to the game server" box later becomes the "Find a match" button. Both are
children of the one box part (say `queue-box`), each with its own hook. The page opens with "Find
a match" carrying `hidden`, and the script swaps which child is hidden. The builder lists the
hidden child under States, so J can show it on the board and design it in place.

- A state is a hooked child inside the part, hidden with the `hidden` attribute until the script
  shows it, or a preview screen (`screens({...})`) that shows the part in that state.
- Repeated parts are copies of a `<template data-hook="template-...">`, and every copy goes into a
  part the page declares, or into another copy that does.
- `kit:check` follows every `append`, `prepend`, `appendChild`, `insertBefore`, `replaceChildren`,
  `before`, `after`, `replaceWith` and `insertAdjacentElement`. Each must add to a part a page
  declares: one found by a hook call, a variable or field set from one, or a template copy. It
  fails on `document.body`, `document.head`, a part's outside (`before`, `after`, `replaceWith`),
  a hook no page has, or anything it cannot follow. Where it cannot follow a real part, name the
  part on the line: `// part: queue-box`.
- A script the builder never designs (the preview page, which builds frames around the real
  pages) is listed in `"rules": { "outsideParts": [{ "file": ..., "why": ... }] }`.

## 3. States stay in their frame

**(checked by `kit:states`, and by `kit:diff` on a pull request that changes
`design/record.json`)** A part's states (Connecting, then Find a match, then the result) belong to
the frame around them, the part they are states of. In the builder they move and resize with that
frame. Each state's box, and everything inside it, stays inside the frame's box, so showing it
never spills over the parts around it. A state that needs more room makes the frame bigger in the
design, or becomes its own part with its own place. Template copies are not states: they go into
a list part that grows with them.

```
npm run kit:states -- design/record.json
```

## 4. Missing a style or setting? Add a slot

**(checked)** When the code needs a look or a setting the builder can't edit yet (a glow strength,
a candle width, how long a hint waits, a gradient), don't hard-code it, don't drop it, and don't
draw it some way the builder can't see. Make it a slot:

1. Name a token for it in `tokens.css` (`--pons-tv-glow: 12px`), and use it from the part's rule
   (`[data-hook="chart-tv-frame"] { box-shadow: 0 0 var(--pons-tv-glow) var(--pons-tv-glow-colour) }`)
   or read it in the script (`getComputedStyle(...).getPropertyValue('--pons-hint-wait')`).
2. List it in `builder.json` under `"rules": { "slots": [...] }`:
   `{ "token": "--pons-tv-glow", "hook": "chart-tv-frame", "label": "Glow", "kind": "length", "why": "How far the TV glows" }`.
   `kind` is one of `colour`, `length`, `number`, `text`, `choice` (with `"options"`), `shadow`,
   `filter`, `time` or `any`.
3. The builder shows each slot by its label in that part's Settings, and sends a change back as a
   token change in the design branch. `kit:check` fails when a slot's token isn't in `tokens.css`,
   its hook is on no page, or nothing uses the token for that part.

If something can't be a token at all, say so in the pull request: it is a request for the builder
to learn a new kind of slot, and the design stays as J drew it in the meantime.

## 5. Styles live in stylesheets, and scripts never write them

**(checked)** Every style is a rule in a stylesheet keyed by `[data-hook="..."]`: no inline
`style`, no `<style>` blocks, no classes or ids, and no `el.style.x = ...` in scripts. A script
changes how something looks by setting a data attribute or toggling `hidden`, and the stylesheet
keys on it. The one exception is positions (rule 9).

## 6. Values are tokens

Colours (**checked**), sizes, spacing, radii, timings and any number or text a script uses for how
something looks or reads are tokens in `tokens.css` (and `tokens.js` where a script needs them),
never literals. The builder edits tokens; a literal is a value the design can't change. A value
that belongs to one part and that J should see by name is a slot as well (rule 4).

## 7. Decorations are elements

**(checked)** A `::before`, `::after` or `::marker` rule that draws something (`content` other than
`none`) becomes a real child element with its own hook. Rules on pseudo elements that draw nothing
(`box-sizing`, resets) are fine.

## 8. The one allowed embed: the DexScreener chart

**(checked)** The DexScreener chart embed is the one `<iframe>` a designed page may show. It is
listed under `"rules": { "embeds": [...] }`, by host (`dexscreener.com`) and by the hooks of the
frames a script points at it. The builder shows it as a fixed box it can move and resize, and
never edits inside it. Like every DexScreener link it never names a specific contract address in
the page: a script sets its `src` when the coin is known. The preview and gallery pages are tools,
not designed pages, and may frame the site's own pages.

## 9. Scripts may set positions, and only positions

**(checked)** A script may place what it measures at run time (the tour box, the loading bar's
fill, the duel markers). It sets a CSS variable with `el.style.setProperty('--name', value)` only
when `"rules": { "scriptPositions": { "values": [...] } }` lists the name, and stylesheets use those
variables only in the position properties listed beside them (`left`, `top`, `right`, `bottom`,
`inset`, `width`, `height`, `transform`, `translate`, and an SVG circle's `r`, `cx`, `cy`).
Everything else about those parts (colour, border, radius, type, shadow) stays in tokens, slots and
the style layer, where the builder edits it. A script that needs to set something else asks for a
slot (rule 4) or a data attribute (rule 5).

## 10. Hooks stay put

**(checked by `kit:diff`)** No hook the base branch has may disappear or change kind, unless
`design/HOOK-CHANGES.json` lists it as deleted in the builder. A new state or part gets a new hook;
an existing one keeps its name.

## 11. Build from the design record

**(checked by `kit:record-diff`)** When the design branch carries `design/record.json`
(`DESIGN-RECORD.md`), build to it: keep each part's hook, parent and states, put each value it
marks as a token in `tokens.css`, then compare a look-only capture with
`npm run kit:record-diff -- design/record.json <capture>`.

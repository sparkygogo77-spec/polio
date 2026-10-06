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
`tokens.css`; show each panel in each of its declared states, and each scene; edit the settings (slots) a part
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
children of the one box part (say `queue-box`), each with its own hook. The box is a panel with the
states `connecting ready` (rule 12); each child says which state it shows in (`data-show`), and the
script only changes the box's `data-state`. The builder lists the panel's states, so J can show
each one on the board and design it in place.

- A state is a declared state of a panel (rules 12 to 20), never a child the script hides or shows
  itself.
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
changes how something looks by setting a data attribute or a panel's `data-state` (rule 13), and the stylesheet
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

## State rules (rules 12 to 20)

J's state rules 1 to 9, numbered here 12 to 20. A panel whose scripts hide k parts on their own has
2^k possible looks, and the builder can't tell which are real. Declared states give exactly n looks,
so designing a site is the sum of its panels' states, not the product. The builder reads them
instead of capturing the live site and guessing; captures stay only as a check that live still
matches.

```html
<section data-hook="signup-box" data-panel="signup-box" data-states="form sent" data-state="form" data-label="Sign-up box">
  <form data-hook="signup-form" data-show="form">…</form>
  <p data-hook="signup-thanks" data-show="sent">Thanks, you are on the list.</p>
</section>
```

```json
{ "scenes": [{ "name": "signed-up", "label": "Home: signed up", "page": "index.html",
               "screen": "signed-up", "panels": { "signup-box": "sent" } }] }
```

```js
setState('signup-box', 'sent');   // the site's hook helpers; setOn('form-error', true) for an "off on" panel
```

## 12. A panel that changes declares its states

**(checked)** A part whose look changes while the page runs is a panel: its root carries
`data-panel="<id>"` and `data-states="a b c"`, and starts in one of them with `data-state="a"`. The
id is the root's own hook. A panel that can be absent from the page has an `off` state, which hides
the whole panel. `data-state` is only ever a panel's state: for data a stylesheet keys on, use
another `data-` attribute.

## 13. Scripts change only the panel's state

**(checked)** To change what a panel shows, a script sets `data-state` on its root
(`setState(id, state)`, or `setOn(id, on)` for an `off on` panel) and nothing else: never
`hidden`, `style.display` or classes on the parts inside it.

## 14. Parts say where they show; one shared rule hides the rest

**(checked)** A part that shows only in some states lists them in the markup: `data-show="a b"`. A
part without `data-show` shows in every state. One shared rule in `tokens.css`, between the
`kit:panels` markers, hides the rest: a panel's `off` state, and in each other state every part that
doesn't list it. CSS can't compare two attributes, so `npm run kit:hooks` writes that rule from the
pages, and `kit:check` fails when it is stale. A `hidden` attribute in the markup is only for
something that is never shown (a drawing canvas, a download link).

## 15. Data is not a state

**(checked)** Text and numbers a script fills in (a balance, a name, a lead) are data, not states:
they go into their part through its `data-hook`. Sample values for them go in the samples file
(the file `"samples"` in `builder.json` names) as
`{ "hooks": { "<hook>": ["sample", "another"] } }`, and the builder shows them as sample chips.
`kit:check` fails on a sample for a hook no page has.

## 16. Panels never sit inside another panel's state

**(checked)** A panel never sits inside a part that shows only in some states of another panel.
If one panel's state brings up another panel, that panel is its own `data-panel` (with an `off`
state) beside or inside the first panel's always-shown parts, and the script sets both. Panels may share data, never
structure.

## 17. The scene file lists each scene's panels

**(checked)** The scene file (the file `"scenes"` in `builder.json` names) lists
each scene a person meets, in order: its name, label, page, the preview screen that shows it, and
`"panels": { "<id>": "<state>" }` for every panel present. A panel appears only when the scene
provides it: one left out is absent (its `off` state), so a panel without an `off` state is in every
scene of its page (a panel inside a template comes and goes with its copies). Going from the landing page into the main page is just more scenes. `kit:check`
fails on a panel or state that doesn't exist, a panel whose enclosing panel the scene leaves out,
or a missing panel that has no `off` state. A browser test should check that each scene's preview screen
shows exactly those states.

## 18. One id is one panel

**(checked)** The same `data-panel` id in several places (on several pages, or in each copy of a
template) is one panel, edited once, so it declares the same states everywhere.

## 19. Transitions on states are fine

A stylesheet may animate between states with CSS transitions or animations keyed on
`[data-panel="<id>"][data-state="<state>"]`. The builder saves its own edits the same way, as
style-layer rules keyed by panel and state, so they go back to the code without touching scripts.

## 20. kit:check enforces the state rules

**(checked)** `kit:check` fails on a part a script hides or shows itself, a state in `data-show`
that its panel doesn't declare, a part with `data-show` outside any panel, a panel inside another
panel's state, a `data-state` on anything but a panel, a `setState` or `setOn` naming a panel or
state that doesn't exist, a stale shared rule, and the scene and sample file problems above.

## Labels for the builder (rules 21 to 24)

Four more labels tell the builder what a part is, so it doesn't have to guess. They change nothing a
person sees.

```html
<ul data-hook="list-items" data-list="template-list-item" data-label="List entries"></ul>
<span data-hook="order-total" data-kind="money">12.50</span>
<label data-hook="name-field" data-group="form-field">…</label>
```

## 21. Plain names

**(checked)** `data-label="Find a match box"` is the name the builder shows for a part instead of
its hook. Every panel root and every list has one; any other part may. One to 60 characters, in
the words a person would use.

## 22. Say what the text is

**(checked)** A part a script fills with a value says what kind it is: `data-kind` is one of
`text`, `number`, `money`, `percent`, `time`, `date`, `address` or `hash`. The builder picks sample
chips and type to fit (money keeps its width as the digits change, an address can be shortened).

## 23. Lists name their template

**(checked)** The part that copies of a `<template>` go into says so: `data-list="template-..."`.
Every template on a designed page has its list, so the builder can show the list with none, one or
many copies.

## 24. Style groups

**(checked)** Parts that share one look carry the same `data-group="name"` (all panel titles, all
main buttons, all form fields). The builder edits a group once, the way one panel id is one panel. A group has at
least two parts.

## 25. Pictures on parts

A picture J drops on a part's Contents in the builder is how that part should look. "Send the
design back" carries it as `design/pictures/<hook>.<ext>`, listed in `design/pictures.json` with the
part's `hook`, the picture's `size`, its `crop` (the box round what it really shows, so a loosely
cropped picture still fits) and J's `note`. The code chat that picks up the branch applies every
entry:

- Copy the picture into the site's own folder (it serves only that; `design/` is not served), cut to
  its `crop` box; trim further only if what is left is still a plain margin.
- Make it the part's look through a token in the token file (`--<hook>-picture: url(...)`), used as
  the part's background in the stylesheet, sized to fit (`contain` unless the note says otherwise).
  Size changes go in tokens too.
- Keep the same element, its `data-hook`, its words (visually hidden if the picture already shows
  them, so screen readers and scripts still read them), its states, and everything the scripts do
  with it. A picture never replaces a part, and never adds an `<img>` the scripts don't know.
- If the picture shows a shape (a rounded or angled button), match the part's clickable area to it
  with `border-radius` or a `clip-path` token, so clicks land where the picture is.
- Add the new token to the slots list (`rules.slots`) so the builder can edit it next round.

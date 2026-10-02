# The design record

One JSON format, `design/record.json`, that both the capturer and the builder write and code chats
build from. It is the capture record the capturer has always written (the Chart TV thread rebuilt
the Trorty TV almost exactly from `sites/trumpmorty-fun/capture/routes/page_home.json`), with
what the builder knows added to each part: its hook and name, its states, its breakpoints, which of
its values are tokens, its animations and its assets. Every addition is optional, so an old
capture still reads as a record. The schema is `design-record.schema.json`.

## The file

```json
{
  "record": 1,
  "source": "builder",            // or "capture"
  "site": "PonsStars",
  "madeAt": "2026-10-02T21:00:00Z",
  "tokens": { "--color-accent": "#2f6fde", "--chart-line-width": "2" },
  "breakpoints": [{ "name": "desktop", "width": 1440 }, { "name": "phone", "width": 390 }],
  "pages": [ { "file": "web/index.html", "name": "Play", ...one capture record... } ]
}
```

A capture route file (`url`, `title`, `capturedAt`, `viewport`, `page`, `bodyBg`, `bodyColor`,
`font`, `faces`, `keyframes`, `tree`, `head`, `links`) is a record of one page: a reader that finds
`tree` at the top treats the file as `{ "record": 1, "source": "capture", "pages": [file] }`.

## A part (a node of `tree`)

Everything the capturer writes stays as it is: `t` (tag), `x` `y` `w` `h` (the box, in page
pixels, before transforms), `p` (DOM path), `kids`, `text`, `color`, `bg`, `bgi`, `fs` `fw` `ff`
`ffs` `lh` `ls` `ta` `tt` (type), `pad` `mar` `border` `radius` `shadow` (box), `disp` `dir` `gap`
`just` `align` `wrap` (layout), `pos` `ins` `z`, `tf` `tfo` `ptf` (transforms), `op`, `filter`,
`anim` (running animation), `motion` (`transition`, `hover`, `active` rules), `src`, `svgFile`, `href`.

Added, all optional:

| Key | What | Example |
| --- | --- | --- |
| `hook` | its `data-hook`, kept exactly | `"chart-tv-frame"` |
| `label` | its name in the builder | `"TV frame"` |
| `parent` | the hook of the part it sits in (also given by nesting) | `"chart-tv-body"` |
| `states` | each state it has, with the styles that differ in it | `{ "hidden": { "group": "match", "hidden": true }, "hover": { "style": { "transform": "translateY(-3px)" } }, "active": { "style": { ... } } }` |
| `at` | per breakpoint, what differs from the first breakpoint | `{ "phone": { "x": 0, "w": 390, "fs": 14 } }` |
| `tokens` | which values are tokens: style key to token name | `{ "bg": "--color-panel", "fs": "--size-title" }` |
| `assets` | inline SVG or a picture it draws | `{ "svg": "<svg ...>", "img": "web/img/tv.png" }` |

`states.hidden.hidden: true` means the page starts with it hidden; the code shows it. The record
still carries its box and styles as they are when shown.

## Building from it (code chats)

- Build each part with its `hook` as `data-hook`, exactly. A part with no hook gets one from its
  `label` (`chart-main`).
- Every value named in a part's `tokens` goes into `tokens.css` (and `tokens.js` through
  `kit:hooks`) under that name; the stylesheet and any script use the token, never the value.
- Hover, active and other states are `[data-hook="..."]:hover` (etc.) rules; hidden states use the
  `hidden` attribute.
- Breakpoints become media queries at the widths in `breakpoints`.

## Checking a build against it

After a build, take a look-only capture of the built page (Polio's Capture, "Look only, no
presses"), then:

```
node tools/record-diff.mjs design/record.json <capture of the built page>.json [--page web/index.html] [--px 4]
```

It matches parts by hook and lists each part that is missing, or whose size, place (relative to
the page), colour, background or type size differs by more than the tolerance. It exits 1 when
any part differs.

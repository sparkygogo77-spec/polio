# Recreating a real page: what was found, and whose it is

Two doors bring something a person did not make in this tool onto the
board as parts: a live address read from the space's panel, and a zip of
a page dropped on its well. Both go through the same reader and the same
catalogue and land the same way, so a finding on one is usually a finding
on both. What follows is every finding from walking them by hand against
real pages, sorted by which piece owns it, so that another session
exercising the same arc against the same pages can compare rather than
repeat.

The pieces, in the order a page passes through them:

1. **The route** opens the page and measures it: `api/studio/element`
   for an address, `api/studio/zip` for a zip, both running `CANDIDATES`
   and `MEASURE` from `siteRead.ts` inside the page. Nothing here decides
   what anything is; it reports boxes, words, colours, type, links.
2. **The block picker** decides which candidates make up the whole page:
   `pageBlocks` in `zipImport.ts`.
3. **The catalogue** decides which library part a reading becomes:
   `recreateFrom` in `recreate.ts`.
4. **The landing** puts the part in the space and locks the layout:
   `FromASite.tsx`, `fitToSurface`, `lockNow`.
5. **The part** draws what it was given: `parts/*.tsx`, the library's own.

## Pages walked

- `https://www.csszengarden.com/` (design 214), as a live address on the
  deployed site and as a zip exported from it (index.html, two
  stylesheets, eleven pictures and fonts).
- `https://playwright.dev/`, as a live address on the deployed site. The
  reader lists 60 candidates in 2.3 s and the whole-page take makes nine
  blocks of it: the links bar, the first screen, the three-card band,
  four bands, the footer. A session with its own egress read the same
  page and counted nine bands from a screenshot; the two agree.

## Findings, by owner

### The route (measurement)

- **Fixed.** A line of the page marked up with an inline element inside it
  (`<abbr>`, `<em>`) was read as separate runs and came out as separate
  lines: "The Beauty of" / "CSS" / "Design". Runs are joined while they
  share a block; inline-block items stay their own.
- **Fixed.** Only a block's own background was read, so a page whose look
  sits on the body (koi, bamboo, a teal ground) read as painted on
  nothing. The nearest painted colour and picture behind a block are
  read, up to the body, and marked as behind.
- **Fixed.** A `header` taller than a bar (a page builder's first screen
  is often a `<header>`) was named "the bar across the top" in the list
  while the catalogue rightly made it a first screen. A header is named a
  bar only at a bar's height.
- **Fixed.** A candidate's selector was cut at six steps under the body
  and still prefixed `body >`, so anything seven deep, 22 of the 60
  things listed on playwright.dev, matched nothing and came back "not on
  the page any more" when pressed; two of those were among the 24 the
  panel offered. The path walks all the way to the body: 60 of 60 are
  found again at the same box.
- **Fixed.** A link with no words (a GitHub mark, a Discord mark) was
  dropped, so a bar of 12 links read as 10. It is named by its label,
  its title, its picture's alt, its icon's title or the last part of
  where it goes: 12 of 12, "GitHub repository", "Discord server".
- **Fixed.** A block's children were its direct children, and a page
  builder wraps a band's contents in a container and a row, so a row of
  three cards read as one child and landed as a band of words. A wrapper
  that is the only thing inside is opened, up to four deep: the card row
  is three cards, three columns, the page's own titles.
- **Fixed.** A gradient was not paint: a first screen painted with three
  dark stops read as painted on nothing and its white words landed on no
  ground. The mean of a gradient's stops is its colour, for the block's
  own paint and for what is behind it: rgb(33, 40, 40), lightness 0.15.
- **Open.** Web fonts the page loads from the network are not fetched on
  either door: the zip's page may not ask the network for anything, and
  the address door reads only the one page. Type lands as the fallback
  the browser used ("system sans" for Libre Baskerville).
- **Open.** Candidate words in the list are `textContent`, so a row of
  inline-block links reads as one word: "PlaywrightDocsMCPCLIAPI". The
  reading itself is right; only the list's caption is squashed.
- **Open, intermittent.** On the deployed site the measure call (the
  second call, selectors given) has answered 502 from the gateway once
  in four walks, in under a second, where the same call took 3 s and
  succeeded before and after. The panel says so rather than hanging.
  Not reproduced locally; likely the serverless browser's cold start.

### The block picker (which boxes make the page)

- **Fixed.** The same box under three selectors (`header`, its wrapper,
  its `h1`) landed as three parts on top of one another. One box is one
  block.
- **Fixed.** A column holding sections came through as one band of every
  word on the page. A block whose contents are named bands stacked down
  it, two or more sections tall, is opened into them.
- **Fixed.** Sections whose boxes collapse under floated children list
  their paragraphs as top-level boxes. Runs of small boxes down one
  column are one band, measured member by member and merged; a heading
  spilling out of its section's box belongs to the section.
- **Fixed.** A section whose own box collapsed under floated paragraphs
  that are themselves tall (over 120px each) arrived as a thin band plus
  its paragraphs: the Zen Garden's Requirements section, 33px tall over
  five paragraphs, landed as four parts. The route now measures a box
  grown to hold the children that run out of it and touch it (placed
  children never count), so Requirements reads 1121px tall with its six
  children inside. A paragraph and a heading are named as such, so a
  section of tall paragraphs is never opened as a column; and a column
  whose box is stretched up beside the floats of the section before it
  (Zen's main column begins 310px down, beside the intro's summary and
  preamble) is trimmed to where its own contents begin, so it still opens
  into its sections. The Zen page now reads as ten blocks, Requirements
  one of them.

### The catalogue (which part it becomes)

- **Fixed.** There was no list-of-links part, so a sidebar of pages or a
  list of resources landed as a band of words. Three or more links that
  are most of a block's words are a list of links, every link a line.
- **Fixed.** Untagged, a footer was any band low on the page with four
  links. Once icon links were named, a band of nine company marks near
  the foot read as a footer with nine links. Only links that are words on
  the page count toward an untagged footer; the marks are a band of
  pictures for the grounded step.
- **Open.** The Zen Garden's design list pairs each design with its
  author as two links; the list part shows them as consecutive lines.
  The page's pairing is not a shape the list part has.
- **Open.** The band-of-words entry lands the one-line pitch part, which
  draws its first line only, and keeps three lines under the heading. A
  section of five paragraphs (Requirements) lands as one part showing
  its heading; the reading holds all six runs. The part is the wrong
  shape for a band of prose, which is the catalogue's to fix.
- **Open.** Anything the catalogue does not claim is "a band of words":
  real words and paint, the library's shape. The panel's line counts
  these plainly. Six of fifteen on the Zen Garden zip after the link
  list; none of the nine on playwright.dev were checked as parts yet.

### The landing (into the space)

- **Fixed.** One element taken alone landed at its own size: a list 841px
  tall in a space 380px tall was clamped to the top of the page, its
  middle fell outside the line, and it had no space, no plan and no
  panel. It is fitted to the space now, proportion kept, at most nine
  tenths of it either way.
- **Fixed.** Adding a part picks it, which swapped the space's panel for
  the part's and lost the line that says what happened. The space stays
  picked.
- **Fixed.** A made space could not be picked again: it has no fill and no
  key, and 0 of its two handles picked it, so once a part in it was picked
  the space's panel (Make it again, the order) was gone for good. Taking
  hold of the surface picks it.
- **Fixed.** Parts were placed on whole pixels, so a 60px bar on a 3077px
  page landed 31px tall on a 1573px surface and 16 of 36 locked shares
  split at the third decimal against the page; the surface's proportion
  was 2.4034 against the page's 2.4039. The fit, the frame placement and
  the single take are to a hundredth of a pixel: 2.40397 against 2.40391,
  the largest share drift 0.00006 of the page.
- **Fixed.** The panel offered the 24 biggest things, and the bar across
  the top of playwright.dev was the 38th, so the one thing a person points
  at first could only be had by taking the whole page. The page's blocks
  come first on the list, top to bottom, then the rest biggest first; a
  block that is a run of small boxes is measured member by member when
  taken alone, as when the page is taken whole.

### The part (how it draws)

- **Open, by instruction.** The first-screen part draws its own "Get
  started" and "Learn more" buttons when it was given none. The reading
  is right (the page had no buttons there); the part fills the gap with
  its defaults. Left alone: the part's behaviour, not the reading's.
- **Fixed.** The colour parser knew hex and oklch and not the browser's
  own `rgb()`, so every colour measured off a page was carried on the
  node and dropped by the part: a white bar drew the site's dark surface,
  and the footer's dark paint on the first night was the site's own,
  not the page's. `rgb()` and `rgba()` parse; the bar draws oklch(1 0 0),
  the first screen rgb(33, 40, 40).
- **Fixed.** A part landed at half the page's width kept the page's type
  at full size: a 48px headline in a box half as tall, cut off at the
  top. The type is scaled by the same number as the box, so the first
  screen draws its headline at 28.8px with nothing cut off. The theme
  floors `size` at 0.6, so a surface drawn narrower than six tenths of
  the page still lands its words a shade larger than the page had them.
- **Open, by instruction.** The header part folds its links under a menu
  below 640px, so the bar taken alone into a 655px space lands 589px
  wide and shows its name and a menu; laid on the whole page's surface
  at 654.5px it shows its links. The part's own rule, not the reading's.
- **Fixed.** Every part split its contents at commas as well as at
  lines, so a headline with commas in it, "…for testing, scripting, and
  AI agents.", was three items: the first drawn as the line, the second as
  the sentence under it, the third lost. Contents with lines in them are
  split at lines only; a content on one line is still a list by its
  commas. The first screen draws its 82-character headline whole.
- **Open.** The card-grid part keeps each card's title and not its
  sentence; the filler under a title on a landed card grid is the
  part's, not the page's.
- **Open, said plainly.** Pictures inside any block are placeholders, and
  the grounded step cannot be reached for them. Walked on the Zen Garden
  zip: 3 of 10 landed blocks hold a picture; `recreate` put in the space's
  order (5 steps) and Make it again pressed made 0 calls to any route,
  changed 0 parts, and the panel said "10 parts locked where they were
  drawn". Three things are missing, on three owners: a library part has
  no field to hold a picture and draws `Placeholder` where one goes (the
  part's); the step runs only inside a queue job on the first drawing it
  made, and a landed part has no first picture, since the zip route hands
  a `zip:` address and the site route the page's own, neither of which
  the board can fetch (the route's, and a runner nobody has written); and
  the image route wants a key none of the sessions holds (a key). The
  panel's line used to promise "put Make the real thing in the order";
  it now says the picture stays a placeholder and why.

## How to compare a run

For an address, the list the panel shows is `CANDIDATES` at 400, biggest
first, cut to 60; "Take the whole page" is `pageBlocks` over that list.
The probe `tests/site-read.mjs` runs the same two functions against a
page it serves itself, so a difference between a live read and the
fixture is a difference in the page, not the reader. A finding about
what a part looks like on the board is the part's; a finding about which
part it became is the catalogue's; a finding about words, boxes or
colours being wrong is the route's.

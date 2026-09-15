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
- **Open.** A section whose own box collapses under paragraphs that are
  themselves tall (over 120px each) still arrives as a thin band plus its
  paragraphs: the Zen Garden's Requirements section, four parts.

### The catalogue (which part it becomes)

- **Fixed.** There was no list-of-links part, so a sidebar of pages or a
  list of resources landed as a band of words. Three or more links that
  are most of a block's words are a list of links, every link a line.
- **Open.** The Zen Garden's design list pairs each design with its
  author as two links; the list part shows them as consecutive lines.
  The page's pairing is not a shape the list part has.
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

### The part (how it draws)

- **Open, by instruction.** The first-screen part draws its own "Get
  started" and "Learn more" buttons when it was given none. The reading
  is right (the page had no buttons there); the part fills the gap with
  its defaults. Left alone: the part's behaviour, not the reading's.
- **Open.** The card-grid part keeps each card's title and not its
  sentence; the filler under a title on a landed card grid is the
  part's, not the page's.
- **Open.** Pictures inside any block are placeholders until the grounded
  step, which is euler's `recreate` step asked for by name.

## How to compare a run

For an address, the list the panel shows is `CANDIDATES` at 400, biggest
first, cut to 60; "Take the whole page" is `pageBlocks` over that list.
The probe `tests/site-read.mjs` runs the same two functions against a
page it serves itself, so a difference between a live read and the
fixture is a difference in the page, not the reader. A finding about
what a part looks like on the board is the part's; a finding about which
part it became is the catalogue's; a finding about words, boxes or
colours being wrong is the route's.

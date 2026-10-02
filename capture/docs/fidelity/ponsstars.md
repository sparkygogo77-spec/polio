# PonsStars design preview: capture fixes (lane S), 2026-10-02

The owner's own test site, https://pst-server-beige.vercel.app/preview.html?still=1
(nothing on it writes). Taken with the Builder's Capture a site, it showed
four things; each is fixed in general and held by `site/capture/check-script-built.mjs`
(red before, green after), on stand-in pages.

## What was wrong, and where

1. **Only the first screen.** The preview builds its 13 screens one after
   another over about 5 s ("Building …"); the capture read it once the
   network was idle: 1440x1888 of about 30,800 px. *Capture side.* Now
   `capture-route.mjs` reads a page only once it stops changing: no element
   added or taken out and no change of height for 1.5 s, no request in
   flight, at most 30 s (`--built`, `--built-quiet`). The wait is said on
   stderr (`built: waited 6.9 s … height 1500 -> 9900 px`) and kept in the
   capture as `built`. Words changing in place (a clock, a price) are not
   waited for.
2. **The price chart lost.** On the live game page the chart is TradingView
   Lightweight Charts: canvases stacked in a table. The capture already keeps
   each canvas as a picture at its drawn size, place and stacking (held now
   by the check: candles under crosshair, axis in its cell, trade label
   over them). But the *preview* copies each screen out of a hidden frame and
   swaps every canvas for an `<img>` whose source is a `data:` address of what
   it drew (`preview.js`). The capture tried to download those addresses
   ("could not fetch data:image/png…"), and the converter dropped the
   pictures. *Capture side.* Now a `data:` picture is carried from its own
   bytes, never fetched, and its document entry says so in words instead of
   repeating the address.
3. **Words on one line run together.** *Capture side, and the converter.* An
   element's own words were recorded as one string with one box. The
   converter's hole arbiter then tried every place for *all* the children's
   words as one block: the nav's four links fitted before the bars
   (`PlayLeaderboardMy profileHow it works | | |`), and the three values of
   `Match: … Round: 0 Status: live` fitted nowhere, so they stayed laid over
   `Match: Round: Status:`. Now the dump records each run of an element's own
   words with its box (`ot`), and `inline-runs.mjs` puts a line of words and
   links back in the order the page drew it: a sentence folds its children in
   as runs, with the spaces its text holds; a line whose own words only
   separate (a nav's bars) keeps its links as parts and makes each bar a part
   at its own place between them. A line with an icon or a dot in it is set as
   before. An older capture (no `ot`) no longer folds several elements with
   room between them in as one block.
4. **Pages differing only by their query** stay separate pages (they did: 13).
   Held by the check now.

Two things the new wait exposed, fixed on the way: the behaviours pass read a
script's 5 s bob, sampled for 1.5 s while it rose, as a drift and never
sampled it again (`behaviours-drive.mjs`: a drift that comes back is a
float); and the states pass now allows the room a press makes in each run's
box, as it did in the text box.

## For the Builder (Polio lane)

Nothing new is needed for these four: the document now carries the chart as
picture parts, a sentence as runs (`content: [{text}, {text, colour, weight},
{text, bg, pad, radius, size}]`, as the hole arbiter already wrote), and a
nav's bars as words parts of their own at their boxes. Two things to make sure
of:

- A part whose `content` is now `""` (the nav itself, once its bars are parts
  of their own) draws no words; its box and dress as before.
- A sentence's runs are drawn on one line in order, a chip run (`bg`) with its
  padding and rounding and its own `size` (the match id's grey 14px chip).

## Re-capture of the 13 screens: not taken from this lane

This container's browser does not trust the egress proxy's certificate; the
two ways around it (pinning the proxy's key in Chromium, or a local curl
mirror) were refused by this session's permission check as weakening
certificate checks, and the capture workflow could not be started from here
(GitHub answered 403 to the dispatch). The code is on branch
`claude/wonderful-pascal-105n6y`: run the Builder's Capture a site (or the
"Capture a site" workflow on that branch) with the 13 addresses
`/preview.html?still=1&screen=<name>` for first-visit, lobby, before-queue,
queue-waiting, mid-match, last-seconds, result-win, result-loss,
tie-rematch, tour, leaderboard, profile, public-result.

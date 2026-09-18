# The Engine catalogue, audited: 24 entries, both halves

No entry is cut here. This is the table that was asked for before anything is.

## What the two halves mean

Every element in common use is supposed to ship two ways, and each entry
below is read against both:

- **Conventional** — is there a version that behaves the way people expect?
  Expect means what a visitor who has met this thing on other websites would
  assume it does. Judged against the site that is *published*, not the board,
  because the published site is the website.
- **Free-made** — is there a version that can be built here, with no account,
  no bill and no third party?

Neither half means the entry is a candidate to cut. One half means a gap.

## The three facts every row is read off

Nothing below is an opinion about what these elements ought to be. Each row is
read off three things in the repository, and each can be checked:

1. **The board part.** `src/features/studio/parts/Platform.tsx` and
   `parts/Ops.tsx`. Twelve elements each. Every one of the 24 draws a truthful
   working demonstration — the state really changes when you press it — built
   on sampled data from `parts/sample.ts`.
2. **The published page.** `src/features/studio/staticSite.ts`. One
   `index.html` per page plus one stylesheet. Its own header says what it is:
   "it is a still. Anything that was a React handler is gone." The emitted
   `<head>` is charset, viewport, `<title>` and the stylesheet links —
   nothing else. There is no `<script>` anywhere in the output, no
   `robots.txt`, no `sitemap.xml`, no `manifest.json`, no `404.html`, and
   `<html lang="en">` is written in fixed.
3. **The blueprint.** `src/features/studio/spec.ts`, the `Elements:` block
   around line 645. For each element it prints the label, the feature id,
   placement, contents, options, links, colour, type and the prompt. It never
   prints *how the thing should be built* — no service, no route, no choice.

## The headline, before the table

**No element in the catalogue offers a choice of route — not in Engine, not
anywhere.** There is no switch reading "made here" or "conventional" on any of
the 24, and 23 of them carry no options at all (`dark-mode` has one, for which
theme starts selected). So the rule that every element in common use ships both
ways is not implemented for a single entry. The table below is therefore mostly
a table of which half is *reachable*, not which half is *offered*.

## The table

| # | Entry | Conventional half | Free-made half | Verdict |
|---|---|---|---|---|
| 1 | Dark / light mode | Toggle works on the board; published page has no script, so it is a picture of a toggle | Yes, and cheap — a class on `<html>`, or `prefers-color-scheme` with no script at all | **Gap** |
| 2 | Theme picker | Same: real on the board, inert once published | Yes — a CSS custom property and a few lines | **Gap** |
| 3 | Works on phones | Published page is one fixed board width with `max-width: 100%`, so it shrinks rather than reflows | Yes — media queries cost nothing | **Gap**, and the one that stays invisible until someone opens the site on a phone |
| 4 | Accessibility | It is a checklist panel you place *on* the page. Accessibility is a property of every part, not a part | Free by definition — it is how the markup is written | **Wrong shape.** Belongs as a behaviour over the whole page (tier B), not a panel |
| 5 | Languages | Buttons really swap the words on the board; published page is inert and always says `lang="en"` | Yes, and unusually clean: one page per language, and the Builder already has pages | **Gap** |
| 6 | Search engine setup | The part shows a truthful search-result preview with a description you type. The published `<head>` carries a title and nothing else — the description you typed is thrown away | Entirely free: four meta tags and two files | **Gap**, and the cheapest in the list to close |
| 7 | Analytics | Needs a service, and no service is named anywhere in the app or the blueprint | None on a static host: real numbers need something that receives them | **Neither**, today |
| 8 | Accounts & login | Needs a real service. The board part signs you in against an email regex and says "Signed in" | Not possible on a static page; anything client-only is theatre | **Neither**, today. The board part is the most misleading of the 24 |
| 9 | Saved data | Needs a real database. The board part invents row counts | None without a server | **Neither**, today |
| 10 | Public API | Needs a server to answer. The board part shows a sample response | None without a server | **Neither**, today |
| 11 | Works offline | Needs a manifest and a service worker; the publish writes neither | Entirely free — no account, about thirty lines, two files | **Gap** |
| 12 | Speed budget | A panel of numbers typed by hand. A budget is enforced by a tool before release, never shown to visitors | Free (the tools are) | **Wrong shape.** Belongs beside Build, not on a page |
| 13 | Error screens | A 404 needs a `404.html` at the root. Nothing writes one | Entirely free — one more HTML file | **Gap**, and a one-file fix |
| 14 | Cookie consent | Board banner remembers the answer; published banner cannot be dismissed | Free | **Gap.** Also only means anything if something is tracking, which ties it to row 7 |
| 15 | Automatic emails | Needs a sending service | None on a static site | **Neither**, today. The part is a preview of an email — a design artefact, not a site element |
| 16 | Content editing | Needs a backend, or a git-based CMS | **Already built and unnamed: the Builder is the CMS.** Copy is edited on the board and republished | **One half** — the free-made one, unclaimed |
| 17 | Drafts & versions | Needs a backend | **Already built and unnamed: the publish pushes to a repository, so git is the history** | **One half** — the free-made one, unclaimed |
| 18 | Tests | Invents pass/fail from a seeded random number and shows green ticks on the website | Free (the runners are) | **Wrong shape**, and the worst mock in the list: invented green ticks on a published page |
| 19 | Connect a service | Depends entirely on which service is named | Depends | **Placeholder by design.** Both halves are properties of whatever is named in its hint. Keep as-is |
| 20 | Time & weather aware | Clock is right on the board and frozen once published. Weather needs an API | The clock half is free; the weather half is not | **Gap**, and it binds a free thing to a paid one under one name. Worth splitting |
| 21 | QR code hand-off | **The cells are drawn from a seeded random number. It is not a QR code and will not scan** | Yes — an encoder is a couple of hundred lines, no account | **Gap**, and the most concrete build here. It is also the one most likely to embarrass, because it looks exactly like the real thing |
| 22 | Print layout | Needs `@media print` rules; the export carries the app's stylesheets, which have none for the site | Entirely free | **Gap**, small |
| 23 | Archive | A list of what came before. Publishes as a real static list | Free | **Both halves.** The only entry of the 24 that publishes as the thing it claims to be |
| 24 | Brand kit | A kit is a document for whoever builds, not a thing a visitor meets | Free | **Wrong shape.** It is a Looks artefact, and Looks exists |

## The buckets

- **Both halves, publishes as claimed — 1.** Archive (23).
- **Wrong shape, not a page element at all — 4.** Accessibility (4), Speed
  budget (12), Tests (18), Brand kit (24). None of these is a cut: each has a
  place to move to — a whole-page behaviour, the Build, the Build, and Looks.
- **Neither half today — 5.** Analytics (7), Accounts & login (8), Saved data
  (9), Public API (10), Automatic emails (15). All five want a server. These
  are the only genuine cut candidates, and the alternative to cutting is to
  name a route.
- **One half, the free-made one already built — 2.** Content editing (16),
  Drafts & versions (17). Nothing has to be built for these; they have to be
  *said*.
- **Gap — the element is right, the publish drops it — 11.** Rows 1, 2, 3, 5,
  6, 11, 13, 14, 20, 21, 22.
- **Placeholder by design — 1.** Connect a service (19).

## What closing the gaps would take

The eleven gaps are not eleven problems. Ten of them are one problem: the
published page is a still with no script and a head with nothing in it. Four
of those ten close by writing a file the publish does not write yet —
`404.html`, `robots.txt` and `sitemap.xml`, `manifest.json` — and four more by
letting a handful of elements emit the few lines of script they need. The
eleventh, the QR code, is a self-contained encoder and touches nothing else.

## The recommendation, which is not a cut

The rule is that every element in common use ships both ways. Nothing in the
catalogue can express that today, so nothing does it. The catalogue already
has the shape for it: `FeatureOption` in `catalog.ts`, and the blueprint
already prints an element's options to whoever builds the site
(`spec.ts`, the `options:` line). One shared option — call it **Build**, with
values `made here` and `conventional` — put on every element where both halves
are real, would carry the rule through the board, the brief and the build for
the cost of one constant and one line per entry. It is the same mechanism
`density`, `emphasis` and `columns` already use.

That is the piece to settle before anything is cut, because it changes what
"neither half" means for five of these entries: an element that names its
route has a conventional half by naming it.

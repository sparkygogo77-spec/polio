"use client";
/**
 * The sub-group marks — the moons that go round the planets.
 *
 * Same set as `planets.tsx` and drawn through the same `Svg` shell: a 24 grid,
 * one stroke weight, no fills, `currentColor` so the category's hue paints
 * them. A sub-group is a smaller idea than a category, so each mark is a
 * single object rather than a scene — a bell, a bag, a bar chart — and it
 * reads at 13px, which is the size the crumb bar draws them at.
 *
 * One entry per sub-group id in `catalog.ts`. Ids repeat across categories
 * ("more" appears three times) and share a mark, which is the point: the same
 * idea should look the same wherever it turns up.
 */
import * as React from "react";
import { Svg, type IconProps } from "./planets";

/* ------------------------------------------------------------ structure */

const PageShape = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M4 8h16M4 17h16" />
  </Svg>
);

const Grids = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  </Svg>
);

const SplitLayouts = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M10 4.5v15" />
  </Svg>
);

const Switchers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9h6V5.5h12V19H3z" />
    <path d="M9 9h12" />
  </Svg>
);

const Overlays = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="14" height="12" rx="1.8" />
    <rect x="8.5" y="9" width="13" height="10" rx="1.8" />
  </Svg>
);

const Footer = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 15.5h18" />
    <path d="M6.5 18h4M14 18h3.5" />
  </Svg>
);

const YourNotes = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h8l5 5v13H6z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 16.5h4" />
  </Svg>
);

/* ------------------------------------------------------------------ nav */

const TopBars = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
    <path d="M6 6.5h2M11 6.5h7" />
  </Svg>
);

const FindingThings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </Svg>
);

const WhereAmI = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c4-5 6-8.2 6-11a6 6 0 1 0-12 0c0 2.8 2 6 6 11z" />
    <circle cx="12" cy="10" r="2.2" />
  </Svg>
);

const BetweenPages = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="7" height="14" rx="1.4" />
    <rect x="14.5" y="5" width="7" height="14" rx="1.4" />
    <path d="M10.5 12h3M12.5 10.2l1.8 1.8-1.8 1.8" />
  </Svg>
);

/* ----------------------------------------------------------------- hero */

const Heroes = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 17h19" />
    <path d="M6 17a6 6 0 0 1 12 0" />
    <path d="M12 4v2.4M4.6 8.6l1.7 1.7M19.4 8.6l-1.7 1.7" />
  </Svg>
);

const ThePitch = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 10.5h8" />
  </Svg>
);

const TheButton = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="8" width="19" height="8" rx="4" />
    <path d="M8 12h8" />
  </Svg>
);

const Proof = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M8.6 13.6 7 21l5-2.4L17 21l-1.6-7.4" />
  </Svg>
);

/* -------------------------------------------------------------- content */

const BodyText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 10.5h16M4 15h12M4 19.5h8" />
  </Svg>
);

const TypeTreatment = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20 11 4l7 16" />
    <path d="M6.6 14.5h8.8" />
  </Svg>
);

const ListsOfThings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="7" r="1.4" />
    <circle cx="5" cy="12.5" r="1.4" />
    <circle cx="5" cy="18" r="1.4" />
    <path d="M9.5 7h10M9.5 12.5h10M9.5 18h7" />
  </Svg>
);

const Boxes = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.4" />
    <path d="M7 10.5h10M7 14h6" />
  </Svg>
);

/* ---------------------------------------------------------------- media */

const Pictures = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.6" />
    <path d="m3.5 17 5-5 4.5 4.5L16.5 13l4 4" />
  </Svg>
);

const MovingThrough = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="5.5" width="11" height="13" rx="1.8" />
    <path d="M3.5 9.5v5M20.5 9.5v5" />
  </Svg>
);

const SoundAndVideo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10.2 8.8 15.6 12l-5.4 3.2z" />
  </Svg>
);

const Embeds = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.6 2.7 2.6 14.3 0 17-2.6-2.7-2.6-14.3 0-17z" />
  </Svg>
);

const Generated = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2 13.9 9l6.1.2-4.9 3.6 1.8 5.9L12 15.2 7.1 18.7l1.8-5.9L4 9.2 10.1 9z" />
  </Svg>
);

/* --------------------------------------------------------------- motion */

const OnScroll = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="5" />
    <path d="M12 6.5v4M10.4 9l1.6 1.8L13.6 9" />
  </Svg>
);

const OnPointer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.5 18 12l-5.2 1.1 2.6 5.4-2.2 1-2.6-5.4L6 17.6z" />
  </Svg>
);

const Moments = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3.5 9.2 7 12.7 8.2 9.2 9.4 8 13 6.8 9.4 3.3 8.2 6.8 7z" />
    <path d="M16.5 12.5 17.4 15l2.6.9-2.6.9-.9 2.5-.9-2.5-2.6-.9 2.6-.9z" />
  </Svg>
);

/* ------------------------------------------------------------- interact */

const KeyboardAndMenus = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M8 14h8" />
  </Svg>
);

const Feedback = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 10a6 6 0 0 1 12 0c0 4 1.4 5.5 2 6H4c.6-.5 2-2 2-6z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Svg>
);

const DirectHandling = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1.3" />
    <circle cx="15" cy="6" r="1.3" />
    <circle cx="9" cy="12" r="1.3" />
    <circle cx="15" cy="12" r="1.3" />
    <circle cx="9" cy="18" r="1.3" />
    <circle cx="15" cy="18" r="1.3" />
  </Svg>
);

const OnHover = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

const FirstRun = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V3" />
    <path d="M6 4h12l-2.6 4L18 12H6z" />
  </Svg>
);

const Play = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="7" width="19" height="10" rx="4.5" />
    <path d="M7 10v4M5 12h4" />
    <circle cx="16.5" cy="11" r="1.1" />
    <circle cx="18.6" cy="13.5" r="1.1" />
  </Svg>
);

/* ---------------------------------------------------------------- forms */

const Forms = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Svg>
);

const Inputs = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v9" />
    <path d="m8.5 9 3.5 3.5L15.5 9" />
    <path d="M4 15v4h16v-4" />
  </Svg>
);

const Signup = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 3 2.5 10.5l7.5 3 3 7.5z" />
    <path d="M21 3 10 13.5" />
  </Svg>
);

const Protection = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

/* ------------------------------------------------------------- commerce */

const Browsing = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7.5h15l-1.2 13H5.7z" />
    <path d="M8.5 9.5V6a3.5 3.5 0 0 1 7 0v3.5" />
  </Svg>
);

const Buying = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h2.7l2.6 10.5h9.4L20 7H6.4" />
    <circle cx="9.5" cy="19" r="1.5" />
    <circle cx="16.5" cy="19" r="1.5" />
  </Svg>
);

const Plans = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M2.5 10h19" />
    <path d="M6 14.5h4" />
  </Svg>
);

const Persuasion = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.9l6-.9z" />
  </Svg>
);

const Economy = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
  </Svg>
);

/* ----------------------------------------------------------------- data */

const Charts = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4v16h16" />
    <path d="m7 15 3.5-4.5 3 2.5L20 6" />
  </Svg>
);

const Numbers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 20V11M12 20V4.5M18.5 20v-6" />
  </Svg>
);

const Tables = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.8" />
    <path d="M3 9.5h18M3 14.5h18M10.5 9.5V19.5" />
  </Svg>
);

const Arrangements = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.2" />
    <rect x="9.5" y="4" width="5" height="10" rx="1.2" />
    <rect x="16" y="4" width="5" height="13" rx="1.2" />
  </Svg>
);

const Live = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
    <path d="M4.8 4.8a10 10 0 0 0 0 14.4M19.2 4.8a10 10 0 0 1 0 14.4" />
  </Svg>
);

/* --------------------------------------------------------------- social */

const People = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
  </Svg>
);

const Talking = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.5h12v8H8l-5 3.5z" />
    <path d="M9 15.5h12v-6" />
    <path d="M21 15.5v4l-3.5-2.5" />
  </Svg>
);

const Reacting = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z" />
  </Svg>
);

const KeepingOrder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 3.5a5 5 0 0 0-4.2 7.6L3.5 18v2.5H6l6.9-6.9a5 5 0 0 0 6.6-6.4l-3 3-2.6-2.6z" />
  </Svg>
);

const More = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);

/* ------------------------------------------------------------------- ai */

const Conversation = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4.5h16v11H9.5L4 20z" />
    <path d="M8.5 10h.01M12 10h.01M15.5 10h.01" />
  </Svg>
);

const Writing = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20.5 6 15 15.5 5.5a2.5 2.5 0 0 1 3.5 3.5L9.5 18.5z" />
    <path d="m14 7 3 3" />
  </Svg>
);

const Suggesting = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="12" cy="12" r="0.6" />
  </Svg>
);

/* ---------------------------------------------------------------- power */

const KeyboardFirst = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
  </Svg>
);

const DenseViews = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5h18M3 8.2h18M3 11.4h18M3 14.6h18M3 17.8h13M3 21h9" />
  </Svg>
);

const Terminal = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <path d="m6.5 9.5 3 2.5-3 2.5M12.5 15h5" />
  </Svg>
);

const Privacy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12s3.5-6 9-6c1.5 0 2.9.4 4.1 1M21 12s-3.5 6-9 6c-1.6 0-3-.4-4.2-1.1" />
    <path d="M4 4l16 16" />
  </Svg>
);

/* ------------------------------------------------------------- platform */

const Appearance = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" />
  </Svg>
);

const Reach = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.6 2.4 14.4 0 17" />
  </Svg>
);

const AccountsAndData = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="10" width="16" height="10.5" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);

const RunningIt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
    <path d="m12 17 4-5.5" />
  </Svg>
);

const TalkingOut = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13.5V19a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 19v-5.5h-5l-1.5 2.5h-5L8 13.5z" />
    <path d="M12 3v7M9.4 6.4 12 3.6l2.6 2.8" />
  </Svg>
);

/**
 * Sub-group id → mark. Every id in `SUBGROUPS` has an entry; anything new
 * falls back to `More`, which is the honest picture of an unsorted pile.
 */
export const MOON: Record<string, (p: IconProps) => React.ReactElement> = {
  "page-shape": PageShape,
  grids: Grids,
  "split-layouts": SplitLayouts,
  switchers: Switchers,
  overlays: Overlays,
  footer: Footer,
  "your-notes": YourNotes,
  "top-bars": TopBars,
  "finding-things": FindingThings,
  "where-am-i": WhereAmI,
  "between-pages": BetweenPages,
  heroes: Heroes,
  "the-pitch": ThePitch,
  "the-button": TheButton,
  proof: Proof,
  "body-text": BodyText,
  "type-treatment": TypeTreatment,
  "lists-of-things": ListsOfThings,
  boxes: Boxes,
  pictures: Pictures,
  "moving-through": MovingThrough,
  "sound-and-video": SoundAndVideo,
  embeds: Embeds,
  generated: Generated,
  "on-scroll": OnScroll,
  "on-pointer": OnPointer,
  moments: Moments,
  "keyboard-and-menus": KeyboardAndMenus,
  feedback: Feedback,
  "direct-handling": DirectHandling,
  "on-hover": OnHover,
  "first-run": FirstRun,
  play: Play,
  forms: Forms,
  inputs: Inputs,
  signup: Signup,
  protection: Protection,
  browsing: Browsing,
  buying: Buying,
  plans: Plans,
  persuasion: Persuasion,
  economy: Economy,
  charts: Charts,
  numbers: Numbers,
  tables: Tables,
  arrangements: Arrangements,
  live: Live,
  people: People,
  talking: Talking,
  reacting: Reacting,
  "keeping-order": KeepingOrder,
  more: More,
  conversation: Conversation,
  writing: Writing,
  suggesting: Suggesting,
  "keyboard-first": KeyboardFirst,
  "dense-views": DenseViews,
  terminal: Terminal,
  privacy: Privacy,
  appearance: Appearance,
  reach: Reach,
  "accounts-and-data": AccountsAndData,
  "running-it": RunningIt,
  "talking-out": TalkingOut,
  /* Groups the shelf plan added: marks borrowed from the nearest kind. */
  "moving-words": TypeTreatment,
  "on-its-own": Moments,
  "press-to-show": DirectHandling,
  together: People,
};

export function moonFor(id: string) {
  return MOON[id] ?? More;
}

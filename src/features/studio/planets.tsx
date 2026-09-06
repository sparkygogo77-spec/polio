"use client";
/**
 * The library's category marks.
 *
 * Outlines only, one colour each, drawn in `currentColor` so a category's own
 * hue paints it. No fills: at 16px a filled planet is a blob, while a ring and
 * a couple of lines still read as Saturn. Everything sits on a 24 grid with a
 * single stroke weight, so fourteen different objects still look like one set.
 */
import * as React from "react";
import type { CategoryId } from "./catalog";

type IconProps = { className?: string; size?: number };

function Svg({ children, size = 16, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Layout — a ringed planet: a body with a structure around it. */
export const Ringed = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="5.5" />
    <ellipse cx="12" cy="12" rx="10.5" ry="3.4" transform="rotate(-20 12 12)" />
  </Svg>
);

/** Navigation — a comet: it is going somewhere. */
export const Comet = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="16.5" cy="7.5" r="3.2" />
    <path d="M13.6 9.4 4.5 18.5" />
    <path d="M15.4 11.6 10 17" />
    <path d="M11.4 7.6 6.5 12.5" />
  </Svg>
);

/** First screen — the sun. */
export const Sun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.2M12 19.8V22M22 12h-2.2M4.2 12H2M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6M19.1 19.1l-1.6-1.6M6.5 6.5 4.9 4.9" />
  </Svg>
);

/** Text — a crescent moon, the shape a page of words makes. */
export const Moon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Svg>
);

/** Media — a galaxy: many things at once. */
export const Galaxy = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1.6" />
    <path d="M13.4 10.6c3.4-2.4 7.6.4 6.4 4.2-1.2 3.8-6.6 5.4-10.4 3" />
    <path d="M10.6 13.4c-3.4 2.4-7.6-.4-6.4-4.2C5.4 5.4 10.8 3.8 14.6 6.2" />
  </Svg>
);

/** Motion — an orbit, with something on it. */
export const Orbit = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-30 12 12)" />
    <circle cx="19" cy="8" r="1.4" />
  </Svg>
);

/** Interaction — a satellite: it answers you. */
export const Satellite = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)" />
    <path d="M6.4 6.4 3 3M17.6 17.6 21 21" />
    <path d="M4.6 10.2 8 6.8M13.8 19.4l3.4-3.4" />
    <path d="M15.5 5.5a4 4 0 0 1 3 3" />
  </Svg>
);

/** Forms — a station module: panels either side of a body. */
export const Station = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9.5" y="7" width="5" height="10" rx="1.6" />
    <path d="M9.5 12H3M14.5 12H21" />
    <path d="M3 9v6M21 9v6M6 9.5v5M18 9.5v5" />
  </Svg>
);

/** Shop — an asteroid: a thing you can hold. */
export const Asteroid = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 18.5 6l2 6.5-4 6-6.5.8L5 15.5 4 9Z" />
    <circle cx="10" cy="10" r="1.4" />
    <circle cx="15" cy="14.5" r="1.8" />
  </Svg>
);

/** Data — a constellation: points, and the lines you draw between them. */
export const Constellation = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="17" r="1.3" />
    <circle cx="10" cy="9" r="1.3" />
    <circle cx="15.5" cy="14" r="1.3" />
    <circle cx="19" cy="5.5" r="1.3" />
    <path d="M5.9 15.9 9.3 10.2M11 10l3.7 3.1M16.6 12.9 18.4 6.8" />
  </Svg>
);

/** Social — a saucer: other people arriving. */
export const Saucer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 11a4 4 0 0 1 8 0" />
    <ellipse cx="12" cy="12.4" rx="8.5" ry="2.6" />
    <path d="M8.5 16.5 7 20M12 17v3.5M15.5 16.5 17 20" />
  </Svg>
);

/** AI — a helmet: something looking back at you. */
export const Helmet = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M7.5 11.2a4.5 4.5 0 0 1 9 0v1.6a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1Z" />
    <path d="M20.4 10.5h1.1M2.5 10.5h1.1" />
  </Svg>
);

/** Dense & keyboard — a rocket: for people in a hurry. */
export const Rocket = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5c3 2.4 4.6 6 4.6 9.6L12 17l-4.6-4.9c0-3.6 1.6-7.2 4.6-9.6Z" />
    <circle cx="12" cy="9.5" r="1.8" />
    <path d="M7.6 11.5 5 14.2l1.4 3.4M16.4 11.5 19 14.2l-1.4 3.4" />
    <path d="M10.5 18.5 12 21.5l1.5-3" />
  </Svg>
);

/** Under the hood — a telescope: the thing you look through. */
export const Telescope = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 13.5 12-7 2.6 4.5-12 7Z" />
    <path d="m9.5 15.5 2 5M13 13.5l3.5 4.5" />
    <path d="M3.5 12.2 2 14.8l2.6 1.5" />
  </Svg>
);

/** One mark per category. */
export const PLANET: Record<CategoryId, (p: IconProps) => React.JSX.Element> = {
  structure: Ringed,
  nav: Comet,
  hero: Sun,
  content: Moon,
  media: Galaxy,
  motion: Orbit,
  interact: Satellite,
  forms: Station,
  commerce: Asteroid,
  data: Constellation,
  social: Saucer,
  ai: Helmet,
  power: Rocket,
  platform: Telescope,
};

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
import type { BuiltInCategory, CategoryId } from "./shelf";

export type IconProps = { className?: string; size?: number };

export function Svg({ children, size = 16, className }: IconProps & { children: React.ReactNode }) {
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
    <circle cx="12" cy="12" r="2.2" />
    <path d="M8.1 8.1a5.5 5.5 0 0 0 0 7.8M15.9 8.1a5.5 5.5 0 0 1 0 7.8" />
    <path d="M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6" />
  </Svg>
);

/** Forms — a manifest: the sheet you fill in and hand over. */
export const Station = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="3" width="15" height="18" rx="2" />
    <path d="M8.5 3v2.4h7V3" />
    <path d="M8 10.5h8M8 14h5" />
    <path d="m8 17.6 1.4 1.4 2.6-2.8" />
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

/** AI — a nucleus with three things in orbit: it puts them together. */
export const Helmet = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.6" />
    <circle cx="12" cy="3.6" r="1.5" />
    <circle cx="19.3" cy="16.2" r="1.5" />
    <circle cx="4.7" cy="16.2" r="1.5" />
    <path d="M12 5.1v4.3M14.3 13.4l3.7 2.1M9.7 13.4 6 15.5" />
  </Svg>
);

/**
 * Engine — a rocket motor: the chamber, the bell it flares into, and the
 * burn under it.
 *
 * It used to be a car with its bonnet propped up, which was a drawing of the
 * words "under the hood" rather than of the thing. The category is Engine
 * now, and every other mark in this set is something in the sky, so the
 * engine that belongs here is the one that pushes a rocket: it means motor
 * to anyone, and it keeps the twelve reading as one set.
 */
export const Thruster = (p: IconProps) => (
  <Svg {...p}>
    {/* the chamber, and the bell flaring out of it */}
    <path d="M9.4 4.6a2.6 2.6 0 0 1 5.2 0" />
    <path d="M9.4 4.6C9.1 8.1 8 11.4 5.8 14.6" />
    <path d="M14.6 4.6c.3 3.5 1.4 6.8 3.6 10" />
    {/* the mouth of it, seen a little from above */}
    <ellipse cx="12" cy="14.8" rx="6.2" ry="1.5" />
    {/* the throat, where the burn is narrowest */}
    <path d="M9.1 8h5.8" />
    {/* and the burn */}
    <path d="M8.9 17.7 7.9 20.6M12 18.1V21.1M15.1 17.7l1 2.9" />
  </Svg>
);

/** One mark per category. */
export const PLANET: Record<BuiltInCategory, (p: IconProps) => React.JSX.Element> = {
  structure: Ringed,
  nav: Comet,
  hero: Sun,
  content: Moon,
  media: Galaxy,
  motion: Orbit,
  interact: Satellite,
  forms: Station,
  data: Constellation,
  social: Saucer,
  ai: Helmet,
  platform: Thruster,
};

/**
 * The mark for any category, including one a connected repository brought
 * with it. A repository is not one of the twelve and has no planet of its
 * own, so it gets the comet: something that came in from outside and is
 * passing through the same sky.
 */
export function planetOf(id: CategoryId): (p: IconProps) => React.JSX.Element {
  return PLANET[id as BuiltInCategory] ?? Comet;
}

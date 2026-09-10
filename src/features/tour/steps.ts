"use client";
/**
 * The tour: what it shows, and how it puts the screen in a state worth
 * showing.
 *
 * A tour of a builder cannot be a stack of screenshots. Half of what this app
 * can do is not on screen until you press something — the wheel is under a
 * right-press, the drawing board under a menu entry, the blueprint behind a
 * button — so each step *stages* the thing first and then lights it where it
 * really is. What you are looking at is the app, dimmed, with holes cut in
 * the dark.
 *
 * A step lights at most four things, because five is a list and a list is
 * what a tour exists to avoid. Each carries the three facts that are worth
 * carrying: what it is called, one line of what it is for, and where it lives
 * — so that the tour is still useful an hour after it is over.
 *
 * A spot whose thing is not on screen keeps its card and loses its hole. That
 * is not a failure mode, it is the point: some of these live somewhere the
 * tour is not standing, and saying so is the job.
 */
import { BACKGROUND_ID, useStudio } from "@/features/studio/store";
import { closeRadial, openBoard, openRadial, radialAt } from "@/features/studio/RadialMenu";
import { BLUE_RINGS } from "@/features/studio/menuGeometry";

export interface Spot {
  name: string;
  /** One line. If it needs two, it is two features. */
  line: string;
  /** Where to find it when the tour is over. */
  where: string;
  /** What to cut out of the dark: a selector, or a rectangle worked out at the time. */
  at?: string | (() => DOMRect | null);
  /** Grow the hole past the thing, for something that reads tight. */
  pad?: number;
  /** A round hole for a round thing; a function for something that is either. */
  round?: boolean | (() => boolean);
}

export interface Step {
  id: string;
  title: string;
  /** One line under the title, about the step rather than any one feature. */
  blurb: string;
  route: "/builds" | "/builder";
  spots: Spot[];
  /** Put the screen in the state this step is about. */
  arrive?: () => Promise<void> | void;
  /** Put back whatever was opened, so the next step starts clean. */
  leave?: () => void;
}

/* ------------------------------------------------------------------ */
/* Staging                                                             */
/* ------------------------------------------------------------------ */

const $ = (sel: string): HTMLElement | null => document.querySelector<HTMLElement>(sel);

/** Wait for something the route has to draw before a step can be staged. */
export async function waitFor(sel: string, ms = 3000): Promise<HTMLElement | null> {
  const until = Date.now() + ms;
  for (;;) {
    const el = $(sel);
    if (el) return el;
    if (Date.now() > until) return null;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

const rect = (sel: string) => (): DOMRect | null => $(sel)?.getBoundingClientRect() ?? null;

/** A box of the given size about a point, which is how anything round is measured. */
function about(x: number, y: number, r: number): DOMRect {
  return new DOMRect(x - r, y - r, r * 2, r * 2);
}

/**
 * Somewhere in the canvas to open the wheel, kept left of centre.
 *
 * The cards sit beside what they name, and a wheel opened in the middle of a
 * wide screen leaves them nowhere to go but on top of it.
 */
function spotOnCanvas(fraction = 0.36): { x: number; y: number } {
  const board = $("[data-studio-scroll]") ?? document.body;
  const r = board.getBoundingClientRect();
  return { x: Math.round(r.left + r.width * fraction), y: Math.round(r.top + r.height * 0.46) };
}

const wheelRect = (r: number) => (): DOMRect | null => {
  const at = radialAt();
  return at ? about(at.x, at.y, r) : null;
};

/** The wheel is round or square as the owner left it, and so is the hole round it. */
const wheelIsRound = () => useStudio.getState().menuShape !== "square";

const builder = () => window as unknown as {
  __studioSetBrief?: (v: boolean) => void;
  __studioSetLibrary?: (v: boolean) => void;
  __studioSetLeftPanel?: (id: string) => void;
};

/* ------------------------------------------------------------------ */
/* The steps                                                           */
/* ------------------------------------------------------------------ */

export const STEPS: Step[] = [
  {
    id: "wheel",
    title: "The wheel",
    blurb: "Right-press anything on the board and the whole editor comes to the pointer.",
    route: "/builder",
    arrive: async () => {
      builder().__studioSetBrief?.(false);
      await waitFor("[data-studio-scroll]");
      const { x, y } = spotOnCanvas();
      // The page is a thing with a wheel of its own, and it is always there —
      // a tour cannot count on the board having a part on it yet.
      useStudio.getState().selectBackground();
      openRadial(BACKGROUND_ID, x, y, null);
      await waitFor("[data-radial]");
    },
    leave: () => closeRadial(),
    spots: [
      {
        name: "The wheel",
        line: "Everything you can do to one part, in one press — the panel on the right is only the convenience.",
        where: "Right-press any part, or the page itself.",
        // The first level reaches `BLUE_RINGS.reach`; the hole is that and a
        // little, so the wheel is lit and the board around it is not.
        at: wheelRect(BLUE_RINGS.reach + 12),
        round: wheelIsRound,
      },
      {
        name: "The middle",
        line: "The way back, and the handle the wheel is carried by; there is no X on it anywhere.",
        where: "The hub. On the page's own wheel it is Add instead.",
        at: wheelRect(BLUE_RINGS.hole + 6),
        round: wheelIsRound,
      },
      {
        name: "Round or square",
        line: "The same wheel cut two ways; nothing moves but the outline.",
        where: "The toolbar, between the devices and the zoom.",
        at: "[data-menu-shape]",
        pad: 4,
      },
    ],
  },

  {
    id: "looks",
    title: "Looks",
    blurb: "Colour, light and texture — for the whole site here, for one part on its own wheel.",
    route: "/builder",
    arrive: async () => {
      closeRadial();
      builder().__studioSetLibrary?.(true);
      builder().__studioSetLeftPanel?.("look");
      await waitFor("[data-look-panel]");
      // Three sections are taller than the panel, and a hole cut over
      // something scrolled out of sight is a hole over nothing. Texture is
      // brought to the foot, which puts the other two above it.
      $("[data-look-texture]")?.scrollIntoView({ block: "end" });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    },
    spots: [
      {
        name: "Colour",
        line: "Six roles, built from one accent, and any one part may override its own.",
        where: "Look, on the left of the Builder.",
        at: "[data-look-colour]",
      },
      {
        name: "Light & depth",
        line: "One lamp for the whole site: put it where you can see it landing and every surface relights itself.",
        where: "Look › Place the light.",
        at: "[data-look-light]",
      },
      {
        name: "Texture",
        line: "A stack of layers over the page — a pattern, a wash, or an image you drop straight onto it.",
        where: "Look, under the light.",
        at: "[data-look-texture]",
      },
      {
        name: "Looks, for one part",
        line: "The same three, about a single element rather than the site.",
        where: "The Looks slab, bottom right of any part's wheel.",
      },
    ],
  },

  {
    id: "board",
    title: "The drawing board",
    blurb: "For a part that does not exist yet: draw the shape, say what it is, and make it real.",
    route: "/builder",
    arrive: async () => {
      closeRadial();
      await waitFor("[data-studio-scroll]");
      const { x, y } = spotOnCanvas(0.38);
      openBoard(x, y, { x: 0, y: 0 });
      await waitFor("[data-draw-board]");
    },
    leave: () => closeRadial(),
    spots: [
      {
        name: "The surface",
        line: "Draw the thing roughly; the ink is snapped to lines, boxes and ellipses as you finish each stroke.",
        where: "Right-press the board › Draw a new part here.",
        at: "[data-draw-surface]",
        pad: 2,
        round: true,
      },
      {
        name: "The words",
        line: "What it is, in your own words. The drawing says the shape; this says the job.",
        where: "The strip across the board.",
        at: "[data-draw-words]",
      },
      {
        name: "How the ink is read",
        line: "Snap cleans each stroke into a shape, smooth averages it, raw keeps your hand.",
        where: "The board's rim.",
        at: "[data-draw-mode]",
        pad: 4,
      },
      {
        name: "Make real",
        line: "The drawing and the words go to Claude and come back as a part on the board, placed where you drew it.",
        where: "The button under the board.",
        at: "[data-draw-button]",
        pad: 4,
      },
    ],
  },

  {
    id: "blueprint",
    title: "The iteration book",
    blurb: "What the canvas says in words any agent can act on, the record of every ask, and the pin that keeps it open beside the board.",
    route: "/builder",
    arrive: async () => {
      closeRadial();
      builder().__studioSetBrief?.(true);
      await waitFor("[data-brief-modes]");
    },
    leave: () => builder().__studioSetBrief?.(false),
    spots: [
      {
        name: "The asks",
        line: "Plan, critique, prompts, finish, ideas, build — or anything at all in your own words.",
        where: "The counter on the end of the toolbar, or ⌘↵.",
        at: "[data-brief-modes]",
        pad: 4,
      },
      {
        name: "The brief",
        line: "Every page, part and prompt compiled into one document, self-contained enough to hand to any agent.",
        where: "The Brief tab, and Copy or Download beneath it.",
        at: "[data-brief-body]",
      },
      {
        name: "The Trail",
        line: "Every ask and every answer, kept as threads, so a decision can be found again months later. Pin the book open, or open it as a page beside Design and Preview.",
        where: "The Trail tab, and Book on the toolbar.",
        at: "[data-brief-views]",
        pad: 4,
      },
      {
        name: "Publish",
        line: "The document, the blueprint and any generated code, pushed as one commit.",
        where: "The row at the foot of this dialog.",
        at: "[data-brief-publish]",
      },
    ],
  },

  {
    id: "builds",
    title: "Builds, and going live",
    blurb: "More than one site in one browser, each with somewhere of its own to publish.",
    // /builds, not /: once a site has been published into this repository "/"
    // redirects to the site itself, and a tour cannot end on a redirect.
    route: "/builds",
    arrive: async () => {
      builder().__studioSetBrief?.(false);
      closeRadial();
      await waitFor("[data-builds-list], [data-builds-views]");
    },
    spots: [
      {
        name: "The sites",
        line: "Every document this browser holds. Press one and the Builder is on it, with nothing lost on the way out.",
        where: "Builds, the first screen.",
        at: "[data-builds-list]",
      },
      {
        name: "Repos",
        line: "Where each site publishes: owner, name and branch, set per site.",
        where: "The Repos tab.",
        at: "[data-builds-views]",
        pad: 4,
      },
      {
        name: "The swap",
        line: "The same list, mid-edit, without leaving the canvas.",
        where: "The top bar, beside the search.",
        at: "[data-builds-switch]",
        pad: 4,
      },
      {
        name: "Go live",
        line: "Pushes the files, builds them on Vercel and hands back the address the site is at.",
        where: "The book's publish row. The Vercel token goes in the vault, ⌘⇧K.",
      },
    ],
  },
];

export const rectOf = (spot: Spot): DOMRect | null =>
  typeof spot.at === "string" ? rect(spot.at)() : spot.at ? spot.at() : null;

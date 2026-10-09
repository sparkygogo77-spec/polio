/**
 * RANDOMIZE THEME: a whole new palette for a site brought in, in one roll.
 *
 * J (2026-10-09): "there should also be a coherent randomize theme generator
 * that changes the entire color palette of the site while understanding
 * contrast from buttons to background and the panels its on".
 *
 * It takes the site's theme swatches (the short palette: a role and a
 * colour each) and gives every one a new colour from one hue family, the
 * way `harmonise` builds the six roles, then holds the contrast:
 *
 *   · panels and cards stand off the main fill;
 *   · buttons reach 3:1 against the main fill and every panel;
 *   · words reach 4.5:1 against the main fill and every panel;
 *   · words on a button get their own ink (`onButtons`), black or white,
 *     whichever reads at 4.5:1 or better on that button.
 *
 * Light stays light and dark stays dark (read off the main fill), so a roll
 * never turns a page inside out. Pictures are never recoloured.
 *
 * Pure: the dice are passed in. `tests/theme-dice.mjs`.
 */
import { contrast, css, harmonise, parseColor, type Oklch, type Palette } from "./colour.ts";

export interface DiceSwatch { id: string; role: string; value: string }
export interface ThemeRoll {
  /** Swatch id to its new colour. */
  to: Map<string, string>;
  /** Ink for words standing on a button, by the button swatch's id. */
  onButtons: Map<string, string>;
  /** The page itself and the background layers. */
  page: string;
  /** The six roles, so new parts match the roll. */
  palette: Palette;
  light: boolean;
  hue: number;
}

const HARMONY_SHIFT = [30, 150, 180, 120, -30];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (h: number) => ((h % 360) + 360) % 360;
const BLACK: Oklch = { l: 0.16, c: 0, h: 0 };
const WHITE: Oklch = { l: 0.99, c: 0, h: 0 };

/** Move `col`'s lightness away from `from` until it reads at `ratio` against every one of `against`. */
export function reach(col: Oklch, against: readonly Oklch[], ratio: number, lighter: boolean): Oklch {
  let c = { ...col };
  for (let i = 0; i < 60 && against.some((b) => contrast(c, b) < ratio); i++) {
    c = { ...c, l: clamp(c.l + (lighter ? 0.015 : -0.015), 0.02, 0.995) };
    if (c.l <= 0.02 || c.l >= 0.995) break;
  }
  return c;
}

/** The roll. `rand` returns 0..1 (Math.random, or a seeded one in tests). */
export function rollTheme(swatches: readonly DiceSwatch[], rand: () => number = Math.random, lightHint?: boolean): ThemeRoll {
  const of = (r: string) => swatches.filter((s) => s.role === r);
  const mainNow = parseColor(of("main")[0]?.value ?? "");
  const light = mainNow ? mainNow.l > 0.6 : !!lightHint;
  const hue = Math.floor(rand() * 360);
  const hue2 = wrap(hue + HARMONY_SHIFT[Math.floor(rand() * HARMONY_SHIFT.length)]!);
  const chroma = 0.1 + rand() * 0.08;
  const to = new Map<string, string>();
  const onButtons = new Map<string, string>();

  /* The ground: the main fill, and the page a step further out. */
  const main: Oklch = light ? { l: 0.95 + rand() * 0.03, c: chroma * 0.12, h: hue } : { l: 0.17 + rand() * 0.05, c: chroma * 0.2, h: hue };
  const page: Oklch = { ...main, l: clamp(main.l + (light ? 0.02 : -0.05), 0.05, 0.995) };
  for (const s of of("main")) to.set(s.id, css(main));

  /* Panels and cards: a step off the main fill each, so they read as standing on it. */
  const panels: Oklch[] = of("panels").map((_, i) => ({ l: clamp(main.l + (light ? -1 : 1) * (0.06 + i * 0.05), 0.05, 0.99), c: chroma * (light ? 0.15 : 0.3), h: hue }));
  of("panels").forEach((s, i) => to.set(s.id, css(panels[i]!)));
  const grounds = [main, ...panels];

  /* Buttons: the bold colour, 3:1 or better on every ground. */
  const buttons = of("buttons").map((s, i) => {
    const seed: Oklch = { l: light ? 0.55 - i * 0.08 : 0.68 + i * 0.06, c: chroma + 0.03, h: i % 2 ? hue : hue2 };
    /* Off every ground, then on until its own words read on it: white words on a light site's button, black on a dark one's. */
    const b = reach(reach(seed, grounds, 3, !light), [light ? WHITE : BLACK], 4.5, !light);
    to.set(s.id, css(b));
    const ink = contrast(BLACK, b) >= contrast(WHITE, b) ? BLACK : WHITE;
    onButtons.set(s.id, css(ink));
    return b;
  });

  /* Words: 4.5:1 or better on every ground. */
  of("words").forEach((s, i) => {
    const seed: Oklch = { l: light ? 0.25 + i * 0.12 : 0.93 - i * 0.12, c: chroma * (i ? 0.6 : 0.15), h: i ? hue2 : hue };
    to.set(s.id, css(reach(seed, grounds, 4.5, !light)));
  });

  /* Accent: the second hue, bright enough to be seen on the ground. */
  of("accent").forEach((s, i) => to.set(s.id, css(reach({ l: light ? 0.55 : 0.78, c: chroma + 0.04, h: wrap(hue2 + i * 40) }, grounds, 3, !light))));
  /* Outline: quiet, but there. Shadow: darker than the ground. */
  of("outline").forEach((s, i) => to.set(s.id, css({ l: light ? 0.78 - i * 0.08 : 0.4 + i * 0.08, c: chroma * 0.4, h: hue })));
  of("shadow").forEach((s, i) => to.set(s.id, css({ l: light ? 0.35 - i * 0.05 : 0.08 + i * 0.04, c: chroma * 0.3, h: hue })));

  /* The six roles, for parts added later and parts that follow a role. */
  const six = harmonise({ l: light ? 0.55 : 0.75, c: chroma, h: hue }, "analogous", light);
  const firstWords = to.get(of("words")[0]?.id ?? "");
  const palette: Palette = {
    ...six,
    bg: css(page),
    surface: css(panels[0] ?? main),
    ...(firstWords ? { text: firstWords } : {}),
    accent: css(buttons[0] ?? reach({ l: light ? 0.5 : 0.72, c: chroma, h: hue2 }, grounds, 3, !light)),
    highlight: to.get(of("accent")[0]?.id ?? "") ?? six.highlight,
  };
  return { to, onButtons, page: css(page), palette, light, hue };
}

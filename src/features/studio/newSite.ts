/**
 * Rolling a theme onto the open site, and starting a new site with one.
 *
 * `rollOnto` is the Theme panel's Randomize (`ThemePanel.tsx`): the settings
 * kept with the site (`look.themeRoll`: locks, Familiar to Original, the
 * design philosophy, Try these) make the roll, and `applyTheme` puts it on
 * as one undo step named for it. `startNewSite` is what the Builds page's
 * New site opens on: one sample page in a theme of its own, with nothing to
 * undo back to, since there was nothing before it.
 */
import { defaultRoll, type ThemeRollSettings } from "./look";
import { useStudio } from "./store";
import { readPhilosophy, rollTheme, type SiteTheme } from "./siteTheme";
import { pickTryThese } from "./tryThese";
import type { StyleKit } from "./styleKits";

/** A seed for a roll: anything, as long as two rolls in a row differ. */
export const newSeed = (): number => (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0;

/** Roll and put on the site, as one undo step. */
export function rollOnto(opts: { seed?: number; kits?: readonly StyleKit[]; siteName?: string; fresh?: boolean } = {}): SiteTheme {
  const s = useStudio.getState();
  const set: ThemeRollSettings = { ...defaultRoll(), ...s.look.themeRoll };
  const seed = opts.seed ?? newSeed();
  const phil = readPhilosophy(set.philosophy);
  const theme = rollTheme({ seed, prev: s.look.theme ?? null, locks: set.locks, originality: set.originality, kits: opts.kits ?? [], ranges: phil.ranges, philosophy: set.philosophy.trim() || null });
  s.applyTheme(theme, { tryThese: set.tryThese ? pickTryThese(seed, 2 + (seed % 2)) : [], siteName: opts.siteName, fresh: opts.fresh, settings: set });
  return theme;
}

/** A new site's first page: a sample page in a theme of its own. */
export function startNewSite(name?: string, seed?: number): SiteTheme {
  const theme = rollOnto({ seed, siteName: name, fresh: true });
  useStudio.setState({ past: [], future: [] });
  return theme;
}

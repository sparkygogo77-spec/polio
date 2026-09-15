/**
 * Whether any module has asked for a nav entry.
 *
 * The sidebar and the route tabs draw `registry.nav`; the settings and the
 * command that toggle them are offered only while there is a nav to toggle.
 * The settings are defined before the registry exists and the registry is
 * built from them, so this stands between the two: the registry binds the
 * count once it has one, and nothing here imports anything.
 */
let count: () => number = () => 0;

export const hasNav = (): boolean => count() > 0;

export function bindNavCount(read: () => number): void {
  count = read;
}

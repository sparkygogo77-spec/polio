// The only way scripts reach the page: by data-hook. kit-check reads every call to these helpers
// (the hook name must be a plain string, or the line carries a "// hooks: a-{b,c}" comment).

/** The element with this hook (inside root). Throws if it is missing, so a renamed hook fails loudly. */
export function hook(name, root = document) {
  const found = root.querySelector(`[data-hook="${name}"]`);
  if (!found) throw new Error(`no element with data-hook="${name}"`);
  return found;
}

/** Every element with this hook (inside root). */
export function hooks(name, root = document) {
  return [...root.querySelectorAll(`[data-hook="${name}"]`)];
}

/** A copy of the one element inside <template data-hook="name">. Scripts never build markup any other way. */
export function fromTemplate(name) {
  const template = hook(name);
  return template.content.firstElementChild.cloneNode(true);
}

/** The part with this hook inside a copy made by fromTemplate (or the copy itself). */
export function part(copy, name) {
  return copy.dataset.hook === name ? copy : hook(name, copy);
}

/** The page's search parameters: ?still=1 freezes motion, &screen=<name> picks a preview state. */
export const params = new URLSearchParams(location.search);
export const still = params.get('still') === '1';
if (still) document.documentElement.toggleAttribute('data-still', true);

/**
 * Declares the screens (states) a page can show, by name, as listed in builder.json. With
 * ?screen=<name> the matching one runs after the page is set up; otherwise the first runs.
 */
export function screens(table) {
  const name = params.get('screen') ?? Object.keys(table)[0];
  (table[name] ?? Object.values(table)[0])();
}

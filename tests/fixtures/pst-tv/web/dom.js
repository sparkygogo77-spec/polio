// Finding, filling and repeating page parts by data-hook, shared by every page. The scripts find
// elements only through these helpers (web/HOOKS.md); web/hooks.json lists every place they do.

/** The page part with this hook (inside `root`, the whole page by default), or null. */
export const $ = (hook, root = document) => root.querySelector(`[data-hook="${hook}"]`);
export const setText = (hook, text) => { $(hook).textContent = text; };
export const show = (hook, on) => { $(hook).hidden = !on; };

/** A part inside a copied template, or the copy itself when it carries the hook. */
export const part = (root, hook) => (root.dataset?.hook === hook ? root : $(hook, root));

/**
 * A fresh copy of what `<template data-hook="<hook>">` holds: the markup a script repeats (a table
 * row, a result round, a trade marker), kept in the page so the design can restyle and rearrange
 * it like any other markup. The template holds one element; the script fills it with fill().
 */
export function fromTemplate(hook, root = document) {
  const t = root.querySelector(`template[data-hook="${hook}"]`);
  if (!t) throw new Error(`the page has no template ${hook}`);
  return t.content.firstElementChild.cloneNode(true);
}

/**
 * Fill a copy's parts, keyed by hook: text (a string or number), a node to put in, or
 * { text, href } for a link. A part the design left out of the template is skipped.
 */
export function fill(root, values) {
  for (const [hook, value] of Object.entries(values)) {
    const el = part(root, hook);
    if (!el) continue;
    if (value instanceof Node) el.replaceChildren(value);
    else if (value && typeof value === 'object') {
      if (value.href !== undefined) el.href = value.href;
      if (value.text !== undefined) el.textContent = value.text;
    } else el.textContent = value;
  }
  return root;
}

/** Remove a part from a copy (for example a section that does not apply to this round). */
export function drop(root, hook) {
  part(root, hook)?.remove();
}

/** A CSS variable's value on the page (web/base.css sets them; the style layer may change them). */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A CSS variable holding a plain number, or `fallback` when it is missing or not a number. */
export function cssNumber(name, fallback) {
  const n = Number.parseFloat(cssVar(name));
  return Number.isFinite(n) ? n : fallback;
}

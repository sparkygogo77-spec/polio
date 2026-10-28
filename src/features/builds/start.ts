"use client";
/**
 * THE START ROW'S DOORS INTO THE BUILDER.
 *
 * Builds is not where a site is captured, drafted or handed to agents: those
 * are the Builder's own dialogs. So a Start entry opens the Builder with
 * `?start=<what>`, and the dialog that owns that flow asks `startAsked` on
 * mount. The first to take it clears it from the address, so a reload does
 * not open it again.
 */
export type StartWhat = "capture" | "idea" | "agents";

export const startHref = (what: StartWhat): string => `/builder?start=${what}`;

/** Was the Builder opened to start `what`? True once, then the address is cleaned. */
export function startAsked(what: StartWhat): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("start") !== what) return false;
  q.delete("start");
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${q.size ? `?${q}` : ""}${window.location.hash}`);
  return true;
}

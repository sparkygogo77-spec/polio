export const isBrowser = typeof window !== "undefined";

export function isMac(): boolean {
  if (!isBrowser) return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "") || /Mac OS X/.test(navigator.userAgent);
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

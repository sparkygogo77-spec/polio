import { isMac } from "./env";

/**
 * Shortcut grammar:
 *   "mod+k"      -> Cmd+K on macOS, Ctrl+K elsewhere
 *   "shift+/"    -> "?"
 *   "g p"        -> chord: press g, then p (within 800ms)
 *   "escape", "arrowdown", "enter", "1".."9"
 */
export interface KeyCombo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export function parseShortcut(spec: string): KeyCombo[] {
  return spec
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => {
      const tokens = part.split("+").filter(Boolean);
      const combo: KeyCombo = { key: "", mod: false, ctrl: false, alt: false, shift: false, meta: false };
      for (const t of tokens) {
        if (t === "mod") combo.mod = true;
        else if (t === "ctrl" || t === "control") combo.ctrl = true;
        else if (t === "alt" || t === "option") combo.alt = true;
        else if (t === "shift") combo.shift = true;
        else if (t === "meta" || t === "cmd" || t === "command") combo.meta = true;
        else combo.key = normaliseKey(t);
      }
      return combo;
    });
}

function normaliseKey(k: string): string {
  const map: Record<string, string> = {
    esc: "escape",
    return: "enter",
    space: " ",
    up: "arrowup",
    down: "arrowdown",
    left: "arrowleft",
    right: "arrowright",
    plus: "+",
    comma: ",",
    period: ".",
    slash: "/",
    backslash: "\\",
    question: "?",
  };
  return map[k] ?? k;
}

export function comboMatches(combo: KeyCombo, e: KeyboardEvent): boolean {
  const mac = isMac();
  const wantMeta = combo.meta || (combo.mod && mac);
  const wantCtrl = combo.ctrl || (combo.mod && !mac);
  if (e.metaKey !== wantMeta) return false;
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.altKey !== combo.alt) return false;
  const key = e.key.toLowerCase();
  // For "?" and friends shift is part of the printed key; don't require it separately.
  const shiftImplied = key.length === 1 && /[^a-z0-9 ]/.test(key);
  if (!shiftImplied && e.shiftKey !== combo.shift) return false;
  return key === combo.key || e.code.toLowerCase() === `key${combo.key}` || e.code.toLowerCase() === combo.key;
}

/**
 * Human display: "mod+k" -> "⌘K" on mac, "Ctrl+K" elsewhere.
 *
 * `mac` is injectable so components can pass a hydration-safe value (the
 * server cannot know the platform); it defaults to sniffing the browser.
 */
export function formatShortcut(spec: string, mac = isMac()): string {
  return parseShortcut(spec)
    .map((c) => {
      const parts: string[] = [];
      if (c.mod) parts.push(mac ? "⌘" : "Ctrl");
      if (c.ctrl) parts.push(mac ? "⌃" : "Ctrl");
      if (c.alt) parts.push(mac ? "⌥" : "Alt");
      if (c.shift) parts.push(mac ? "⇧" : "Shift");
      if (c.meta && !c.mod) parts.push(mac ? "⌘" : "Win");
      parts.push(displayKey(c.key));
      return parts.join(mac ? "" : "+");
    })
    .join(" then ");
}

function displayKey(k: string): string {
  const map: Record<string, string> = {
    escape: "Esc",
    enter: "↵",
    " ": "Space",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    backspace: "⌫",
    tab: "Tab",
  };
  return map[k] ?? k.toUpperCase();
}

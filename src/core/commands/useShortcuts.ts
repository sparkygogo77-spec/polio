"use client";
import * as React from "react";
import { registry } from "@/core/registry";
import { useActions } from "@/core/actions";
import { comboMatches, parseShortcut, type KeyCombo } from "@/core/lib/keys";
import { isTypingTarget } from "@/core/lib/env";
import { getSetting } from "@/core/settings/store";

const CHORD_MS = 900;
const MODIFIERS = new Set(["shift", "meta", "control", "alt", "capslock"]);

interface Compiled {
  combos: KeyCombo[];
  def: (typeof registry.shortcuts)[number];
}

/** Install every registered shortcut on window. Mount once in the shell. */
export function useShortcuts() {
  const ctx = useActions();
  const compiled = React.useMemo<Compiled[]>(
    () => registry.shortcuts.map((def) => ({ combos: parseShortcut(def.keys), def })).sort((a, b) => b.combos.length - a.combos.length),
    [],
  );

  React.useEffect(() => {
    const buffer: { e: KeyboardEvent; t: number }[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (MODIFIERS.has(e.key.toLowerCase())) return;
      const now = performance.now();
      while (buffer.length && now - buffer[0]!.t > CHORD_MS) buffer.shift();
      buffer.push({ e, t: now });
      if (buffer.length > 3) buffer.shift();
      const typing = isTypingTarget(e.target);
      const chords = getSetting<boolean>("keyboard.chords");
      for (const { combos, def } of compiled) {
        if (combos.length > 1 && !chords) continue;
        if (typing && !def.allowInInput) continue;
        if (def.when && !def.when()) continue;
        if (combos.length > buffer.length) continue;
        let ok = true;
        for (let i = 0; i < combos.length; i++) {
          const ev = buffer[buffer.length - combos.length + i]!.e;
          if (!comboMatches(combos[i]!, ev)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        if (!def.passive) e.preventDefault();
        buffer.length = 0;
        def.run(ctx);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compiled, ctx]);
}

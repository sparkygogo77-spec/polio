"use client";
/**
 * Client bootstrap: hydrates persisted stores, wires settings → audio/news,
 * unlocks audio on first gesture, and runs module onMount hooks.
 */
import * as React from "react";
import { useSettings, onSettingChange, getSetting, getSettingDef, allSettingGroups } from "@/core/settings/store";
import { setAudioConfigSource, installAudioUnlock, play } from "@/core/audio/engine";
import { publish, useToasts } from "@/core/toasts/store";
import { registry } from "@/core/registry";
import { getActions } from "@/core/actions";
import { labelValue } from "@/core/lib/format";
import type { SettingDef } from "@/core/types";

setAudioConfigSource(() => ({
  enabled: getSetting<boolean>("audio.enabled"),
  master: getSetting<number>("audio.master"),
  categories: {
    ui: getSetting<boolean>("audio.ui"),
    feedback: getSetting<boolean>("audio.feedback"),
    alerts: getSetting<boolean>("audio.alerts"),
    feed: getSetting<boolean>("audio.feed"),
  },
  hover: getSetting<boolean>("audio.hover"),
}));

function cueFor(def: SettingDef | undefined, value: unknown) {
  if (!def) return "select" as const;
  if (def.type === "toggle") return value ? ("toggleOn" as const) : ("toggleOff" as const);
  if (def.type === "slider" || def.type === "hue" || def.type === "number") return "tick" as const;
  return "select" as const;
}

export function AppBootstrap() {
  const markHydrated = useSettings((s) => s.markHydrated);

  React.useEffect(() => {
    void useSettings.persist.rehydrate();
    markHydrated();
    const unlock = installAudioUnlock();

    const offChange = onSettingChange((id, value, prev, def) => {
      // Sound. Sound-related toggles get a forced confirmation so muting still clicks.
      const cue = cueFor(def, value);
      if (id === "audio.enabled") play(value ? "toggleOn" : "toggleOff", { force: true });
      else if (id === "audio.master") play("tick", { force: true });
      else play(cue);

      if (!def || def.silent || !getSetting<boolean>("feed.settingsInFeed")) return;
      const group = allSettingGroups().find((g) => g.id === def.group);
      const fmt = def.format as ((v: unknown) => string) | undefined;
      const optionLabel = (v: unknown) => def.options?.find((o) => o.value === v)?.label ?? (fmt ? fmt(v) : labelValue(v));
      publish({
        key: `setting:${id}`,
        title: def.label,
        body: group ? `${group.label} setting` : "Setting",
        level: "info",
        source: "settings",
        diff: { field: def.label, from: prev, to: value, format: optionLabel },
        toast: true,
        sound: false,
        coalesceMs: Infinity,
      });
    });

    const cleanups: (() => void)[] = [];
    // Defer so ActionsProvider has committed its effect.
    const t = window.setTimeout(() => {
      for (const m of registry.modules) {
        if (!m.onMount) continue;
        try {
          const c = m.onMount(getActions());
          if (typeof c === "function") cleanups.push(c);
        } catch (err) {
          console.error(`[builder] module "${m.id}" onMount failed`, err);
        }
      }
    }, 0);

    const sweep = window.setInterval(() => useToasts.getState().sweep(), 500);

    return () => {
      unlock();
      offChange();
      window.clearTimeout(t);
      window.clearInterval(sweep);
      for (const c of cleanups) c();
    };
  }, [markHydrated]);

  return null;
}

// Re-export for callers that want the def in the palette.
export { getSettingDef };

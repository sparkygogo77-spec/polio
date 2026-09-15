"use client";
/**
 * Writes settings onto <html> as data-* attributes and CSS variables. All
 * visual switching happens in CSS from there, so it is instant and global.
 */
import * as React from "react";
import { useSettings, getSettingDef } from "@/core/settings/store";
import { prefersReducedMotion } from "@/core/lib/env";

const KEYS = [
  "appearance.mode",
  "appearance.accentHue",
  "appearance.radius",
  "appearance.density",
  "appearance.font",
  "appearance.fontScale",
  "appearance.contrast",
  "effects.motion",
  "effects.glow",
  "effects.scanlines",
  "effects.noise",
  "effects.glass",
  "effects.pressScale",
  "effects.flashDurationMs",
  "privacy.blur",
  "privacy.streamer",
  "developer.showScopes",
] as const;

type Snapshot = Record<(typeof KEYS)[number], unknown>;

function read(values: Record<string, unknown>): Snapshot {
  const out = {} as Snapshot;
  for (const k of KEYS) out[k] = k in values ? values[k] : getSettingDef(k)?.default;
  return out;
}

export function ThemeProvider() {
  const values = useSettings((s) => s.values);
  const snap = React.useMemo(() => read(values), [values]);

  React.useEffect(() => {
    const el = document.documentElement;
    const mode = snap["appearance.mode"] as string;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      el.dataset.theme = mode === "system" ? (mq.matches ? "dark" : "light") : mode;
    };
    apply();
    if (mode === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [snap]);

  React.useEffect(() => {
    const el = document.documentElement;
    const on = (v: unknown) => (v ? "on" : "off");
    el.style.setProperty("--accent-h", String(snap["appearance.accentHue"]));
    el.style.setProperty("--radius", `${snap["appearance.radius"]}px`);
    el.style.setProperty("--font-scale", String(snap["appearance.fontScale"]));
    el.style.setProperty("--press-scale", String(snap["effects.pressScale"]));
    el.dataset.density = String(snap["appearance.density"]);
    el.dataset.font = String(snap["appearance.font"]);
    el.dataset.contrast = snap["appearance.contrast"] ? "high" : "normal";
    const motion = snap["effects.motion"] as string;
    el.dataset.motion = motion === "full" && prefersReducedMotion() ? "reduced" : motion;
    el.dataset.glow = on(snap["effects.glow"]);
    el.dataset.scanlines = on(snap["effects.scanlines"]);
    el.dataset.noise = on(snap["effects.noise"]);
    el.dataset.glass = on(snap["effects.glass"]);
    el.dataset.blur = on(snap["privacy.blur"]);
    el.dataset.streamer = on(snap["privacy.streamer"]);
    el.dataset.showScopes = on(snap["developer.showScopes"]);
  }, [snap]);

  return (
    <>
      <div className="ambient-glow" aria-hidden />
      <div className="ambient-scanlines" aria-hidden />
      <div className="ambient-noise" aria-hidden />
    </>
  );
}

"use client";
import * as React from "react";
import { Activity, Rows3, Volume2, VolumeX, Wifi } from "lucide-react";
import site from "@site";
import { registry } from "@/core/registry";
import { useSetting, useSettingValue } from "@/core/settings/useSetting";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/tooltip";
import { NumberTicker } from "@/core/ui/number-ticker";

function Clock() {
  const h24 = useSettingValue<boolean>("behaviour.clock24h");
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!now) return <span className="num w-16 text-right">--:--:--</span>;
  return <span className="num w-16 text-right">{now.toLocaleTimeString(undefined, { hour12: !h24 })}</span>;
}

/** Simulated latency so the bar feels alive; replace with a real ping in your module. */
function Latency() {
  const [ms, setMs] = React.useState(42);
  React.useEffect(() => {
    const t = window.setInterval(() => setMs((m) => Math.max(12, Math.min(180, Math.round(m + (Math.random() - 0.5) * 18)))), 1500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Tooltip content="Round-trip latency (simulated)">
      <span className="flex items-center gap-1">
        <Wifi className={cn("size-3", ms < 80 ? "text-up" : ms < 140 ? "text-warn" : "text-down")} />
        <NumberTicker value={ms} format={(n) => `${n.toFixed(0)}ms`} flash={false} />
      </span>
    </Tooltip>
  );
}

function Fps() {
  const [fps, setFps] = React.useState(60);
  React.useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="flex items-center gap-1">
      <Activity className="size-3" />
      <span className="num">{fps} fps</span>
    </span>
  );
}

export function StatusBar() {
  const show = useSettingValue<boolean>("appearance.statusBar");
  const [sound, setSound] = useSetting<boolean>("audio.enabled");
  const [density, setDensity] = useSetting<string>("appearance.density");
  const fps = useSettingValue<boolean>("developer.fps");
  if (!show) return null;
  const left = registry.statusItems.filter((s) => s.side !== "right");
  const right = registry.statusItems.filter((s) => s.side === "right");
  const btn = "tactile flex h-5 items-center gap-1 rounded-xs px-1.5 hover:bg-hover hover:text-fg";
  return (
    <footer className="relative z-[56] flex h-(--statusbar-h) shrink-0 items-center gap-3 border-t border-border glass px-2 text-[10px] text-fg-muted">
      <Tooltip content="Connected (simulated)">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-up animate-ping-dot" />
          live
        </span>
      </Tooltip>
      <Latency />
      {left.map((s) => (
        <s.component key={s.id} />
      ))}
      <span className="ml-auto" />
      {right.map((s) => (
        <s.component key={s.id} />
      ))}
      {fps ? <Fps /> : null}
      <Tooltip content="Toggle density" shortcut="mod+shift+d">
        <button type="button" className={btn} onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}>
          <Rows3 className="size-3" />
          {density}
        </button>
      </Tooltip>
      <Tooltip content={sound ? "Mute" : "Unmute"} shortcut="mod+.">
        <button type="button" className={btn} onClick={() => setSound(!sound)} aria-pressed={sound}>
          {sound ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />}
          {sound ? "sound" : "muted"}
        </button>
      </Tooltip>
      <Clock />
      <span className="num text-fg-faint">v{site.version}</span>
    </footer>
  );
}

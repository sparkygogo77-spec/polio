"use client";
import * as React from "react";
import { Globe, MessageCircle, Pause, Play, Search, SlidersHorizontal, Star, Zap } from "lucide-react";
import { GRADUATION_ETH, PRESETS, STAGE_LABEL, usePulse, type Stage, type Token } from "./sim";
import { useActions } from "@/core/actions";
import { useSettingValue } from "@/core/settings/useSetting";
import { ctxProps } from "@/core/context-menu/ctx";
import { fmtAge, fmtCompact, fmtShortAddress, fmtUsd } from "@/core/lib/format";
import { cn } from "@/core/lib/cn";
import { Badge, Blur, BlurToggle, Button, CopyButton, EmptyState, NumberTicker, Popover, Progress, Segmented, Slider, Sparkline, Switch, Tooltip, VirtualList } from "@/core/ui";

const STAGES: Stage[] = ["new", "final", "migrated"];

function avatarStyle(address: string): React.CSSProperties {
  const h1 = parseInt(address.slice(2, 5), 16) % 360;
  const h2 = (h1 + 60) % 360;
  return { background: `linear-gradient(135deg, oklch(0.7 0.18 ${h1}), oklch(0.55 0.2 ${h2}))` };
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.2 8.2L23.2 22h-6.6l-5.2-6.8L5.4 22H2.3l7.7-8.8L1 2h6.8l4.7 6.2L18.9 2zm-1.1 18h1.8L6.3 3.9H4.4L17.8 20z" />
    </svg>
  );
}

const TokenRow = React.memo(function TokenRow({ t, now }: { t: Token; now: number }) {
  const buy = usePulse((s) => s.buy);
  const preset = usePulse((s) => s.preset);
  const watched = usePulse((s) => s.watch.has(t.address));
  const pos = usePulse((s) => s.positions[t.address]);
  const spark = useSettingValue<boolean>("pulse.showSparkline");
  const confirmBuy = useSettingValue<boolean>("pulse.confirmBuy");
  const rowFlash = useSettingValue<boolean>("effects.rowFlash");
  const ctx = useActions();
  const fresh = now - t.insertedAt < 1500;
  const eth = PRESETS[preset];
  const onBuy = async () => {
    if (confirmBuy) {
      const ok = await ctx.confirm({ title: `Buy ${eth} ETH of ${t.ticker}?`, body: `${fmtUsd(t.mc)} market cap · ${t.liq.toFixed(2)} ETH liquidity`, confirmLabel: "Buy" });
      if (!ok) return;
    }
    buy(t, eth);
  };
  const skew = t.txB + t.txS ? t.txB / (t.txB + t.txS) : 0.5;
  return (
    <div
      {...ctxProps("token", t.address, t)}
      className={cn(
        "group relative flex cursor-default items-center gap-2 border-b border-border px-2 py-1.5 transition-colors hover:bg-hover",
        fresh && rowFlash && "animate-row-in",
        pos && "bg-accent-soft/40",
      )}
      style={{ minHeight: "var(--row-h)" }}
    >
      <div className="relative size-8 shrink-0 rounded-md" style={avatarStyle(t.address)}>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 mix-blend-plus-lighter">{t.ticker.slice(0, 2)}</span>
        {watched ? <Star className="absolute -right-1 -top-1 size-3 fill-warn text-warn" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-xs font-semibold text-fg">{t.ticker}</span>
          <span className="truncate text-[11px] text-fg-muted">{t.name}</span>
          <span className="num ml-auto shrink-0 text-[10px] text-fg-faint">{fmtAge(t.createdAt, now)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-fg-muted">
          <span className="flex shrink-0 items-center gap-0.5 streamer-hidden">
            <span className="num">{fmtShortAddress(t.address, 4, 3)}</span>
            <CopyButton text={t.address} label="contract address" className="size-4 opacity-0 group-hover:opacity-100" />
          </span>
          <span className="flex shrink-0 items-center gap-1 text-fg-faint">
            {t.socials.x ? <XIcon className="size-2.5 hover:text-fg" /> : null}
            {t.socials.tg ? <MessageCircle className="size-2.5 hover:text-fg" /> : null}
            {t.socials.web ? <Globe className="size-2.5 hover:text-fg" /> : null}
            <a href={`https://x.com/search?q=${t.address}`} target="_blank" rel="noreferrer" className="hover:text-fg" aria-label="Search X" onClick={(e) => e.stopPropagation()}>
              <Search className="size-2.5" />
            </a>
          </span>
          {t.paid ? (
            <Badge variant="warn" size="sm" className="shrink-0">
              DS
            </Badge>
          ) : null}
          <span className="flex shrink-0 items-center gap-1.5">
            <Tooltip content="Dev holding">
              <span className={cn("num", t.devPct > 15 ? "text-down" : "text-fg-faint")}>DH {t.devPct}%</span>
            </Tooltip>
            <Tooltip content="Top 10 holders">
              <span className={cn("num", t.top10Pct > 50 ? "text-warn" : "text-fg-faint")}>T10 {t.top10Pct}%</span>
            </Tooltip>
            {t.sniperPct > 15 ? (
              <Tooltip content="Sniper share">
                <span className="num text-down">SN {t.sniperPct}%</span>
              </Tooltip>
            ) : null}
          </span>
        </div>
        {t.stage !== "migrated" ? <Progress value={t.progress} tone="auto" height={2} className="mt-1" /> : null}
      </div>
      {spark ? <Sparkline data={t.hist} width={44} height={18} className="hidden shrink-0 @min-[460px]:block" /> : null}
      <div className="grid w-[104px] shrink-0 grid-cols-2 gap-x-1.5 text-right text-[10px] leading-4">
        <span className="text-fg-faint">MC</span>
        <Blur>
          <NumberTicker value={t.mc} format={(n) => fmtUsd(n, 1)} className="font-medium text-fg" />
        </Blur>
        <span className="text-fg-faint">V</span>
        <Blur>
          <NumberTicker value={t.vol} format={(n) => fmtUsd(n, 1)} flash={false} className="text-fg-muted" />
        </Blur>
        <span className="text-fg-faint">TX</span>
        <span className="num">
          <span className="text-up">{t.txB}</span>
          <span className="text-fg-faint">/</span>
          <span className="text-down">{t.txS}</span>
        </span>
        <span className="text-fg-faint">Liq</span>
        <Blur>
          <NumberTicker value={t.liq} format={(n) => `${n.toFixed(2)}Ξ`} flash={false} className="text-fg-muted" />
        </Blur>
      </div>
      <div className="flex w-14 shrink-0 flex-col items-stretch gap-1">
        <Tooltip content={`Quick buy ${eth} ETH (P${preset})`} shortcut="click">
          <Button size="xs" variant="up" className="w-full justify-center" sound="confirm" optimistic doneLabel="Sent" onClick={onBuy}>
            <Zap />
            {eth}
          </Button>
        </Tooltip>
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-down/40">
          <div className="h-full bg-up" style={{ width: `${skew * 100}%` }} />
        </div>
      </div>
    </div>
  );
});

function ColumnFilters() {
  const filters = usePulse((s) => s.filters);
  const setFilters = usePulse((s) => s.setFilters);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-fg-muted">
          <span>Min liquidity</span>
          <span className="num">{filters.minLiq.toFixed(1)} ETH</span>
        </div>
        <Slider value={[filters.minLiq]} min={0} max={4} step={0.1} onValueChange={(v) => setFilters({ minLiq: v[0] ?? 0 })} />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-fg-muted">
          <span>Min market cap</span>
          <span className="num">{fmtUsd(filters.minMc, 0)}</span>
        </div>
        <Slider value={[filters.minMc]} min={0} max={100_000} step={1000} onValueChange={(v) => setFilters({ minMc: v[0] ?? 0 })} />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-fg-muted">
          <span>Max dev holding</span>
          <span className="num">{filters.maxDev}%</span>
        </div>
        <Slider value={[filters.maxDev]} min={0} max={100} step={1} onValueChange={(v) => setFilters({ maxDev: v[0] ?? 100 })} />
      </div>
      <label className="flex items-center justify-between text-xs">
        Require socials
        <Switch size="sm" checked={filters.requireSocials} onCheckedChange={(v) => setFilters({ requireSocials: v })} />
      </label>
    </div>
  );
}

function Column({ stage, now }: { stage: Stage; now: number }) {
  const rows = usePulse((s) => s.columns[stage]);
  const queued = usePulse((s) => s.queue[stage].length);
  const paused = usePulse((s) => s.paused[stage]);
  const setPaused = usePulse((s) => s.setPaused);
  const hidden = usePulse((s) => s.hidden);
  const filters = usePulse((s) => s.filters);
  const filtered = React.useMemo(
    () =>
      rows.filter(
        (t) =>
          !hidden.has(t.address) &&
          t.liq >= filters.minLiq &&
          t.mc >= filters.minMc &&
          t.devPct <= filters.maxDev &&
          (!filters.requireSocials || t.socials.x || t.socials.tg || t.socials.web),
      ),
    [rows, hidden, filters],
  );
  const activeFilters = Number(filters.minLiq > 0) + Number(filters.minMc > 0) + Number(filters.maxDev < 100) + Number(filters.requireSocials);
  const density = useSettingValue<string>("appearance.density");
  return (
    <section
      {...ctxProps("pulse-column", stage)}
      className="@container flex min-h-0 min-w-0 flex-1 flex-col border-r border-border last:border-r-0"
      onMouseEnter={() => setPaused(stage, true)}
      onMouseLeave={() => setPaused(stage, false)}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-panel/70 px-2">
        <span className={cn("size-1.5 rounded-full", paused ? "bg-warn" : "bg-up animate-ping-dot")} />
        <span className="shrink-0 text-xs font-semibold text-fg">{STAGE_LABEL[stage]}</span>
        <span className="num shrink-0 text-[10px] text-fg-faint">{filtered.length}</span>
        {stage === "final" ? <span className="hidden truncate text-[10px] text-fg-faint @min-[380px]:inline">≥ {GRADUATION_ETH / 2} of {GRADUATION_ETH} ETH</span> : null}
        {queued > 0 ? (
          <button type="button" onClick={() => setPaused(stage, false)} className="tactile num rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg animate-pop">
            +{queued} new
          </button>
        ) : null}
        <span className="ml-auto" />
        <Popover title={`Filters${activeFilters ? ` · ${activeFilters} active` : ""}`} content={<ColumnFilters />} align="end">
          <Button variant="ghost" size="iconXs" aria-label="Filters" className={cn(activeFilters && "text-accent")}>
            <SlidersHorizontal />
          </Button>
        </Popover>
        <BlurToggle />
      </header>
      <div className="min-h-0 flex-1">
        <VirtualList
          items={filtered}
          getKey={(t) => t.address}
          estimateSize={density === "compact" ? 74 : 86}
          renderItem={(t) => <TokenRow t={t} now={now} />}
          empty={<EmptyState title="Nothing here yet" body={stage === "new" ? "New launches stream in every second or so." : "Tokens move here as liquidity grows."} />}
        />
      </div>
    </section>
  );
}

export function PulsePage() {
  const running = usePulse((s) => s.running);
  const setRunning = usePulse((s) => s.setRunning);
  const preset = usePulse((s) => s.preset);
  const setPreset = usePulse((s) => s.setPreset);
  const positions = usePulse((s) => s.positions);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const posCount = Object.keys(positions).length;
  return (
    <div className="flex h-full min-h-[calc(100dvh-var(--topbar-h)-var(--statusbar-h))] flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-xs font-semibold text-fg">Pulse</span>
        <span className="hidden text-[11px] text-fg-muted sm:inline">Hover a column to freeze it. Right-click any row.</span>
        <span className="ml-auto" />
        {posCount ? (
          <Badge variant="accent" dot>
            {posCount} position{posCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
        <Tooltip content="Quick-buy preset" shortcut="1 / 2 / 3">
          <div>
            <Segmented
              size="xs"
              value={String(preset)}
              onChange={(v) => setPreset(Number(v) as 1 | 2 | 3)}
              options={([1, 2, 3] as const).map((p) => ({ value: String(p), label: `P${p} · ${PRESETS[p]}Ξ` }))}
              silent
              aria-label="Preset"
            />
          </div>
        </Tooltip>
        <Tooltip content={running ? "Pause stream" : "Resume stream"} shortcut="p">
          <Button size="iconXs" variant={running ? "ghost" : "subtle"} aria-label="Toggle stream" sound={false} onClick={() => setRunning(!running)}>
            {running ? <Pause /> : <Play />}
          </Button>
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {STAGES.map((s) => (
          <Column key={s} stage={s} now={now} />
        ))}
      </div>
    </div>
  );
}

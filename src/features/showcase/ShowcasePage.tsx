"use client";
import * as React from "react";
import { AlertTriangle, Bell, Check, Download, Heart, Inbox, Play, Plus, Rocket, Search, Star, Trash2, Volume2, Zap } from "lucide-react";
import { useActions } from "@/core/actions";
import { useShowcase } from "./store";
import { CUE_NAMES, cueCategory, play } from "@/core/audio/engine";
import { useSetting, useSettingValue } from "@/core/settings/useSetting";
import { ctxProps } from "@/core/context-menu/ctx";
import { fmtCompact, fmtUsd } from "@/core/lib/format";
import { cn } from "@/core/lib/cn";
import {
  Badge,
  Blur,
  BlurToggle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  Dialog,
  Dropdown,
  EmptyState,
  Input,
  Kbd,
  NumberTicker,
  Popover,
  Progress,
  Segmented,
  Select,
  Separator,
  Skeleton,
  Slider,
  Sparkline,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  VirtualList,
} from "@/core/ui";
import type { Level } from "@/core/types";

const SECTIONS = [
  ["buttons", "Buttons"],
  ["inputs", "Inputs & toggles"],
  ["overlays", "Overlays & menus"],
  ["context", "Right-click"],
  ["news", "News & toasts"],
  ["data", "Live data"],
  ["sound", "Sound board"],
  ["effects", "Effects"],
  ["virtual", "Virtual list"],
] as const;

function Section({ id, title, body, children }: { id: string; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {body ? <p className="text-[11px] text-fg-muted">{body}</p> : null}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-fg-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function useRandomWalk(start: number, step: number, enabled: boolean, ms: number) {
  const [v, setV] = React.useState(start);
  React.useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setV((x) => Math.max(0, x + (Math.random() - 0.48) * step)), ms);
    return () => window.clearInterval(t);
  }, [enabled, step, ms]);
  return v;
}

export function ShowcasePage() {
  const ctx = useActions();
  const liked = useShowcase((s) => s.liked);
  const removed = useShowcase((s) => s.removed);
  const live = useSettingValue<boolean>("showcase.liveNumbers");
  const tickMs = useSettingValue<number>("showcase.tickMs");
  const [seg, setSeg] = React.useState("1h");
  const [sel, setSel] = React.useState("weighted");
  const [sw, setSw] = React.useState(true);
  const [sl, setSl] = React.useState([35]);
  const [dialog, setDialog] = React.useState(false);
  const [slippage, setSlippage] = React.useState(1);
  const [motion, setMotion] = useSetting<string>("effects.motion");
  const [glow, setGlow] = useSetting<boolean>("effects.glow");
  const [scan, setScan] = useSetting<boolean>("effects.scanlines");
  const [noise, setNoise] = useSetting<boolean>("effects.noise");
  const [hue, setHue] = useSetting<number>("appearance.accentHue");
  const mc = useRandomWalk(1_240_000, 60_000, live, tickMs);
  const price = useRandomWalk(0.0042, 0.0003, live, tickMs);
  // The feed cues, on the one feed the template ships: a tick up or down
  // with the price, gated by "Feed events" in the engine.
  const lastPrice = React.useRef(price);
  React.useEffect(() => {
    if (live && price !== lastPrice.current) play(price > lastPrice.current ? "priceUp" : "priceDown");
    lastPrice.current = price;
  }, [price, live]);
  const [hist, setHist] = React.useState<number[]>(() => Array.from({ length: 30 }, (_, i) => 50 + Math.sin(i / 3) * 10));
  React.useEffect(() => {
    setHist((h) => [...h.slice(-29), mc / 20_000]);
  }, [mc]);
  const rows = React.useMemo(() => Array.from({ length: 10_000 }, (_, i) => ({ id: i, name: `Row ${i + 1}`, value: Math.round(Math.random() * 1e6) })), []);

  const bump = (delta: number) => {
    const next = Math.max(0, Math.min(50, slippage + delta));
    setSlippage(next);
    ctx.publish({
      key: "showcase:slippage",
      title: "Slippage",
      body: "Changed from the showcase page",
      level: "info",
      source: "showcase",
      diff: { field: "Slippage", from: slippage, to: next, format: (v) => `${v}%` },
      toast: true,
      coalesceMs: Infinity,
    });
  };
  const levelDemo = (level: Level) =>
    ctx.publish({ key: `showcase:level:${level}`, title: `${level} event`, body: "Same key: press again and the count climbs instead of a new row.", level, source: "showcase", toast: true });
  const spam = () => {
    for (let i = 0; i < 60; i++) ctx.publish({ title: `Burst event ${i + 1}`, body: "60 publishes in one frame. The rate limiter drops the excess.", level: "info", source: "burst", sound: false });
    ctx.openPanel("news");
  };

  return (
    <div className="flex gap-6 px-4 py-6 sm:px-6">
      <nav className="sticky top-4 hidden h-fit w-40 shrink-0 flex-col gap-0.5 lg:flex" aria-label="Sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={() => play("select")} className="tactile rounded-sm px-2 py-1 text-[11px] text-fg-muted hover:bg-hover hover:text-fg">
            {label}
          </a>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div>
          <h1 className="text-lg font-semibold text-fg">Showcase</h1>
          <p className="text-[11px] text-fg-muted">Every primitive with sound, haptics and instant feedback wired in. Right-click anything.</p>
        </div>

        <Section id="buttons" title="Buttons" body="Cues fire on pointer-down, before the click resolves. Press scale is a setting.">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="up">
              <Zap />
              Buy
            </Button>
            <Button variant="danger">
              <Trash2 />
              Sell
            </Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="Sizes">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Star">
              <Star />
            </Button>
          </Row>
          <Row label="States">
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button optimistic doneLabel={<><Check /> Done</>} sound="confirm">
              Optimistic
            </Button>
            <Button shortcut="mod+enter" variant="primary">
              With hint
            </Button>
            <CopyButton text="0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" label="address" size="sm" variant="outline">
              Copy address
            </CopyButton>
          </Row>
        </Section>

        <Section id="inputs" title="Inputs & toggles" body="Sliders tick, switches chirp up or down, segmented controls select.">
          <Row label="Switch">
            <Switch checked={sw} onCheckedChange={setSw} />
            <Switch size="sm" defaultChecked />
            <Switch disabled />
          </Row>
          <Row label="Slider">
            <Slider className="w-64" value={sl} onValueChange={setSl} readout={(n) => `${n}%`} />
          </Row>
          <Row label="Segmented">
            <Segmented value={seg} onChange={setSeg} options={["5m", "1h", "6h", "24h"].map((v) => ({ value: v, label: v }))} />
            <Segmented
              size="xs"
              value={seg}
              onChange={setSeg}
              options={[
                { value: "5m", label: "5m" },
                { value: "1h", label: "1h" },
                { value: "6h", label: "6h" },
                { value: "24h", label: "24h" },
              ]}
            />
          </Row>
          <Row label="Select">
            <Select
              value={sel}
              onChange={setSel}
              options={[
                { value: "weighted", label: "Weighted average", description: "default" },
                { value: "fifo", label: "FIFO" },
                { value: "lifo", label: "LIFO" },
              ]}
            />
          </Row>
          <Row label="Input">
            <Input placeholder="Search tokens…" left={<Search />} className="w-56" />
            <Input placeholder="0x…" mono className="w-56" />
            <Input placeholder="Disabled" disabled className="w-32" />
          </Row>
          <Row label="Tabs">
            <Tabs defaultValue="positions" className="w-full">
              <TabsList>
                <TabsTrigger value="positions">Positions</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="positions" className="text-[11px] text-fg-muted">
                Open positions render here.
              </TabsContent>
              <TabsContent value="orders" className="text-[11px] text-fg-muted">
                Limit orders and triggers.
              </TabsContent>
              <TabsContent value="history" className="text-[11px] text-fg-muted">
                Every fill, exportable.
              </TabsContent>
            </Tabs>
          </Row>
          <Row label="Badges">
            <Badge>Default</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="up" dot>
              +12.4%
            </Badge>
            <Badge variant="down" dot>
              -3.1%
            </Badge>
            <Badge variant="warn">DS paid</Badge>
            <Badge variant="info">beta</Badge>
            <Badge variant="outline">T10 18%</Badge>
            <Badge variant="solid">LIVE</Badge>
            <Kbd>mod+k</Kbd>
            <Kbd>g p</Kbd>
          </Row>
        </Section>

        <Section id="overlays" title="Overlays & menus" body="Every overlay plays open and close cues and pops from its origin.">
          <Row label="Tooltip">
            <Tooltip content="Quick buy at preset size" shortcut="b">
              <Button size="sm">
                <Zap />
                Hover me
              </Button>
            </Tooltip>
          </Row>
          <Row label="Popover">
            <Popover
              title="Filters"
              content={
                <div className="flex flex-col gap-3">
                  <Slider defaultValue={[20]} readout={(n) => `${n}K`} />
                  <Slider defaultValue={[60]} readout={(n) => `${n}%`} />
                  <div className="flex items-center justify-between text-xs">
                    <span>Hide without socials</span>
                    <Switch size="sm" defaultChecked />
                  </div>
                </div>
              }
            >
              <Button size="sm" variant="outline">
                Filters
              </Button>
            </Popover>
          </Row>
          <Row label="Dropdown">
            <Dropdown
              entries={(c) => [
                { type: "label", label: "Preset" },
                { id: "p1", label: "P1 · 0.1 ETH", shortcut: "1", onSelect: () => c.publish({ key: "preset", title: "Preset", diff: { from: "P2", to: "P1" }, toast: true, source: "showcase" }) },
                { id: "p2", label: "P2 · 0.5 ETH", shortcut: "2", checked: true, onSelect: () => c.publish({ key: "preset", title: "Preset", diff: { from: "P2", to: "P2" }, toast: true, source: "showcase" }) },
                { id: "p3", label: "P3 · 1 ETH", shortcut: "3", onSelect: () => c.publish({ key: "preset", title: "Preset", diff: { from: "P2", to: "P3" }, toast: true, source: "showcase" }) },
                { type: "separator" },
                { id: "more", label: "More", children: [
                  { id: "a", label: "Nested item", onSelect: () => c.publish({ key: "preset:nested", title: "Nested item", body: "From a submenu.", toast: true, source: "showcase" }) },
                  { id: "b", label: "Another", hint: "beta", onSelect: () => c.publish({ key: "preset:nested", title: "Another", body: "From a submenu.", toast: true, source: "showcase" }) },
                ] },
                { id: "del", label: "Delete preset", danger: true, icon: Trash2, onSelect: () => void c.confirm({ title: "Delete preset P2?", danger: true, confirmLabel: "Delete" }).then((ok) => ok && c.publish({ key: "preset", title: "Preset P2 deleted", level: "warn", toast: true, source: "showcase" })) },
              ]}
            >
              <Button size="sm">
                Presets
                <Plus />
              </Button>
            </Dropdown>
          </Row>
          <Row label="Dialog">
            <Button size="sm" variant="primary" onClick={() => setDialog(true)}>
              Open dialog
            </Button>
            <Button size="sm" variant="danger" onClick={() => void ctx.confirm({ title: "Sell 100%?", body: "This closes the position at market.", danger: true, confirmLabel: "Sell" }).then((ok) => ctx.publish({ key: "showcase:sell", title: ok ? "Sold" : "Cancelled", level: ok ? "success" : "info", source: "showcase", toast: true }))}>
              Confirm flow
            </Button>
            <Dialog
              open={dialog}
              onOpenChange={setDialog}
              title="Edit preset"
              description="Saved trade configuration."
              footer={
                <>
                  <Button variant="ghost" size="sm" onClick={() => setDialog(false)} sound="close">
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" sound="confirm" onClick={() => setDialog(false)}>
                    Save
                  </Button>
                </>
              }
            >
              <div className="flex flex-col gap-3">
                <Input placeholder="Size in ETH" mono defaultValue="0.5" />
                <Slider defaultValue={[15]} readout={(n) => `${n}% slip`} />
              </div>
            </Dialog>
          </Row>
        </Section>

        <Section id="context" title="Right-click" body="These cards declare a scope with ctxProps(). The module adds items for it; the core adds page items below.">
          <div className="grid gap-2 sm:grid-cols-3">
            {["Alpha", "Beta", "Gamma"].filter((name) => !removed[name.toLowerCase()]).map((name) => (
              <div key={name} {...ctxProps("demo-card", name.toLowerCase(), { name, liked: !!liked[name.toLowerCase()] })} data-liked={!!liked[name.toLowerCase()]} className="tactile flex h-20 items-center justify-center rounded-md border border-dashed border-border-strong text-xs text-fg-muted hover:bg-hover">
                <Heart className={cn("mr-1.5 size-3.5", liked[name.toLowerCase()] && "fill-down text-down")} />
                Right-click {name}
              </div>
            ))}
          </div>
        </Section>

        <Section id="news" title="News & toasts" body="Same key = same line. Reverting before you read it removes the line entirely.">
          <Row label="Coalesce">
            <Button size="sm" onClick={() => bump(-1)}>
              −1%
            </Button>
            <span className="num w-10 text-center text-sm font-semibold">{slippage}%</span>
            <Button size="sm" onClick={() => bump(1)}>
              +1%
            </Button>
            <span className="text-[11px] text-fg-muted">Change slippage a few times, then open the bell: one line reading “from → to”.</span>
          </Row>
          <Row label="Levels">
            <Button size="sm" variant="outline" onClick={() => levelDemo("info")}>
              <Bell />
              Info
            </Button>
            <Button size="sm" variant="up" onClick={() => levelDemo("success")}>
              <Check />
              Success
            </Button>
            <Button size="sm" variant="outline" className="text-warn" onClick={() => levelDemo("warn")}>
              <AlertTriangle />
              Warn
            </Button>
            <Button size="sm" variant="danger" onClick={() => levelDemo("error")}>
              Error
            </Button>
          </Row>
          <Row label="Rate limit">
            <Button size="sm" variant="ghost" onClick={spam}>
              <Rocket />
              Publish 60 at once
            </Button>
          </Row>
        </Section>

        <Section id="data" title="Live data" body="Numbers tween toward new values and flash by direction. Blur hides them for streaming.">
          <Row label="Ticker">
            <Blur>
              <NumberTicker value={mc} format={(n) => fmtUsd(n)} className="text-base font-semibold" colorize />
            </Blur>
            <Blur>
              <NumberTicker value={price} format={(n) => `$${n.toFixed(5)}`} className="font-mono" />
            </Blur>
            <BlurToggle />
          </Row>
          <Row label="Sparkline">
            <Sparkline data={hist} width={120} height={28} />
            <Sparkline data={[5, 4, 4, 3, 3, 2]} tone="down" />
            <Sparkline data={[1, 3, 2, 4, 3, 5]} tone="accent" fill={false} />
          </Row>
          <Row label="Progress">
            <div className="flex w-full max-w-md flex-col gap-2">
              <Progress value={0.32} tone="auto" label="32%" />
              <Progress value={0.71} tone="auto" label="71%" glow />
              <Progress value={0.96} tone="auto" label="96%" glow />
            </div>
          </Row>
          <Row label="Skeleton">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </Row>
          <Row label="Empty">
            <EmptyState icon={Inbox} title="No positions" body="Buys from the feed show up here." action={<Button size="sm" onClick={() => ctx.openPanel("news")}>Open feed</Button>} className="p-2" />
          </Row>
          <Separator />
          <Row label="Format">
            <span className="num text-xs text-fg-muted">{fmtCompact(1234)} · {fmtCompact(1_500_000)} · {fmtUsd(42_000_000_000)}</span>
          </Row>
        </Section>

        <Section id="sound" title="Sound board" body="Every cue is synthesised at play time. Categories map to the Audio settings.">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
            {CUE_NAMES.map((c) => (
              <Button key={c} size="sm" variant="outline" sound={false} onClick={() => play(c, { force: true })} className="justify-between">
                <span className="flex items-center gap-1.5">
                  <Play className="size-3" />
                  {c}
                </span>
                <span className="text-[9px] uppercase text-fg-faint">{cueCategory(c)}</span>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-fg-muted">
            <Volume2 className="size-3.5" />
            Master volume lives in Settings → Audio. <Kbd>mod+.</Kbd> mutes everything.
          </div>
        </Section>

        <Section id="effects" title="Effects" body="Ambient layers and motion, all runtime switches on <html>.">
          <Row label="Motion">
            <Segmented value={motion} onChange={setMotion} options={["full", "reduced", "off"].map((v) => ({ value: v, label: v }))} />
          </Row>
          <Row label="Ambience">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch size="sm" checked={glow} onCheckedChange={setGlow} /> Glow
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch size="sm" checked={scan} onCheckedChange={setScan} /> Scanlines
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch size="sm" checked={noise} onCheckedChange={setNoise} /> Grain
            </label>
          </Row>
          <Row label="Accent">
            <Slider className="w-64" value={[hue]} min={0} max={360} onValueChange={(v) => setHue(v[0] ?? hue)} readout={(n) => `${n}°`} />
            <Button size="sm" variant="ghost" onClick={() => setHue(Math.floor(Math.random() * 360))}>
              Random
            </Button>
          </Row>
        </Section>

        <Section id="virtual" title="Virtual list" body="10,000 rows, only the visible ones exist in the DOM.">
          <div className="h-64 rounded-md border border-border">
            <VirtualList
              items={rows}
              getKey={(r) => String(r.id)}
              estimateSize={28}
              renderItem={(r) => (
                <div {...ctxProps("virtual-row", String(r.id), r)} className="flex h-7 items-center justify-between border-b border-border px-3 text-xs hover:bg-hover">
                  <span className="text-fg-muted">{r.name}</span>
                  <span className="num">{fmtCompact(r.value)}</span>
                </div>
              )}
            />
          </div>
          <div className="text-[11px] text-fg-faint">
            <Download className="mr-1 inline size-3" />
            Rows also carry a scope, so right-click works inside the window.
          </div>
        </Section>
      </div>
    </div>
  );
}

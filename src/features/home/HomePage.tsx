"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bell, Command, Keyboard, MousePointer2, Settings2, Sparkles, Terminal, Volume2, Zap } from "lucide-react";
import site from "@site";
import { registry } from "@/core/registry";
import { useActions } from "@/core/actions";
import { allSettingDefs } from "@/core/settings/store";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Card, CardContent } from "@/core/ui/card";
import { Kbd } from "@/core/ui/kbd";
import { ctxProps } from "@/core/context-menu/ctx";
import { cn } from "@/core/lib/cn";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-panel/60 px-3 py-2">
      <span className="num text-lg font-semibold leading-tight text-fg">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-fg-faint">{label}</span>
    </div>
  );
}

const PILLARS = [
  { icon: MousePointer2, title: "Right-click everywhere", body: "Every element can declare a scope; modules contribute items. Nested scopes stack." },
  { icon: Zap, title: "Instant, tactile", body: "Cues fire on pointer-down, buttons compress, values flash by direction, actions read as done immediately." },
  { icon: Bell, title: "News that never repeats", body: "Same key updates the line in place: 1% → 2% → 3% is one row reading “1% → 3%”. Reverts vanish." },
  { icon: Volume2, title: "Synthesised audio", body: "Twenty cues rendered by the Web Audio API. No asset files, per-category mutes, master volume." },
  { icon: Settings2, title: "Every option, hidden well", body: "Dozens of settings, searchable, grouped, with an advanced switch so the default view stays calm." },
  { icon: Keyboard, title: "Palette and chords", body: "⌘K reaches every command, page and toggle. Two-key chords like g p navigate without a mouse." },
];

export function HomePage() {
  const ctx = useActions();
  const { hero } = site.home;
  const modules = registry.modules.filter((m) => !m.hidden);
  const [n, setN] = React.useState(1);

  const demoPublish = () => {
    const next = n + 1;
    setN(next);
    ctx.publish({
      key: "home:demo-slippage",
      title: "Slippage",
      body: "Try pressing this a few times: one line, not many.",
      diff: { field: "Slippage", from: n, to: next, format: (v) => `${v}%` },
      level: "info",
      source: "home",
      toast: true,
      coalesceMs: Infinity,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12" {...ctxProps("home", "hero")}>
      <section className="relative">
        {hero.eyebrow ? (
          <Badge variant="accent" className="mb-3">
            <Sparkles className="size-3" />
            {hero.eyebrow}
          </Badge>
        ) : null}
        <h1 className="max-w-3xl text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-4xl lg:text-5xl">{hero.title}</h1>
        {hero.subtitle ? <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-fg-muted sm:text-base">{hero.subtitle}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {hero.primaryCta ? (
            <Button asChild variant="primary" size="lg" sound="confirm">
              <Link href={hero.primaryCta.href}>
                <Terminal />
                {hero.primaryCta.label}
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
          {hero.secondaryCta ? (
            <Button asChild variant="outline" size="lg">
              <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
            </Button>
          ) : null}
          <Button variant="ghost" size="lg" onClick={() => ctx.openPanel("commands")} shortcut="mod+k">
            <Command />
            Command palette
          </Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-2xl">
          <Stat label="Modules" value={modules.length} />
          <Stat label="Commands" value={registry.commands.length} />
          <Stat label="Options" value={allSettingDefs().length} />
          <Stat label="Shortcuts" value={registry.shortcuts.length} />
        </div>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <Card key={p.title} className="tactile hover:border-border-strong" {...ctxProps("pillar", p.title, p)}>
            <CardContent className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <p.icon className="size-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-fg">{p.title}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-fg-muted">{p.body}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-lg border border-border bg-panel/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-fg">Feel it in ten seconds</div>
            <div className="text-[11px] text-fg-muted">Right-click this box. Press ⌘K. Then hit the button below repeatedly and open the bell.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={demoPublish} optimistic doneLabel="Updated ✓">
              Change slippage to {n + 1}%
            </Button>
            <Button variant="ghost" onClick={() => ctx.openPanel("news")}>
              <Bell />
              Open news
            </Button>
          </div>
        </div>
      </section>

      {site.home.showModuleGrid && modules.length ? (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-semibold text-fg">Feature modules</h2>
            <span className="text-[11px] text-fg-faint">Each one is a folder under src/features</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const href = m.routes?.[0]?.path ?? "/";
              const Icon = m.icon ?? Sparkles;
              return (
                <Link key={m.id} href={href} className={cn("group block")} {...ctxProps("module", m.id, m)}>
                  <Card className="tactile h-full transition-colors group-hover:border-accent/40">
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-accent" />
                        <span className="text-xs font-semibold text-fg">{m.name}</span>
                        {m.demo ? (
                          <Badge size="sm" className="ml-auto">
                            demo
                          </Badge>
                        ) : null}
                      </div>
                      {m.description ? <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">{m.description}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(m.tags ?? []).map((t) => (
                          <Badge key={t} size="sm" variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[11px] text-accent">
                        Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {site.home.showAgentGuide ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-fg">Make it yours</h2>
          <p className="mt-1 max-w-2xl text-[11px] text-fg-muted">
            This is a foundation, not a finished site. Hand an agent <span className="font-mono text-fg">AGENTS.md</span> and one of the recipes in{" "}
            <span className="font-mono text-fg">docs/PROMPTS.md</span>, or do it by hand:
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { n: 1, t: "Re-centre the site", b: "Edit site.config.ts: name, copy, accent hue, nav style, which demos stay." },
              { n: 2, t: "Add a feature", b: "npm run new:feature <id> scaffolds a module with routes, menus, commands and settings." },
              { n: 3, t: "Remove the demos", b: "Set demoModules: [] once your own modules exist. Nothing else references them." },
            ].map((s) => (
              <li key={s.n} className="rounded-md border border-border bg-panel/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="num flex size-5 items-center justify-center rounded-sm bg-accent text-[10px] font-bold text-accent-fg">{s.n}</span>
                  <span className="text-xs font-semibold text-fg">{s.t}</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">{s.b}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-fg-faint">
            <span>Try</span>
            <Kbd>shift+/</Kbd>
            <span>for every shortcut,</span>
            <Kbd>g p</Kbd>
            <span>to jump to the feed.</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

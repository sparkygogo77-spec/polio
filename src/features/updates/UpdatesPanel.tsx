"use client";
/**
 * What's new, as a panel that slides in over whatever you were doing.
 *
 * A changelog nobody opens is a changelog nobody reads, so this is one keypress
 * from anywhere and never a page you have to navigate away to. Each release is
 * a stop on one line running down the left: version, what it was for, what it
 * added, and a small drawing of the thing itself — a texture engine and a
 * colour engine read the same in prose and quite differently in a picture.
 */
import * as React from "react";
import { X } from "lucide-react";
import { useUi } from "@/core/ui-state/store";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/lib/cn";
import { RELEASES, type Sketch } from "./changelog";

/* ------------------------------------------------------------------ */
/* The little drawings                                                 */
/* ------------------------------------------------------------------ */

function Sketchpad({ kind }: { kind: Sketch }) {
  const box = "h-16 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-elevated/60";
  switch (kind) {
    case "frame":
      return (
        <div className={cn(box, "flex flex-col gap-1 p-1.5")}>
          <span className="h-2 rounded-[2px] bg-accent/60" />
          <span className="h-4 rounded-[2px] bg-fg/15" />
          <div className="flex flex-1 gap-1">
            <span className="flex-1 rounded-[2px] bg-fg/10" />
            <span className="flex-1 rounded-[2px] bg-fg/10" />
          </div>
        </div>
      );
    case "parts":
      return (
        <div className={cn(box, "grid grid-cols-3 gap-1 p-1.5")}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={cn("rounded-[2px]", i % 4 === 0 ? "bg-accent/50" : "bg-fg/12")} />
          ))}
        </div>
      );
    case "palette":
      return (
        <div className={cn(box, "flex items-end gap-1 p-1.5")}>
          {[0.18, 0.34, 0.52, 0.7, 0.86, 1].map((v, i) => (
            <span key={i} className="flex-1 rounded-[2px]" style={{ height: `${25 + v * 70}%`, background: `oklch(${0.35 + v * 0.45} 0.15 ${230 + i * 18})` }} />
          ))}
        </div>
      );
    case "flame":
      return (
        <div className={cn(box, "relative")}>
          <span className="absolute inset-x-3 bottom-0 h-10 rounded-full blur-[6px]" style={{ background: "radial-gradient(60% 70% at 50% 100%, oklch(0.7 0.2 248 / 0.8), transparent 72%)" }} />
          <span className="absolute inset-x-6 top-3 h-5 rounded-[2px] bg-fg/15" />
        </div>
      );
    case "picture":
      return (
        <div
          className={box}
          style={{
            backgroundColor: "oklch(0.2 0.02 260)",
            backgroundImage:
              "repeating-linear-gradient(38deg, oklch(0.72 0.16 250 / 0.55) 0 2px, transparent 2px 9px), repeating-linear-gradient(-38deg, oklch(0.72 0.16 250 / 0.4) 0 2px, transparent 2px 9px)",
          }}
        />
      );
    case "planets":
      return (
        <div className={cn(box, "flex items-center justify-center gap-1.5")}>
          {[
            { hue: 210, r: 6, ring: true },
            { hue: 30, r: 5, ring: false },
            { hue: 300, r: 4, ring: false },
          ].map((p, i) => (
            <svg key={i} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={`oklch(0.8 0.13 ${p.hue})`} strokeWidth="1.5" aria-hidden>
              <circle cx="12" cy="12" r={p.r} />
              {p.ring ? <ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)" /> : null}
            </svg>
          ))}
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

export function UpdatesPanel() {
  const open = useUi((s) => s.panels.updates);
  const closePanel = useUi((s) => s.closePanel);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel("updates"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => closePanel("updates")}
        className={cn(
          "fixed inset-0 z-[75] bg-black/40 transition-opacity duration-(--motion-slow)",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Updates"
        data-updates-panel=""
        data-open={open ? "1" : "0"}
        aria-hidden={!open}
        {...(open ? {} : { inert: "" as unknown as boolean })}
        className={cn(
          "fixed right-0 top-0 z-[76] flex h-dvh w-[min(420px,92vw)] flex-col border-l border-border bg-panel shadow-panel transition-transform duration-(--motion-slow) ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-fg">Updates</h2>
            <p className="text-[11px] text-fg-muted">What has been built, newest first.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close updates" onClick={() => closePanel("updates")}>
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ol className="relative space-y-5 border-l border-border pl-5">
            {RELEASES.map((r, i) => (
              <li key={r.version} className="relative">
                {/* The stop on the line. The newest one is filled in. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[26px] top-1 size-2.5 rounded-full border-2",
                    i === 0 ? "border-accent bg-accent" : "border-border bg-panel",
                  )}
                />
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="num text-[11px] font-semibold text-accent">v{r.version}</span>
                      <h3 className="min-w-0 truncate text-[13px] font-semibold text-fg">{r.title}</h3>
                      {i === 0 ? <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[9px] font-semibold text-accent">now</span> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{r.summary}</p>
                  </div>
                  <Sketchpad kind={r.sketch} />
                </div>
                <ul className="mt-2 space-y-1">
                  {r.added.map((line) => (
                    <li key={line} className="flex gap-2 text-[11px] leading-snug text-fg-muted">
                      <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-faint" />
                      {line}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </>
  );
}

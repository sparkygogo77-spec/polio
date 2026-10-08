"use client";
/**
 * The theme a site made here was rolled from, and the roll: the top of the
 * Look tab (`LookPanel.tsx`).
 *
 * What it shows, in this order: the theme's name and how it was made; the
 * Randomize key; the slider from Familiar to Original; a lock per group
 * (colours, fonts, shapes, layout, motion), each saying what the group is
 * now; the design philosophy box, with what was understood said back; and
 * the switch for a "Try these" section. Every roll is one undo step named
 * for the theme (`historyNames.ts`). How the next roll is made is kept with
 * the site (`look.themeRoll`), outside undo: moving the slider is not an edit
 * to the site.
 */
import * as React from "react";
import { Dices, Lock, LockOpen } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useBuilds } from "@/features/builds/store";
import { defaultRoll, type ThemeRollSettings } from "./look";
import { useStudio } from "./board/store";
import { useBoardKits } from "./DrawKits";
import { GROUP_LABEL, GROUPS, kitDistance, minDistanceAt, pairingOf, readPhilosophy, type Group, type SiteTheme } from "./siteTheme";
import { rollOnto } from "./newSite";
import type { StyleKit } from "./look";

const LIGHT_WORD: Record<number, string> = { 0: "above", 45: "the top right", 90: "the right", 135: "the bottom right", 180: "below", 225: "the bottom left", 270: "the left", 315: "the top left" };

/** What a group is now, in plain words. */
export function groupSays(t: SiteTheme, g: Group): string {
  switch (g) {
    case "colours": return `${t.colours.mode} page, ${t.colours.harmony === "split" ? "split complementary" : t.colours.harmony === "mono" ? "one colour" : t.colours.harmony} from ${t.colours.hue}°`;
    case "fonts": return pairingOf(t.fonts.pairing).name;
    case "shapes": return `${t.shapes.corner} corners, ${t.shapes.border === "none" ? "no" : t.shapes.border} border, ${t.shapes.shadow === "none" ? "no shadows" : `${t.shapes.shadow} shadows`}${t.shapes.shadow === "none" || t.shapes.shadow === "glow" ? "" : `, light from ${LIGHT_WORD[t.shapes.light] ?? "above"}`}, ${t.shapes.buttonSize} ${t.shapes.buttonShape === "match" ? "" : `${t.shapes.buttonShape} `}buttons`;
    case "layout": return `header ${t.layout.header}, first screen ${t.layout.hero}, ${t.layout.cards} cards, ${t.layout.density}, type ×${t.layout.scale}, ${t.layout.step}px steps`;
    case "motion": return t.motion.style;
  }
}

/** Kits from every other site in Builds: what Familiar starts from and Original keeps away from. */
function useCapturedKits(): StyleKit[] {
  const { elsewhere, here } = useBoardKits(true);
  const captured = useStudio((s) => s.nodes.some((n) => !!n.from));
  return React.useMemo(() => [...(captured ? here : []), ...elsewhere.flatMap((o) => o.kits)], [captured, here, elsewhere]);
}

/** How the next roll is made: kept with the site, outside undo. */
function setRoll(patch: Partial<ThemeRollSettings>) {
  useStudio.setState((s) => ({ look: { ...s.look, themeRoll: { ...defaultRoll(), ...s.look.themeRoll, ...patch } } }));
}

export function ThemeSection() {
  const theme = useStudio((s) => s.look.theme ?? null);
  const kept = useStudio((s) => s.look.themeRoll);
  const roll = React.useMemo(() => ({ ...defaultRoll(), ...kept }), [kept]);
  const brief = useStudio((s) => s.brief.name);
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.name);
  const kits = useCapturedKits();
  const [text, setText] = React.useState(roll.philosophy);
  React.useEffect(() => setText(roll.philosophy), [roll.philosophy]);
  const phil = React.useMemo(() => readPhilosophy(text), [text]);
  const far = theme && kits.length ? kitDistance(theme, kits) : null;
  const go = () => {
    play("confirm");
    rollOnto({ kits, siteName: brief || project || undefined });
  };
  const word = roll.originality < 0.34 ? "Familiar" : roll.originality > 0.66 ? "Original" : "Between";
  return (
    <section data-theme-section="" className="space-y-2 border-b border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 data-look-heading className="text-plain font-semibold text-fg">Theme</h3>
        <button type="button" data-theme-roll="" onClick={go} className="tactile inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-2 py-1 text-small font-medium text-fg">
          <Dices className="size-3.5" /> Randomize
        </button>
      </div>
      <p data-theme-name="" className="text-small text-fg-muted">
        {theme ? <>Now: <span className="text-fg">{theme.name}</span>.{far ? ` ${far.distance.toFixed(2)} from the nearest captured style (${far.nearest}).` : ""}</> : "This site has no theme yet. Randomize builds a sample page in one."}
      </p>

      <label className="block space-y-1">
        <div className="flex justify-between text-small text-fg-muted"><span>Familiar</span><span data-theme-originality-word="" className="text-fg">{word}</span><span>Original</span></div>
        <input
          type="range" min={0} max={1} step={0.05} value={roll.originality} data-theme-originality="" aria-label="Familiar to Original"
          onChange={(e) => setRoll({ originality: Number(e.target.value) })} className="w-full"
        />
        <span className="block text-fine text-fg-faint">
          {roll.originality < 0.5 ? "Starts from styles already captured on your other sites and font pairings people know." : `Keeps at least ${minDistanceAt(roll.originality).toFixed(2)} away from every captured style${kits.length ? ` (${kits.length} on your other sites)` : " (none captured yet)"}.`}
        </span>
      </label>

      <div className="space-y-1" data-theme-groups="">
        {GROUPS.map((g) => {
          const locked = roll.locks.includes(g);
          return (
            <div key={g} className="flex items-start gap-2">
              <button
                type="button" data-theme-lock={g} aria-pressed={locked} aria-label={`${locked ? "Unlock" : "Lock"} ${GROUP_LABEL[g]}`}
                title={locked ? `${GROUP_LABEL[g]} stay as they are when you roll. Press to let them change.` : `Keep ${GROUP_LABEL[g].toLowerCase()} as they are when you roll.`}
                onClick={() => { play(locked ? "toggleOff" : "toggleOn"); setRoll({ locks: locked ? roll.locks.filter((x) => x !== g) : [...roll.locks, g] }); }}
                className={cn("tactile mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border", locked ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted")}
              >
                {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
              </button>
              <div className="min-w-0 text-small">
                <div className="font-medium text-fg">{GROUP_LABEL[g]}</div>
                <div data-theme-says={g} className="text-fg-muted">{theme ? groupSays(theme, g) : "not rolled yet"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <label className="block space-y-1">
        <span className="text-small font-medium text-fg">Design philosophy</span>
        <textarea
          data-theme-philosophy="" rows={2} value={text} placeholder="brutalist newspaper, hard shadows, one loud colour"
          onChange={(e) => setText(e.target.value)} onBlur={() => setRoll({ philosophy: text })}
          className="w-full rounded-md border border-border bg-bg px-2 py-1 text-small text-fg"
        />
        {text.trim() ? (
          <span data-theme-understood="" className="block text-fine text-fg-muted">
            {phil.understood.length ? `Rolls stay inside: ${phil.understood.join("; ")}.` : "No word here narrows the roll yet."}
            {phil.unknown.length ? ` Not understood: ${phil.unknown.join(", ")}.` : ""}
          </span>
        ) : null}
        <span className="block text-fine text-fg-faint">Read by word rules. An artificial intelligence (AI) step could later read a whole sentence, suggest ranges for words these rules do not know, and name the result.</span>
      </label>

      <label className="flex items-center gap-2 text-small text-fg-muted">
        <input type="checkbox" data-theme-try="" checked={roll.tryThese} onChange={(e) => setRoll({ tryThese: e.target.checked })} />
        Add a &ldquo;Try these&rdquo; section: two or three working parts from the shelf, in this theme
      </label>
    </section>
  );
}

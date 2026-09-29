"use client";
/**
 * The tool options bar: each tool's own settings, in the header, where the
 * drawing colours have always been.
 *
 * HIS WORDS. "Make a checkbox option for that, the checkbox should be in the
 * header where colors are chosen when drawing, where we will prepare to
 * associate different settings with each tool selected."
 *
 * So the bar is the piece and a setting is a tenant. `TOOL_OPTIONS` lists
 * them; the bar shows the ones whose `tools` include the tool in hand, in
 * `order`, and nothing at all when a tool has none. A tenant is one of two
 * kinds:
 *
 *   · `toggle` — a checkbox bound to a module setting (`settings` on the
 *     manifest in `index.ts`), so it is also in ⌘K and the settings drawer,
 *     and it lives per browser like the drawing colour, never in the board;
 *   · `custom` — anything richer, drawn by its own component: the pen's
 *     colour and kinds are this, moved here from `StudioPage.tsx` unchanged.
 *
 * A second or third tool's setting is one more entry here; the bar itself
 * does not change. Below `lg` the header folds, and More tools draws the same
 * entries compactly (`compact`).
 */
import * as React from "react";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { cn } from "@/core/lib/cn";
import { useSetting } from "@/core/settings/useSetting";
import { Popover } from "@/core/ui/popover";
import { Tooltip } from "@/core/ui/tooltip";
import { Link2, Link2Off, Lock } from "lucide-react";
import { DRAW_KINDS, HUES, useStudio, type Tool } from "./store";

type Entry = { id: string; tools: readonly Tool[]; order: number } & (
  | { kind: "toggle"; setting: string; label: string; hint: string }
  | { kind: "custom"; render: (p: { compact?: boolean }) => React.ReactNode }
);

export const TOOL_OPTIONS: readonly Entry[] = [
  {
    id: "draw-kind", tools: ["pen", "arrow"], order: 1, kind: "custom",
    render: ({ compact }) => <InkRow compact={compact} />,
  },
  {
    id: "group-scale", tools: ["select"], order: 1, kind: "toggle",
    setting: "studio.groupScaleContents",
    label: "Scale contents with group",
    hint: "When a locked group is resized, its icons and words grow and shrink with it. Off, the arrangement still scales and each part keeps its own size.",
  },
];

export function ToolOptions({ tool, compact }: { tool: Tool; compact?: boolean }) {
  const mine = TOOL_OPTIONS.filter((o) => o.tools.includes(tool)).sort((a, b) => a.order - b.order);
  if (!mine.length) return null;
  return (
    <div data-tool-options={tool} className={cn("items-center gap-1.5", compact ? "flex flex-wrap" : "hidden lg:flex")}>
      {mine.map((o) => (
        <div key={o.id} data-tool-option={o.id} className="flex items-center">
          {o.kind === "toggle" ? <OptionCheckbox setting={o.setting} label={o.label} hint={o.hint} compact={compact} /> : o.render({ compact })}
        </div>
      ))}
    </div>
  );
}

/**
 * A checkbox, because he asked for one by name, worn as an icon, because he
 * then asked for the room back.
 *
 * HIS WORDS, the second time: "Scale contents with group" was a labelled
 * checkbox taking a 164px slot on the bar; make it an icon, two linked locks
 * or something in that spirit. So the key is a padlock (the setting is about
 * a LOCKED group) beside a chain: whole when the contents scale with the
 * group, broken when each part keeps its own size. On is filled in the
 * accent, off is plain, so the state reads at a glance the way a tick does;
 * pointing at it says the whole label, the state and what it does.
 *
 * It is still a real `<input type="checkbox">`: the key's whole face, its
 * own tick drawn away (never hidden: a control at zero opacity is not on
 * the screen, `tests/header.mjs`), so a press anywhere on it is a press on
 * the checkbox, the
 * keyboard reaches it, and it carries the sound and the haptic every other
 * control on this bar gives. In More tools (`compact`) there is room, so the
 * words come back beside the icon.
 */
function OptionCheckbox({ setting, label, hint, compact }: { setting: string; label: string; hint: string; compact?: boolean }) {
  const [value, set] = useSetting<boolean>(setting);
  const on = value !== false;
  const Chain = on ? Link2 : Link2Off;
  return (
    <Tooltip content={`${label}: ${on ? "on" : "off"}. ${hint}`}>
      <label
        className={cn(
          "tactile relative flex cursor-pointer select-none items-center gap-0.5 rounded-md border px-1 py-0.5 text-small",
          on ? "border-accent bg-accent-soft text-accent" : "border-border bg-elevated text-fg-muted hover:text-fg",
        )}
      >
        <input
          type="checkbox"
          aria-label={label}
          className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-md bg-transparent"
          checked={on}
          onChange={(e) => { play(e.target.checked ? "toggleOn" : "toggleOff"); haptic(); set(e.target.checked); }}
        />
        <Lock aria-hidden className="pointer-events-none size-3.5 shrink-0" />
        <Chain aria-hidden className="pointer-events-none size-3.5 shrink-0" />
        {compact ? <span className="pointer-events-none ml-1">{label}</span> : null}
      </label>
    </Tooltip>
  );
}

/** The pen's tenant: the ink colour it reads from the store, handed to the row below. */
function InkRow({ compact }: { compact?: boolean }) {
  const inkHue = useStudio((s) => s.inkHue);
  return <DrawKindRow inkHue={inkHue} compact={compact} />;
}

/**
 * ONE COLOUR, AND BESIDE IT WHAT HE IS DRAWING.
 *
 * His words: "in the places of the colors when i pick to draw freehand just
 * make the color stay there but only one button instead of multiple, and
 * when i click the color i can adjust it and beside it the buttons become
 * preselect options for 'button' 'surface' 'icon' or whatever options i can
 * draw".
 *
 * Eight swatches became one button that wears the colour it is set to and
 * opens the eight when pressed; the room they took is now the kinds. The
 * saying-what-a-thing-is moves BEFORE the drawing instead of being asked
 * afterwards — and `part` is still there, so it moves rather than
 * disappearing.
 *
 * Every chip is wired to a path that already exists (`DRAW_KINDS` in the
 * store says which). Button is here now that it is real: a preset kind
 * means coded and pressable the moment it lands. Icon and Cube go with the
 * ink's Make real and with the drawing disc, which says which it is using.
 */
export function DrawKindRow({ inkHue, compact }: { inkHue: number; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const kind = useStudio((st) => st.drawKind);
  return (
    <div data-draw-row="" className={cn("flex items-center gap-1", compact ? "" : "rounded-md border border-border bg-elevated px-1 py-0.5")}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        content={
          /*
           * PRESSING THE COLOUR ADJUSTS IT.
           *
           * "when i click the color i can adjust it" \u2014 and eight swatches is
           * not adjusting, it is choosing from eight. The wheel is the whole
           * wheel, so the colour he wants is reachable whether or not
           * somebody thought of it; the eight stay under it as the quick way
           * back to a colour he has used, which is what they were good for.
           */
          <div data-ink-hues="" className="flex w-[176px] flex-col gap-2">
            <div
              data-ink-wheel=""
              role="slider"
              tabIndex={0}
              aria-label="Ink colour"
              aria-valuemin={0}
              aria-valuemax={359}
              aria-valuenow={Math.round(inkHue)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowLeft" ? -4 : e.key === "ArrowRight" ? 4 : 0;
                if (!step) return;
                e.preventDefault();
                useStudio.getState().setInk({ hue: (Math.round(inkHue) + step + 360) % 360 });
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const pick = (clientX: number) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  useStudio.getState().setInk({ hue: Math.max(0, Math.min(359, Math.round(((clientX - r.left) / Math.max(1, r.width)) * 359))) });
                };
                pick(e.clientX);
                const move = (m: PointerEvent) => pick(m.clientX);
                const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
              className="relative h-5 w-full cursor-ew-resize rounded-sm border border-border"
              style={{ background: "linear-gradient(to right, oklch(0.72 0.16 0), oklch(0.72 0.16 60), oklch(0.72 0.16 120), oklch(0.72 0.16 180), oklch(0.72 0.16 240), oklch(0.72 0.16 300), oklch(0.72 0.16 359))" }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute top-[-2px] h-[22px] w-[3px] rounded-full border border-bg bg-fg"
                style={{ left: `calc(${(inkHue / 359) * 100}% - 1.5px)` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`Ink hue ${h}`}
                  onClick={() => { useStudio.getState().setInk({ hue: h }); setOpen(false); }}
                  className={cn("tactile size-5 rounded-sm border", inkHue === h ? "border-fg" : "border-transparent")}
                  style={{ background: `oklch(0.72 0.16 ${h})` }}
                />
              ))}
            </div>
          </div>
        }
      >
        <button
          type="button"
          data-ink-colour=""
          aria-label="Ink colour"
          title="The colour you draw in. Press to change it."
          className="tactile size-4 shrink-0 rounded-sm border border-fg"
          style={{ background: `oklch(0.72 0.16 ${inkHue})` }}
        />
      </Popover>
      <span className="mx-0.5 h-3.5 w-px bg-border" />
      {DRAW_KINDS.map((k) => (
        <button
          key={k.id}
          type="button"
          data-draw-kind={k.id}
          aria-pressed={kind === k.id}
          title={k.means}
          onClick={() => useStudio.getState().setDrawKind(k.id)}
          className={cn(
            "tactile rounded-sm px-1.5 py-px text-small",
            kind === k.id ? "bg-accent text-on-accent" : "text-fg-muted hover:text-fg",
          )}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

"use client";
/**
 * One element's own colours.
 *
 * The site owns six roles; a part follows them unless it is told otherwise.
 * Here you pick a role on this part and give it either another role ("make
 * this one's background the accent") or a colour of its own. Naming a role is
 * the better answer nine times out of ten: it keeps the part inside the
 * palette, so a later change to the palette carries through.
 *
 * Used by the wheel's Look wedge and by the Inspector, so there is one
 * control, not two that drift apart.
 */
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Tooltip } from "@/core/ui/tooltip";
import { RotateCcw } from "lucide-react";
import { distinctShades, parseColor, toHex, ROLES, ROLE_LABEL, type Palette, type RoleId } from "./look";
import { CHIP } from "./colourMenu";
import type { NodeColour } from "./shelf/run";
import { tryProps } from "./tryLook";

export function effectiveColour(colour: NodeColour | null, palette: Palette, role: RoleId): string {
  const raw = colour?.[role];
  if (!raw) return palette[role];
  if ((ROLES as readonly string[]).includes(raw)) return palette[raw as RoleId];
  return parseColor(raw) ? raw : palette[role];
}

export function ColourOverride({
  colour, palette, onChange, tryFor,
}: {
  colour: NodeColour | null;
  palette: Palette;
  onChange: (next: NodeColour | null) => void;
  /** The part a swatch is tried on while pointed at (tryLook.ts); without it, swatches only set. */
  tryFor?: string;
}) {
  const [role, setRole] = React.useState<RoleId>("bg");
  const current = colour?.[role] ?? "";
  const overridden = Object.entries(colour ?? {}).filter(([, v]) => v).length;
  /* The other roles to borrow, one swatch per shade the eye can tell apart (three near-black inks were three swatches), and never a repeat of the site's own (`distinctShades`). The one it wears now always shows. */
  const choices = distinctShades(ROLES.filter((r) => r !== role), (r) => palette[r], [palette[role]])
    .concat((ROLES as readonly string[]).includes(current) && current !== role ? [current as RoleId] : [])
    .filter((r, i, all) => all.indexOf(r) === i);

  const nextWith = (value: string | null): NodeColour | null => {
    const next: NodeColour = { ...(colour ?? {}) };
    if (value === null) delete next[role];
    else next[role] = value;
    return Object.values(next).some(Boolean) ? next : null;
  };
  const set = (value: string | null) => onChange(nextWith(value));
  /* Pointed at, the part wears the colour on the board; the click sets it. */
  const trying = (value: string | null) => (tryFor ? tryProps(() => ({ patches: { [tryFor]: { colour: nextWith(value) } } }), () => { play("select"); set(value); }) : { onClick: () => { play("select"); set(value); } });

  return (
    <div className="space-y-1.5">
      {/* Which of this part's six roles you are changing. */}
      <div className="grid grid-cols-6 gap-1">
        {ROLES.map((r) => (
          <Tooltip key={r} content={`${ROLE_LABEL[r]}${colour?.[r] ? ", changed" : ", follows the site"}`}>
            <button
              type="button"
              aria-label={`${ROLE_LABEL[r]} on this part`}
              aria-pressed={role === r}
              onClick={() => { play("select"); setRole(r); }}
              // A block, not a chip: it stretches to its column, so it takes
              // the corner from the one definition and its own width from the
              // grid. Forcing a chip's width here would leave five gaps.
              className={cn(
                "relative h-6 border-2 transition-colors",
                role === r ? "border-accent" : "border-border hover:border-border-strong",
              )}
              style={{ borderRadius: CHIP.radius.square, background: effectiveColour(colour, palette, r) }}
            >
              {colour?.[r] ? <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent" /> : null}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* What to set it to: the site again, another role, or a colour. */}
      <div className="flex flex-wrap items-center gap-1">
        {/*
          FOLLOW THE SITE, said as "back to the site's colour": the site's
          swatch with a dashed rim and a turn-back arrow. The folded corner
          it wore read as a slash, and a slash reads as "no colour" (J,
          2026-10-09), which on the words of a part makes no sense at all.
        */}
        <Tooltip content={`Back to the site's ${ROLE_LABEL[role].toLowerCase()}`}>
          <button
            type="button"
            data-follow-site=""
            aria-label={`Follow the site's ${ROLE_LABEL[role]}`}
            {...trying(null)}
            className={cn("tactile flex items-center justify-center border-2 border-dashed", !current ? "border-fg" : "border-border-strong")}
            style={{ width: CHIP.near, height: CHIP.near, borderRadius: CHIP.radius.square, background: palette[role], color: (parseColor(palette[role])?.l ?? 0) > 0.6 ? "#111" : "#fff" }}
          >
            <RotateCcw className="size-3" aria-hidden />
          </button>
        </Tooltip>
        {choices.map((r) => (
          <Tooltip key={r} content={`Use the site's ${ROLE_LABEL[r].toLowerCase()}`}>
            <button
              type="button"
              aria-label={`Use ${ROLE_LABEL[r]}`}
              {...trying(r)}
              className={cn("tactile border-2", current === r ? "border-fg" : "border-transparent")}
              style={{ width: CHIP.near, height: CHIP.near, borderRadius: CHIP.radius.square, background: palette[r] }}
            />
          </Tooltip>
        ))}
        <input
          type="color"
          aria-label={`${ROLE_LABEL[role]} colour`}
          value={toHexish(effectiveColour(colour, palette, role))}
          onChange={(e) => set(e.target.value)}
          className="cursor-pointer border border-border bg-transparent p-0"
          style={{ width: CHIP.near, height: CHIP.near, borderRadius: CHIP.radius.square }}
        />
      </div>

      <p className="text-small leading-snug text-fg-faint">
        {overridden
          ? `${overridden} of six changed on this part. Naming a role keeps it inside the palette.`
          : `${ROLE_LABEL[role]} follows the site. Pick a role above to change it here only.`}
      </p>
    </div>
  );
}

/** `<input type="color">` only understands #rrggbb, so give it something it can show. */
function toHexish(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const c = parseColor(value);
  return c ? toHex(c) : "#888888";
}

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
import { parseColor, toHex, ROLES, ROLE_LABEL, type Palette, type RoleId } from "./look";
import type { NodeColour } from "./parts/theme";

export function effectiveColour(colour: NodeColour | null, palette: Palette, role: RoleId): string {
  const raw = colour?.[role];
  if (!raw) return palette[role];
  if ((ROLES as readonly string[]).includes(raw)) return palette[raw as RoleId];
  return parseColor(raw) ? raw : palette[role];
}

export function ColourOverride({
  colour, palette, onChange,
}: {
  colour: NodeColour | null;
  palette: Palette;
  onChange: (next: NodeColour | null) => void;
}) {
  const [role, setRole] = React.useState<RoleId>("bg");
  const current = colour?.[role] ?? "";
  const overridden = Object.entries(colour ?? {}).filter(([, v]) => v).length;

  const set = (value: string | null) => {
    const next: NodeColour = { ...(colour ?? {}) };
    if (value === null) delete next[role];
    else next[role] = value;
    const any = Object.values(next).some(Boolean);
    onChange(any ? next : null);
  };

  return (
    <div className="space-y-1.5">
      {/* Which of this part's six roles you are changing. */}
      <div className="grid grid-cols-6 gap-1">
        {ROLES.map((r) => (
          <Tooltip key={r} content={`${ROLE_LABEL[r]}${colour?.[r] ? " — changed" : " — follows the site"}`}>
            <button
              type="button"
              aria-label={`${ROLE_LABEL[r]} on this part`}
              aria-pressed={role === r}
              onClick={() => { play("select"); setRole(r); }}
              className={cn(
                "relative h-6 rounded-sm border-2 transition-colors",
                role === r ? "border-accent" : "border-border hover:border-border-strong",
              )}
              style={{ background: effectiveColour(colour, palette, r) }}
            >
              {colour?.[r] ? <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent" /> : null}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* What to set it to: the site again, another role, or a colour. */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => { play("select"); set(null); }}
          className={cn(
            "tactile rounded-sm border px-1.5 py-0.5 text-[10px]",
            !current ? "border-fg text-fg" : "border-border text-fg-muted hover:text-fg",
          )}
        >
          Site
        </button>
        {ROLES.filter((r) => r !== role).map((r) => (
          <Tooltip key={r} content={`Use the site's ${ROLE_LABEL[r].toLowerCase()}`}>
            <button
              type="button"
              aria-label={`Use ${ROLE_LABEL[r]}`}
              onClick={() => { play("select"); set(r); }}
              className={cn("tactile size-5 rounded-sm border-2", current === r ? "border-fg" : "border-transparent")}
              style={{ background: palette[r] }}
            />
          </Tooltip>
        ))}
        <input
          type="color"
          aria-label={`${ROLE_LABEL[role]} colour`}
          value={toHexish(effectiveColour(colour, palette, role))}
          onChange={(e) => set(e.target.value)}
          className="size-5 cursor-pointer rounded-sm border border-border bg-transparent p-0"
        />
      </div>

      <p className="text-[10px] leading-snug text-fg-faint">
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

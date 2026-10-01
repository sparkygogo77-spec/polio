"use client";
/**
 * The site's own styles for the picked part: the kits its buttons, cards,
 * panels and badges wear (styleKits.ts), each shown as a swatch dressed in
 * it. Pointing at one dresses the part in it on the board (tryLook.ts);
 * pointing away takes it off; a click puts it on, as one undo step.
 *
 * A kit dresses the part's fill, outline, shadow, light, corners, type and
 * hover and press (kitLook.ts); its size, words and place are its own.
 */
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import type { StudioNode } from "./store";
import { roleOf, type KitNode, type StyleKit } from "./styleKits";
import { useBoardKits } from "./DrawKits";
import { lookOfKit } from "./kitLook";
import { lookPatch, type Facet } from "./partLook";
import { pasteLook } from "./partLookApply";
import { tryProps } from "./tryLook";

/** What a kit carries onto a part: all of its look but motion, which a kit does not hold. */
export const KIT_FACETS: Facet[] = ["fill", "outline", "shadow", "light", "corners", "font", "hover"];
const MOST = 8;

export function KitStyles({ node }: { node: StudioNode }) {
  const { here } = useBoardKits(true);
  const role = roleOf(node as unknown as KitNode);
  const kits = React.useMemo(() => {
    const mine = role ? here.filter((k) => k.role === role) : here;
    return (mine.length ? mine : here).slice(0, MOST);
  }, [here, role]);
  if (!kits.length) return <div className="text-small text-fg-muted">This site has no styles of its own yet.</div>;
  const button = node.featureId === "cta-primary";
  return (
    <div data-kit-styles="" className="flex flex-wrap gap-1.5">
      {kits.map((k) => {
        const look = lookOfKit(k, { button });
        return (
          <button key={k.id} type="button" data-kit-style={k.id} aria-label={`Wear ${k.name}`} title={k.name}
            className="tactile flex h-8 w-14 items-center justify-center overflow-hidden"
            {...tryProps(
              () => ({ patches: { [node.id]: lookPatch(node as never, look, KIT_FACETS) }, what: k.name }),
              () => { const n = pasteLook([node.id], look, KIT_FACETS); play(n ? "confirm" : "deny"); },
            )}>
            <KitSwatch kit={k} />
          </button>
        );
      })}
    </div>
  );
}

/** A kit drawn small: its fill, edge, corners, shadow and type, on a swatch. */
export function KitSwatch({ kit, className }: { kit: StyleKit; className?: string }) {
  const f = kit.fill;
  const bg = f.kind === "none" ? "transparent" : f.stops?.length && f.kind !== "solid"
    ? `linear-gradient(${Math.round(f.angle ?? 180)}deg, ${f.stops.map((s) => s.colour).join(", ")})`
    : f.colour;
  const scale = Math.min(1, 26 / Math.max(1, kit.size.h));
  const shadow = kit.shadows.slice(0, 2).map((s) => `${s.dx * scale}px ${s.dy * scale}px ${s.hard ? 0 : s.blur * scale}px ${s.colour}`).join(", ");
  return (
    <span className={cn("flex h-6 w-12 items-center justify-center text-[9px] leading-none", className)} style={{
      background: bg,
      border: kit.border && kit.border.width > 0 ? `${Math.max(1, Math.round(kit.border.width * scale))}px ${kit.border.style || "solid"} ${kit.border.colour}` : undefined,
      borderRadius: Math.min(12, kit.radius * scale),
      boxShadow: shadow || undefined,
      color: kit.text?.colour,
      fontFamily: kit.text?.stack ?? (kit.text?.face ? `'${kit.text.face}'` : undefined),
      fontWeight: kit.text?.weight,
    }}>Aa</span>
  );
}

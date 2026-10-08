"use client";
/**
 * The site's own styles for the picked part: the kits its buttons, cards,
 * panels and badges wear (styleKits.ts), each shown as a swatch dressed in
 * it. Pointing at one dresses the part in it on the board (tryLook.ts);
 * pointing away takes it off; a click puts it on, as one undo step.
 *
 * Under them, the styles learned from every other site you imported
 * (library/learned.ts) and the other boards' own, for the same kind of part.
 *
 * A kit dresses the part's fill, outline, shadow, light, corners, type and
 * hover and press (kitLook.ts); its size, words and place are its own.
 */
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import type { StudioNode } from "./board/store";
import { roleOf, type KitNode, type StyleKit } from "./look";
import { useBoardKits } from "./DrawKits";
import { lookOfKit } from "./look/parts";
import { lookPatch, type Facet } from "./look/parts";
import { pasteLook } from "./look/ui";
import { tryProps } from "./tryLook";
import { useLearned } from "./shelf/ui";

/** What a kit carries onto a part: all of its look but motion, which a kit does not hold. */
export const KIT_FACETS: Facet[] = ["fill", "outline", "shadow", "light", "corners", "font", "hover"];
const MOST = 8;

export function KitStyles({ node }: { node: StudioNode }) {
  const { here, elsewhere } = useBoardKits(true);
  const lib = useLearned((s) => s.lib);
  const role = roleOf(node as unknown as KitNode);
  const kits = React.useMemo(() => {
    const mine = role ? here.filter((k) => k.role === role) : here;
    return (mine.length ? mine : here).slice(0, MOST);
  }, [here, role]);
  /* And every other site's, learned on import (library/learned.ts): builder-wide, so a style from any site is on every board. */
  const learned = React.useMemo(() => {
    const hereHost = here[0]?.host ?? null;
    const fromLib = Object.values(lib.sites).filter((l) => l.host !== hereHost)
      .flatMap((l) => l.kits.filter((k) => !role || k.role === role).slice(0, 3).map((k) => ({ k, site: l.name })));
    /* And the other boards' own (once "Button looks from your sites" under Effects), one list, each style once. */
    const fromBoards = elsewhere.flatMap((e) => e.kits.filter((k) => k.host !== hereHost && (!role || k.role === role)).slice(0, 3).map((k) => ({ k, site: e.site })));
    const seen = new Set<string>();
    return [...fromLib, ...fromBoards].filter(({ k }) => { const key = `${k.host}:${k.id}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, MOST);
  }, [lib, here, elsewhere, role]);
  if (!kits.length && !learned.length) return <div className="text-small text-fg-muted">This site has no styles of its own yet.</div>;
  const button = node.featureId === "cta-primary";
  const swatch = (k: StyleKit, title: string, from: "here" | "learned") => {
    const look = lookOfKit(k, { button });
    return (
      <button key={`${from}:${k.host}:${k.id}`} type="button" data-kit-style={k.id} data-kit-from={from} aria-label={`Wear ${title}`} title={title}
        className="tactile flex h-8 w-14 items-center justify-center overflow-hidden"
        {...tryProps(
          () => ({ patches: { [node.id]: lookPatch(node as never, look, KIT_FACETS) }, what: title }),
          () => { const n = pasteLook([node.id], look, KIT_FACETS); play(n ? "confirm" : "deny"); },
        )}>
        <KitSwatch kit={k} />
      </button>
    );
  };
  return (
    <div className="space-y-1.5">
      {kits.length ? <div data-kit-styles="" className="flex flex-wrap gap-1.5">{kits.map((k) => swatch(k, k.name, "here"))}</div> : null}
      {learned.length ? (
        <div data-kit-styles-learned="" className="space-y-1">
          <div className="text-fine text-fg-faint">From your other sites</div>
          <div className="flex flex-wrap gap-1.5">{learned.map(({ k, site }) => swatch(k, `${k.name}, ${site}`, "learned"))}</div>
        </div>
      ) : null}
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
    <span className={cn("flex h-6 w-12 items-center justify-center text-fine leading-none", className)} style={{
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

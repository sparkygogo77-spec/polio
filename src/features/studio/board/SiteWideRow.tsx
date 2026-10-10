"use client";
/**
 * THE WHOLE-SITE EFFECTS, AS CHIPS OVER THE PAGE.
 *
 * A whole-site effect (smooth scrolling, a progress bar, back to top, a
 * cursor, parts appearing as they scroll in) changes how the page moves and
 * takes no room in it. Dropped on the board it used to stand on the page as
 * a dark sketch box of its own, over whatever panel was there, and made the
 * page longer (J, 2026-10-10). Now it sits in the page's own caption, beside
 * its name and size: one chip per effect. A press picks it, so the side panel
 * shows its settings (Strength, Style); the × turns it off for the whole site.
 */
import { useStudio, type StudioNode } from "./store";
import { getFeature } from "../shelf";
import { setSwitch } from "../ShelfCards";
import { switchOf } from "../shelfFacts";
import { play } from "@/core/audio/engine";

export function SiteWideRow({ nodes, selection }: { nodes: StudioNode[]; selection: readonly string[] }) {
  if (!nodes.length) return null;
  const off = (n: StudioNode) => {
    if (switchOf(n.featureId)) { setSwitch(n.featureId, false); return; }
    const st = useStudio.getState();
    st.removeNodes([n.id]);
    play("close");
  };
  return (
    <span data-site-wide="" className="pointer-events-auto flex items-center gap-1">
      <span aria-hidden>·</span>
      <span>Whole site</span>
      {nodes.map((n) => {
        const picked = selection.includes(n.id);
        const dim = n.options?.off === "yes";
        return (
          <span
            key={n.id}
            data-site-wide-chip={n.featureId}
            data-selected={picked ? "" : undefined}
            role="button"
            tabIndex={0}
            title="Runs on the whole page. Press to set it up."
            className="inline-flex cursor-pointer items-center gap-1 rounded-full px-[0.6em] font-medium"
            style={{
              background: picked ? "var(--accent)" : "var(--accent-soft)",
              color: picked ? "oklch(0.99 0 0)" : "var(--fg)",
              opacity: dim ? 0.55 : 1,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              useStudio.getState().setSelection([n.id]);
              play("select");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); useStudio.getState().setSelection([n.id]); }
            }}
          >
            {getFeature(n.featureId)?.name ?? n.label}
            <span
              role="button"
              aria-label={`Turn off ${getFeature(n.featureId)?.name ?? n.label}`}
              data-site-wide-off=""
              className="opacity-70 hover:opacity-100"
              onPointerDown={(e) => { e.stopPropagation(); off(n); }}
            >
              ×
            </span>
          </span>
        );
      })}
    </span>
  );
}

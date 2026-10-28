"use client";
/**
 * THE SYSTEM TAB: the site's tokens and components in one place
 * (handovers/CREATE-SYSTEM-PROPOSAL.md (c), approved by J 2026-10-23).
 *
 *   SYSTEM                         [Take from this site] [New]
 *   COLOURS · TYPE · SPACE AND SHAPE · MOTION · COMPONENTS
 *
 * Everything it changes goes through `system/api.ts`: one undo step each,
 * reaching the shared library and so every site using the System. Opening
 * the tab changes nothing; neither does reading a take before "Take it".
 * Pressing a "used by" count lights those parts on the board.
 *
 * The rows are in `panels/system/`: tokens (`tokens.tsx`), the take and the
 * library picker (`take.tsx`), the picked part's links with "Change just
 * this one" (`picked.tsx`), and the component editor (`components.tsx`).
 */
import * as React from "react";
import { useStudio } from "../board/store";
import { useSiteSystem } from "../system/api";
import { PanelSection } from "./PartTreePanel";
import { ColourTokens, MotionTokens, ShapeTokens, TypeTokens } from "./system/tokens";
import { SystemBar } from "./system/take";
import { PickedPart } from "./system/picked";
import { ComponentEditor, ComponentList } from "./system/components";
import { light } from "./system/values";
import { useOpenAsk } from "./system/open";

export function SystemPanel() {
  const { system, counts } = useSiteSystem();
  const [open, setOpen] = React.useState<string | null>(null);
  const [variant, setVariant] = React.useState<string | null>(null);
  const onePicked = useStudio((s) => s.selection.length === 1);
  /* The light goes out with the tab. */
  React.useEffect(() => () => light(null, null), []);
  const { ask, taken } = useOpenAsk();
  React.useEffect(() => { if (!ask) { setOpen(null); setVariant(null); } }, [system?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* "Edit the component" from the Element panel: this component, on that variant. */
  React.useEffect(() => {
    if (!ask || !system) return;
    setOpen(ask.component);
    setVariant(ask.variant);
    taken();
  }, [ask, system]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-system-panel={system?.id ?? ""} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
      <SystemBar system={system} />
      {!system ? (
        <p data-system-none="" className="text-small text-fg-muted">
          This site has no System yet, and there is no house style. Take one from the site: its colours, type, space, corners, shadows, motion and components, with nothing on the board moved.
        </p>
      ) : open ? (
        <ComponentEditor key={open} s={system} id={open} variant={variant} onBack={() => { setOpen(null); setVariant(null); }} />
      ) : (
        <>
          {onePicked ? <PanelSection id="system-picked" title="Picked part"><PickedPart system={system} /></PanelSection> : null}
          <PanelSection id="system-colours" title="Colours"><ColourTokens s={system} counts={counts} /></PanelSection>
          <PanelSection id="system-type" title="Type"><TypeTokens s={system} counts={counts} /></PanelSection>
          <PanelSection id="system-shape" title="Space and shape"><ShapeTokens s={system} counts={counts} /></PanelSection>
          <PanelSection id="system-motion" title="Motion"><MotionTokens s={system} counts={counts} /></PanelSection>
          <PanelSection id="system-components" title="Components"><ComponentList s={system} onOpen={(id) => { setVariant(null); setOpen(id); }} /></PanelSection>
        </>
      )}
    </div>
  );
}

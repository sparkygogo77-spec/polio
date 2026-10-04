"use client";
/**
 * THE PICTURES TAB: the drawing tool, on a tab of its own.
 *
 * HIS WORDS: "its pretty convoluted, give the ai image generator its own
 * section/display panel option instead of being at the bottom of element".
 *
 * It had gone inside each part's "Make a picture", folded at the foot of the
 * Element tab under the route's eleven options, so with nothing picked it was
 * nowhere at all and he thought it had been taken away. Here it is always
 * one press away. Picked or not, it draws, and a drawing drags onto the page
 * at its own size; with one part picked, "Put it on this part" puts it there.
 *
 * The part's own route (which model a picture of it is sent to) stays in the
 * part's "Make a picture": that is a setting of the part, not the tool.
 */
import { useShallow } from "zustand/react/shallow";
import { getFeature } from "./catalog";
import { partName } from "./partNames";
import { RenderPanel } from "./RenderPanel";
import { useStudio } from "./store";

const featureName = (id: string) => getFeature(id)?.name;

export function PicturesPanel() {
  const { single, nodes } = useStudio(useShallow((s) => ({
    single: s.selection.length === 1 ? s.nodes.find((n) => n.id === s.selection[0]) ?? null : null,
    nodes: s.nodes,
  })));
  return (
    <div data-pictures-panel="" className="flex flex-col">
      <p data-pictures-for={single?.id ?? ""} className="px-3 pt-3 text-small leading-relaxed text-fg-muted">
        {single
          ? <>Draws for <span className="text-fg">{partName(single, nodes, featureName)}</span>: put a drawing on it, or drag one onto the page.</>
          : "Drag a drawing onto the page to place it at its own size. Pick a part first to put a drawing on it."}
      </p>
      <RenderPanel forNode={single?.id} />
    </div>
  );
}

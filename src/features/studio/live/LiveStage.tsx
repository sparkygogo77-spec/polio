"use client";
/**
 * The live site, fitted to whatever space it is given.
 *
 * Used in two places that should feel identical: the board when you flip the
 * switch to Preview, and the full-size /builder/preview address. Neither one
 * moves the page around you — the site appears where the frame was.
 */
import * as React from "react";
import { ctxProps } from "@/core/context-menu/ctx";
import { useStudio } from "../store";
import { DEVICE_WIDTH, placeNodes, type Device } from "./layout";
import { LiveSite } from "./LiveSite";

export function LiveStage({
  device,
  pageId,
  onNavigatePage,
  onScale,
  padding = 16,
}: {
  device: Device;
  pageId: string;
  onNavigatePage: (id: string) => void;
  onScale?: (scale: number) => void;
  padding?: number;
}) {
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const frameWidth = useStudio((s) => s.frameWidth);

  const ref = React.useRef<HTMLDivElement>(null);
  const [avail, setAvail] = React.useState({ w: 1440, h: 900 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = device === "desktop" ? frameWidth : DEVICE_WIDTH[device];
  const { height } = React.useMemo(
    () => placeNodes(nodes.filter((n) => n.pageId === pageId), device, frameWidth),
    [nodes, pageId, device, frameWidth],
  );
  const scale = Math.min(1, (avail.w - padding * 2) / width);
  React.useEffect(() => onScale?.(scale), [scale, onScale]);

  return (
    <div ref={ref} data-live-scroller="" className="no-bars h-full w-full overflow-auto" {...ctxProps("studio-live", pageId, { pageId, device })}>
      <div style={{ width: width * scale, height: height * scale, margin: `${padding}px auto`, position: "relative" }}>
        <div style={{ width, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <LiveSite
            pages={pages}
            nodes={nodes}
            pageId={pageId}
            device={device}
            frameWidth={frameWidth}
            format={format}
            look={look}
            onNavigatePage={onNavigatePage}
            /*
             * A cube turned in Preview stays turned. The board is a still
             * frame by the parts' own rule, so this is where anyone actually
             * turns one, and the angle they left it at belongs on the node
             * rather than dying with the preview.
             */
            onEvent={(e, nodeId) => { if (e.type === "cube" && nodeId) useStudio.getState().setCubeTurn(nodeId, e.turn); }}
            nodeProps={(n) => ctxProps("studio-live-node", n.id, n)}
          />
        </div>
      </div>
    </div>
  );
}

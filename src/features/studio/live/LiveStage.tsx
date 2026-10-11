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
import { useStudio } from "../board/store";
import { DEVICE_WIDTH, placeNodes, type Device } from "./layout";
import { LiveSite } from "./LiveSite";
import { isCaptured } from "../fluidSite";
import { previewWindow } from "./previewWindow";

/**
 * A cube or a solid turned in Preview stays turned. The board is a still
 * frame by the parts' own rule, so this is where anyone actually turns one,
 * and the angle they left it at belongs on the node rather than dying with
 * the preview. Only the cube's was kept, and only on the board's own
 * Preview; the full /builder/preview page kept neither.
 */
export function keepTurn(e: { type: string; turn?: { x: number; y: number } }, nodeId: string | undefined): void {
  if (!nodeId || !e.turn) return;
  if (e.type === "cube") useStudio.getState().setCubeTurn(nodeId, e.turn);
  if (e.type === "mesh") useStudio.getState().setMeshTurn(nodeId, e.turn);
}

export function LiveStage({
  device: startDevice,
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
  const shapes = useStudio((s) => s.shapes);
  const siteName = useStudio((s) => s.brief.name);
  const frameWidth = useStudio((s) => s.frameWidth);

  const ref = React.useRef<HTMLDivElement>(null);
  const [avail, setAvail] = React.useState({ w: 1440, h: 900 });

  /*
   * The device is the stage's own once it is up. The right-click menu's
   * Device entries call one window hook, and only the /builder/preview page
   * installed it, so on the board's own Preview they called nothing. The
   * stage installs it now, wherever it is mounted; the page's own copy is
   * the same hook and is never mounted at the same time.
   */
  const [device, setDevice] = React.useState<Device>(startDevice);
  React.useEffect(() => setDevice(startDevice), [startDevice]);
  const windowed = device === "desktop" && nodes.some((n) => n.pageId === pageId && isCaptured(n));
  React.useEffect(() => {
    const w = window as unknown as { __studioLiveDevice?: (d: string) => void };
    w.__studioLiveDevice = (d) => { if (d === "desktop" || d in DEVICE_WIDTH) setDevice(d as Device); };
    return () => { delete w.__studioLiveDevice; };
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    /* The window view and the frame are two scrollers: measured again when the view changes. */
  }, [windowed]);

  const width = device === "desktop" ? frameWidth : DEVICE_WIDTH[device];
  const { height } = React.useMemo(
    () => placeNodes(nodes.filter((n) => n.pageId === pageId), device, frameWidth),
    [nodes, pageId, device, frameWidth],
  );
  /*
   * A BROUGHT-IN PAGE IS SHOWN AS THE WINDOW SHOWS IT (J, 2026-10-11: "Preview
   * must look and behave exactly like the live site"). The board's Preview
   * drew a captured page in a scaled frame that scrolled as one: a part the
   * page fixes to the window (or a rail that sticks the whole way down) went
   * up the view with everything else, and its clock and nameplate floated
   * mid-page. On the desktop it now opens as /builder/preview's window view
   * does (`previewWindow.ts`): 1:1 at the pane's width, re-anchored by the
   * export's own rules, inside a box that does not scroll and carries a
   * transform, so what is fixed is fixed to the Preview's view and what is
   * sticky sticks to what scrolls. `tests/preview-pins.mjs`.
   */
  const stretch = windowed;
  const site = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (stretch && site.current) previewWindow(site.current, pageId, nodes, frameWidth);
  }, [stretch, nodes, pageId, frameWidth, avail.w, avail.h]);
  const scale = stretch ? 1 : Math.min(1, (avail.w - padding * 2) / width);
  React.useEffect(() => onScale?.(scale), [scale, onScale]);

  if (stretch) {
    return (
      <div className="relative h-full w-full" style={{ transform: "translateZ(0)", overflow: "hidden" }}>
        <div ref={ref} data-live-scroller="" data-live-view="window" className="no-bars absolute inset-0 overflow-auto" {...ctxProps("studio-live", pageId, { pageId, device })}>
          <div ref={site} style={{ width: "100%", minWidth: Math.min(frameWidth, 1280), position: "relative", "--pv-vh": `${avail.h / 100}px`, "--pv-vw": `${avail.w / 100}px` } as React.CSSProperties}>
            {/* A new page for each view: what the window view writes onto the parts is not React's, and must not outlive it. */}
            <div key="window" style={{ width: "100%" }}>
              <LiveSite
                features
                pages={pages}
                nodes={nodes}
                pageId={pageId}
                device={device}
                frameWidth={frameWidth}
                format={format}
                look={look}
                siteName={siteName}
                shapes={shapes}
                onNavigatePage={onNavigatePage}
                onEvent={(e, nodeId) => keepTurn(e, nodeId)}
                nodeProps={(n) => ctxProps("studio-live-node", n.id, n)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} data-live-scroller="" className="no-bars h-full w-full overflow-auto" {...ctxProps("studio-live", pageId, { pageId, device })}>
      <div style={{ width: width * scale, height: height * scale, margin: `${padding}px auto`, position: "relative" }}>
        <div key="frame" style={{ width, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <LiveSite
            features
            pages={pages}
            nodes={nodes}
            pageId={pageId}
            device={device}
            frameWidth={frameWidth}
            format={format}
            look={look}
            siteName={siteName}
            shapes={shapes}
            onNavigatePage={onNavigatePage}
            /*
             * A cube turned in Preview stays turned. The board is a still
             * frame by the parts' own rule, so this is where anyone actually
             * turns one, and the angle they left it at belongs on the node
             * rather than dying with the preview.
             */
            onEvent={(e, nodeId) => keepTurn(e, nodeId)}
            nodeProps={(n) => ctxProps("studio-live-node", n.id, n)}
          />
        </div>
      </div>
    </div>
  );
}

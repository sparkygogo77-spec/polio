"use client";
/**
 * The live preview at full size: /builder/preview and /builder/preview/<page>.
 *
 * A route rather than a dialog so the browser scrolls, the page path is the
 * URL, and nothing fights the site's own keyboard handling. This is the same
 * runtime shape a generated site has: pages → LiveSite.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Maximize, Monitor, Smartphone, Tablet } from "lucide-react";
import type { RouteProps } from "@/core/types";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";
import { livePath, useStudio, useStudioHydration } from "../board/store";
import { DEVICE_WIDTH, placeNodes, type Device } from "./layout";
import { LiveSite } from "./LiveSite";
import { keepTurn } from "./LiveStage";
import { homeOf } from "../homePage";
import { isCaptured } from "../fluidSite";
import { previewWindow } from "./previewWindow";

const trim = (s: string) => s.replace(/^\/+|\/+$/g, "");

export function PreviewPage({ params, published }: RouteProps & { published?: boolean }) {
  useStudioHydration();
  const router = useRouter();
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  // The look is the document too. Without it this route drew every published
  // page in the palette derived from the accent hue — the board, the pinned
  // preview and the site all disagreed, and a site designed near-black and
  // acid green arrived in the template's purple.
  const look = useStudio((s) => s.look);
  const shapes = useStudio((s) => s.shapes);
  const siteName = useStudio((s) => s.brief.name);
  const frameWidth = useStudio((s) => s.frameWidth);

  const rest = trim(params["*"] ?? "");
  /* "/" is Home, the same Home the export writes as index.html (homePage.ts). */
  const page = (rest ? pages.find((p) => trim(p.path) === rest) : homeOf(pages)) ?? homeOf(pages)!;

  /*
   * What the page is shown in. The window by default (`previewWindow.ts`):
   * the page 1:1 at the Preview's own size, as the published page opens. A
   * frame is a desktop that is narrower than the site's, so a site drawn for
   * a phone opens at the phone's width. The device widths are the others.
   */
  const [device, setDevice] = React.useState<Device | "window">(() => (frameWidth <= DEVICE_WIDTH.phone ? "phone" : frameWidth <= DEVICE_WIDTH.tablet ? "tablet" : "window"));
  const ref = React.useRef<HTMLDivElement>(null);
  const [avail, setAvail] = React.useState(1600);
  const [room, setRoom] = React.useState({ w: 1600, h: 900 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { setAvail(el.clientWidth); setRoom({ w: el.clientWidth, h: el.clientHeight }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lets the right-click menu switch device.
  React.useEffect(() => {
    const w = window as unknown as { __studioLiveDevice?: (d: string) => void };
    w.__studioLiveDevice = (d) => setDevice(d as Device | "window");
    return () => {
      delete w.__studioLiveDevice;
    };
  }, []);

  const inWindow = device === "window";
  const drawn: Device = inWindow ? "desktop" : device;
  const captured = React.useMemo(() => nodes.some(isCaptured), [nodes]);
  const width = drawn === "desktop" ? frameWidth : DEVICE_WIDTH[drawn];
  /* In the window a captured page is 1:1 and stretches (below); one built by hand fills the width, as its published page does (`frameCss`). */
  const scale = inWindow ? (captured ? 1 : Math.max(0.05, avail / width)) : Math.min(1, (avail - 32) / width);
  const { height } = React.useMemo(() => placeNodes(nodes.filter((n) => n.pageId === page.id), drawn, frameWidth), [nodes, page.id, drawn, frameWidth]);
  /* The captured page, re-anchored as published once it is drawn, and again whenever it is drawn anew or the window changes. */
  const stretch = inWindow && captured;
  const site = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (stretch && site.current) previewWindow(site.current, page.id, nodes, frameWidth);
  }, [stretch, nodes, page.id, frameWidth, room.w, room.h]);

  // Opened *at* a part — from the wheel's tray — the page scrolls to it and
  // lets it play its entrance in view. The hash is the part's id.
  React.useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!id) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-live-node="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 350);
    return () => window.clearTimeout(t);
  }, [page.id]);

  const goPage = React.useCallback(
    (id: string) => {
      play("navigate");
      /* On /site a page link is the visitor's, and stays on /site. */
      router.push(livePath(id, published ? "/site" : undefined));
    },
    [router, published],
  );

  return (
    <div data-live-column="" className="flex h-[calc(100dvh-var(--topbar-h))] min-w-0 flex-col overflow-hidden">
      <div data-live-bar="" className={cn("flex shrink-0 items-center gap-1 border-b border-border bg-panel/60 px-2 py-1.5", published && "hidden")}>
        <Tooltip content="Back to the board" shortcut="b">
          <Button variant="ghost" size="xs" aria-label="Back to board" onClick={() => router.push("/builder")}>
            <ArrowLeft />
            Board
          </Button>
        </Tooltip>
        <span className="mx-1 h-4 w-px bg-border" />
        <nav aria-label="Pages" className="flex min-w-0 items-center gap-1 overflow-x-auto hide-scrollbar">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={p.id === page.id ? "page" : undefined}
              onClick={() => goPage(p.id)}
              className={cn("tactile shrink-0 rounded-md px-2 py-1 text-plain", p.id === page.id ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
            >
              {p.name}
            </button>
          ))}
        </nav>
        <span className="flex-1" />
        <Segmented
          size="xs"
          value={device}
          onChange={(v) => setDevice(v as Device)}
          options={[
            { value: "window", label: "Window", icon: <Maximize /> },
            { value: "desktop", label: "Desktop", icon: <Monitor /> },
            { value: "tablet", label: "Tablet", icon: <Tablet /> },
            { value: "phone", label: "Phone", icon: <Smartphone /> },
          ]}
          aria-label="Preview device"
        />
        <span className="num ml-2 w-10 text-right text-small text-fg-muted">{Math.round(scale * 100)}%</span>
      </div>

      {/*
        The wrapper does not scroll and carries a transform, so a band the
        page fixes to the window is fixed to the Preview's own view (not the
        Builder's), and stays there as the page scrolls under it.
      */}
      <div className="relative min-h-0 flex-1" style={stretch ? { transform: "translateZ(0)", overflow: "hidden" } : undefined}>
      <div ref={ref} data-live-scroller="" data-live-view={device} className={cn("overflow-auto", stretch ? "absolute inset-0 [scrollbar-width:none]" : "h-full")} {...ctxProps("studio-live", page.id, { pageId: page.id, device: drawn })}>
        <div
          ref={site}
          style={stretch
            ? ({ width: "100%", minWidth: Math.min(frameWidth, 1280), position: "relative", "--pv-vh": `${room.h / 100}px`, "--pv-vw": `${room.w / 100}px` } as React.CSSProperties)
            : { width: width * scale, ...(drawn === "desktop" ? { height: height * scale } : null), margin: inWindow ? 0 : "16px auto", position: "relative" }}
        >
          {/* A new page for each view: what the window view writes onto the parts is not React's, and must not outlive it. */}
          <div key={stretch ? "window" : "frame"} style={stretch ? { width: "100%" } : drawn === "desktop" ? { width, transform: `scale(${scale})`, transformOrigin: "0 0" } : { width, zoom: scale }}>
            <LiveSite
              features
              visitor={published}
              pages={pages}
              nodes={nodes}
              pageId={page.id}
              device={drawn}
              frameWidth={frameWidth}
              format={format}
              look={look}
              siteName={siteName}
              shapes={shapes}
              onNavigatePage={goPage}
              onEvent={(e, nodeId) => keepTurn(e, nodeId)}
              nodeProps={(n) => ctxProps("studio-live-node", n.id, n)}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

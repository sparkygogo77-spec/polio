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
import { ArrowLeft, Monitor, Smartphone, Tablet } from "lucide-react";
import type { RouteProps } from "@/core/types";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";
import { livePath, useStudio, useStudioHydration } from "../store";
import { DEVICE_WIDTH, placeNodes, type Device } from "./layout";
import { LiveSite } from "./LiveSite";

const trim = (s: string) => s.replace(/^\/+|\/+$/g, "");

export function PreviewPage({ params, published }: RouteProps & { published?: boolean }) {
  useStudioHydration();
  const router = useRouter();
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const frameWidth = useStudio((s) => s.frameWidth);

  const rest = trim(params["*"] ?? "");
  const page = pages.find((p) => trim(p.path) === rest) ?? pages[0]!;

  const [device, setDevice] = React.useState<Device>(() => (frameWidth <= DEVICE_WIDTH.phone ? "phone" : frameWidth <= DEVICE_WIDTH.tablet ? "tablet" : "desktop"));
  const ref = React.useRef<HTMLDivElement>(null);
  const [avail, setAvail] = React.useState(1600);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lets the right-click menu switch device.
  React.useEffect(() => {
    const w = window as unknown as { __studioLiveDevice?: (d: string) => void };
    w.__studioLiveDevice = (d) => setDevice(d as Device);
    return () => {
      delete w.__studioLiveDevice;
    };
  }, []);

  const width = device === "desktop" ? frameWidth : DEVICE_WIDTH[device];
  const scale = Math.min(1, (avail - 32) / width);
  const { height } = React.useMemo(() => placeNodes(nodes.filter((n) => n.pageId === page.id), device, frameWidth), [nodes, page.id, device, frameWidth]);

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
      router.push(livePath(id));
    },
    [router],
  );

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-h)-var(--statusbar-h))] min-w-0 flex-col overflow-hidden">
      <div className={cn("flex shrink-0 items-center gap-1 border-b border-border bg-panel/60 px-2 py-1.5", published && "hidden")}>
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
              className={cn("tactile shrink-0 rounded-md px-2 py-1 text-[11px]", p.id === page.id ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
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
            { value: "desktop", label: "Desktop", icon: <Monitor /> },
            { value: "tablet", label: "Tablet", icon: <Tablet /> },
            { value: "phone", label: "Phone", icon: <Smartphone /> },
          ]}
          aria-label="Preview device"
        />
        <span className="num ml-2 w-10 text-right text-[10px] text-fg-muted">{Math.round(scale * 100)}%</span>
      </div>

      <div ref={ref} data-live-scroller="" className="min-h-0 flex-1 overflow-auto" {...ctxProps("studio-live", page.id, { pageId: page.id, device })}>
        <div style={{ width: width * scale, height: height * scale, margin: "16px auto", position: "relative" }}>
          <div style={{ width, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <LiveSite
              pages={pages}
              nodes={nodes}
              pageId={page.id}
              device={device}
              frameWidth={frameWidth}
              format={format}
              onNavigatePage={goPage}
              nodeProps={(n) => ctxProps("studio-live-node", n.id, n)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

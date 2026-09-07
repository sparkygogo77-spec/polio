"use client";
/**
 * One page of the site, live. Props only — the pinned preview window and the
 * full-size preview route both render this, and it is the shape Stage 5's
 * generated runtime takes.
 */
import * as React from "react";
import { Block } from "../blocks";
import type { FormatValues } from "../format";
import { themeFrom, type NodeLink, type PartEvent } from "../parts";
import { resolvePalette } from "../parts/theme";
import { auraShadow, type Look } from "../look";
import type { StudioNode, StudioPage } from "../store";
import { deriveBehaviours } from "./behaviours";
import { LiveShell } from "./LiveShell";
import { placeNodes, type Device } from "./layout";

export interface LiveSiteProps {
  pages: StudioPage[];
  nodes: StudioNode[];
  pageId: string;
  device: Device;
  frameWidth: number;
  format: FormatValues;
  look?: Look;
  onNavigatePage?: (pageId: string) => void;
  onEvent?: (e: PartEvent) => void;
  /** Extra props for each part's wrapper (the builder hangs its right-click scope here). */
  nodeProps?: (node: StudioNode) => Record<string, unknown>;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A link's page target may be an id, a path, or a name someone typed in a nav bar. */
export function resolvePageLink(pages: StudioPage[], target: string): StudioPage | null {
  const t = target.trim();
  if (!t) return null;
  return (
    pages.find((p) => p.id === t) ??
    pages.find((p) => p.path === t || p.path === "/" + slug(t)) ??
    pages.find((p) => p.name.toLowerCase() === t.toLowerCase()) ??
    (t.toLowerCase() === "home" || t === "/" ? pages[0] ?? null : null)
  );
}

interface Toast { id: number; text: string; level: string }

export function LiveSite({ pages, nodes, pageId, device, frameWidth, format, look, onNavigatePage, onEvent, nodeProps }: LiveSiteProps) {
  const t = React.useMemo(() => themeFrom(format, look), [format, look]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const light = look?.light;
  const pageNodes = React.useMemo(() => nodes.filter((n) => n.pageId === pageId), [nodes, pageId]);
  const { width, height, placed } = React.useMemo(() => placeNodes(pageNodes, device, frameWidth), [pageNodes, device, frameWidth]);
  const behaviours = React.useMemo(() => deriveBehaviours(pageNodes), [pageNodes]);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const seq = React.useRef(0);

  const emit = React.useCallback(
    (e: PartEvent) => {
      onEvent?.(e);
      if (e.type === "success") window.dispatchEvent(new CustomEvent("builder:success"));
      const text = e.type === "toast" ? e.text : e.type === "success" ? "Done" : e.type === "cart" ? `${e.delta > 0 ? "Added" : "Removed"} ${e.item}` : e.type === "auth" ? (e.signedIn ? `Signed in${e.name ? ` as ${e.name}` : ""}` : "Signed out") : null;
      if (!text) return;
      const id = ++seq.current;
      setToasts((xs) => [...xs.slice(-2), { id, text, level: e.type === "toast" ? e.level ?? "info" : "success" }]);
      window.setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 2500);
    },
    [onEvent],
  );

  const navigate = React.useCallback(
    (link: NodeLink) => {
      if (link.kind === "url") {
        window.open(link.target, "_blank", "noopener");
        return;
      }
      if (link.kind === "node") {
        document.querySelector(`[data-live-node="${link.target}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const page = resolvePageLink(pages, link.target);
      if (page) onNavigatePage?.(page.id);
      else emit({ type: "toast", text: `No page called “${link.target}” yet` });
    },
    [pages, onNavigatePage, emit],
  );

  const transition = String(format["pages.transition"] ?? "fade");
  const motion = String(format["motion.level"] ?? "moderate");
  const animation =
    motion === "none" || transition === "none"
      ? undefined
      : transition === "slide"
        ? "slide-in-right var(--motion-slow) cubic-bezier(0.2, 0.8, 0.2, 1) both"
        : "fade-in var(--motion-base) ease-out both";

  return (
    <div
      data-live-root=""
      data-live-page={pageId}
      style={{ width, height, position: "relative", overflow: "hidden", ...(t.surfaceStyle ?? { background: t.backdrop, backgroundSize: "16px 16px" }), userSelect: "text", color: t.text }}
    >
      <LiveShell behaviours={behaviours} accent={t.accent} surface={t.surface}>
        <div key={pageId} style={{ position: "absolute", inset: 0, animation }}>
          {placed.map((p) => (
            <div
              key={p.node.id}
              data-live-node={p.node.id}
              {...nodeProps?.(p.node)}
              style={{
                position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h,
                boxShadow: auraShadow(p.node.aura, palette) ?? undefined,
                // Its entrance. The board draws the finished state; this is the
                // only place a part is seen arriving.
                animation: p.node.anim ? `${p.node.anim} var(--motion-slow, 420ms) cubic-bezier(0.2, 0.8, 0.2, 1) both` : undefined,
              }}
            >
              <Block node={p.node} t={t} palette={palette} light={light} page={{ w: width, h: height }} layers={look?.texture} mode="live" size={{ w: p.w, h: p.h }} onNavigate={navigate} emit={emit} />
            </div>
          ))}
          {placed.length === 0 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontFamily: t.bodyFamily, fontSize: 14 }}>
              Nothing on this page yet.
            </div>
          ) : null}
        </div>
      </LiveShell>
      {t.overlayStyle ? (
        <div aria-hidden data-live-wash="" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...t.overlayStyle }} />
      ) : null}
      {toasts.length ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none" }}>
          {toasts.map((x) => (
            <div key={x.id} role="status" style={{ padding: "8px 14px", borderRadius: 999, background: t.surface, border: `1px solid ${x.level === "error" ? "oklch(0.65 0.2 25)" : t.line}`, color: t.text, fontFamily: t.bodyFamily, fontSize: 13, boxShadow: "0 8px 24px oklch(0 0 0 / .3)", animation: "slide-up var(--motion-base) ease-out both" }}>
              {x.text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

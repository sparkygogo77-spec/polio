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
import { TextureDrift } from "../TextureDrift";
import { CarriedFonts } from "./CarriedFonts";
import { motionCss } from "../parts/capturedMotion";
import { resolvePalette } from "../parts/theme";
import { auraStyle, entranceCss, washCss, type Look } from "../look";
import type { StudioNode, StudioPage, StudioShape } from "../store";
import { unbuiltSections } from "../spec";
import type { Picture } from "../pictures";
import { deriveBehaviours } from "./behaviours";
import { LiveShell } from "./LiveShell";
import { placeNodes, type Device } from "./layout";
import { homeOf } from "../homePage";
import { pageFeatures } from "../library/works";
import { runWorks } from "./runWorks";

export interface LiveSiteProps {
  pages: StudioPage[];
  nodes: StudioNode[];
  pageId: string;
  device: Device;
  frameWidth: number;
  format: FormatValues;
  look?: Look;
  onNavigatePage?: (pageId: string) => void;
  /** Every event a part sends, with the part that sent it. */
  onEvent?: (e: PartEvent, nodeId: string) => void;
  /** Extra props for each part's wrapper (the builder hangs its right-click scope here). */
  nodeProps?: (node: StudioNode) => Record<string, unknown>;
  /**
   * Where a part's picture is to be pointed at, when the caller knows.
   *
   * Left alone, the bytes are found in this browser's file storage. The
   * publish passes the path the file will have in the repository, because
   * the page it is writing is read from there and has no browser storage
   * behind it.
   */
  pictureAt?: (pic: Picture) => string | undefined;
  /**
   * What the site is called. A wordmark reads it — the brief binds every
   * logo to the name, and without it two bars on his home page published
   * the word "Logo".
   */
  siteName?: string;
  /**
   * Everything drawn on the board: regions, arrows, sketches.
   *
   * Only the regions are read, and only the ones with words on them and
   * nothing inside. Those are sections of the brief's own layout that no
   * part carries, and the page says so where they stand rather than
   * closing the gap silently. Leave it out and the page is exactly as it
   * was: a board with no empty regions has nothing to say here either.
   */
  shapes?: StudioShape[];
  /**
   * How far inside another page this one is being drawn.
   *
   * A surface is a page, so a cube on the home page can carry the About
   * page on one side — and the About page could carry a cube of its own.
   * One level is a cube with pages on it; two would be a hall of mirrors
   * that costs the browser real work for something nobody can read. So
   * the page inside a surface draws its parts and hands no surfaces on.
   */
  depth?: number;
  /**
   * True when this render is the page a visitor will be served.
   *
   * The publish boundary. Everything the page could not build says so
   * where he is building and says nothing at all where a stranger is
   * reading: a note about how the work is made has no business on his
   * domain. The publish gathers the same list and hands it to him beside
   * the button instead.
   */
  published?: boolean;
  /**
   * Run the features the page's parts carry (`node.work`), as the published
   * page runs them: the Preview's switch and the full preview route. Left
   * out everywhere else (the companion beside the board, a page on a cube,
   * the export's own render), so nothing plays while the board is shown.
   */
  features?: boolean;
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
    (t.toLowerCase() === "home" || t === "/" ? homeOf(pages) ?? null : null)
  );
}

interface Toast { id: number; text: string; level: string }

export function LiveSite({ pages, nodes, pageId, device, frameWidth, format, look, onNavigatePage, onEvent, nodeProps, pictureAt, siteName, shapes, depth = 0, published = false, features = false }: LiveSiteProps) {
  const t = React.useMemo(() => ({ ...themeFrom(format, look, siteName), published }), [format, look, siteName, published]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const light = look?.light;
  const wash = React.useMemo(() => washCss(light), [light]);
  const pageNodes = React.useMemo(() => nodes.filter((n) => n.pageId === pageId), [nodes, pageId]);
  const { width, height: laidOut, placed, reflowed } = React.useMemo(() => placeNodes(pageNodes, device, frameWidth), [pageNodes, device, frameWidth]);
  /*
   * The brief's own layout, minus what the board carries. Reflowed, a
   * section has nowhere of its own to stand, so the sections queue up under
   * the page in the order they were drawn; at the board's width each one
   * stands where it was drawn, which is where the brief says it goes.
   */
  const missing = React.useMemo(
    () => (published ? [] : unbuiltSections(shapes ?? [], nodes, pageId)),
    [published, shapes, nodes, pageId],
  );
  const STRIP = 84;
  const sections = missing.map((sec, i) =>
    reflowed
      ? { ...sec, box: { left: 12, top: laidOut + i * (STRIP + 12), width: Math.max(0, width - 24), height: STRIP } }
      : { ...sec, box: { left: sec.x, top: sec.y, width: Math.min(sec.w, width), height: Math.max(sec.h, 48) } },
  );
  const height = reflowed && sections.length ? laidOut + sections.length * (STRIP + 12) + 12 : laidOut;
  const pageScroll = pages.find((p) => p.id === pageId)?.scroll;
  const behaviours = React.useMemo(() => deriveBehaviours(pageNodes, pageScroll), [pageNodes, pageScroll]);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const seq = React.useRef(0);

  const emit = React.useCallback(
    (e: PartEvent, nodeId = "") => {
      onEvent?.(e, nodeId);
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

  /*
   * A page, drawn to fit a surface.
   *
   * The same component, at the site's own width, scaled down to the box it
   * is standing on and left un-pointable so the thing it is on can still
   * be turned. The page it is standing on is not offered — a surface
   * showing the page it is part of is a mirror, not a page — and neither
   * is anything one level further in.
   */
  const surface = React.useCallback(
    (target: string, box: { w: number; h: number }): React.ReactNode => {
      if (depth > 0) return null;
      const page = resolvePageLink(pages, target);
      if (page?.id === pageId) return null;
      // A side bound to a page that has since been deleted. The side says
      // so; it does not quietly become a blank face of a box.
      if (!page) {
        return (
          <div data-cube-surface="gone" style={{ width: box.w, height: box.h, display: "grid", placeItems: "center", padding: 10, boxSizing: "border-box", textAlign: "center", color: t.muted, fontFamily: t.bodyFamily, fontSize: Math.max(9, Math.round(Math.min(box.w, box.h) * 0.07)), pointerEvents: "none" }}>
            the page this side showed is not in the site any more
          </div>
        );
      }
      const scale = Math.max(0.02, box.w / Math.max(1, frameWidth));
      return (
        <div data-cube-surface={page.id} style={{ width: box.w, height: box.h, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ width: frameWidth, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <LiveSite
              pages={pages}
              nodes={nodes}
              pageId={page.id}
              device="desktop"
              frameWidth={frameWidth}
              format={format}
              look={look}
              siteName={siteName}
              shapes={shapes}
              pictureAt={pictureAt}
              depth={depth + 1}
              published={published}
            />
          </div>
        </div>
      );
    },
    [depth, pages, pageId, nodes, frameWidth, format, look, siteName, shapes, pictureAt, t.muted, t.bodyFamily],
  );

  /* The features, run on this page's parts once they are drawn; again only when what they are told changes. */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bound = React.useMemo(() => (features && !published && depth === 0 ? JSON.stringify(pageFeatures(pageNodes).bindings) : "[]"), [features, published, depth, pageNodes]);
  React.useEffect(() => {
    if (bound === "[]" || !rootRef.current) return;
    return runWorks(rootRef.current, pageNodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bound, pageId]);

  const motionSheet = React.useMemo(() => motionCss(nodes.filter((n) => n.pageId === pageId), look?.keyframes, (id) => `[data-live-node="${id}"]`), [nodes, pageId, look?.keyframes]);
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
      ref={rootRef}
      data-live-root=""
      data-live-page={pageId}
      style={{ width, height, position: "relative", overflow: "hidden", ...(t.surfaceStyle ?? { background: t.backdrop, backgroundSize: "16px 16px" }), userSelect: "text", color: t.text }}
    >
      <TextureDrift layers={look?.texture} palette={palette} />
      <CarriedFonts fonts={look?.fonts} />
      {/* The page's own motion, as captured (parts/capturedMotion.ts); the export writes the same into its stylesheet. */}
      {motionSheet ? <style data-motion-css="">{motionSheet}</style> : null}
      <LiveShell behaviours={behaviours} accent={t.accent} surface={t.surface}>
        <div key={pageId} style={{ position: "absolute", inset: 0, animation }}>
          {/* The pool the lamp puts on the page ("Light on the page"), as the
              board draws it (Canvas, data-frame-light): under the parts, so
              they stand in it. Only the board drew it, so the wash that
              changed 41% of the board changed nothing in Preview or on the
              published page. */}
          {wash ? <div aria-hidden data-live-light="" style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: wash }} /> : null}
          {placed.map((p) => (
            <div
              key={p.node.id}
              data-live-node={p.node.id}
              {...nodeProps?.(p.node)}
              style={{
                position: "absolute", left: p.x, top: p.y, width: p.w,
                // The same floor the board gives a box: its words are never
                // cut off, whatever height the capture measured.
                minHeight: p.h, display: "flex", flexDirection: "column",
                ...((auraStyle(p.node.aura, palette, p.node.auraSize, p.node.auraStyle) ?? {}) as React.CSSProperties),
                // Its entrance. The board draws the finished state; this is the
                // only place a part is seen arriving.
                animation: entranceCss(p.node.anim, p.node.animSpeed, p.node.animDelay, p.node.animEase),
              }}
            >
              <Block node={p.node} t={t} palette={palette} light={light} page={{ w: width, h: height }} layers={look?.texture} mode="live" size={{ w: p.w, h: p.h }} onNavigate={navigate} emit={(e) => emit(e, p.node.id)} pictureAt={pictureAt} surface={surface} />
            </div>
          ))}
          {sections.map((sec) => (
            <div
              key={sec.id}
              data-live-section={sec.id}
              role="note"
              style={{
                position: "absolute", ...sec.box,
                display: "flex", flexDirection: "column", gap: 4, justifyContent: "center",
                padding: 16, boxSizing: "border-box",
                border: `1px dashed ${t.muted}`, borderRadius: Math.min(t.radius, 10),
                color: t.muted, fontFamily: t.bodyFamily, opacity: 0.75,
              }}
            >
              <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 11, fontWeight: 500 }}>{sec.label}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>in the layout, and nothing has been built for it yet</span>
            </div>
          ))}
          {placed.length === 0 && sections.length === 0 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontFamily: t.bodyFamily, fontSize: 14 }}>
              Nothing on this page yet.
            </div>
          ) : null}
        </div>
      </LiveShell>
      {t.overlayStyle ? (
        <div aria-hidden data-live-wash="" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...t.overlayStyle }} />
      ) : null}
      {t.veil ? (
        <div aria-hidden data-live-veil="" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: t.veil }} />
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

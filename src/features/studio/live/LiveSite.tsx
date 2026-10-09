"use client";
/**
 * One page of the site, live. Props only — the pinned preview window and the
 * full-size preview route both render this, and it is the shape Stage 5's
 * generated runtime takes.
 */
import * as React from "react";
import { Block } from "../blocks";
import type { FormatValues } from "../format";
import { isOverlay, themeFrom, type NodeLink, type PartEvent } from "../shelf/ui";
import { LiveKeyframes, TextureDrift } from "../TextureDrift";
import { CarriedFonts } from "./CarriedFonts";
import { copyMotion, motionCss } from "../shelf";
import { resolvePalette } from "../shelf/run";
import { auraStyle, entranceCss, washCss, type Look } from "../look";
import type { StudioNode, StudioPage, StudioShape } from "../board/store";
import { unbuiltSections } from "../spec";
import type { Picture } from "../pictures";
import { deriveBehaviours } from "./behaviours";
import { LiveShell } from "./LiveShell";
import { placeNodes, type Device } from "./layout";
import { planFor, SMALL_RULES, treeFor } from "./smallRules";
import { PHONE_MAX, SMALL_WIDTH, type SmallDevice } from "./small";
import { breakersFor, cssIdent, smallSheet } from "./smallCss";
import { resolvePart } from "../shelf/ui";
import { homeOf } from "../homePage";
import { getWork, pageFeatures, usesOf } from "../shelf";
import { runWorks } from "./runWorks";
import { followsOf, placeFollowers } from "./follow";
import { leadsOf, withLead } from "../shelf";
import { holderIds } from "../owner";

/** Parts that draw a real control and wear a brought-in page's hooks on it, not on their box. */
const OWN_HOOKS = new Set(["field", "checkbox"]);

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
  /**
   * The published page: one page for every width (`live/smallCss.ts`). The
   * desktop is drawn as ever, each part once, and under this window width
   * the tablet's and the phone's layouts are rules on those same parts.
   */
  smallAt?: number;
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

export function LiveSite({ pages, nodes, pageId, device, frameWidth, format, look, onNavigatePage, onEvent, nodeProps, pictureAt, siteName, shapes, depth = 0, published = false, features = false, smallAt }: LiveSiteProps) {
  const t = React.useMemo(() => ({ ...themeFrom(format, look, siteName), published }), [format, look, siteName, published]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const light = look?.light;
  const wash = React.useMemo(() => washCss(light), [light]);
  const pageNodes = React.useMemo(() => nodes.filter((n) => n.pageId === pageId), [nodes, pageId]);
  const holders = holderIds(pageNodes);
  /*
   * ONE PAGE AT EVERY WIDTH. On a tablet or a phone the page is its plan
   * (`small.ts`), not the desktop's boxes narrowed; and it is the desktop's
   * own parts, each drawn once where the desktop draws it, nested by what
   * holds what, laid out at that width by rules (`smallCss.ts`). The
   * published page is the same page with the rules under media queries.
   */
  const small = device === "desktop" ? null : device;
  const nested = !!small || (!!smallAt && depth === 0);
  const { width, height: laidOut, placed, reflowed } = React.useMemo(() => placeNodes(pageNodes, nested ? "desktop" : device, frameWidth), [pageNodes, device, frameWidth, nested]);
  const planNodes = React.useMemo(() => pageNodes.filter((n) => resolvePart(n.featureId)?.tier !== "B"), [pageNodes]);
  const plans = React.useMemo(() => {
    if (!nested) return null;
    const devices: SmallDevice[] = small ? [small] : ["tablet", "phone"];
    return devices.map((d) => planFor(planNodes, d, frameWidth));
  }, [nested, small, planNodes, frameWidth]);
  const tree = React.useMemo(() => (nested ? treeFor(planNodes) : null), [nested, planNodes]);
  /* The words of a captured row start after what stands before them (`parts/leadIn.ts`). */
  const leads = React.useMemo(() => leadsOf(pageNodes), [pageNodes]);
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
        const to = document.querySelector(`[data-live-node="${link.target}"]`);
        /* A link to a "What's new" card opens it (`library/tour.ts`), as the published link does. */
        if (to?.querySelector("[data-tour]")) { to.dispatchEvent(new CustomEvent("whats-new:open")); return; }
        to?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  /* Another part of this page, live, in a box: a "What's new" step's preview. Not inside a page drawn on a surface. */
  const partView = React.useCallback(
    (of: string, box: { w: number; h: number }): React.ReactNode =>
      depth > 0 ? null : <PartCopy of={of} box={box} placed={placed} leads={leads} t={t} palette={palette} light={light} look={look} onNavigate={navigate} pictureAt={pictureAt} emit={emit} />,
    [depth, placed, leads, t, palette, light, look, navigate, pictureAt, emit],
  );

  /* The features, run on this page's parts once they are drawn; again only when what they are told changes. */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bound = React.useMemo(() => (features && !published && depth === 0 ? JSON.stringify(pageFeatures(pageNodes).bindings) : "[]"), [features, published, depth, pageNodes]);
  React.useEffect(() => {
    if (bound === "[]" || !rootRef.current) return;
    return runWorks(rootRef.current, pageNodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bound, pageId]);

  /* Parts set right after a line's words follow them wherever they end (`follow.ts`): after every draw, a resize, and the fonts. */
  const followers = React.useMemo(() => (depth > 0 ? [] : pageNodes.flatMap((n) => { const f = followsOf(n); return f ? [{ id: n.id, follows: f }] : []; })), [depth, pageNodes]);
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !followers.length) return;
    const find = (id: string) => `[data-live-node="${id.replace(/["\\]/g, "\\$&")}"]`;
    let frame = 0;
    const place = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => placeFollowers(root, followers, find)); };
    placeFollowers(root, followers, find);
    const seen = new ResizeObserver(place);
    seen.observe(root);
    for (const f of followers) { const to = root.querySelector(find(f.follows.id)); if (to) seen.observe(to); }
    void document.fonts?.ready.then(place);
    return () => { cancelAnimationFrame(frame); seen.disconnect(); };
  });

  const motionSheet = React.useMemo(() => motionCss(nodes.filter((n) => n.pageId === pageId), look?.keyframes, (id) => `[data-live-node="${id}"]`), [nodes, pageId, look?.keyframes]);
  const transition = String(format["pages.transition"] ?? "fade");
  const motion = String(format["motion.level"] ?? "moderate");
  const animation =
    motion === "none" || transition === "none"
      ? undefined
      : transition === "slide"
        ? "slide-in-right var(--motion-slow) cubic-bezier(0.2, 0.8, 0.2, 1) both"
        : "fade-in var(--motion-base) ease-out both";

  /* One part, where the desktop draws it. */
  const partOf = (p: (typeof placed)[number]) => (
    <div
      key={p.node.id}
      /* A brought-in page's hooks, on the part's box, unless the part draws a control that wears them itself (`parts/PageControls.tsx`). */
      {...(p.node.hooks && !OWN_HOOKS.has(p.node.featureId) ? p.node.hooks : null)}
      data-live-node={p.node.id}
      {...nodeProps?.(p.node)}
      className={nested ? ((p.node as { state?: unknown }).state ? "sm-p sm-state" : "sm-p") : undefined}
      style={{
        position: "absolute", left: p.x, top: p.y, width: p.w,
        // A part the page never let take a press (the grain over everything, a decoration): presses pass through it.
        ...((p.node as { inert?: boolean }).inert ? { pointerEvents: "none" as const } : null),
        // The same floor the board gives a box: its words are never
        // cut off, whatever height the capture measured.
        minHeight: p.h, display: "flex", flexDirection: "column",
        ...((auraStyle(p.node.aura, palette, p.node.auraSize, p.node.auraStyle) ?? {}) as React.CSSProperties),
        // Its entrance. The board draws the finished state; this is the
        // only place a part is seen arriving.
        animation: entranceCss(p.node.anim, p.node.animSpeed, p.node.animDelay, p.node.animEase),
        // A part a press shows: hidden where the page opens, until the press (`Show on press`) shows it.
        ...((p.node as { state?: unknown }).state ? { display: "none" as const } : null),
        // A card over the page ("What's new"): its box takes no room and no press; what it opens is fixed over the window.
        ...(isOverlay(p.node.featureId) ? { minHeight: 0, height: 0, pointerEvents: "none" as const, animation: undefined } : null),
      }}
    >
      <Block node={withLead(p.node, leads)} t={t} palette={palette} light={light} page={{ w: width, h: height }} layers={look?.texture} holder={holders.has(p.node.id)} mode="live" size={{ w: p.w, h: p.h }} onNavigate={navigate} emit={(e) => emit(e, p.node.id)} pictureAt={pictureAt} surface={surface} partView={partView} />
    </div>
  );
  /*
   * NESTED BY WHAT HOLDS WHAT. A part that holds others stands in a box with
   * them (`.sm-g`), see-through on the desktop (`display: contents`), so
   * every part is still placed against the page and drawn in the order it
   * was. At a small width the rules lay the box out: opened round what it
   * holds, or kept whole and scaled.
   */
  const byId = new Map(placed.map((p, i) => [p.node.id, { p, i }]));
  const keys = new Map<string, number>();
  const keyOf = (id: string): number => {
    const known = keys.get(id);
    if (known !== undefined) return known;
    const k = Math.min(byId.get(id)?.i ?? Infinity, ...(tree?.kids.get(id) ?? []).map((c) => keyOf(c.id)));
    keys.set(id, k);
    return k;
  };
  const breaks = React.useMemo(() => (plans && tree ? breakersFor(plans, (id) => tree.kids.has(id)) : new Map<string, number>()), [plans, tree]);
  const breakers = (c: string) => Array.from({ length: breaks.get(c) ?? 0 }, (_, i) => <i key={`br${i}`} className="sm-br" aria-hidden style={{ display: "none" }} />);
  const unit = (id: string): React.ReactNode => {
    const kids = (tree?.kids.get(id) ?? []).filter((c) => byId.has(c.id) || tree?.kids.has(c.id));
    const own = byId.get(id);
    if (!kids.length) return own ? partOf(own.p) : null;
    const members = [id, ...kids.map((c) => c.id)].sort((x, y) => (x === id ? byId.get(id)?.i ?? Infinity : keyOf(x)) - (y === id ? byId.get(id)?.i ?? Infinity : keyOf(y)));
    return (
      <div key={`g:${id}`} className={`sm-g g-${id}`} style={{ display: "contents" }}>
        <div className="sm-gi" style={{ display: "contents" }}>
          {members.map((m) => (m === id ? (own ? partOf(own.p) : null) : unit(m)))}
          {breakers(id)}
        </div>
      </div>
    );
  };
  /* The rules for each width this page is drawn at: scoped to this page on the board, under media queries when published. */
  const smallCss = React.useMemo(() => {
    if (!plans || !tree) return "";
    const holds = (id: string) => tree.kids.has(id);
    const parentOf = (id: string) => tree.parent.get(id) ?? null;
    const stated = (id: string) => !!(pageNodes.find((n) => n.id === id) as { state?: unknown } | undefined)?.state;
    const group = (id: string) => `.g-${cssIdent(id)}`;
    const control = (id: string) => { const n = pageNodes.find((x) => x.id === id); return !!n && SMALL_RULES.isControl(n); };
    if (small) {
      return smallSheet(plans[0]!, { part: (id) => `[data-live-node="${id.replace(/["\\]/g, "\\$&")}"]`, group, holds, parentOf, stated, control, scope: `[data-live-page="${pageId}"][data-live-device="${small}"] `, pageWidth: `${SMALL_WIDTH[small]}px`, narrowest: small === "phone" ? 320 : PHONE_MAX + 1 });
    }
    const at = (d: SmallDevice) => smallSheet(plans.find((p) => p.device === d)!, { part: (id) => `#${cssIdent(id)}`, group, holds, parentOf, stated, control, scope: "", pageWidth: "100%", narrowest: d === "phone" ? 320 : PHONE_MAX + 1 });
    const wideFrom = smallAt ?? 1024;
    return `@media (max-width: ${wideFrom - 0.02}px) and (min-width: ${PHONE_MAX + 1}px) {\n${at("tablet")}\n}\n@media (max-width: ${PHONE_MAX + 0.98}px) {\n${at("phone")}\n}`;
  }, [plans, tree, small, smallAt, pageId, pageNodes]);
  /* The menu's key, when a width has one: a checkbox in a label holds it open, no script. */
  const hasMenu = !!plans?.some((p) => p.items.some((x) => x.kind === "menu"));
  const menuKey = hasMenu ? (
    <>
      <label className="sm-menu-button" data-small-menu-button="" style={{ display: "none", alignItems: "center", gap: 8, padding: "0 16px", boxSizing: "border-box", borderRadius: Math.min(t.radius, 12), border: `1px solid ${t.line}`, background: t.surface, color: t.text, fontFamily: t.bodyFamily, fontSize: 16, cursor: "pointer", userSelect: "none", position: "relative", zIndex: 22 }}>
        <input type="checkbox" className="sm-menu-toggle" style={{ position: "absolute", opacity: 0, width: 1, height: 1, margin: 0, pointerEvents: "none" }} />
        <span aria-hidden className="sm-glyph"><span className="sm-glyph-open">{"\u2630"}</span><span className="sm-glyph-close">{"\u2715"}</span></span>
        Menu
      </label>
      <div aria-hidden className="sm-menu-panel" data-small-menu-panel="" style={{ display: "none", background: t.surface, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 12), boxShadow: "0 12px 32px oklch(0 0 0 / .3)" }} />
    </>
  ) : null;

  return (
    <div
      ref={rootRef}
      data-live-root=""
      data-live-page={pageId}
      data-live-device={device}
      {...(small ? { "data-small-page": small } : null)}
      className={nested ? "sm-page" : undefined}
      style={{ width, height, overflow: "hidden", position: "relative", ...(t.surfaceStyle ?? { background: t.backdrop, backgroundSize: "16px 16px" }), userSelect: "text", color: t.text }}
    >
      <TextureDrift layers={look?.texture} palette={palette} />
      <LiveKeyframes />
      <CarriedFonts fonts={look?.fonts} />
      {/* The page's own motion, as captured (parts/capturedMotion.ts); the export writes the same into its stylesheet. */}
      {motionSheet ? <style data-motion-css="">{motionSheet}</style> : null}
      <LiveShell behaviours={behaviours} accent={t.accent} surface={t.surface} published={published}>
        <div key={pageId} className="sm-root" style={{ position: "absolute", inset: 0, animation }}>
          {/* The pool the lamp puts on the page ("Light on the page"), as the
              board draws it (Canvas, data-frame-light): under the parts, so
              they stand in it. Only the board drew it, so the wash that
              changed 41% of the board changed nothing in Preview or on the
              published page. */}
          {wash ? <div aria-hidden data-live-light="" style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: wash }} /> : null}
          {nested ? (
            <>
              {menuKey}
              {smallCss ? <style data-small-css="">{smallCss}</style> : null}
              {(tree?.roots ?? []).filter((n) => byId.has(n.id)).sort((x, y) => keyOf(x.id) - keyOf(y.id)).map((n) => unit(n.id))}
              {breakers("")}
            </>
          ) : placed.map((p) => partOf(p))}
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

type Placed = ReturnType<typeof placeNodes>["placed"][number];

/** A part that does something when pressed (a copy, a press that shows a panel), not one that only moves. */
const takesPress = (work: StudioNode["work"]) => usesOf(work).some((u) => !u.off && getWork(u.id)?.manifest.category === "interact");

/**
 * One part of the page, and the parts standing inside its box, drawn live
 * on their own and scaled into a box: what a "What's new" step shows on
 * top. The real parts, the same blocks the page draws, so a link in it
 * goes where the page's does and a feature the part carries works on it
 * too: each piece wears `data-copy-of` (its part's id), which the features
 * runtime binds as it binds the part (`RUNTIME_JS`, `runWorks`). Never a
 * `data-live-node`, so nothing on the page is found twice.
 */
export function PartCopy({ of, box, placed, leads, t, palette, light, look, onNavigate, emit, pictureAt, still }: {
  of: string;
  box: { w: number; h: number };
  placed: readonly Placed[];
  leads: ReturnType<typeof leadsOf>;
  t: ReturnType<typeof themeFrom>;
  palette: ReturnType<typeof resolvePalette>;
  light?: Look["light"];
  look?: Look;
  onNavigate?: (link: NodeLink) => void;
  emit?: (e: PartEvent, nodeId: string) => void;
  pictureAt?: (pic: Picture) => string | undefined;
  /** Drawn on the board: held still, as the board draws everything. */
  still?: boolean;
}) {
  const me = placed.find((p) => p.node.id === of);
  if (!me) return null;
  const near = 2;
  const inside = placed.filter((p) =>
    !(p.node as { state?: unknown }).state && !isOverlay(p.node.featureId) &&
    p.x >= me.x - near && p.y >= me.y - near && p.x + p.w <= me.x + me.w + near && p.y + p.h <= me.y + me.h + near);
  const scale = Math.min(box.w / Math.max(1, me.w), box.h / Math.max(1, me.h), 1.5);
  /* Its pieces renamed for the copy, and its own hover, press and motion written again for them (`copyMotion`). Held still on the board. */
  const motion = copyMotion(inside.map((p) => p.node), of);
  return (
    <div data-part-copy={of} style={{ width: box.w, height: box.h, position: "relative", overflow: "hidden" }}>
      {!still && motion.css ? <style data-copy-motion="">{motion.css}</style> : null}
      <div style={{ position: "absolute", left: (box.w - me.w * scale) / 2, top: (box.h - me.h * scale) / 2, width: me.w, height: me.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        {inside.map((p) => (
          <div
            key={p.node.id}
            data-copy-of={p.node.id}
            data-copy-node={motion.idOf(p.node.id)}
            /* Words over the part, doing nothing of their own, let a press through to it: in the card, a press anywhere on the bar is the bar's. */
            style={{ position: "absolute", left: p.x - me.x, top: p.y - me.y, width: p.w, minHeight: p.h, display: "flex", flexDirection: "column", ...((p.node as { inert?: boolean }).inert || (p.node.id !== of && !p.node.link && !takesPress(p.node.work)) ? { pointerEvents: "none" as const } : null) }}
          >
            <Block node={withLead(p.node, leads)} motionId={motion.idOf(p.node.id)} t={t} palette={palette} light={light} page={{ w: me.w, h: me.h }} layers={look?.texture} mode={still ? "board" : "live"} size={{ w: p.w, h: p.h }} onNavigate={onNavigate} emit={(e) => emit?.(e, p.node.id)} pictureAt={pictureAt} />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
/**
 * A site, small. One definition, used wherever a site has to be shown small.
 *
 * It lives in `studio` because everything it is made of does — the blocks,
 * the palette, the wash, the frame height — and both surfaces that want a
 * site shown small import it from here: the Builds page, which is where it
 * started, and the timeline's green card, which had its own take and does
 * not any more.
 *
 * The Builds page listed documents by their counts — four pages, twenty-one
 * parts — which tells you what is in a project and nothing about which
 * project it is. What identifies a site is what it looks like, so each card
 * shows the site itself: the real parts, the real palette, the real texture
 * and the real light, laid out at the frame's true width and scaled down to
 * the card.
 *
 * It is the same render the board draws, not a picture of it. There is no
 * screenshot to go stale, nothing to store, and nothing to bake — a project
 * whose colour changed looks changed the next time you open Builds. Parts are
 * drawn in `board` mode, which is the still one: a card is a thumbnail, not
 * sixteen animations running behind a list.
 *
 * Where the document comes from is the caller's business: Builds reads it out
 * of a slot in storage, because every project except the open one is a slot
 * the Builder has never loaded, and the timeline hands over the snapshot the
 * update kept. Neither changes what is drawn.
 */
import * as React from "react";
import { Block, themeFrom } from "./blocks";
import { resolvePalette } from "./parts/theme";
import { washCss } from "./look";
import { frameHeight, type StudioNode, type StudioPage } from "./board/store";
import type { FormatValues } from "./format";
import type { Look } from "./look";

/**
 * What a preview needs, named here rather than borrowed from either caller.
 *
 * Builds hands it a `StudioDoc` read out of a slot and the timeline hands it
 * the snapshot an update left behind; those are the same object under two
 * names, and the component should not have to know which side it came from.
 * So it names the six fields it actually reads, in the studio's own types,
 * and both fit — `StudioDoc` is this exact shape and a thread's snapshot is
 * the whole document the store held.
 *
 * Every field is optional because both sources are persisted shapes: what
 * the store's hydration would have filled in is not there.
 */
export interface PreviewDoc {
  pages?: StudioPage[];
  nodes?: StudioNode[];
  format?: FormatValues;
  look?: Look;
  activePageId?: string;
  frameWidth?: number;
  /** The site's own name, so a wordmark in the thumbnail reads it and not "Logo". */
  brief?: { name?: string };
}

export interface SitePreviewProps {
  doc: PreviewDoc | null;
  /** The card's width in px; the frame is scaled to it. */
  width: number;
  /** How tall the card is. The page is cut off at the bottom, like a real fold. */
  height: number;
  /** Draw only the parts that start above the fold: what a picture of the card needs, and nothing it cannot show (`builds/thumbs.tsx`). */
  fold?: boolean;
  /** The whole page, as tall as it is at this width, for a preview that scrolls. */
  whole?: boolean;
}

export function SitePreview({ doc, width, height, fold, whole }: SitePreviewProps) {
  const view = React.useMemo(() => {
    if (!doc || !doc.pages?.length) return null;
    const page = doc.pages.find((p) => p.id === doc.activePageId) ?? doc.pages[0]!;
    const nodes = (doc.nodes ?? []).filter((n) => n.pageId === page.id);
    const format = doc.format ?? {};
    const look = doc.look;
    const theme = themeFrom(format, look, doc.brief?.name);
    const palette = resolvePalette(format, look);
    const frameW = Number(format["frame.width"]) || doc.frameWidth || 1440;
    return {
      nodes,
      theme,
      palette,
      frameW,
      frameH: frameHeight(nodes),
      wash: look?.light ? washCss(look.light) : null,
      layers: look?.texture ?? [],
      light: look?.light,
      page: { w: frameW, h: frameHeight(nodes) },
      veil: look?.veil ?? 0,
    };
  }, [doc]);

  if (!view) {
    return (
      <div className="grid size-full place-items-center rounded-[5px] border border-dashed border-border bg-elevated/40 text-small text-fg-faint">
        nothing on it yet
      </div>
    );
  }
  // A page with nothing on it is still a real page with a real colour, so it
  // is drawn — and then said, because an empty frame and a site that failed
  // to draw look identical.
  const bare = view.nodes.length === 0;

  // The whole width, always: a thumbnail that cropped the sides would be
  // showing you a column of one site and a column of another.
  const scale = width / view.frameW;
  const shown = fold && scale > 0 ? view.nodes.filter((n) => n.y < height / scale) : view.nodes;

  return (
    <div className={whole ? "relative w-full overflow-hidden rounded-[5px]" : "relative size-full overflow-hidden rounded-[5px]"} style={{ background: view.theme.backdrop, ...(whole ? { height: Math.ceil(view.frameH * scale) } : {}) }}>
      <div
        aria-hidden
        // Inert and unscrollable: a card is a picture of a site, and a part
        // that grabs a wheel or a drag inside a list is a card you cannot
        // scroll past.
        inert
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: view.frameW, height: view.frameH, transform: `scale(${scale})`, ...(view.theme.surfaceStyle ?? { background: view.theme.backdrop }) }}
      >
        {view.wash ? <div className="absolute inset-0" style={{ backgroundImage: view.wash }} /> : null}
        {shown.map((n) => (
          <div key={n.id} className="absolute overflow-hidden" style={{ left: n.x, top: n.y, width: n.w, height: n.h }}>
            <Block
              node={n}
              t={view.theme}
              palette={view.palette}
              light={view.light}
              page={view.page}
              layers={view.layers}
              mode="board"
            />
          </div>
        ))}
        {view.veil ? <div className="absolute inset-0" style={{ background: `oklch(0 0 0 / ${view.veil})` }} /> : null}
      </div>
      {bare ? (
        <span className="absolute inset-0 grid place-items-center text-small text-fg-faint">nothing on it yet</span>
      ) : null}
      {/* The fold: the page runs on past the card, and says so rather than
          stopping dead on a cut-off part. */}
      {!whole && view.frameH * scale > height ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/45 to-transparent" />
      ) : null}
    </div>
  );
}

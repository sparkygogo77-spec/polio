"use client";
/**
 * THE VERSIONS, SIDE BY SIDE, PAGE BY PAGE.
 *
 * One column a version (its plain name and its one line), one row a page any
 * version proposes. Each cell is that version's page drawn small: the same
 * render Compare and Builds use (`SitePreview`, `compare/model.ts#onPage`),
 * in the house style, with the version's suggested words in it so its voice
 * shows. J ticks a cell to take that page from that version; one tick a row.
 * "Take all" ticks a whole version.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { SitePreview, type PreviewDoc } from "../SitePreview";
import { onPage } from "../compare/model";
import type { Look } from "../look";
import type { System } from "../system/model";
import { buildSite, pageRows, togglePick, wholeVersion, type Picks, type Versions } from "./versions";

const THUMB_W = 180;
const THUMB_H = 120;

export function VersionsPicker({ versions, system, picks, onPicks }: { versions: Versions; system: System; picks: Picks; onPicks: (p: Picks) => void }) {
  const rows = React.useMemo(() => pageRows(versions), [versions]);
  /* Each version built once, every page of it, words in: the thumbnails are its pages. */
  const docs = React.useMemo<PreviewDoc[]>(() => versions.versions.map((_, i) => {
    const site = buildSite(versions, wholeVersion(versions, i), system, { words: "fill" });
    return { pages: site.pages, nodes: site.nodes as unknown as PreviewDoc["nodes"], look: { palette: site.palette } as unknown as Look, frameWidth: 1440, activePageId: site.pages[0]?.id };
  }), [versions, system]);

  return (
    <div data-versions="" className="overflow-x-auto">
      <div className="grid gap-2" style={{ gridTemplateColumns: `5.5rem repeat(${versions.versions.length}, ${THUMB_W}px)` }}>
        <div />
        {versions.versions.map((v, i) => (
          <div key={i} data-version={i} className="flex flex-col gap-1">
            <span data-version-name="" className="text-sm font-semibold text-fg">{v.name}</span>
            {v.pitch ? <span className="text-small leading-snug text-fg-muted">{v.pitch}</span> : null}
            <button type="button" data-version-all={i} onClick={() => onPicks(wholeVersion(versions, i))} className="tactile self-start rounded-md border border-border px-1.5 py-0.5 text-small text-fg">
              Take all {v.pages.length} {v.pages.length === 1 ? "page" : "pages"}
            </button>
          </div>
        ))}
        {rows.map((r) => (
          <React.Fragment key={r.key}>
            <span data-page-row={r.key} className="self-center text-small font-medium text-fg">{r.name}</span>
            {versions.versions.map((_, vi) => {
              const at = r.in.get(vi);
              if (at == null) return <span key={vi} data-page-cell="" data-empty="" className="self-center text-center text-small text-fg-faint">—</span>;
              const on = picks[r.key] === vi;
              const doc = docs[vi]!;
              return (
                <button
                  key={vi}
                  type="button"
                  data-page-cell=""
                  data-page={r.key}
                  data-from={vi}
                  aria-pressed={on}
                  aria-label={`${r.name} from ${versions.versions[vi]!.name}`}
                  onClick={() => onPicks(togglePick(picks, r.key, vi))}
                  className={cn("tactile relative overflow-hidden rounded-md border-2 bg-surface", on ? "border-accent" : "border-border")}
                  style={{ width: THUMB_W, height: THUMB_H }}
                >
                  <SitePreview doc={onPage(doc, doc.pages?.[at]?.id ?? null)} width={THUMB_W - 4} height={THUMB_H - 4} fold />
                  {on ? <span className="absolute right-1 top-1 rounded-full bg-accent p-0.5 text-white"><Check className="size-3" /></span> : null}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

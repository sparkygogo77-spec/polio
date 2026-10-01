"use client";
/**
 * LEARNED FROM YOUR SITES: what every import taught the Builder, per site.
 *
 * For each site brought in: its versions of shelf items, by shelf category,
 * each with its true badge; its style kits and motions, which any drawn
 * shape can wear; its fonts and palette, each a press away from the open
 * board; and what was skipped, with why. Forgetting a site is here and
 * nowhere else: removing a board never wipes what it taught.
 * (`library/learned.ts`, `library/useLearned.ts`.)
 */
import * as React from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { useLearned } from "./library/useLearned";
import type { LearnedSite } from "./library/learned";
import { getWork } from "./library/works";
import { CATEGORIES, getFeature } from "./catalog";
import { STATUS_LABEL } from "./shelfFacts";
import { useStudio } from "./store";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";

const OPEN = "studio:learned";
/** Open "Learned from your sites" from anywhere: a button, a command. */
export const openLearned = () => window.dispatchEvent(new CustomEvent(OPEN));

/** The shelf's own name for a category ("Motion"). */
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
const itemName = (item: string) => (item.startsWith("work:") ? getWork(item.slice(5))?.manifest.name ?? item.slice(5) : getFeature(item)?.name ?? item);

function Site({ site }: { site: LearnedSite }) {
  const forget = useLearned((s) => s.forget);
  const [sure, setSure] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const byCat = new Map<string, LearnedSite["versions"]>();
  for (const v of site.versions) byCat.set(v.category, [...(byCat.get(v.category) ?? []), v]);
  const usePalette = () => {
    if (!site.palette) return;
    const s = useStudio.getState();
    useStudio.setState({ look: { ...s.look, palette: { ...s.look.palette, ...site.palette } } });
    play("confirm");
    setSaid(`The open board now uses ${site.name}'s palette. Undo puts it back.`);
  };
  const addFonts = () => {
    const s = useStudio.getState();
    const had = new Set(((s.look as { fonts?: { id?: string; family: string }[] }).fonts ?? []).map((f) => f.id ?? f.family));
    const add = site.fonts.files.filter((f) => !had.has(f.id ?? f.family));
    useStudio.setState({ look: { ...s.look, fonts: [...((s.look as { fonts?: unknown[] }).fonts ?? []), ...add] } as never });
    play("confirm");
    setSaid(add.length ? `${[site.fonts.heading, site.fonts.body].filter((x, i, a) => x && a.indexOf(x) === i).join(" and ")} can now set any part on the open board (the part panel's Font, and Look's swap).` : "The open board already has these fonts.");
  };
  return (
    <section data-learned-site={site.host} className="space-y-2 rounded-md border border-border p-3">
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-plain font-semibold text-fg">{site.name} <span className="font-normal text-fg-muted">· {site.host}</span></h3>
          <p className="text-small text-fg-muted">
            {site.versions.length} shelf version{site.versions.length === 1 ? "" : "s"}, {site.kits.length} style kit{site.kits.length === 1 ? "" : "s"}, {site.motions.length} motion{site.motions.length === 1 ? "" : "s"}. Learned {new Date(site.at).toLocaleString()}.
          </p>
        </div>
      </header>
      {site.versions.length ? (
        <div className="space-y-1">
          <div className="text-small font-semibold uppercase tracking-[0.08em] text-fg">On the shelf, as “{site.name} version”</div>
          {[...byCat.entries()].map(([cat, list]) => (
            <div key={cat} data-learned-category={cat} className="text-small">
              <span className="text-fg-muted">{catLabel(cat)}: </span>
              {list.map((v, i) => (
                <span key={v.item} data-learned-item={v.item} data-status={v.status} className="text-fg">
                  {i ? ", " : ""}{itemName(v.item)} <span className="text-fg-faint">({STATUS_LABEL[v.status].toLowerCase()})</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {site.kits.length ? (
        <p data-learned-kits={site.kits.length} className="text-small"><span className="text-fg-muted">Style kits, worn by a drawn shape on any board: </span><span className="text-fg">{site.kits.map((k) => k.name).join(", ")}</span></p>
      ) : null}
      {site.motions.length ? (
        <p data-learned-motions={site.motions.length} className="text-small"><span className="text-fg-muted">Motions a drawn shape can wear: </span><span className="text-fg">{site.motions.map((m) => m.name).join(", ")}</span></p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {site.palette ? (
          <Button size="xs" variant="outline" data-learned-palette="" onClick={usePalette}>
            {Object.values(site.palette).slice(0, 6).map((c, i) => <span key={i} className="size-3 rounded-sm border border-border" style={{ background: c }} />)}
            Use this palette
          </Button>
        ) : null}
        {site.fonts.files.length ? (
          <Button size="xs" variant="outline" data-learned-fonts="" onClick={addFonts}>
            Add {[site.fonts.heading, site.fonts.body].filter((x, i, a) => x && a.indexOf(x) === i).join(" and ")} to this board
          </Button>
        ) : null}
      </div>
      {said ? <p className="text-small text-fg-muted">{said}</p> : null}
      {site.skipped.length ? (
        <details data-learned-skipped={site.skipped.length} className="text-small">
          <summary className="cursor-pointer text-fg-muted">{site.skipped.length} thing{site.skipped.length === 1 ? "" : "s"} not kept, and why</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fg-muted">
            {site.skipped.map((k, i) => <li key={i}><span className="text-fg">{k.what}</span>: {k.why}.</li>)}
          </ul>
        </details>
      ) : null}
      <div className="flex justify-end">
        {sure ? (
          <span className="flex items-center gap-1.5 text-small">
            Forget everything learned from {site.name}?
            <Button size="xs" variant="danger" data-learned-forget-yes="" onClick={() => { forget(site.host); play("close"); }}>Forget it</Button>
            <Button size="xs" variant="ghost" onClick={() => setSure(false)}>Keep it</Button>
          </span>
        ) : (
          <Button size="xs" variant="ghost" data-learned-forget="" onClick={() => setSure(true)}><Trash2 /> Forget this site</Button>
        )}
      </div>
    </section>
  );
}

/** The dialog, mounted once; `openLearned()` opens it. */
export function LearnedDialog() {
  const [open, setOpen] = React.useState(false);
  const lib = useLearned((s) => s.lib);
  React.useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  const sites = Object.values(lib.sites).sort((a, b) => b.at - a.at);
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Learned from your sites" size="lg"
      description="What every imported site taught the Builder, kept for every board in this browser and in every backup. Re-importing a site updates it; removing a board does not wipe it.">
      <div data-learned-panel="" className="max-h-[70vh] space-y-2 overflow-y-auto">
        {sites.length ? sites.map((s) => <Site key={s.host} site={s} />) : (
          <p className="text-plain text-fg-muted">Nothing yet. Bring a site in (Builds, or From a site) and what it does that can be used again lands here and on the shelf.</p>
        )}
      </div>
    </Dialog>
  );
}

/** The button that opens it. */
export function LearnedButton({ size = "md" }: { size?: "md" | "sm" | "xs" }) {
  const count = useLearned((s) => Object.keys(s.lib.sites).length);
  return (
    <Button size={size} variant="outline" data-learned-open="" onClick={() => openLearned()}>
      <BookOpen />
      Learned from your sites{count ? ` (${count})` : ""}
    </Button>
  );
}

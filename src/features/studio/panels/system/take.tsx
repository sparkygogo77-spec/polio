"use client";
/**
 * "TAKE FROM THIS SITE", and which System the site uses.
 *
 * The take is read dry first (`takeFromSite({ dry: true })`): the dialog
 * says what was found, how many values will point at tokens and how many
 * stay one-offs, and that nothing on the board moves. Only "Take it" links
 * anything, in one undo step.
 *
 * THE LIBRARY. Sites share Systems (J, Q5). The picker lists every System
 * held; choosing one points the site at it (`pointSiteAt`: nothing is linked
 * until a take). "Own copy" gives the site a copy of its own to change apart
 * (`forkSite`), with every pointer kept.
 */
import * as React from "react";
import { Copy, Download, FilePlus2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Select } from "@/core/ui/select";
import { forkSite, newSystem, pointSiteAt, takeFromSite, useLibrary, type TakeAnswer } from "../../system/api";
import type { System } from "../../system/model";
import { useStudio } from "../../board/store";

const n = (x: number) => x.toLocaleString();
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

/** "Found 9 colours 6 text sizes …", from a dry take. */
export function foundLine(r: TakeAnswer): string[] {
  const f = r.report.found;
  return [
    plural(f.colours, "colour"), plural(f.sizes, "text size"), plural(f.faces, "face"), plural(f.space, "space step"),
    plural(f.corners, "corner"), plural(f.shadows, "shadow"), plural(f.durations + f.easings, "motion value"),
  ];
}

export function TakeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const name = useStudio((s) => s.brief?.name?.trim() || s.nodes.find((x) => x.from?.host)?.from?.host || "this site");
  const [dry, setDry] = React.useState<TakeAnswer | { ok: false; says: string } | null>(null);
  React.useEffect(() => {
    if (!open) { setDry(null); return; }
    /* A frame for the dialog to show first: a large site's read takes a quarter of a second. */
    const t = window.setTimeout(() => setDry(takeFromSite({ dry: true })), 30);
    return () => window.clearTimeout(t);
  }, [open]);
  const take = () => {
    const r = takeFromSite();
    if (!r.ok) { setDry(r); play("deny"); return; }
    play("confirm");
    onOpenChange(false);
  };
  const comps = dry?.ok ? dry.system.components.map((c) => c.name.toLowerCase()) : [];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={`Take the System from “${name}”`}
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" data-take-confirm="" disabled={!dry?.ok} onClick={take}>Take it</Button>
        </>
      )}
    >
      <div data-take-report="" className="space-y-2 text-xs text-fg">
        {!dry ? <p className="text-fg-muted">Reading the site…</p> : !dry.ok ? <p className="text-down">{dry.says}</p> : (
          <>
            <p><span className="text-fg-muted">Found </span>{foundLine(dry).join("  ")}</p>
            <p data-take-components={dry.report.found.components}>
              {plural(dry.report.found.components, "component")}{comps.length ? ` (${comps.join(", ")})` : ""}, {plural(dry.report.found.variants, "variant")}
            </p>
            <p data-take-linked={dry.report.linked} data-take-oneoffs={dry.report.oneOffs}>
              {plural(dry.report.linked, "value")} will point at tokens. {n(dry.report.oneOffs)} stay as they are (one-offs).
            </p>
            <p className="text-fg-muted">Nothing on the board moves.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** The head: which System, Take from this site, New, Own copy. */
export function SystemBar({ system }: { system: System | null }) {
  const library = useLibrary();
  const [taking, setTaking] = React.useState(false);
  const options = library.map((s) => ({ value: s.id, label: s.name }));
  if (system && !options.some((o) => o.value === system.id)) options.unshift({ value: system.id, label: system.name });
  return (
    <div data-system-bar="" className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Button size="xs" variant="primary" data-take-open="" onClick={() => { play("open"); setTaking(true); }}>
          <Download /> Take from this site
        </Button>
        <Button size="xs" variant="outline" data-system-new="" title="A new, empty System for this site" onClick={() => { play("confirm"); newSystem(); }}>
          <FilePlus2 /> New
        </Button>
      </div>
      {options.length ? (
        <div className="flex items-center gap-1">
          <Select
            aria-label="System this site uses"
            className="min-w-0 flex-1"
            value={system?.id ?? ""}
            placeholder="Use a System from the library"
            options={options}
            onChange={(id) => { if (id !== system?.id) { const r = pointSiteAt(id); play(r && "ok" in r && r.ok === false ? "deny" : "select"); } }}
          />
          {system ? (
            <Button size="xs" variant="outline" data-system-fork="" title="A copy of this System for this site alone: changing it changes no other site" onClick={() => { play("confirm"); forkSite(); }}>
              <Copy /> Own copy
            </Button>
          ) : null}
        </div>
      ) : null}
      <TakeDialog open={taking} onOpenChange={setTaking} />
    </div>
  );
}

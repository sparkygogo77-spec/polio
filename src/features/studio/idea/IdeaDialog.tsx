"use client";
/**
 * A NEW SITE FROM AN IDEA (create system (b), as J approved it).
 *
 * What is it, in a sentence or more; the sections wanted, if any; a site
 * liked, if any. Make a draft asks Claude once for a page plan of catalogue
 * parts and lays it out in the house style (`draft.ts`). Opened from the new
 * site's offer (`NewSiteOffer.tsx`). One draft: three drafts stay off by
 * default (J, Q8).
 */
import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Dialog } from "@/core/ui/dialog";
import { makeDraft, type Made } from "./draft";

const FROM_WORDS = { house: "the house style", site: "this site's System", theme: "a new System from your words (no System is marked as the house style yet)" } as const;

/** The sections as typed: commas or new lines between them. */
export const sectionsOf = (s: string): string[] => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 12);

export function IdeaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ids = React.useId();
  const [text, setText] = React.useState("");
  const [sections, setSections] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [made, setMade] = React.useState<Made | null>(null);

  const go = async () => {
    setBusy(true);
    try {
      setMade(await makeDraft({ text: text.trim(), sections: sectionsOf(sections), ref: ref.trim() || null }));
    } finally {
      setBusy(false);
    }
  };
  const close = (v: boolean) => { onOpenChange(v); if (!v) setMade(null); };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="A new site"
      description="Say what it is. Claude plans a first draft from Polio's parts, drawn in the house style."
      footer={made ? <Button onClick={() => close(false)} data-idea-done="">Edit the draft</Button> : (
        <>
          <Button variant="outline" onClick={() => close(false)} data-idea-blank="">Blank page instead</Button>
          <Button onClick={() => void go()} loading={busy} disabled={!text.trim()} data-idea-make=""><Sparkles /> Make a draft</Button>
        </>
      )}
    >
      {made ? (
        <div data-idea-made="" className="flex flex-col gap-2 text-xs text-fg-muted">
          <p><span className="font-medium text-fg">{made.plan.name}</span>: {made.plan.sections.length} sections, {made.parts} parts, drawn in {FROM_WORDS[made.style.from]} ({made.style.name}).</p>
          {made.plan.missing.length ? <p data-idea-missing="">Placeholders for what no part does yet: {made.plan.missing.map((m) => m.name).join(", ")}.</p> : null}
          {made.plain ? <p data-idea-plain="" className="text-warning">{made.plain}</p> : null}
          {made.spend?.dollars ? <p>The plan cost ${made.spend.dollars.toFixed(3)}.</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-fg-muted">
            <label htmlFor={`${ids}-what`}>What is it?</label>
            <Textarea id={`${ids}-what`} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="A booking site for a small pottery studio in Leeds. Classes, a shop, a gallery. Warm, hand-made, calm." data-idea-text="" />
          </div>
          <div className="flex flex-col gap-1 text-xs text-fg-muted">
            <label htmlFor={`${ids}-sections`}>Sections <span className="text-fg-subtle">— optional, commas between them</span></label>
            <Input id={`${ids}-sections`} value={sections} onChange={(e) => setSections(e.target.value)} placeholder="Classes, Shop, Gallery, About" autoComplete="off" data-idea-sections="" />
          </div>
          <div className="flex flex-col gap-1 text-xs text-fg-muted">
            <label htmlFor={`${ids}-ref`}>A site you like <span className="text-fg-subtle">— optional; Claude is told its address, nothing is fetched</span></label>
            <Input id={`${ids}-ref`} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://example.com" autoComplete="off" spellCheck={false} data-idea-ref="" />
          </div>
        </div>
      )}
    </Dialog>
  );
}

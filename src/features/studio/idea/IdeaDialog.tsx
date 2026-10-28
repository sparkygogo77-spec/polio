"use client";
/**
 * A NEW SITE FROM AN IDEA (create system (b), as J approved it), in versions.
 *
 *   1. What is it, in a sentence or more; the sections wanted, if any; a site
 *      liked, if any. Ask Claude makes three or four clearly different
 *      versions in ONE call; Make them here makes three free, from the
 *      catalogue, with no call (`versionsRun.ts#askVersions`).
 *   2. The versions side by side, page by page (`VersionsPicker.tsx`). J
 *      ticks which pages J wants and from which version; Build makes only
 *      those the site, with links between them, as one undo step.
 *   3. The suggested words, line by line. Each goes in only when J accepts
 *      it: nothing is written into the site unasked.
 *
 * Opened from the new site's offer (`NewSiteOffer.tsx`).
 */
import * as React from "react";
import { ArrowLeft, Check, Sparkles, Shuffle } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Dialog } from "@/core/ui/dialog";
import { VariationsLink } from "../ThemePanel";
import { acceptOffer, askVersions, buildPicked, offerOpen, styleFor, type Asked, type Built, type Style } from "./versionsRun";
import { VersionsPicker } from "./VersionsPicker";
import type { Picks } from "./versions";

const FROM_WORDS = { house: "the house style", site: "this site's System", theme: "a new System from your words (no System is marked as the house style yet)" } as const;

/** The sections as typed: commas or new lines between them. */
export const sectionsOf = (s: string): string[] => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 12);

type Step = { at: "ask" } | { at: "pick"; asked: Asked; style: Style } | { at: "built"; asked: Asked; built: Built };

export function IdeaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ids = React.useId();
  const [text, setText] = React.useState("");
  const [sections, setSections] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [busy, setBusy] = React.useState<"claude" | "local" | null>(null);
  const [step, setStep] = React.useState<Step>({ at: "ask" });
  const [picks, setPicks] = React.useState<Picks>({});
  const [taken, setTaken] = React.useState<Set<string>>(new Set());

  const go = async (claude: boolean) => {
    setBusy(claude ? "claude" : "local");
    try {
      const idea = { text: text.trim(), sections: sectionsOf(sections), ref: ref.trim() || null };
      const asked = await askVersions(idea, { claude });
      setPicks({});
      setStep({ at: "pick", asked, style: styleFor(idea, asked.versions.name) });
    } finally {
      setBusy(null);
    }
  };
  const build = () => {
    if (step.at !== "pick") return;
    setTaken(new Set());
    setStep({ at: "built", asked: step.asked, built: buildPicked(step.asked.versions, picks, step.style) });
  };
  const close = (v: boolean) => { onOpenChange(v); if (!v) { setStep({ at: "ask" }); setPicks({}); } };
  const ticked = Object.keys(picks).length;

  const footer = step.at === "built" ? <Button onClick={() => close(false)} data-idea-done="">Done</Button>
    : step.at === "pick" ? (
      <>
        <Button variant="outline" onClick={() => setStep({ at: "ask" })} data-idea-back=""><ArrowLeft /> Back</Button>
        <Button onClick={build} disabled={!ticked} data-idea-build="">Build {ticked || ""} {ticked === 1 ? "page" : "pages"}</Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={() => close(false)} data-idea-blank="">Blank page instead</Button>
        <Button variant="outline" onClick={() => void go(false)} loading={busy === "local"} disabled={!text.trim() || !!busy} data-idea-local=""><Shuffle /> Make them here (free)</Button>
        <Button onClick={() => void go(true)} loading={busy === "claude"} disabled={!text.trim() || !!busy} data-idea-make=""><Sparkles /> Ask Claude</Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size={step.at === "pick" ? "xl" : step.at === "built" ? "lg" : "md"}
      title="A new site"
      description={step.at === "pick" ? "Tick the pages you want, each from the version you like it in." : step.at === "built" ? "Your pages are built. The words are suggestions: take the ones you want." : "Say what it is. You get three or four different versions to pick pages from, in the house style."}
      footer={footer}
    >
      {step.at === "built" ? (
        <BuiltView asked={step.asked} built={step.built} taken={taken} onTake={(id) => setTaken((s) => new Set(s).add(id))} />
      ) : step.at === "pick" ? (
        <div className="flex flex-col gap-2">
          {step.asked.plain ? <p data-idea-plain="" className="text-warning">{step.asked.plain}</p> : null}
          <VersionsPicker versions={step.asked.versions} system={step.style.system} picks={picks} onPicks={setPicks} />
          <p className="text-fg-muted">
            {step.asked.versions.by === "claude" ? "Made by Claude in one call" : "Made here from the catalogue, free"}, drawn in {FROM_WORDS[step.style.from]}.
            {step.asked.spend?.dollars ? ` The call cost $${step.asked.spend.dollars.toFixed(3)}.` : ""}
            {step.asked.versions.missing.length ? ` Placeholders for what no part does yet: ${step.asked.versions.missing.map((m) => m.name).join(", ")}.` : ""}
          </p>
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

/** What was built, and the suggested words, one line each, each put in only when accepted. */
function BuiltView({ asked, built, taken, onTake }: { asked: Asked; built: Built; taken: Set<string>; onTake: (id: string) => void }) {
  const pages = [...new Set(built.offers.map((o) => o.page))];
  return (
    <div data-idea-made="" className="flex flex-col gap-2 text-xs text-fg-muted">
      <p><span className="font-medium text-fg">{asked.versions.name}</span>: {built.pages} {built.pages === 1 ? "page" : "pages"}, {built.parts} parts, drawn in {FROM_WORDS[built.style.from]} ({built.style.name}). One undo takes it all back.</p>
      <div className="flex items-center justify-between gap-2">
        <span>Lock what you like and randomize the rest:</span>
        <VariationsLink bare />
      </div>
      {built.offers.length ? (
        <div data-idea-words="" className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {pages.map((page) => (
            <div key={page} className="flex flex-col gap-1">
              <span className="font-medium text-fg">{page}</span>
              {built.offers.filter((o) => o.page === page).map((o) => {
                const done = taken.has(o.id);
                const open = !done && offerOpen(o);
                return (
                  <div key={o.id} data-word-offer={o.id} className="flex items-start gap-2 rounded-md border border-border px-2 py-1">
                    <span className="min-w-0 flex-1"><span className="text-fg-subtle">{o.part}: </span><span className="text-fg">{o.to}</span></span>
                    {done ? <span data-word-taken="" className="inline-flex items-center gap-1 text-success"><Check className="size-3" /> In</span>
                      : <Button size="xs" variant="outline" disabled={!open} onClick={() => { if (acceptOffer(o)) onTake(o.id); }} data-word-accept="">Use</Button>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

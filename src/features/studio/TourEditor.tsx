"use client";
/**
 * A "What's new" card's steps, in the Element panel (`tour.ts`).
 *
 * One to six steps. Each is about a feature the site really has, picked
 * from a list the Builder reads off the board (the parts as the Element
 * list names them, the features working on them, the sections, and the
 * backend features the site carries, or what is missing for one); its
 * words and its one button are typed here and drawn on the board as typed.
 * Then when it shows, and "Mark a new update", which moves what is shown
 * now to "See previous updates" and shows the card once more to everyone.
 */
import * as React from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";
import { Select } from "@/core/ui/select";
import { Textarea } from "@/core/ui/textarea";
import { play } from "@/core/audio/engine";
import { useStudio, type StudioNode } from "./board/store";
import { getFeature } from "./catalog";
import { getWork } from "./library/works";
import {
  ACTION_WORDS, MAX_STEPS, SITE_OPTIONS, WHEN_WORDS, blankStep, markUpdate, stepFor, tourChoices, tourOf, withSteps,
  type TourActionKind, type TourChoice, type TourStep, type TourWhen,
} from "./tour";

const featureName = (id: string) => getFeature(id)?.name;
const workName = (id: string) => getWork(id)?.manifest.name;
const workKind = (id: string) => getWork(id)?.manifest.category;

export function TourEditor({ node }: { node: StudioNode }) {
  const nodes = useStudio((s) => s.nodes);
  const pages = useStudio((s) => s.pages);
  const siteName = useStudio((s) => s.brief.name);
  const tour = tourOf(node);
  const steps = tour.current.steps;
  const at = Math.max(0, Math.min(steps.length - 1, tour.at ?? 0));
  const choices = React.useMemo(
    () => tourChoices(nodes as never, { pageId: node.pageId, self: node.id, siteName, featureName, workName, workKind }),
    [nodes, node.pageId, node.id, siteName],
  );
  const save = (t: typeof tour) => useStudio.getState().updateNode(node.id, { tour: t });
  const setStep = (i: number, patch: Partial<TourStep>) => save(withSteps(tour, steps.map((s, j) => (j === i ? { ...s, ...patch } : s))));
  const [adding, setAdding] = React.useState(steps.length === 0);

  const add = (c: TourChoice | null) => {
    if (steps.length >= MAX_STEPS) return;
    play("confirm");
    const next = [...steps, c ? stepFor(c) : blankStep()];
    save({ ...withSteps(tour, next), at: next.length - 1 });
    setAdding(false);
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    save({ ...withSteps(tour, next), at: j });
  };
  const remove = (i: number) => {
    play("close");
    save({ ...withSteps(tour, steps.filter((_, j) => j !== i)), at: Math.max(0, i - 1) });
  };

  return (
    <div data-tour-editor={node.id} className="space-y-3">
      <div className="space-y-1">
        <span className="block text-small font-medium uppercase tracking-wider text-fg-faint">When it shows</span>
        <Segmented
          size="xs"
          aria-label="When it shows"
          data-tour-when-field=""
          value={tour.when}
          onChange={(v) => save({ ...tour, when: v as TourWhen })}
          options={(Object.keys(WHEN_WORDS) as TourWhen[]).map((w) => ({ value: w, label: WHEN_WORDS[w] }))}
        />
        <p className="text-fine leading-snug text-fg-muted">
          {tour.when === "first"
            ? "Once, the first time someone visits. Each visitor's browser remembers it."
            : tour.when === "update"
              ? "Once per update: each visitor sees an update once, and again when you mark a new one."
              : "Never on its own: a link to this card (or to #whats-new) opens it. Set a part's Links to this card."}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-small font-medium uppercase tracking-wider text-fg-faint">Steps</span>
          <span className="num text-fine text-fg-faint">{steps.length} of {MAX_STEPS}</span>
        </div>
        {steps.map((s, i) => (
          <StepRow
            key={i}
            step={s}
            index={i}
            count={steps.length}
            open={i === at}
            choices={choices}
            pages={pages.map((p) => ({ id: p.id, name: p.name }))}
            onOpen={() => save({ ...tour, at: i })}
            onChange={(patch) => setStep(i, patch)}
            onMove={(by) => move(i, by)}
            onRemove={() => remove(i)}
          />
        ))}
        {steps.length < MAX_STEPS ? (
          adding ? (
            <FeaturePicker choices={choices} onPick={(c) => add(c)} onCancel={steps.length ? () => setAdding(false) : undefined} />
          ) : (
            <Button size="xs" variant="outline" data-tour-add="" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> Add a step
            </Button>
          )
        ) : (
          <p className="text-fine text-fg-muted">Six steps is the most a card holds: a visitor reads three.</p>
        )}
      </div>

      <div className="space-y-1 border-t border-border pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-small text-fg">Update {tour.current.id}<span className="text-fg-faint"> · {tour.current.date}</span></span>
          <Button
            size="xs"
            variant="outline"
            data-tour-mark=""
            disabled={!steps.length}
            onClick={() => { play("confirm"); save(markUpdate(tour)); }}
          >
            Mark a new update
          </Button>
        </div>
        <p className="text-fine leading-snug text-fg-muted">
          Shows the card once more to every visitor; what it shows now moves to “See previous updates”{tour.past.length ? ` (${tour.past.length} there now)` : ""}.
        </p>
      </div>
    </div>
  );
}

function StepRow({ step, index, count, open, choices, pages, onOpen, onChange, onMove, onRemove }: {
  step: TourStep; index: number; count: number; open: boolean; choices: TourChoice[];
  pages: { id: string; name: string }[];
  onOpen: () => void; onChange: (p: Partial<TourStep>) => void; onMove: (by: -1 | 1) => void; onRemove: () => void;
}) {
  const [picking, setPicking] = React.useState(false);
  const about = choices.find((c) => c.id && c.id === step.target);
  const sections = choices.filter((c) => c.group === "Sections");
  const linkValue = step.link ? `${step.link.kind}:${step.link.target}` : "";
  return (
    <div data-tour-step-row={index} data-open={open ? "" : undefined} className="rounded-md border border-border">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" onClick={onOpen} className="tactile flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="num shrink-0 text-fine text-fg-faint">{index + 1}</span>
          <span className="truncate text-plain text-fg">{step.title || "Untitled step"}</span>
        </button>
        <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="tactile rounded-xs p-0.5 text-fg-faint hover:text-fg disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
        <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className="tactile rounded-xs p-0.5 text-fg-faint hover:text-fg disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
        <button type="button" aria-label="Remove this step" data-tour-remove="" onClick={onRemove} className="tactile rounded-xs p-0.5 text-fg-faint hover:text-fg"><X className="size-3.5" /></button>
      </div>
      {open ? (
        <div className="space-y-2 border-t border-border p-2">
          <div className="space-y-0.5">
            <span className="text-fine text-fg-faint">Shows on top</span>
            {picking ? (
              <FeaturePicker choices={choices} onPick={(c) => { onChange({ target: c.id || null, ...(step.title ? null : { title: c.title }) }); setPicking(false); }} onCancel={() => setPicking(false)} />
            ) : (
              <button type="button" data-tour-target-field="" onClick={() => setPicking(true)} className="tactile flex w-full items-center justify-between gap-2 rounded-sm border border-border px-2 py-1 text-left text-plain hover:bg-hover">
                <span className="truncate">{about ? about.name : step.target ? "A part not on this page any more" : "Words only"}</span>
                {about?.where ? <span className="shrink-0 text-fine text-fg-faint">{about.where}</span> : null}
              </button>
            )}
          </div>
          <label className="block space-y-0.5">
            <span className="text-fine text-fg-faint">Title</span>
            <Input inputSize="sm" data-tour-title-field="" value={step.title} placeholder="Copy the address in one press" onChange={(e) => onChange({ title: e.target.value })} />
          </label>
          <label className="block space-y-0.5">
            <span className="text-fine text-fg-faint">Two or three lines</span>
            <Textarea data-tour-lines-field="" rows={3} value={step.lines} placeholder={"One plain line per line.\nNo more than three."} onChange={(e) => onChange({ lines: e.target.value.split("\n").slice(0, 3).join("\n") })} />
          </label>
          <div className="space-y-1">
            <span className="text-fine text-fg-faint">Its button</span>
            <Select
              aria-label="What its button does"
              value={step.action}
              onChange={(v) => onChange({ action: v as TourActionKind })}
              options={(Object.keys(ACTION_WORDS) as TourActionKind[]).map((k) => ({ value: k, label: ACTION_WORDS[k] }))}
            />
            {step.action !== "none" ? (
              <Input inputSize="sm" data-tour-button-field="" value={step.button} placeholder="Turn it on" aria-label="The button's words" onChange={(e) => onChange({ button: e.target.value })} />
            ) : null}
            {(step.action === "scroll" || step.action === "open") && !step.target ? (
              <p className="text-fine text-fg-muted">Pick what the step shows first: the button {step.action === "scroll" ? "scrolls to" : "presses"} it.</p>
            ) : null}
            {step.action === "option" ? (
              <div className="space-y-1">
                <Select
                  aria-label="Which option"
                  value={step.option || ""}
                  placeholder="Pick an option"
                  onChange={(v) => onChange({ option: v, path: step.path || `Settings › ${SITE_OPTIONS.find((o) => o.id === v)?.name ?? v}` })}
                  options={SITE_OPTIONS.map((o) => ({ value: o.id, label: o.name, description: o.does }))}
                />
                <p className="text-fine leading-snug text-fg-muted">The site has no dark look or sounds a visitor can switch yet; add them in Format first and they will be listed here.</p>
              </div>
            ) : null}
            {step.action === "link" ? (
              <Select
                aria-label="Where it goes"
                value={linkValue}
                placeholder="A page or a section of this site"
                onChange={(v) => { const [kind, ...rest] = v.split(":"); onChange({ link: { kind: kind as "page" | "node", target: rest.join(":") } }); }}
                options={[
                  ...pages.map((p) => ({ value: `page:${p.id}`, label: `Page: ${p.name}` })),
                  ...sections.map((c) => ({ value: `node:${c.id}`, label: c.name })),
                ]}
              />
            ) : null}
          </div>
          <details className="group">
            <summary className="cursor-pointer text-fine text-fg-faint">Advanced: where to find it</summary>
            <label className="mt-1 block space-y-0.5">
              <span className="text-fine text-fg-faint">A path to it, with a switch when the button turns an option on</span>
              <Input inputSize="sm" data-tour-path-field="" value={step.path} placeholder="Settings › Alerts" onChange={(e) => onChange({ path: e.target.value })} />
            </label>
          </details>
        </div>
      ) : null}
    </div>
  );
}

/** The site's features to pick from, searchable, grouped; a missing one says what it needs. */
function FeaturePicker({ choices, onPick, onCancel }: { choices: TourChoice[]; onPick: (c: TourChoice) => void; onCancel?: () => void }) {
  const [q, setQ] = React.useState("");
  const find = q.trim().toLowerCase();
  const hits = choices.filter((c) => !find || `${c.name} ${c.where ?? ""}`.toLowerCase().includes(find));
  const SHOWN = 60;
  const groups = ["On this page", "Features", "Sections", "Needs a backend"] as const;
  return (
    <div data-tour-picker="" className="space-y-1 rounded-md border border-border p-1.5">
      <div className="flex items-center gap-1">
        <Input inputSize="sm" autoFocus data-tour-picker-search="" value={q} placeholder="Find a part, a feature or a section" aria-label="Find what the step shows" onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1" />
        {onCancel ? <Button size="xs" variant="ghost" onClick={onCancel}>Cancel</Button> : null}
      </div>
      <div className="max-h-56 overflow-y-auto">
        {groups.map((g) => {
          const rows = hits.filter((c) => c.group === g).slice(0, SHOWN);
          if (!rows.length) return null;
          return (
            <div key={g} className="py-0.5">
              <div className="px-1 text-fine uppercase tracking-wider text-fg-faint">{g}</div>
              {rows.map((c, i) => (
                <button
                  key={`${c.id}-${c.name}-${i}`}
                  type="button"
                  data-tour-choice={c.id || undefined}
                  data-tour-missing={c.missing ? "" : undefined}
                  disabled={!!c.missing}
                  title={c.missing ?? c.name}
                  onClick={() => onPick(c)}
                  className="tactile flex w-full flex-col items-start rounded-sm px-1.5 py-1 text-left hover:bg-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="min-w-0 truncate text-plain text-fg">{c.name}</span>
                    {c.where ? <span className="shrink-0 text-fine text-fg-faint">{c.where}</span> : null}
                  </span>
                  {c.missing ? <span className="text-fine leading-snug text-fg-muted">{c.missing}</span> : null}
                </button>
              ))}
              {hits.filter((c) => c.group === g).length > SHOWN ? <div className="px-1.5 text-fine text-fg-faint">Type to find more</div> : null}
            </div>
          );
        })}
        {!hits.length ? <p className="px-1.5 py-2 text-fine text-fg-muted">Nothing on the site matches “{q}”.</p> : null}
      </div>
      <button type="button" onClick={() => onPick({ id: "", group: "On this page", name: "", where: null, title: "", lines: "", action: "none", button: "" })} className="tactile px-1.5 text-fine text-fg-muted underline">
        A step with words only
      </button>
    </div>
  );
}

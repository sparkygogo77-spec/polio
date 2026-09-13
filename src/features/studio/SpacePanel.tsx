"use client";
/**
 * One element's own panel, inside a space.
 *
 * Every element that lands inside an open black hole gets this, on the
 * right, distinct from the column on the left: what it is, what was asked,
 * which model the route will send it to, and the order of the tasks it will
 * go through. It is the place a person steers one thing without touching
 * the rest, so everything on it writes to this one node and nothing else.
 *
 * The model and the order are read off `planFor` (`space.ts`), which asks
 * the route the same question the run asks it, so what is named here is
 * what would be used. Changing either writes `node.plan`; "Let the route
 * decide" takes it away again.
 *
 * Words are typed on a screen (`SCREEN_FIELD`), choices are keys, and a
 * readout between two arrows is how a choice that is only words is made.
 * Never a dropdown.
 */
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, RotateCcw, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { SCREEN, VOID, screenFace } from "@/core/ui/void";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { getFeature } from "./catalog";
import { STEPS, type Step } from "./imageRoute";
import { KIND_MEANS } from "./shapeKind";
import { moveStep, planFor, spaceBox, STEP_MEANS, type Plan, type Space } from "./space";
import { choicesFor, readingOf, writePlan } from "./planEdit";
import { useStudio, type StudioNode } from "./store";
import { SCREEN_FIELD } from "./PlateEditors";
import { FromASite } from "./FromASite";

/**
 * The space's own panel, for a hole with nothing in it yet.
 *
 * The per-element panel needs an element, so an empty hole had no way to
 * reach From a site at all — which is where a recreation would land. This
 * is the same panel about the space rather than about one part in it: what
 * it is for, how anything made in it is to be made, and the way to point
 * at something real.
 */
export function SpaceOwnPanel({ space }: { space: Space }) {
  const update = useStudio((s) => s.updateSpace);
  /* The plan read as if the space were the thing being made, off its own
     box and its own words, so the space and the parts in it are steered by
     the same control saying the same things. */
  const box = spaceBox(space);
  const reading = React.useMemo(() => planFor({
    label: space.label || "This space", prompt: space.prompt, featureId: "custom-idea",
    w: Math.round(box.w), h: Math.round(box.h), plan: space.plan ?? null,
  }), [space, box.w, box.h]);
  const write = (patch: Partial<Plan>) => {
    const plan: Plan = { model: space.plan?.model ?? null, steps: space.plan?.steps?.length ? space.plan.steps : reading.steps, ...patch };
    update(space.id, { plan });
  };
  return (
    <div className="flex h-full min-h-0 flex-col text-[11px]">
      <div className="shrink-0 border-b px-3 py-2" style={{ borderColor: VOID.rim }}>
        <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>This space</div>
        <Input
          aria-label="What this space is called"
          data-space-name=""
          value={space.label}
          placeholder="A black hole"
          onChange={(e) => update(space.id, { label: e.target.value })}
          className={cn("mt-1 h-7 text-[12px] font-semibold", SCREEN_FIELD)}
        />
        <div className="mt-1 text-[10px]" style={{ color: VOID.muted }}>nothing in it yet</div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
        <section>
          <Label>What it is for</Label>
          <Textarea
            autoGrow rows={3} aria-label="What this space is for" data-space-prompt=""
            placeholder="Say what belongs in here. Everything made in it starts from this."
            value={space.prompt}
            onChange={(e) => update(space.id, { prompt: e.target.value })}
            className={cn("text-[11px]", SCREEN_FIELD)}
          />
        </section>
        <section>
          <Label>Anything made here goes this way</Label>
          <Steps reading={reading} write={write} />
        </section>
        <FromASite space={space} />
      </div>
      {space.plan ? (
        <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: VOID.rim }}>
          <button
            type="button" data-space-plan-reset=""
            onClick={() => { play("tap"); update(space.id, { plan: null }); }}
            className="tactile flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px]"
            style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
          >
            <RotateCcw className="size-3" />
            Let the route decide
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The order, as a list with earlier, later and leave-out keys. One control, two subjects. */
function Steps({ reading, write }: { reading: ReturnType<typeof planFor>; write: (p: Partial<Plan>) => void }) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= reading.steps.length) return;
    play("tick");
    write({ steps: moveStep(reading.steps, from, to) });
  };
  const left = STEPS.filter((st) => !reading.steps.includes(st));
  return (
    <>
      <ol data-space-steps="" className="space-y-1">
        {reading.steps.map((st, i) => (
          <li key={st} data-space-step={st} className="flex items-center gap-1 rounded-md px-1.5 py-1" style={screenFace}>
            <span className="w-3 text-center font-mono text-[10px]" style={{ color: SCREEN.dim }}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-mono" style={{ color: SCREEN.ink }}>{STEP_MEANS[st]}</span>
            <Key title="Earlier" onClick={() => move(i, i - 1)} disabled={i === 0} testId={`space-step-up-${st}`}><ArrowUp /></Key>
            <Key title="Later" onClick={() => move(i, i + 1)} disabled={i === reading.steps.length - 1} testId={`space-step-down-${st}`}><ArrowDown /></Key>
            <Key title="Leave this step out" onClick={() => { if (reading.steps.length > 1) { play("tap"); write({ steps: reading.steps.filter((s) => s !== st) }); } }} disabled={reading.steps.length <= 1} testId={`space-step-drop-${st}`}><X /></Key>
          </li>
        ))}
      </ol>
      {left.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {left.map((st) => (
            <button
              key={st} type="button" data-space-step-add={st}
              onClick={() => { play("tap"); write({ steps: [...reading.steps, st] }); }}
              className="tactile flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
              style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.muted }}
              title="Put this step back, at the end"
            >
              <Plus className="size-2.5" />
              {STEP_MEANS[st]}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function SpacePanel({ node, space }: { node: StudioNode; space: Space }) {
  const reading = React.useMemo(() => readingOf(node), [node]);
  const feature = getFeature(node.featureId);
  const update = useStudio((s) => s.updateNode);
  const setPlan = useStudio((s) => s.setPlan);

  /*
   * The models that can take this job, so the arrows step through real
   * choices and never land on one that would be refused and silently
   * swapped — and in the route's own order, first being what it would take
   * unasked.
   *
   * This used to put every model in `MODELS` through `planFor` and keep the
   * survivors. That agreed with `modelsFor` on all four shapes it was
   * measured against — same models, same order, same first — so this is one
   * derivation replacing two that matched, not a fix. Two derivations of the
   * same fact is how the left panel and this one would come to disagree
   * after a change to the table, which is the thing that must not happen.
   */
  const choices = React.useMemo(() => choicesFor(node, reading).map((c) => c.slug), [node, reading]);

  const write = (patch: Partial<Plan>) => writePlan(node, reading, patch);
  const stepModel = (dir: 1 | -1) => {
    if (!choices.length) return;
    const at = reading.model ? choices.indexOf(reading.model.slug) : -1;
    const next = choices[(at + dir + choices.length) % choices.length]!;
    play("tick");
    write({ model: next });
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= reading.steps.length) return;
    play("tick");
    write({ steps: moveStep(reading.steps, from, to) });
  };
  const drop = (st: Step) => {
    if (reading.steps.length <= 1) return;
    play("tap");
    write({ steps: reading.steps.filter((s) => s !== st) });
  };
  const add = (st: Step) => {
    play("tap");
    write({ steps: [...reading.steps, st] });
  };
  const left = STEPS.filter((st) => !reading.steps.includes(st));
  const what = [feature?.name ?? node.featureId, node.kind ? KIND_MEANS[node.kind] : null, node.role ? `a ${node.role}` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-col text-[11px]">
      {/* What it is */}
      <div className="shrink-0 border-b px-3 py-2" style={{ borderColor: VOID.rim }}>
        <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>In this space</div>
        <Input
          aria-label="What it is"
          data-space-what=""
          value={node.label}
          onChange={(e) => update(node.id, { label: e.target.value })}
          className={cn("mt-1 h-7 text-[12px] font-semibold", SCREEN_FIELD)}
        />
        <div className="mt-1 truncate text-[10px]" style={{ color: VOID.muted }} title={what}>{what}</div>
        <div className="mt-0.5 truncate text-[10px]" style={{ color: VOID.muted }}>in {space.label.trim() || "a black hole"}</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {/* What was asked */}
        <section>
          <Label>What was asked</Label>
          <Textarea
            autoGrow
            rows={3}
            aria-label="What was asked"
            data-space-asked=""
            placeholder={node.sketch?.words ? node.sketch.words : "Say what this should be."}
            value={node.prompt}
            onChange={(e) => update(node.id, { prompt: e.target.value })}
            className={cn("text-[11px]", SCREEN_FIELD)}
          />
        </section>

        {/* The model */}
        <section>
          <Label>{reading.chosen ? "Sent to, as you chose" : "The route will send it to"}</Label>
          <div className="flex items-center gap-1 rounded-md p-1" style={screenFace}>
            <Key title="The model before this one" onClick={() => stepModel(-1)} disabled={choices.length < 2}><ChevronLeft /></Key>
            <div data-space-model={reading.model?.slug ?? ""} className="min-w-0 flex-1 truncate text-center font-mono text-[11px]" style={{ color: reading.model ? SCREEN.ink : SCREEN.dim }} title={reading.model?.slug}>
              {reading.model ? reading.model.name : why(reading.why)}
            </div>
            <Key title="The model after this one" onClick={() => stepModel(1)} disabled={choices.length < 2}><ChevronRight /></Key>
          </div>
          <div className="mt-1 text-[10px]" style={{ color: VOID.muted }}>
            {reading.making === "icon" ? "A mark" : reading.making === "type" ? "Type" : reading.making === "object" ? "A solid" : reading.making === "surface" ? "A ground" : "A picture"}
            {reading.model ? `, one of ${choices.length} that can take it` : ""}
          </div>
        </section>

        {/* The order */}
        <section>
          <Label>{reading.ordered ? "In your order" : "In this order"}</Label>
          <ol data-space-steps="" className="space-y-1">
            {reading.steps.map((st, i) => (
              <li key={st} data-space-step={st} className="flex items-center gap-1 rounded-md px-1.5 py-1" style={screenFace}>
                <span className="w-3 text-center font-mono text-[10px]" style={{ color: SCREEN.dim }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-mono" style={{ color: SCREEN.ink }}>{STEP_MEANS[st]}</span>
                <Key title="Earlier" onClick={() => move(i, i - 1)} disabled={i === 0} testId={`space-step-up-${st}`}><ArrowUp /></Key>
                <Key title="Later" onClick={() => move(i, i + 1)} disabled={i === reading.steps.length - 1} testId={`space-step-down-${st}`}><ArrowDown /></Key>
                <Key title="Leave this step out" onClick={() => drop(st)} disabled={reading.steps.length <= 1} testId={`space-step-drop-${st}`}><X /></Key>
              </li>
            ))}
          </ol>
          {left.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {left.map((st) => (
                <button
                  key={st}
                  type="button"
                  data-space-step-add={st}
                  onClick={() => add(st)}
                  className="tactile flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
                  style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.muted }}
                  title="Put this step back, at the end"
                >
                  <Plus className="size-2.5" />
                  {STEP_MEANS[st]}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/*
          And the other way to fill a space: point at something real.
          Below the steering rather than above it, because most elements in
          a space were put there rather than recreated, and a section that
          asks for a web address at the top of a panel about *this* part
          would read as the panel's subject.
        */}
        <FromASite space={space} />
      </div>

      {/* The way back to the route's own judgement, below the reading matter and never cut by it. */}
      {node.plan ? (
        <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: VOID.rim }}>
          <button
            type="button"
            data-space-plan-reset=""
            onClick={() => { play("tap"); setPlan(node.id, null); }}
            className="tactile flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px]"
            style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
          >
            <RotateCcw className="size-3" />
            Let the route decide
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[9px] uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>{children}</div>;
}

/** A small key on a screen: the screen's own box, in its colours. */
function Key({ children, onClick, disabled, title, testId }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; testId?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="tactile flex size-5 shrink-0 items-center justify-center rounded-[4px] disabled:opacity-30 [&_svg]:size-3"
      style={{ background: SCREEN.key, color: SCREEN.ink, boxShadow: `inset 0 0 0 1px ${SCREEN.line}` }}
    >
      {children}
    </button>
  );
}

function why(w: string | null): string {
  switch (w) {
    case "not-a-model-job": return "Not a model's job";
    case "nothing-serves": return "Nothing in the table takes this";
    case "cannot-take-an-image": return "Nothing that takes a picture";
    case "cannot-do-alpha": return "Nothing that can leave the ground out";
    default: return "No model yet";
  }
}

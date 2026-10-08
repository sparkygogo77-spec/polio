"use client";
/**
 * A part's plan, as two panels read and write it.
 *
 * `node.plan` is one field and there are two places that edit it: create
 * space's panel at the right of the board, for a part inside an open hole,
 * and the audit section in the left panel, for whatever is selected. The
 * rule is that they can never disagree, and the way to keep a rule like that
 * is to give both of them one answer to derive from rather than two
 * derivations that happen to match.
 *
 * They did happen to match. Measured before this file existed, across a
 * plain element, an icon, a picture and a shape cut to a line, the right
 * panel's own loop — every model in `MODELS` put through `planFor` to see
 * which survived — returned the same models in the same order as
 * `modelsFor`, and the first was the route's own pick in all four. So this
 * is not a bug being fixed. It is one derivation instead of two, which is
 * what stops the next change to the table moving one panel and not the
 * other.
 *
 * Nothing here draws. What each control looks like is the panel's business;
 * what there is to control is this.
 */
import {
  inputFor, model, modelsFor, optionsFor,
  type ImageModel, type ModelCard, type ModelField, type Step,
} from "./pictures";
import { planFor, type Plan, type Reading } from "./space";
import { useStudio, type StudioNode } from "./board/store";
import { plain } from "./shelf";

/** What the plan understands about a node. A subset, so this stays free of the board. */
export function planned(n: StudioNode) {
  return {
    label: n.label,
    prompt: n.prompt,
    featureId: n.featureId,
    w: n.w,
    h: n.h,
    role: n.role,
    outline: n.outline,
    content: plain(n.content),
    pictureKind: n.vector ? "vector" : null,
    plan: n.plan ?? null,
    sketch: n.sketch ? { words: n.sketch.words } : null,
  };
}

/** What the route would do with this part right now. */
export function readingOf(n: StudioNode): Reading {
  return planFor(planned(n));
}

/**
 * The step a model is actually asked for.
 *
 * Not `steps[0]`: the first step is usually `read`, which is the drawing
 * being looked at rather than anything being drawn, and no model serves it.
 * Asking the table for `read` returns nothing at all — which is what it did
 * the first time this was written, and it read as "no model serves this
 * part" rather than as the wrong question.
 */
export function askedStep(steps: readonly Step[]): Step {
  return steps.find((st) => st !== "read") ?? "first";
}

/** Every model that serves this part, in the route's own order. The first is what it would take unasked. */
export function choicesFor(n: StudioNode, reading = readingOf(n)): ModelCard[] {
  return modelsFor({
    making: reading.making,
    step: askedStep(reading.steps),
    clipped: !!n.outline,
    fromImage: askedStep(reading.steps) !== "first",
  });
}

/**
 * What the route would send this model, before anybody overrides anything.
 *
 * The panel shows a managed field's routed value with this: `inputFor` is
 * the same call the run makes, and it applies a person's options last, so
 * asking it with none is exactly "what would happen if I said nothing".
 */
export function routeFills(m: ImageModel, n: StudioNode, reading: Reading): Record<string, unknown> {
  return inputFor(m, {
    prompt: reading.asked,
    w: n.w,
    h: n.h,
    step: askedStep(reading.steps),
    options: null,
  });
}

/** A patch onto the node's plan, keeping whatever the plan already said. */
export function writePlan(n: StudioNode, reading: Reading, patch: Partial<Plan>): void {
  const plan: Plan = {
    model: n.plan?.model ?? null,
    steps: n.plan?.steps?.length ? n.plan.steps : reading.steps,
    options: n.plan?.options ?? null,
    ...patch,
  };
  useStudio.getState().setPlan(n.id, plan);
}

/**
 * One option set, held to what the model takes.
 *
 * Every write goes through `optionsFor`, so a field the model does not have
 * never reaches the document — a model given a field it does not know fails
 * the whole call, and the panel is the place a person can most easily ask
 * for one, by picking a model after setting something on another.
 */
export function writeOption(n: StudioNode, reading: Reading, slug: string | null, name: string, value: unknown): void {
  const m = slug ? model(slug) : reading.model;
  if (!m) return;
  const raw = { ...(n.plan?.options ?? {}), [name]: value };
  const held = optionsFor(m, raw);
  writePlan(n, reading, { options: Object.keys(held).length ? held : null });
}

/** Take one option back off, so the route decides it again. */
export function clearOption(n: StudioNode, reading: Reading, name: string): void {
  const rest = { ...(n.plan?.options ?? {}) };
  delete rest[name];
  writePlan(n, reading, { options: Object.keys(rest).length ? rest : null });
}

/**
 * What a field is showing, and where the value came from.
 *
 * Three cases the panel has to tell apart, because they read differently to
 * a person: the field is theirs and they set it; the route fills it and this
 * is what it chose; or nobody has said anything and the model's own default
 * stands.
 */
export type FieldSource = "set" | "routed" | "default";

export function valueOf(
  f: ModelField,
  n: StudioNode,
  filled: Record<string, unknown>,
): { value: unknown; from: FieldSource } {
  const mine = n.plan?.options ?? {};
  if (f.name in mine && mine[f.name] !== undefined) return { value: mine[f.name], from: "set" };
  if (f.managed && f.name in filled) return { value: filled[f.name], from: "routed" };
  return { value: f.default, from: "default" };
}

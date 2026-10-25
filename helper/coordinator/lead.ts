/**
 * The lead: one Claude call reads J's request, its context chips and the
 * owners map, and says which lanes to run. Its answer is advice; the plan
 * the dock sees is made from it here, in plain code, so the rules hold
 * whatever the model writes:
 *
 * - **pc or cloud.** Cloud unless the lane needs local captures, J's boards
 *   or his desktop (J's answer 1). The model names the needs; a lane whose
 *   files or test point at the captures needs them whatever it said.
 * - **Stacking.** Two lanes on one file never run side by side: the later
 *   one is stacked on the earlier (it starts from that branch and merges
 *   after it). A lane that shares files with several waits for all of
 *   them; the contract's `stackedOn` names the last.
 * - **New controls.** A lane that adds a Builder control makes the plan
 *   wait for J's yes (`newControl`), the runner shows it "only-you".
 * - **Models.** The lead and design-heavy lanes use Opus, contained lanes
 *   use Sonnet. No Fable unless J asks.
 *
 * The call itself is `Ask`, passed in: `ask.ts` runs the real one, and the
 * tests pass a stub, so no test makes a real call.
 */
import { CONTRACT_VERSION as v, SIZES, problems, type Plan, type PlanLane, type Request, type Size } from "../contract.ts";
import { LANE_NAME } from "../agents/worktree.ts";
import { matches, type Owners } from "./owners.ts";

export const OPUS = "claude-opus-5-5";
export const SONNET = "claude-sonnet-5-5";
export const LEAD_MODEL = OPUS;

export type Ask = (prompt: string, opts: { model: string }) => Promise<string>;

export const PC_NEEDS = ["captures", "boards", "desktop"] as const;
export type Need = (typeof PC_NEEDS)[number];

/** What the coordinator keeps per lane beyond the contract's PlanLane. */
export type LaneExtra = {
  /** Every earlier lane in the plan it shares a file with (stackedOn is the last). */
  after: string[];
  needs: Need[];
  design: boolean;
  /** The Builder controls it adds, by name. */
  adds: string[];
  model: string;
  why: string;
};

export type LeadResult = { plan: Plan; extra: Map<string, LaneExtra>; fallback: boolean };

/** A file the PC has and the cloud doesn't. */
const LOCAL_ONLY = /(^|\/)(work-editable|capture\/sites)\//;
const NEW_CONTROL = /\b(add|adds|adding|new|another)\b[^.]*?\b(button|toggle|menu|tab|panel|control|slider|switch|dialog|option|setting|wheel item)s?\b/i;

export function leadPrompt(req: Request, owners: Owners): string {
  const open = owners.owners.filter((o) => o.state === "open");
  return [
    "You are the lead for Polio, J's website builder (Next.js). Split J's request into lanes.",
    "Each lane is one branch and one PR, with a red-to-green test in tests/. Keep lanes apart: as few shared files as you can.",
    "",
    `Request (${req.target}${req.action ? `, part action ${req.action}` : ""}, ${req.how}): ${req.text}`,
    req.chips.length ? `Context chips: ${JSON.stringify(req.chips)}` : "Context chips: none",
    "",
    "Lanes open now, and the files they own (a new lane touching these waits):",
    ...(open.length ? open.map((o) => `- ${o.lane} (${o.branch}): ${o.owns.join(", ")}`) : ["- none"]),
    "",
    "Answer with JSON only, in this shape:",
    '{"lanes":[{"lane":"short-kebab-name","files":["src/..."],"test":"tests/<name>.mjs","size":"small|medium|large",',
    ' "needs":[],"design":false,"adds":[],"why":"one line"}]}',
    "- needs: any of \"captures\" (local captured sites), \"boards\" (J's own boards), \"desktop\" (his desktop apps). Leave it empty when the cloud can do it.",
    "- design: true when the lane is design-heavy (look, layout, a new interaction); false when it is contained.",
    "- adds: the names of new Builder controls the lane adds (buttons, menus, panels, settings); empty if none.",
  ].join("\n");
}

/** The lanes list from the model's answer, or null if there isn't one. */
export function parseLead(text: string): Record<string, unknown>[] | null {
  const body = text.replace(/```(?:json)?/g, "");
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(body.slice(start, end + 1)) as { lanes?: unknown };
    if (!Array.isArray(j.lanes) || j.lanes.length === 0) return null;
    return j.lanes.filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null);
  } catch { return null; }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().replace(/\\/g, "/")) : []);
export const shares = (a: string[], b: string[]) => a.some((x) => b.some((y) => x === y || matches(x, y) || matches(y, x)));

export const modelFor = (design: boolean) => (design ? OPUS : SONNET);

/** Makes the plan from the lead's lanes: names, where, stacking, new controls, models. */
/** `taken`: lane names already in use (running, queued, or in owners.json). */
export function shapePlan(req: Request, raw: Record<string, unknown>[], taken: Iterable<string> = []): LeadResult {
  const used = new Set<string>(taken);
  const lanes: PlanLane[] = [];
  const extra = new Map<string, LaneExtra>();
  for (const [i, r] of raw.entries()) {
    let name = slug(String(r.lane ?? "")) || `lane-${i + 1}`;
    if (!LANE_NAME.test(name)) name = `lane-${i + 1}`;
    for (let n = 2; used.has(name); n++) name = `${name.replace(/-\d+$/, "")}-${n}`;
    used.add(name);
    const files = [...new Set(strs(r.files))];
    const test = typeof r.test === "string" && /^tests\/[\w./-]+\.mjs$/.test(r.test) ? r.test : `tests/${name}.mjs`;
    const size: Size = SIZES.includes(r.size as Size) ? (r.size as Size) : "medium";
    const needs = new Set(strs(r.needs).filter((n): n is Need => (PC_NEEDS as readonly string[]).includes(n)));
    if ([...files, test].some((f) => LOCAL_ONLY.test(f))) needs.add("captures");
    const adds = strs(r.adds);
    const after = lanes.filter((l) => shares(l.files, files)).map((l) => l.lane);
    const design = r.design === true || adds.length > 0;
    lanes.push({ lane: name, where: needs.size ? "pc" : "cloud", files, test, size, stackedOn: after.at(-1) ?? null });
    extra.set(name, { after, needs: [...needs], design, adds, model: modelFor(design), why: typeof r.why === "string" ? r.why : "" });
  }
  // The model may miss a new control the request itself asks for: on the
  // Builder, asking J costs a click, missing one ships a control he didn't approve.
  const asked = req.target === "builder-ui" && NEW_CONTROL.test(req.text);
  const newControl = asked || [...extra.values()].some((e) => e.adds.length > 0);
  const plan: Plan = { v, kind: "plan", requestId: req.id, lanes, newControl };
  const p = problems(plan);
  if (p.length) throw new Error(`the lead's plan doesn't fit the contract: ${p.join("; ")}`);
  return { plan, extra, fallback: false };
}

/**
 * The lead's call, shaped. An answer with no lanes is asked once more; a
 * second miss runs the request as one lane (on the PC for a site request,
 * as the runner did before the lead), so J's request never just vanishes.
 */
export async function lead(req: Request, { ask, owners, taken = [] }: { ask: Ask; owners: Owners; taken?: Iterable<string> }): Promise<LeadResult> {
  const prompt = leadPrompt(req, owners);
  let raw = parseLead(await ask(prompt, { model: LEAD_MODEL }));
  raw ??= parseLead(await ask(`${prompt}\n\nYour last answer had no lanes list. Answer with the JSON only.`, { model: LEAD_MODEL }));
  if (raw) return shapePlan(req, raw, taken);
  const one = shapePlan(req, [{ lane: req.text, needs: req.target === "site" ? ["boards"] : [], design: req.target === "builder-ui" }], taken);
  return { ...one, fallback: true };
}

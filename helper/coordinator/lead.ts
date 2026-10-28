/**
 * The lead: one Claude call reads J's request, its context chips and the
 * owners map, and says which lanes to run. Its answer is advice; the plan
 * the dock sees is made from it here, in plain code, so the rules hold
 * whatever the model writes:
 *
 * - **pc or cloud.** Cloud unless the lane needs local captures, J's boards
 *   or his desktop (J's answer 1). The model names the needs; a lane whose
 *   files or test point at the captures, or a request that names one of
 *   the local captured sites (sol face, mochi, sunkcoin), needs the PC
 *   whatever it said.
 * - **Stacking.** Two lanes on one file never run side by side: the later
 *   one is stacked on the earlier (it starts from that branch and merges
 *   after it). A lane that shares files with several waits for all of
 *   them; the contract's `stackedOn` names the last.
 * - **New controls.** A lane that adds a Builder control makes the plan
 *   wait for J's yes (`newControl`), the runner shows it "only-you".
 * - **Models.** The lead and design-heavy lanes use Opus, contained lanes
 *   use Sonnet. No Fable unless J asks.
 * - **Too vague.** The lead may answer with a question instead of lanes.
 *   The plan then holds one lane in the "question" state, and J's answer
 *   is put to the lead with the request. A lead that can't answer at all
 *   (twice) is turned into that question too, so nothing runs blind and
 *   nothing vanishes.
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
  /** Set when this lane stands for a question to J, not work. */
  question: string | null;
};

export type LeadResult = { plan: Plan; extra: Map<string, LaneExtra>; question: string | null };

/** A lane the queue holds or runs now: the lead plans around these too. */
export type LiveLane = { lane: string; files: string[]; requestId: string };

/** A file the PC has and the cloud doesn't. */
const LOCAL_ONLY = /(^|\/)(work-editable|capture\/sites)\//;
/** The captured sites that live only on J's PC, plus his boards and desktop. */
const LOCAL_NAMES = /\b(sol ?face|thesolface\d*|mochi\d*|sunk ?coin|sunk\d|pons ?stars|pst|my boards?|desktop app)\b/i;
const NEW_CONTROL = /\b(add|adds|adding|new|another)\b[^.]*?\b(button|toggle|menu|tab|panel|control|slider|switch|dialog|option|setting|wheel item)s?\b/i;
export const CANT_PLAN = "I couldn't make a plan from this. Say which page or part it is about, and what should change.";

export function leadPrompt(req: Request, owners: Owners, live: LiveLane[] = []): string {
  const open = owners.owners.filter((o) => o.state === "open");
  const lines = [
    ...live.map((l) => `- ${l.lane} (running here now): ${l.files.join(", ") || "files not planned"}`),
    ...open.map((o) => `- ${o.lane} (${o.branch}): ${o.owns.join(", ")}`),
  ];
  return [
    "You are the lead for Polio, J's website builder (Next.js). Split J's request into lanes.",
    "Each lane is one branch and one PR, with a red-to-green test in tests/. Keep lanes apart: as few shared files as you can.",
    "",
    `Request (${req.target}${req.action ? `, part action ${req.action}` : ""}, ${req.how}): ${req.text}`,
    req.chips.length ? `Context chips: ${JSON.stringify(req.chips)}` : "Context chips: none",
    "",
    "Lanes open now, and the files they own (a new lane touching these waits or is stacked):",
    ...(lines.length ? lines : ["- none"]),
    "",
    "Answer with JSON only, in this shape:",
    '{"lanes":[{"lane":"short-kebab-name","files":["src/..."],"test":"tests/<name>.mjs","size":"small|medium|large",',
    ' "needs":[],"design":false,"adds":[],"why":"one line"}]}',
    "- files: every file the lane will change or add, with paths from the repo root. Look at the repo if you are unsure.",
    "- needs: any of \"captures\" (local captured sites), \"boards\" (J's own boards), \"desktop\" (his desktop apps). Leave it empty when the cloud can do it.",
    "- design: true when the lane is design-heavy (look, layout, a new interaction); false when it is contained.",
    "- adds: the names of new Builder controls the lane adds (buttons, menus, panels, settings); empty if none.",
    'If the request is too vague to plan (you can\'t tell which page, part or behaviour it means), answer {"question":"one short question for J"} instead of lanes.',
  ].join("\n");
}

export type Parsed = { lanes: Record<string, unknown>[] } | { question: string } | null;

/** The lanes list or the question from the model's answer; null if there's neither. */
export function parseLead(text: string): Parsed {
  const body = text.replace(/```(?:json)?/g, "");
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(body.slice(start, end + 1)) as { lanes?: unknown; question?: unknown };
    if (typeof j.question === "string" && j.question.trim()) return { question: j.question.trim() };
    if (!Array.isArray(j.lanes)) return null;
    const lanes = j.lanes.filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null && !Array.isArray(l));
    return lanes.length ? { lanes } : null;
  } catch { return null; }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()) : []);
/** A repo path: forward slashes, no leading ./ or /, no dot-dot. */
const cleanPath = (p: string) => p.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "");
const safePath = (p: string) => p !== "" && !p.split("/").includes("..") && !p.includes(":");
export const shares = (a: string[], b: string[]) => a.some((x) => b.some((y) => x === y || matches(x, y) || matches(y, x)));

export const modelFor = (design: boolean) => (design ? OPUS : SONNET);

/** Which local things the request itself names (the lead can miss them). */
export function needsInRequest(req: Request): Need[] {
  const text = [req.text, ...req.chips.map((c) => ("name" in c ? c.name ?? "" : ""))].join(" ");
  const m = LOCAL_NAMES.exec(text);
  if (!m) return [];
  return /board/i.test(m[0]) ? ["boards"] : /desktop/i.test(m[0]) ? ["desktop"] : ["captures"];
}

/**
 * Makes the plan from the lead's lanes: names, where, stacking, new
 * controls, models. `taken`: lane names already in use (running, queued,
 * or in owners.json).
 */
export function shapePlan(req: Request, raw: Record<string, unknown>[], taken: Iterable<string> = []): LeadResult {
  const used = new Set<string>(taken);
  const lanes: PlanLane[] = [];
  const extra = new Map<string, LaneExtra>();
  const fromRequest = needsInRequest(req);
  for (const [i, r] of raw.entries()) {
    let name = slug(String(r.lane ?? "")) || `lane-${i + 1}`;
    if (!LANE_NAME.test(name)) name = `lane-${i + 1}`;
    for (let n = 2; used.has(name); n++) name = `${name.replace(/-\d+$/, "")}-${n}`;
    used.add(name);
    const files = [...new Set(strs(r.files).map(cleanPath).filter(safePath))];
    const t = typeof r.test === "string" ? cleanPath(r.test) : "";
    const test = /^tests\/[\w./-]+\.mjs$/.test(t) && safePath(t) ? t : `tests/${name}.mjs`;
    const size: Size = SIZES.includes(r.size as Size) ? (r.size as Size) : "medium";
    const needs = new Set<Need>([...strs(r.needs).filter((n): n is Need => (PC_NEEDS as readonly string[]).includes(n)), ...fromRequest]);
    if ([...files, test].some((f) => LOCAL_ONLY.test(f))) needs.add("captures");
    const adds = strs(r.adds);
    const after = lanes.filter((l) => shares(l.files, files)).map((l) => l.lane);
    const design = r.design === true || adds.length > 0;
    lanes.push({ lane: name, where: needs.size ? "pc" : "cloud", files, test, size, stackedOn: after.at(-1) ?? null });
    extra.set(name, { after, needs: [...needs], design, adds, model: modelFor(design), why: typeof r.why === "string" ? r.why : "", question: null });
  }
  // The model may miss a new control the request itself asks for: on the
  // Builder, asking J costs a click, missing one ships a control he didn't approve.
  const asked = req.target === "builder-ui" && NEW_CONTROL.test(req.text);
  const newControl = asked || [...extra.values()].some((e) => e.adds.length > 0);
  const plan: Plan = { v, kind: "plan", requestId: req.id, lanes, newControl };
  const p = problems(plan);
  if (p.length) throw new Error(`the lead's plan doesn't fit the contract: ${p.join("; ")}`);
  return { plan, extra, question: null };
}

/** A plan that holds one lane standing for a question to J. It runs nothing. */
export function questionPlan(req: Request, question: string, taken: Iterable<string> = []): LeadResult {
  const used = new Set(taken);
  let name = slug(req.text) || `ask-${slug(req.id)}`;
  if (!LANE_NAME.test(name)) name = `ask-${slug(req.id)}`.slice(0, 48);
  for (let n = 2; used.has(name); n++) name = `${name.replace(/-\d+$/, "")}-${n}`;
  const lane: PlanLane = { lane: name, where: "cloud", files: [], test: `tests/${name}.mjs`, size: "small", stackedOn: null };
  const plan: Plan = { v, kind: "plan", requestId: req.id, lanes: [lane], newControl: false };
  const extra = new Map<string, LaneExtra>([[name, { after: [], needs: [], design: false, adds: [], model: LEAD_MODEL, why: "", question }]]);
  return { plan, extra, question };
}

/**
 * The lead's call, shaped. An answer with neither lanes nor a question is
 * asked once more; after a second miss the lead's silence becomes a
 * question to J, so his request never runs blind and never just vanishes.
 */
export async function lead(req: Request, { ask, owners, taken = [], live = [] }: { ask: Ask; owners: Owners; taken?: Iterable<string>; live?: LiveLane[] }): Promise<LeadResult> {
  const prompt = leadPrompt(req, owners, live);
  let got = parseLead(await ask(prompt, { model: LEAD_MODEL }));
  got ??= parseLead(await ask(`${prompt}\n\nYour last answer had neither a lanes list nor a question. Answer with the JSON only.`, { model: LEAD_MODEL }));
  if (got && "lanes" in got) return shapePlan(req, got.lanes, taken);
  return questionPlan(req, got?.question ?? CANT_PLAN, taken);
}

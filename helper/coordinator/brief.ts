/**
 * Each lane's brief, made from `handovers/lane-rules.md` so a lane the
 * helper starts gets the same rules as one a coordinator briefs by hand.
 *
 * - "J's rules" go in whole, every time.
 * - "Windows notes" go only to PC lanes (a cloud lane has no Windows).
 * - Then the lane's own part: what J asked, its files, its test, the branch
 *   it starts from (a stacked lane starts from the branch it waits on), and
 *   the progress lines the runner reads (agents/brief.ts).
 */
import type { PlanLane, Request } from "../contract.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROGRESS_RULES } from "../agents/brief.ts";

/** One `## Heading` (or `## Heading (note)`) section of a markdown file, heading included; "" when missing. */
export function section(md: string, heading: string): string {
  const lines = md.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === `## ${heading}` || l.trim().startsWith(`## ${heading} (`));
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && /^##\s/.test(l));
  return lines.slice(at, end < 0 ? undefined : end).join("\n").trim();
}

export type BriefInput = {
  req: Request;
  lane: PlanLane;
  /** The text of handovers/lane-rules.md. */
  rules: string;
  /** The branch this lane starts from: the base, or the branch it is stacked on. */
  from: string;
  /** Lanes (or owners) this one comes after: they touch its files and merge first. */
  after: string[];
  model: string;
};

export function briefFor({ req, lane, rules, from: start, after, model }: BriefInput): string {
  const jRules = section(rules, "J's rules");
  if (!jRules) throw new Error("lane-rules.md has no \"## J's rules\" section: a brief without them would be wrong");
  const windows = lane.where === "pc" ? section(rules, "Windows notes") : "";
  const chips = req.chips.length ? `Goes with it: ${JSON.stringify(req.chips)}` : "";
  const last = after.at(-1);
  return [
    `# Lane ${lane.lane} (${lane.size}, ${lane.where === "pc" ? "on J's PC" : "in the cloud"}, ${model})`,
    "",
    `J asked (${req.target}${req.action ? `, part action ${req.action}` : ""}): ${req.text}`,
    chips,
    "",
    `- Branch claude/${lane.lane}, started from ${start}.`,
    last ? `- Stacked after ${after.join(", ")}: they touch your files, and they merge before you do. Say "stacked on ${last}" in the PR body, and don't redo their work.` : "",
    lane.files.length ? `- Files you own: ${lane.files.join(", ")}. Touch nothing else; ask if you must.` : "- No files were planned: say which you will touch before you change any.",
    `- Turn ${lane.test} from red (on ${start}) to green (on your branch), then run the closest existing tests.`,
    `- Write handovers/${lane.lane}.md and the PR body handovers/claude-${lane.lane}-pr-body.md.`,
    "",
    jRules,
    windows ? `\n${windows}` : "",
    "",
    PROGRESS_RULES,
  ].filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n").trim() + "\n";
}

/**
 * The rules text: `handovers/lane-rules.md` when the helper can see it (the
 * coordinator keeps it current), else the copy in the repo
 * (`docs/agents-panel/LANE-RULES.md`), so a cloud helper has them too.
 */
export function loadRules({ handoversDir, repo }: { handoversDir?: string; repo: string }): string {
  const tries = [handoversDir && join(handoversDir, "lane-rules.md"), join(repo, "docs", "agents-panel", "LANE-RULES.md")].filter(Boolean) as string[];
  for (const f of tries) if (existsSync(f)) return readFileSync(f, "utf8");
  throw new Error(`no lane rules at ${tries.join(" or ")}: lanes can't be briefed without them`);
}

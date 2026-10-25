/**
 * After a lane's green run: how its branch reaches the base branch, as merge
 * lines for the dock's feed.
 *
 * - The way depends on whether the helper holds a GitHub token (J hasn't
 *   chosen; Q5 is open). With one: the GitHub API, on green CI only. Without:
 *   the project-chat lines, shown in the dock with a Copy button.
 * - Either way, a merge that waits for J (gate.ts) goes nowhere until he
 *   presses Approve; the line says why. That includes every branch his own
 *   agents didn't make: `ours` comes from the runner's lane records, never
 *   from the branch's name.
 */
import { CONTRACT_VERSION, type MergeLine } from "../contract.ts";
import { chatLines, type ChatAsk } from "./chat.ts";
import { waitsForJ, type GateInput } from "./gate.ts";
import { mergeOnGreen, prFor, type GithubDeps } from "./github.ts";

export type Way = "github" | "chat";
export const wayFor = (token: string | null): Way => (token ? "github" : "chat");

export type MergeJob = GateInput & ChatAsk & { lane: string; prTitle: string; prBody: string };

/** What the dock shows besides the merge line: the copy-and-send text, or why it waits. */
export type MergeStep = { line: MergeLine; copy: string | null; waitsFor: string | null };

const line = (job: MergeJob, status: MergeLine["status"], pr: number | null, words: string): MergeLine =>
  ({ v: CONTRACT_VERSION, kind: "merge", lane: job.lane, p: job.p, generality: job.generality, status, pr, line: words, shots: null, undo: false });

export async function mergeStep(job: MergeJob, opts: { token: string | null; approved: boolean; github?: Omit<GithubDeps, "token"> }): Promise<MergeStep> {
  const why = waitsForJ(job);
  if (why && !opts.approved) return { line: line(job, "stacked", null, `Waits for your Approve: ${why}. ${job.fixes}`), copy: null, waitsFor: why };

  if (wayFor(opts.token) === "chat" || !opts.github) {
    return { line: line(job, "waiting-ci", null, `Ready to merge through the project chat: ${job.fixes}`), copy: chatLines(job), waitsFor: null };
  }

  const d: GithubDeps = { ...opts.github, token: opts.token! };
  const pr = await prFor(d, job.branch, job.prTitle, job.prBody);
  if (pr == null) return { line: line(job, "waiting-ci", null, "GitHub didn't open the PR; use the project chat lines"), copy: chatLines(job), waitsFor: null };
  const out = await mergeOnGreen(d, pr, job.branch);
  if (out.done === "merged") return { line: line(job, "merged", pr, job.fixes), copy: null, waitsFor: null };
  if (out.done === "waiting-ci") return { line: line(job, "waiting-ci", pr, `PR #${pr}: ${out.why}`), copy: null, waitsFor: null };
  return { line: line(job, "stacked", pr, `PR #${pr} held: ${out.why}`), copy: null, waitsFor: out.why };
}

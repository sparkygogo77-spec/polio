/**
 * The project-chat way of merging: the lines J copies into the Polio project
 * chat when the helper holds no GitHub token. Short labelled lines, one per
 * field (memory: project-chat-prompt-format), so the chat can act on them
 * and J can read them on a phone.
 */

export type ChatAsk = {
  branch: string;
  commit: string;
  p: 1 | 2 | 3;
  generality: 1 | 2 | 3 | 4 | 5;
  /** What J will notice. */
  fixes: string;
  /** What was tested, e.g. "agents-merge 31/31, red on base". */
  before: string;
  /** The live check that follows the merge. */
  after: string;
  /** Another branch this one must follow, if it is stacked. */
  after_branch?: string | null;
};

export function chatLines(a: ChatAsk): string {
  const lines = [
    `PR: open from ${a.branch} (${a.commit.slice(0, 8)}) into claude/template-ui-website-builder-11bfgl. P${a.p}, generality ${a.generality}.`,
    `Fixes: ${a.fixes}`,
    `Before: ${a.before}`,
    `After merge: ${a.after}`,
  ];
  if (a.after_branch) lines.push(`Order: merge after ${a.after_branch}.`);
  lines.push("Ask: merge once tests pass and there are no conflicts (J's standing rule); post one line with the PR number.");
  return lines.join("\n");
}

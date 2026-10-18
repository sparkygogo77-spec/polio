/**
 * ONE PUBLISH, ONE DEPLOYMENT: VERCEL BUILDS THE PUBLISHED BRANCH ONLY.
 *
 * A Vercel project connected to a repository deploys every push to every
 * branch, a preview for each branch that is not the production one. On the
 * owner's Hobby plan each is one of the day's hundred deployments, so a code
 * chat's branch, or any branch pushed before a merge, spent one more than
 * the publish itself. The Builder's own repository stopped that in its
 * vercel.json (`git.deploymentEnabled`, every branch off but trunk), and
 * Vercel has built only trunk since. A site the Builder writes says the same
 * in its own vercel.json: every branch off, the branch it publishes to on.
 *
 * Vercel reads this from the commit it would build, so a push to any other
 * branch makes no deployment at all (not even a cancelled one), and a
 * deployment asked for through the API is not a push and is not stopped.
 *
 * Pure, so node tests load it (tests/deploy-only-published-branch.mjs).
 */

/** The branch a site publishes to when nothing names one, as the publish route assumes. */
export const PUBLISH_BRANCH = "main";

/** What vercel.json's `git` says: no branch deploys on a push but `branch`. */
export function onlyBranchDeploys(branch: string = PUBLISH_BRANCH): { deploymentEnabled: Record<string, boolean> } {
  return { deploymentEnabled: { "**": false, [branch]: true } };
}

/**
 * A site's vercel.json, saying that only `branch` deploys on a push. Its
 * other settings stay as they are; null when the text is not a JSON object,
 * which is then left as it came.
 */
export function deployOnlyFrom(text: string, branch: string): string | null {
  let config: unknown;
  try {
    config = JSON.parse(text);
  } catch {
    return null;
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const was = (config as { git?: unknown }).git;
  const git = was && typeof was === "object" && !Array.isArray(was) ? was : {};
  return `${JSON.stringify({ ...config, git: { ...git, ...onlyBranchDeploys(branch) } }, null, 2)}\n`;
}

/**
 * A SITE MADE HERE, PUBLISHED INTO ITS OWN REPOSITORY AS CODE.
 *
 * The owner's words: "it should have both because the pipeline will require
 * a code chat utilizing this repo that was just created and the design site
 * will need to be able to do the refresh and publish both."
 *
 * Route 1 of `kit/PIPELINE.md` (builder first), in one press: the board is
 * exported as the builder-ready kit (`exportForCode`: builder.json, every
 * part with a data-hook, tokens, an empty style layer, hooks.json, the kit's
 * checks and its CLAUDE.md), put on a new branch of the repository Go live
 * made for the site, and merged. A code chat then works in that repository
 * under the kit's contract.
 *
 * What it never does: write over a code chat's work. Once the kit is in,
 * the commit it was merged at is kept on the board (`look.kitSent`); if the
 * repository has moved on since, Publish refuses and says to Refresh first.
 * Refresh brings the repository in (`placeBring`), it reads the kit's
 * builder.json first (`repoRun.ts`), and from then on the site is a site
 * from code, with the code site's own Refresh and Publish
 * (`CodeSiteButtons.tsx`), which send only the style layer.
 */
import { gh, type Answer, type Fetch } from "../kitRun";
import { headOf, mergePull, pushBranch } from "./codePublish";

/** What the board keeps of its last kit publish: where, and the commit it was merged at. */
export interface KitSent { repo: string; sha: string; at: number }

/** Where the kit goes: a new branch named for the site and the day. Never the default branch. */
export function kitBranch(site: string, date: Date): string {
  const slug = site.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "site";
  return `kit/${slug}-${date.toISOString().slice(0, 10)}`;
}

/**
 * Where the repository stands against what the board last published.
 *   · "none"     the kit has never gone in: Publish puts it in.
 *   · "current"  the repository is at the commit the kit was merged at.
 *   · "moved"    someone (a code chat) has pushed since: Refresh brings it in, Publish waits.
 *   · "unknown"  GitHub could not be read just now.
 */
export type KitStatus = { at: "none" | "current" | "moved" | "unknown"; head: string | null; says: string };

export function kitStatus(repo: string, sent: KitSent | null | undefined, head: string | null): KitStatus {
  if (!sent || sent.repo.toLowerCase() !== repo.toLowerCase()) return { at: "none", head, says: `${repo} has no builder kit from this board yet. Publish puts it in, so a code chat can work there.` };
  if (!head) return { at: "unknown", head, says: `${repo} could not be read just now.` };
  if (head !== sent.sha) return { at: "moved", head, says: `${repo} has moved on since this board published (${sent.sha.slice(0, 7)} → ${head.slice(0, 7)}): a code chat has been at work. Refresh brings it in.` };
  return { at: "current", head, says: `Up to date with ${repo} (${head.slice(0, 7)}): nothing has been pushed since this board published.` };
}

/**
 * Go live's own push is not a code chat's work. When it lands directly on the
 * commit the kit was merged at, the board's record moves with it, so Refresh
 * stays green and Publish stays open. Anything else in between (a code chat
 * pushed first) leaves the record where it was, and the repository reads "moved".
 */
export function kitAfterPush(sent: KitSent | null | undefined, pushed: { repo: string; sha: string; parent?: string | null }): KitSent | null {
  if (!sent || sent.repo.toLowerCase() !== pushed.repo.toLowerCase() || !pushed.parent || pushed.parent !== sent.sha) return null;
  return { ...sent, sha: pushed.sha, at: Date.now() };
}

/** The kit's files on a branch, a pull request, merged. A merge GitHub refuses leaves the pull request open and says why. */
export async function publishKit(repo: string, token: string, o: { site: string; sent?: KitSent | null; date?: Date; fetch?: Fetch; say?: (t: string) => void }): Promise<Answer<{ sha: string; pull: string; files: number }>> {
  const f = o.fetch ?? fetch;
  const say = o.say ?? (() => {});
  /* Never over a code chat's work: the repository must be where this board left it. */
  if (o.sent && o.sent.repo.toLowerCase() === repo.toLowerCase()) {
    const head = await headOf(repo, "HEAD", token, f).catch(() => null);
    if (head && head !== o.sent.sha) return { ok: false, says: `${repo} has moved on since this board published (${o.sent.sha.slice(0, 7)} → ${head.slice(0, 7)}). Refresh first, so the code chat's work is brought in rather than written over.` };
  }
  say("Exporting the board as a builder-ready kit…");
  /* Loaded here, not at the top: the rules above are read without a board (`tests/builder-site-code.mjs`). */
  const { exportForCode } = await import("../exportForCode");
  const kit = await exportForCode();
  if (!kit.files.length) return { ok: false, says: kit.says };
  if (kit.problems.length) return { ok: false, says: `Nothing was sent: the kit's check found ${kit.problems.length} problem${kit.problems.length === 1 ? "" : "s"}: ${kit.problems.slice(0, 3).join("; ")}.` };
  say(`Writing ${kit.files.length} files to a branch of ${repo}…`);
  const branch = kitBranch(o.site, o.date ?? new Date());
  const pushed = await pushBranch(repo, token, kit.files, { branch, message: `The builder kit for ${o.site}, from the Builder\n\nbuilder.json, every part with a data-hook, tokens, the style layer, hooks.json and the kit's checks. A code chat works here under CLAUDE.md and kit/PIPELINE.md.`, fetch: f });
  if (!pushed.ok) return pushed;
  say("Opening the pull request…");
  const body = `The Builder published **${o.site}** into this repository as a builder-ready kit (${kit.files.length} files).\n\n- \`builder.json\` lists the pages; every element carries a \`data-hook\`.\n- \`site/tokens.css\`, \`site/base.css\` and an empty \`site/style-layer.css\`: the Builder owns the style layer and the token values, a code chat owns everything else.\n- \`CLAUDE.md\`, \`PIPELINE.md\` and the kit's checks (\`npm run kit:check\`) say how a code chat works here.\n\nFrom now on the Builder's **Refresh** brings this repository's changes back onto the board, and its **Publish** sends only the style layer.`;
  const pr = await gh(f, token, `/repos/${repo}/pulls`, { method: "POST", body: { title: `Builder kit: ${o.site}`, head: pushed.branch, base: pushed.base, body } });
  const pull = typeof pr.json?.html_url === "string" ? pr.json.html_url : null;
  if (!pull) return { ok: false, says: `The kit is on the branch ${pushed.branch}, but GitHub would not open its pull request (it answered ${pr.status}): ${pushed.url}` };
  say("Merging…");
  const merged = await mergePull(repo, pull, token, { title: `Builder kit: ${o.site}`, fetch: f });
  if (!merged.ok) return { ok: false, says: `The kit is in a pull request, not merged: ${merged.says} ${pull}` };
  return { ok: true, sha: merged.sha, pull, files: kit.files.length };
}

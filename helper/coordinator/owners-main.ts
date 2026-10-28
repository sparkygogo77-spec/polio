/**
 * Rebuilds handovers/owners.json from the lane handovers and git history.
 *
 *   node helper/coordinator/owners-main.ts --repo <polio clone> --handovers <Pleo/handovers> [--no-fetch]
 *
 * It fetches first (so "merged" is today's), writes the map, and prints one
 * line per open lane.
 */
import { parseArgs } from "node:util";
import { join, resolve, dirname } from "node:path";
import { buildOwners, gitIn, saveOwners, OWNERS_FILE } from "./owners.ts";

const { values } = parseArgs({ options: {
  repo: { type: "string", default: process.cwd() },
  handovers: { type: "string" },
  base: { type: "string", default: "origin/claude/template-ui-website-builder-11bfgl" },
  "no-fetch": { type: "boolean", default: false },
} });

const repo = resolve(values.repo!);
const handoversDir = resolve(values.handovers ?? join(dirname(repo), "handovers"));
const git = gitIn(repo);
if (!values["no-fetch"]) git("fetch", "--quiet", "origin");
const owners = buildOwners({ handoversDir, git, base: values.base! });
saveOwners(join(handoversDir, OWNERS_FILE), owners);
const open = owners.owners.filter((o) => o.state === "open");
console.log(`${owners.owners.length} branches, ${open.length} open, written to ${join(handoversDir, OWNERS_FILE)}`);
for (const o of open) console.log(`  ${o.lane} (${o.branch}): ${o.owns.slice(0, 4).join(", ")}${o.owns.length > 4 ? ` and ${o.owns.length - 4} more` : ""}`);

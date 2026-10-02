/**
 * THE KIT'S OWN CHECK, RUN ON A SET OF FILES (server and tests only).
 *
 * A builder-ready repository (kit/BUILDER-CONTRACT.md) keeps `hooks.json`
 * made from its code: a style layer that uses a token on a hook changes it,
 * and `kit:check` fails a branch whose map is stale. So before a design is
 * sent, the files as they will be on the style branch are written to a
 * scratch folder and `kit/tools/kit-check.mjs` (the same file the
 * repository runs, copied into this repo under kit/) remakes the map and
 * says what the contract finds. Nothing here touches GitHub or a token.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { check } from "../../../kit/tools/kit-check.mjs";

export interface KitMapAnswer {
  /** What the contract finds, in its own words; empty when it passes. */
  problems: string[];
  /** Files the check made from the code (hooks.json, and the tokens module where there is one), by path. */
  made: Record<string, string>;
}

/** Most a call may carry, so a mistake cannot fill the disk. */
export const KIT_MAP_MOST = 8 * 1024 * 1024;

export function kitMap(files: Record<string, string>, manifestPath = "builder.json"): KitMapAnswer {
  let size = 0;
  for (const [p, t] of Object.entries(files)) {
    if (typeof t !== "string" || !p || p.startsWith("/") || normalize(p).startsWith("..") || p.includes("\0")) return { problems: [`${p}: not a file of the repository`], made: {} };
    size += t.length;
  }
  if (size > KIT_MAP_MOST) return { problems: ["the files are too big to check here"], made: {} };
  if (typeof files[manifestPath] !== "string") return { problems: [`${manifestPath} is missing`], made: {} };
  const dir = mkdtempSync(join(tmpdir(), "kit-map-"));
  try {
    for (const [p, t] of Object.entries(files)) {
      const at = join(dir, p);
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, t);
    }
    const manifest = JSON.parse(files[manifestPath]!) as { hooks?: string; tokensModule?: string };
    const base = dirname(manifestPath) === "." ? "" : `${dirname(manifestPath)}/`;
    const { problems } = check(join(dir, manifestPath), { write: true }) as { problems: string[] };
    const made: Record<string, string> = {};
    for (const p of [manifest.hooks, manifest.tokensModule]) {
      if (!p) continue;
      const at = join(dir, base, p);
      if (existsSync(at)) made[`${base}${p}`] = readFileSync(at, "utf8");
    }
    return { problems, made };
  } catch (e) {
    return { problems: [`the check could not run (${(e as Error).message})`], made: {} };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

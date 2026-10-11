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
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { check } from "../../../kit/tools/kit-check.mjs";
import { KIT_MOTION } from "./kitRun.ts";

export interface KitMapAnswer {
  /** What the contract finds, in its own words; empty when it passes. */
  problems: string[];
  /**
   * Files the check made from the code (hooks.json, and the tokens module where there is one), by path,
   * and the builder's motion file beside the tokens with the kit's copy of it (`kit/starter/vendor/`),
   * so a site whose copy is behind the Builder's gets every motion its layer names.
   */
  made: Record<string, string>;
}

/** Most a call may carry, so a mistake cannot fill the disk. */
export const KIT_MAP_MOST = 8 * 1024 * 1024;

/**
 * Whether `p` names a file inside `dir` (seen from `base` there): not absolute,
 * no `..` past the top, no control character. The check writes where
 * builder.json points, so a path outside would write on this machine.
 */
function inside(dir: string, base: string, p: unknown): p is string {
  if (typeof p !== "string" || isAbsolute(p) || /^[\\/]/.test(p) || /[\x00-\x1f]/.test(p)) return false;
  const r = relative(dir, resolve(dir, base, p));
  return r !== "" && r.split(/[\\/]/)[0] !== ".." && !isAbsolute(r);
}

/** Every path builder.json names, so none of them can lead the check out of its folder. */
function namedPaths(manifest: object): unknown[] {
  const m = manifest as { pages?: unknown; preview?: { page?: unknown }; scripts?: { helperFiles?: unknown }; rules?: { outsideParts?: unknown } };
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  return [
    ...["hooks", "tokens", "tokensModule", "styleLayer", "gallery", "parts", "scenes", "samples"].map((k) => (manifest as Record<string, unknown>)[k]),
    m.preview?.page,
    ...list(m.pages).map((x) => (x as { file?: unknown } | null)?.file),
    ...list(m.scripts?.helperFiles),
    ...list(m.rules?.outsideParts).map((x) => (typeof x === "string" ? x : (x as { file?: unknown } | null)?.file)),
  ].filter((v) => v !== undefined);
}

export function kitMap(files: Record<string, string>, manifestPath = "builder.json"): KitMapAnswer {
  let size = 0;
  for (const [p, t] of Object.entries(files)) {
    if (typeof t !== "string" || !inside(tmpdir(), "", p)) return { problems: [`${p}: not a file of the repository`], made: {} };
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
    const manifest = JSON.parse(files[manifestPath]!) as { hooks?: string; tokensModule?: string; tokens?: string };
    const base = dirname(manifestPath) === "." ? "" : `${dirname(manifestPath)}/`;
    const outside = namedPaths(manifest).find((p) => !inside(dir, base, p));
    if (outside !== undefined) return { problems: [`builder.json: ${String(outside)} is not a file of the repository`], made: {} };
    const { problems } = check(join(dir, manifestPath), { write: true }) as { problems: string[] };
    const made: Record<string, string> = {};
    /* kit-check writes the motion file at <the tokens' folder>/vendor/builder-motion.js. */
    const motion = manifest.tokens ? join(dirname(manifest.tokens), "vendor", "builder-motion.js").split("\\").join("/") : undefined;
    for (const p of [manifest.hooks, manifest.tokensModule, motion]) {
      if (!p) continue;
      const at = join(dir, base, p);
      if (existsSync(at)) made[`${base}${p}`] = readFileSync(at, "utf8");
    }
    const fresh = motion ? made[`${base}${motion}`] : undefined;
    if (fresh) for (const p of Object.keys(files)) if (KIT_MOTION.test(p)) made[p] = fresh;
    return { problems, made };
  } catch (e) {
    return { problems: [`the check could not run (${(e as Error).message})`], made: {} };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

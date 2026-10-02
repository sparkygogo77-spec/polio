/**
 * trumpmorty.fun as sink captured it (sites/trumpmorty-fun), landed the way
 * Bring lands it: `landPalette` ties each part colour that is a role's to the
 * role and records where each role came from. Read, never written: sink is
 * someone else's repository. `SINK` points at a checkout's site folder.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const SINK = process.env.SINK ?? join(here, "..", "..", "capture", "versions", "sink-0ee06fa", "sites", "trumpmorty-fun");

export async function trumpmorty() {
  const at = join(SINK, "site", "document.json");
  if (!existsSync(at)) return null;
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "..", "src") } });
  const { landPalette } = await jiti.import(join(here, "..", "..", "src", "features", "studio", "paletteFrom.ts"));
  const doc = JSON.parse(readFileSync(at, "utf8"));
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  return { ...doc, nodes: landed.nodes, look: { ...doc.look, palette: landed.palette, paletteFrom: landed.from } };
}

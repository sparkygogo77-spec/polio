/**
 * The design, sent back to the code it came from: the style layer (and the
 * hooks map and the design record) on a new style/ branch with a pull
 * request (`styleLayerRun.ts`). One function for "Send the design back" in
 * the repo menu and for Publish on a site from code (`CodeSiteButtons`),
 * which then merges it (`codePublish.ts#mergePull`).
 */
import { readHookMap } from "./designBranch";
import { boardRecord } from "./exportForCode";
import { fileAt } from "./kitRun";
import { layerPrint } from "./codePublish";
import { prepareLayer, publishLayer } from "./styleLayerRun";
import { pictureFiles } from "./partPicture";
import { base64, bytesFor } from "./pictures";
import type { LayerNode, StyleSource } from "./styleLayer";

export type Sent =
  | { ok: true; says: string; pull: string | null; compare: string; branch: string; kit: boolean; print: string; files: string[]; held: string[] }
  | { ok: false; says: string };

export async function sendDesign(nodes: LayerNode[], palette: Record<string, string> | null | undefined, source: StyleSource, token: string, o: { site: string; family?: (name: string) => string | undefined; say?: (t: string) => void; extra?: { path: string; content: string }[] }): Promise<Sent> {
  o.say?.(`Reading the pages from ${source.repo} on ${source.ref}…`);
  const prepared = await prepareLayer(nodes, palette, source, token, { family: o.family, when: new Date().toISOString().slice(0, 10) });
  if (!prepared.ok) return { ok: false, says: prepared.says };
  o.say?.("Making the branch…");
  /* The design record goes with it (design/record.json), with the parts each sits in from the repository's hooks.json. */
  if (prepared.files.length) {
    const mapPath = source.kit?.hooks ?? null;
    const map = mapPath ? readHookMap(await fileAt(fetch, token, source.repo, source.ref || "HEAD", mapPath).catch(() => null)) : {};
    prepared.files.push({ path: "design/record.json", content: boardRecord(map) });
  }
  /* Pictures he put on parts (the Contents plate, `partPicture.ts`): each file and design/pictures.json, for the code to apply under the same hook. */
  const pics = await pictureFiles(nodes as never, async (look) => { const b = await bytesFor(look.picture as never); return b ? base64(b) : null; });
  if (pics.files.length) {
    o.say?.(`Adding ${pics.files.length - 1} picture${pics.files.length === 2 ? "" : "s"} for parts…`);
    prepared.files.push(...pics.files);
  }
  /* Other files that ride with the design: polio/NEXT.md, the issues ticked for the next code chat (`fixLoop.ts`). */
  if (o.extra?.length) prepared.files.push(...o.extra);
  const done = await publishLayer(prepared, source, token, { site: o.site });
  if (!done.ok) return { ok: false, says: done.says };
  return {
    ok: true, says: `${done.says}${pics.missing.length ? ` The picture for ${pics.missing.join(", ")} is no longer in this browser, so it was not sent; drop it on the part again.` : ""}${pics.unhooked.length ? ` ${pics.unhooked.join(", ")} has no data-hook, so its picture was not sent.` : ""}`, pull: done.pull, compare: done.compare, branch: done.branch, kit: prepared.kit,
    print: layerPrint(prepared.layer.css), files: prepared.files.map((x) => x.path),
    held: prepared.kit ? prepared.skipped.map((s) => s.from) : prepared.skipped.map((s) => `“${s.from.slice(0, 40)}” (${s.why})`),
  };
}

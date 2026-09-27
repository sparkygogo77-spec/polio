/**
 * The round trip: features a code chat built in the site's repository,
 * offered back to the library.
 *
 * When the builder next reads one of the owner's own repositories
 * (`repoFeatures.ts` does the reading, and refuses anybody else's), each
 * `features/<id>/` folder is compared with the library: new or changed ones
 * become offers, with the manifest, the script and a diff for the owner to
 * review. What the owner accepts joins the library, held as text, with the part it
 * was attached to as its shelf picture, and is reusable on any site.
 *
 * NOTHING HERE RUNS A SCRIPT. It is read as a string, compared as a string,
 * stored as a string, and only ever leaves the builder inside a published
 * site, where the visitor's browser runs it. A folder whose manifest cannot
 * be read, or names another id, or whose script does not define its own id,
 * is offered with its problems named and cannot be accepted.
 *
 * Pure: the tests run it as written.
 */
import type { Work, WorkManifest, WorkPicture } from "./works.ts";

export interface FoundFeature {
  /** The folder's name, which must be the manifest's id. */
  id: string;
  manifest: string | null;
  script: string | null;
  readme: string | null;
}

export interface DiffLine { op: " " | "+" | "-"; text: string }

export interface Offer {
  id: string;
  status: "new" | "changed";
  manifest: WorkManifest | null;
  /** The manifest as the repository holds it, for review. */
  manifestText: string;
  script: string;
  readme: string | null;
  /** The part ids the manifest says it is attached to. */
  parts: string[];
  /** Against the library's version (manifest, then script); every line added when it is new. */
  diff: DiffLine[];
  problems: string[];
  acceptable: boolean;
}

const FOLDER = /^features\/([a-z0-9][a-z0-9-]{0,63})\/(manifest\.json|script\.js|README\.md)$/;
/** Scripts larger than this are refused outright: a feature is a few lines. */
export const MAX_SCRIPT = 64 * 1024;
const NEEDS = new Set(["none", "wallet", "backend", "key"]);

/** The feature folders among a repository's files. */
export function foundIn(files: readonly { path: string; content: string }[]): FoundFeature[] {
  const by = new Map<string, FoundFeature>();
  for (const f of files) {
    const m = FOLDER.exec(f.path);
    if (!m) continue;
    const it = by.get(m[1]!) ?? { id: m[1]!, manifest: null, script: null, readme: null };
    if (m[2] === "manifest.json") it.manifest = f.content;
    else if (m[2] === "script.js") it.script = f.content;
    else it.readme = f.content;
    by.set(m[1]!, it);
  }
  return [...by.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Is this repository path one the round trip reads? */
export function isFeatureFile(path: string): boolean {
  return FOLDER.test(path);
}

/** A manifest, read and checked. */
function readManifest(f: FoundFeature): { manifest: WorkManifest | null; parts: string[]; problems: string[] } {
  const problems: string[] = [];
  if (!f.manifest) return { manifest: null, parts: [], problems: ["it has no manifest.json"] };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(f.manifest) as Record<string, unknown>;
  } catch {
    return { manifest: null, parts: [], problems: ["its manifest.json is not valid JSON"] };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { manifest: null, parts: [], problems: ["its manifest.json is not an object"] };
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  if (str("id") !== f.id) problems.push(`its manifest names the id “${str("id") || "nothing"}”, not its folder's “${f.id}”`);
  if (!str("name").trim()) problems.push("its manifest has no name");
  if (!str("category").trim()) problems.push("its manifest has no category");
  if (!NEEDS.has(str("needs"))) problems.push("its manifest's needs is not none, wallet, backend or key");
  const inputs = Array.isArray(raw.inputs) ? raw.inputs : null;
  if (!inputs) problems.push("its manifest has no inputs list");
  const badInput = (inputs ?? []).find((i) => !i || typeof i !== "object" || typeof (i as { id?: unknown }).id !== "string");
  if (badInput) problems.push("an input in its manifest has no id");
  const parts = Array.isArray(raw.parts) ? raw.parts.filter((p): p is string => typeof p === "string") : [];
  const look = raw.look && typeof raw.look === "object" ? (raw.look as { sample?: unknown; caption?: unknown }) : {};
  const manifest: WorkManifest = {
    id: f.id,
    name: str("name").trim() || f.id,
    category: str("category").trim() || "data",
    blurb: str("blurb"),
    inputs: (inputs ?? []).filter((i) => !!i && typeof i === "object" && typeof (i as { id?: unknown }).id === "string").map((i) => {
      const x = i as Record<string, unknown>;
      return {
        id: String(x.id),
        label: typeof x.label === "string" ? x.label : String(x.id),
        kind: x.kind === "number" || x.kind === "one" ? x.kind : "text",
        default: typeof x.default === "string" ? x.default : x.default == null ? "" : String(x.default),
        ...(Array.isArray(x.values) ? { values: x.values.map(String) } : {}),
        ...(typeof x.placeholder === "string" ? { placeholder: x.placeholder } : {}),
        ...(typeof x.heard === "string" ? { heard: x.heard } : {}),
        ...(x.required === true ? { required: true } : {}),
      };
    }),
    needs: (NEEDS.has(str("needs")) ? str("needs") : "none") as WorkManifest["needs"],
    says: Array.isArray(raw.says) ? raw.says.filter((x): x is string => typeof x === "string") : [],
    look: { sample: typeof look.sample === "string" ? look.sample : "", ...(typeof look.caption === "string" ? { caption: look.caption } : {}) },
    version: typeof raw.version === "number" ? raw.version : 1,
  };
  return { manifest, parts, problems };
}

function checkScript(f: FoundFeature): string[] {
  if (!f.script) return ["it has no script.js"];
  if (f.script.length > MAX_SCRIPT) return [`its script.js is over ${MAX_SCRIPT / 1024} KB`];
  const own = new RegExp(`siteFeatures\\.define\\(\\s*["'\`]${f.id.replace(/-/g, "\\-")}["'\`]`);
  return own.test(f.script) ? [] : [`its script.js does not call siteFeatures.define("${f.id}", …)`];
}

/** Keys in a fixed order, so two manifests that say the same thing compare equal. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const pretty = (m: WorkManifest | null) => (m ? JSON.stringify(m, null, 2) : "");

/** A line diff: longest common subsequence, equal lines kept, the rest marked. */
export function lineDiff(a: string, b: string): DiffLine[] {
  const x = a ? a.split("\n") : [];
  const y = b ? b.split("\n") : [];
  const n = x.length, m = y.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = x[i] === y[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ op: " ", text: x[i]! }); i++; j++; }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) out.push({ op: "-", text: x[i++]! });
    else out.push({ op: "+", text: y[j++]! });
  }
  while (i < n) out.push({ op: "-", text: x[i++]! });
  while (j < m) out.push({ op: "+", text: y[j++]! });
  return out;
}

/** The folders that are new or changed against the library, each with what the owner needs to decide. */
export function offersFrom(found: readonly FoundFeature[], library: readonly Work[]): Offer[] {
  const out: Offer[] = [];
  for (const f of found) {
    const { manifest, parts, problems } = readManifest(f);
    problems.push(...checkScript(f));
    const have = library.find((w) => w.manifest.id === f.id);
    const script = f.script ?? "";
    if (have && manifest && canonical(have.manifest) === canonical(manifest) && have.script === script) continue;
    const before = have ? `${pretty(have.manifest)}\n${have.script}` : "";
    const after = `${pretty(manifest)}\n${script}`;
    out.push({
      id: f.id,
      status: have ? "changed" : "new",
      manifest,
      manifestText: f.manifest ?? "",
      script,
      readme: f.readme,
      parts,
      diff: lineDiff(before, after),
      problems,
      acceptable: problems.length === 0 && !!manifest,
    });
  }
  return out;
}

/** An accepted offer, as a library feature: text, where it came from, and its picture. */
export function acceptedWork(o: Offer, at: { from: string; picture: WorkPicture | null }): Work {
  if (!o.acceptable || !o.manifest) throw new Error(`${o.id} cannot be accepted: ${o.problems.join("; ")}`);
  return {
    manifest: o.manifest,
    script: o.script,
    ...(o.readme ? { readme: o.readme } : {}),
    from: at.from,
    picture: at.picture,
  };
}

/**
 * A BUILDER-READY REPOSITORY, READ FROM THE BUILDER (kit/BUILDER-CONTRACT.md).
 *
 * A repository made from the kit keeps `builder.json` at its root: its
 * pages, `hooks.json` (every hook, made from the code), `tokens.css`, the
 * style layer's path and the rules for links. This reads them in his
 * browser with his own token, as `styleLayerRun.ts` does, and answers three
 * questions the Builder asks of such a repository:
 *
 *   · what it is now (`readKit`): the manifest and a snapshot of its pages,
 *     hooks and tokens, kept on the site at import (`look.styleSource.seen`);
 *   · what changed since then (`readRound`, before each design round): pages
 *     and hooks added or removed, hooks whose element changed, tokens added
 *     or removed, and the layer's rules for hooks no page has any more. A
 *     repository with no `builder.json` is read the same way from its pages'
 *     own hooks;
 *   · every text file the kit's check needs (`kitFiles`), so the design can
 *     be checked, and `hooks.json` remade, before it is sent (`kitMap.ts`).
 *
 * Always from the repository's default branch: that is the code a design
 * goes back into. `fetch` is passed in, so the tests can stand a GitHub in.
 */
import { hooksIn } from "./sourceHooks.ts";
import type { KitLinks } from "./parts/offsite.ts";
import type { StyleSource } from "./styleLayer.ts";

const API = "https://api.github.com";
export type Fetch = typeof fetch;
export type Answer<T> = ({ ok: true } & T) | { ok: false; says: string };

export interface KitManifest {
  kit: string;
  name?: string;
  pages: { file: string; title?: string }[];
  hooks: string;
  tokens: string;
  styleLayer: string;
  tokensModule?: string;
  styleAssets?: string;
  preview?: { page: string; screens?: { name: string; page: string }[] };
  gallery?: string;
  links?: KitLinks;
  /** BUILDER-RULES.md, machine-readable: the slots are settings the code asks the builder to learn. */
  rules?: { doc?: string; slots?: KitSlot[] };
}

/** A style or setting the builder learns (BUILDER-RULES.md rule 4): a token one part uses, shown by its label in the part's Settings. */
export interface KitSlot {
  token: string;
  hook: string;
  label: string;
  kind?: "colour" | "length" | "number" | "text" | "choice" | "shadow" | "filter" | "time" | "any";
  options?: string[];
  why?: string;
}

/** What a repository was at one moment: the baseline a round is compared with. */
export interface KitSeen {
  ref: string;
  at: string;
  /** From `builder.json` and `hooks.json`; false: read from the pages' own hooks. */
  kit: boolean;
  pages: string[];
  /** Hook name to its element kind (`button`, `input[type=text]`); "" where it is not known. */
  hooks: Record<string, string>;
  tokens: string[];
  /** Each token's value where the map gives one (`builder-hooks.json` "default"): "Take these in" brings them onto the site. */
  values?: Record<string, string>;
}

export async function gh(f: Fetch, token: string, path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const res = await f(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(init?.body ? { "content-type": "application/json" } : {}) },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
    let json: Record<string, unknown> | null = null;
    try { json = (await res.json()) as Record<string, unknown>; } catch { /* an empty answer */ }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
const pathOf = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export async function fileAt(f: Fetch, token: string, repo: string, ref: string, path: string): Promise<string | null> {
  const got = await gh(f, token, `/repos/${repo}/contents/${pathOf(path)}?ref=${encodeURIComponent(ref)}`);
  const content = got.json?.content;
  return got.status === 200 && typeof content === "string" ? b64decode(content) : null;
}

export async function defaultBranch(f: Fetch, token: string, repo: string): Promise<Answer<{ branch: string }>> {
  const info = await gh(f, token, `/repos/${repo}`);
  if (info.status !== 200) return { ok: false, says: info.status === 404 ? `GitHub has no ${repo}, or this token cannot see it.` : info.status === 401 ? "GitHub does not accept the saved key (401): it has expired, been revoked, or was pasted wrong. Make a new one with Contents and Pull requests: read and write on this repository, and add it under Keys." : info.status === 403 ? "GitHub refused that token (403). Check it under Keys." : "GitHub could not be reached." };
  return { ok: true, branch: String(info.json?.default_branch ?? "main") };
}

/** The snapshot of a builder-ready repository, from its manifest and map. */
export function seenOfKit(manifest: KitManifest, hooksJson: string | null, ref: string, at: string): KitSeen {
  let map: { hooks?: Record<string, { element?: string }>; tokens?: Record<string, unknown> } = {};
  try { map = hooksJson ? JSON.parse(hooksJson) : {}; } catch { /* a broken map: nothing known */ }
  return {
    ref, at, kit: true,
    pages: manifest.pages.map((p) => p.file).sort(),
    hooks: Object.fromEntries(Object.entries(map.hooks ?? {}).map(([h, v]) => [h, v?.element ?? ""])),
    /* The code's tokens: one the map lists with no value (null) is the style layer's own variable (--next-step-background-color), not the code's, and is no new token. */
    tokens: Object.entries(map.tokens ?? {}).filter(([, v]) => (v as { default?: unknown } | null)?.default !== null).map(([t]) => t).sort(),
    values: Object.fromEntries(Object.entries(map.tokens ?? {}).flatMap(([t, v]) => {
      const d = (v as { default?: unknown } | null)?.default;
      return typeof d === "string" || typeof d === "number" ? [[t, String(d)]] : [];
    })),
  };
}

/** The code's tokens the board does not hold, or holds at another value. */
export function tokensBehind(source: Pick<StyleSource, "files">, seen: KitSeen): string[] {
  const board = new Map<string, string>();
  for (const f of source.files) for (const v of f.vars) if (v.token && !board.has(v.name)) board.set(v.name, v.value);
  return Object.entries(seen.values ?? {}).filter(([t, v]) => board.get(t) !== v).map(([t]) => t).sort();
}

/**
 * "Take these in": the tokens the code has now, with their values, onto the
 * site's reading of its code (`source.files`). A value the code changed is
 * updated; a token it added is added (to the page that already holds most of
 * the tokens file), so its slot shows and the counts are the code's own.
 * What the owner set by hand (`varsSet`) stays.
 */
export function takeTokens<S extends Pick<StyleSource, "files" | "tokensFile">>(source: S, seen: KitSeen): S {
  const values = seen.values ?? {};
  const names = Object.keys(values);
  if (!names.length) return source;
  const file = source.tokensFile ?? source.files.flatMap((f) => f.vars).find((v) => v.token)?.file ?? null;
  if (!file) return source;
  const had = new Set<string>();
  let files = source.files.map((f) => ({
    ...f,
    vars: f.vars.map((v) => {
      if (v.file !== file || !(v.name in values)) return v;
      had.add(v.name);
      return values[v.name] === v.value ? v : { ...v, value: values[v.name]! };
    }),
  }));
  const fresh = names.filter((t) => !had.has(t) && !files.some((f) => f.vars.some((v) => v.name === t)));
  if (fresh.length) {
    const holds = (f: (typeof files)[number]) => f.vars.filter((v) => v.file === file).length;
    const at = files.reduce((best, f, i) => (holds(f) > holds(files[best]!) ? i : best), 0);
    if (files[at]) files = files.map((f, i) => (i === at ? { ...f, vars: [...f.vars, ...fresh.map((name) => ({ name, value: values[name]!, file, line: 0, token: true }))] } : f));
  }
  return { ...source, files };
}

/** The snapshot of a repository with no `builder.json`, from its pages' hooks as read at import. */
export function seenOfSource(source: StyleSource, at = ""): KitSeen {
  const hooks: Record<string, string> = {};
  for (const f of source.files) for (const h of f.hooks) hooks[h.attr === "id" ? `#${h.value}` : h.value] = "";
  return { ref: source.ref, at, kit: false, pages: source.files.map((f) => f.file).sort(), hooks, tokens: [...new Set(source.files.flatMap((f) => f.vars.map((v) => v.name)))].sort() };
}

/** `builder.json` and a snapshot, or null when the repository has none (it is not builder-ready). */
export async function readKit(repo: string, ref: string, token: string, opts: { fetch?: Fetch; when?: string } = {}): Promise<Answer<{ manifest: KitManifest; seen: KitSeen }> | null> {
  const f = opts.fetch ?? fetch;
  const text = await fileAt(f, token, repo, ref, "builder.json");
  if (text === null) return null;
  let manifest: KitManifest;
  try { manifest = JSON.parse(text) as KitManifest; } catch { return { ok: false, says: `${repo}'s builder.json on ${ref} is not readable JSON.` }; }
  if (!Array.isArray(manifest.pages) || !manifest.hooks || !manifest.styleLayer || !manifest.tokens) return { ok: false, says: `${repo}'s builder.json on ${ref} does not name its pages, hooks, tokens and style layer.` };
  const hooks = await fileAt(f, token, repo, ref, manifest.hooks);
  return { ok: true, manifest, seen: seenOfKit(manifest, hooks, ref, opts.when ?? new Date().toISOString()) };
}

const TEXT = /\.(html?|css|m?js|json|md|ya?ml)$/i;
const MOST_FILES = 400;

/**
 * Every text file the kit's check reads: `builder.json` and each folder
 * holding a page, a stylesheet or the map, as on `ref`.
 */
export async function kitFiles(repo: string, ref: string, token: string, manifest: KitManifest, opts: { fetch?: Fetch } = {}): Promise<Answer<{ files: Record<string, string> }>> {
  const f = opts.fetch ?? fetch;
  const tree = await gh(f, token, `/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  const list = (tree.json?.tree as { path: string; type: string; sha: string; size?: number }[] | undefined) ?? null;
  if (!list) return { ok: false, says: `GitHub would not list ${repo} on ${ref}.` };
  const top = (p: string) => (p.includes("/") ? `${p.split("/")[0]}/` : "");
  const dirs = new Set([manifest.hooks, manifest.tokens, manifest.styleLayer, manifest.preview?.page ?? "", manifest.gallery ?? "", ...manifest.pages.map((p) => p.file)].filter(Boolean).map(top));
  const want = list.filter((e) => e.type === "blob" && TEXT.test(e.path) && !/(^|\/)node_modules\//.test(e.path) && (e.path === "builder.json" || [...dirs].some((d) => d === "" ? !e.path.includes("/") : e.path.startsWith(d))));
  if (want.length > MOST_FILES) return { ok: false, says: `${repo} has ${want.length} files beside its pages, more than the Builder checks at once (${MOST_FILES}).` };
  const files: Record<string, string> = {};
  for (const e of want) {
    const blob = await gh(f, token, `/repos/${repo}/git/blobs/${e.sha}`);
    const content = blob.json?.content;
    if (typeof content !== "string") return { ok: false, says: `GitHub would not hand over ${e.path}.` };
    files[e.path] = b64decode(content);
  }
  return { ok: true, files };
}

/** The kit's check on files, on our server (`/api/studio/kit-map`); the tests pass their own. */
export type KitMapCall = (files: Record<string, string>) => Promise<{ problems: string[]; made: Record<string, string> }>;
/**
 * The kit's check on our server. The files go gzipped: a big site's pages are
 * megabytes of text, past what the host takes in one request (it answers
 * 413), and a tenth of that packed. An answer that is not the check's own
 * says what it was.
 */
export const kitMapOnServer: KitMapCall = async (files) => {
  const text = JSON.stringify({ files });
  let body: BodyInit = text;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (typeof CompressionStream !== "undefined") {
    try {
      body = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
      headers["x-body-encoding"] = "gzip";
    } catch { body = text; }
  }
  const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
  try {
    const res = await fetch("/api/studio/kit-map", { method: "POST", headers, body });
    const json = (await res.json().catch(() => null)) as { problems?: string[]; made?: Record<string, string> } | null;
    if (!json) return { problems: [res.status === 413 ? `the files (${mb(text.length)} of text, ${mb(typeof body === "string" ? body.length : (body as ArrayBuffer).byteLength)} sent) are too big for the server to take in one request (413)` : `the check answered ${res.status} without saying why`], made: {} };
    return { problems: json.problems ?? [`the check answered ${res.status}`], made: json.made ?? {} };
  } catch {
    return { problems: ["the check could not be reached"], made: {} };
  }
};

export interface RoundChanges {
  pagesAdded: string[];
  pagesRemoved: string[];
  hooksAdded: string[];
  hooksRemoved: string[];
  /** Hooks on a different kind of element now: a rule for a button may not fit a link. */
  kindChanged: string[];
  tokensAdded: string[];
  tokensRemoved: string[];
  /** Tokens the board holds behind the code (missing, or another value): "Take these in" brings them, even when nothing else changed since the last round. */
  tokensBehind?: string[];
  /** The layer's rules for hooks no page has now: they would style nothing. */
  staleRules: string[];
  /** Nothing changed and nothing is stale. */
  same: boolean;
  says: string;
}

const list = (xs: string[], most = 8) => (xs.length > most ? `${xs.slice(0, most).join(", ")} and ${xs.length - most} more` : xs.join(", "));

/** What changed between two snapshots, and which of the layer's hooks are gone. */
export function roundChanges(before: KitSeen, now: KitSeen, layerHooks: string[] = []): RoundChanges {
  const b = new Set(Object.keys(before.hooks));
  const n = new Set(Object.keys(now.hooks));
  const pagesAdded = now.pages.filter((p) => !before.pages.includes(p));
  const pagesRemoved = before.pages.filter((p) => !now.pages.includes(p));
  const hooksAdded = [...n].filter((h) => !b.has(h)).sort();
  const hooksRemoved = [...b].filter((h) => !n.has(h)).sort();
  const kindChanged = [...n].filter((h) => b.has(h) && before.hooks[h] && now.hooks[h] && before.hooks[h] !== now.hooks[h]).sort();
  const tokensAdded = now.tokens.filter((t) => !before.tokens.includes(t));
  const tokensRemoved = before.tokens.filter((t) => !now.tokens.includes(t));
  const staleRules = [...new Set(layerHooks)].filter((h) => !n.has(h)).sort();
  const same = !pagesAdded.length && !pagesRemoved.length && !hooksAdded.length && !hooksRemoved.length && !kindChanged.length && !tokensAdded.length && !tokensRemoved.length && !staleRules.length;
  const lines: string[] = [];
  if (same) lines.push(`Nothing changed in the code since ${before.at ? `it was read on ${before.at.slice(0, 10)}` : "it was brought in"}.`);
  if (pagesAdded.length) lines.push(`New page${pagesAdded.length === 1 ? "" : "s"}: ${list(pagesAdded)}.`);
  if (pagesRemoved.length) lines.push(`Page${pagesRemoved.length === 1 ? "" : "s"} gone: ${list(pagesRemoved)}.`);
  if (hooksAdded.length) lines.push(`${hooksAdded.length} new hook${hooksAdded.length === 1 ? "" : "s"}: ${list(hooksAdded)}.`);
  if (hooksRemoved.length) lines.push(`${hooksRemoved.length} hook${hooksRemoved.length === 1 ? "" : "s"} gone: ${list(hooksRemoved)}.`);
  if (kindChanged.length) lines.push(`Now a different kind of element: ${list(kindChanged.map((h) => `${h} (${before.hooks[h]} to ${now.hooks[h]})`))}.`);
  if (tokensAdded.length) lines.push(`New token${tokensAdded.length === 1 ? "" : "s"}: ${list(tokensAdded)}.`);
  if (tokensRemoved.length) lines.push(`Token${tokensRemoved.length === 1 ? "" : "s"} gone: ${list(tokensRemoved)}.`);
  if (staleRules.length) lines.push(`Warning: your design styles ${list(staleRules)}, which no page has now. Those rules would style nothing; bring the site in again, or ask a code chat to put the hook back.`);
  return { pagesAdded, pagesRemoved, hooksAdded, hooksRemoved, kindChanged, tokensAdded, tokensRemoved, staleRules, same, says: lines.join(" ") };
}

/** The hooks a layer's rules name, from their selectors. */
export function layerHooksOf(rules: { selector: string }[]): string[] {
  const out: string[] = [];
  for (const r of rules) for (const m of r.selector.matchAll(/\[data-hook="([^"]+)"\]|#([A-Za-z][\w-]*)/g)) out.push(m[1] ?? `#${m[2]}`);
  return out;
}

/**
 * Before a design round: the repository as it is now on its default branch,
 * against what the site was brought in from (`source.seen`, else the pages'
 * hooks read at import).
 */
export async function readRound(source: StyleSource, token: string, opts: { fetch?: Fetch; layerHooks?: string[]; when?: string } = {}): Promise<Answer<{ changes: RoundChanges; seen: KitSeen; manifest: KitManifest | null; branch: string }>> {
  const f = opts.fetch ?? fetch;
  const main = await defaultBranch(f, token, source.repo);
  if (!main.ok) return main;
  const when = opts.when ?? new Date().toISOString();
  const kit = await readKit(source.repo, main.branch, token, { fetch: f, when });
  if (kit && !kit.ok) return kit;
  let now: KitSeen;
  if (kit) now = kit.seen;
  else {
    const hooks: Record<string, string> = {};
    const pages: string[] = [];
    for (const page of source.files) {
      const html = await fileAt(f, token, source.repo, main.branch, page.file);
      if (html === null) continue;
      pages.push(page.file);
      for (const h of hooksIn(html)) hooks[h.attr === "id" ? `#${h.value}` : h.value] = "";
    }
    now = { ref: main.branch, at: when, kit: false, pages: pages.sort(), hooks, tokens: seenOfSource(source).tokens };
  }
  let before = source.seen ?? seenOfSource(source);
  let fair = now;
  /* A snapshot from pages alone knows ids, but no element kinds or tokens: compare like with like. */
  if (before.kit !== now.kit) {
    const named = (h: Record<string, string>) => Object.fromEntries(Object.keys(h).filter((k) => !k.startsWith("#")).map((k) => [k, ""]));
    before = { ...before, hooks: named(before.hooks) };
    fair = { ...now, tokens: before.tokens, hooks: named(now.hooks) };
  }
  let changes = roundChanges(before, fair, opts.layerHooks ?? []);
  /* What the board holds is compared too, not only the last round: a site whose round was taken in before its tokens were (or before the code changed) still catches up. */
  const behind = tokensBehind(source, now);
  if (behind.length) {
    const said = `The board's design tokens are behind the code: ${behind.length} to take in (${behind.slice(0, 4).join(", ")}${behind.length > 4 ? ", …" : ""}).`;
    changes = { ...changes, tokensBehind: behind, same: false, says: changes.same ? said : `${changes.says} ${said}` };
  }
  return { ok: true, changes, seen: now, manifest: kit ? kit.manifest : null, branch: main.branch };
}

/**
 * A repository's builder.json: the builder-ready starter kit's manifest.
 *
 * The contract is PST's kit/BUILDER-CONTRACT.md (the kit merged into
 * sparkygogo77-spec/PST, its own repository later). builder.json is what the
 * builder reads first, and every path in it is relative to the file itself:
 *
 *   { "kit": "1.0.0", "name": "PonsStars",
 *     "pages": [{ "file": "web/index.html", "title": "Play" }, …],
 *     "hooks": "web/builder-hooks.json", "tokens": "web/tokens.css",
 *     "styleLayer": "web/style-layer.css",
 *     "preview": { "page": "web/preview.html", "query": "?still=1&screen=<name>",
 *                  "screens": [{ "name": "home", "page": "starter/index.html" }, …] },
 *     "gallery": "web/gallery.html",
 *     "scripts": { "hookCalls": { "setText": 0, "part": 1, … }, "helperFiles": ["web/dom.js"] },
 *     "links": { "allowHosts": [...], "block": [{ "pattern", "why" }] },
 *     "tokensModule": "web/tokens.js" }
 *
 * When a repository has one, Bring it in reads it first and imports from it
 * directly: its pages in its order and by its titles, parts named by their
 * data-hook, the code view from its hooks file, its tokens as variables the
 * owner sets, and the style layer written to its styleLayer. Without one,
 * the page is found and read as before.
 *
 * Pure. `tests/code-view.mjs` holds it against the kit's own builder.json and
 * PST's.
 */

export interface BuilderManifest {
  /** Where it was found. */
  file: string;
  kit: string | null;
  name: string | null;
  pages: { file: string; name?: string }[];
  hooks: string | null;
  tokens: string | null;
  styleLayer: string | null;
  /** The preview screens' names, each opened at `<page><query>` with the name in. */
  screens: string[];
  /** Each screen with the page it is a state of, where the manifest says (`{ "name", "page" }`). */
  screenPages: { name: string; page: string }[];
  previewPage: string | null;
  previewQuery: string | null;
  gallery: string | null;
  /** The script helpers that take a hook, and which argument it is (`setText('x')`: 0, `part(row, 'x')`: 1). */
  hookCalls: Record<string, number>;
  helperFiles: string[];
  /** Where links may go, and the patterns they must not match, with why. */
  links: { allowHosts: string[]; block: { pattern: string; why: string }[] } | null;
  tokensModule: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A path written in the manifest, from the folder the manifest is in. */
function rooted(path: unknown, base: string): string | null {
  const p = str(path);
  if (!p) return null;
  const q = p.replace(/^\.\//, "");
  return q.startsWith("/") ? q.slice(1) : `${base}${q}`;
}

/** The manifest, or null when the text is not one (no pages and no hooks, tokens or style layer). */
export function readManifest(text: string, file = "builder.json"): BuilderManifest | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const base = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
  const pages: BuilderManifest["pages"] = [];
  if (Array.isArray(o.pages)) for (const p of o.pages) {
    if (!p || typeof p !== "object") continue;
    const q = p as Record<string, unknown>;
    const f = rooted(q.file, base);
    if (f && /\.html?$/i.test(f)) pages.push({ file: f, ...(str(q.title) ? { name: str(q.title)! } : {}) });
  }
  const preview = o.preview && typeof o.preview === "object" ? (o.preview as Record<string, unknown>) : null;
  const screens = Array.isArray(preview?.screens) ? (preview!.screens as unknown[]).map((s) => (s && typeof s === "object" ? str((s as Record<string, unknown>).name) : null)).filter((s): s is string => !!s) : [];
  const screenPages = Array.isArray(preview?.screens) ? (preview!.screens as unknown[]).flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const name = str((s as Record<string, unknown>).name);
    const page = rooted((s as Record<string, unknown>).page, base);
    return name && page ? [{ name, page }] : [];
  }) : [];
  const scripts = o.scripts && typeof o.scripts === "object" ? (o.scripts as Record<string, unknown>) : null;
  const calls = scripts?.hookCalls && typeof scripts.hookCalls === "object" ? Object.fromEntries(Object.entries(scripts.hookCalls as Record<string, unknown>).filter(([, v]) => Number.isInteger(v)).map(([k, v]) => [k, v as number])) : {};
  const links = o.links && typeof o.links === "object" ? (o.links as Record<string, unknown>) : null;
  const m: BuilderManifest = {
    file,
    kit: o.kit === undefined || o.kit === null ? null : String(o.kit),
    name: str(o.name),
    pages,
    hooks: rooted(o.hooks, base),
    tokens: rooted(o.tokens, base),
    styleLayer: rooted(o.styleLayer, base),
    screens,
    screenPages,
    previewPage: rooted(preview?.page, base),
    previewQuery: str(preview?.query),
    gallery: rooted(o.gallery, base),
    hookCalls: calls,
    helperFiles: Array.isArray(scripts?.helperFiles) ? (scripts!.helperFiles as unknown[]).map((f) => rooted(f, base)).filter((f): f is string => !!f) : [],
    links: links ? {
      allowHosts: Array.isArray(links.allowHosts) ? links.allowHosts.map(String) : [],
      block: Array.isArray(links.block) ? (links.block as unknown[]).filter((b) => b && typeof b === "object").map((b) => ({ pattern: String((b as Record<string, unknown>).pattern ?? ""), why: String((b as Record<string, unknown>).why ?? "") })).filter((b) => b.pattern) : [],
    } : null,
    tokensModule: rooted(o.tokensModule, base),
  };
  return m.pages.length || m.hooks || m.tokens || m.styleLayer ? m : null;
}

/** The manifest's file in a repository's tree: at the root, or at the root of the folder the site is in. */
export function manifestIn(paths: readonly string[], dir?: string | null): string | null {
  const d = dir ? `${dir.replace(/\/?$/, "/")}` : "";
  return paths.find((p) => p === `${d}builder.json`) ?? paths.find((p) => p === "builder.json") ?? null;
}

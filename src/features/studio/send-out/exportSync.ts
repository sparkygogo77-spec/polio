/**
 * WHO OWNS EACH EXPORTED FILE, AND WHAT A NEW EXPORT MAY WRITE
 * (create-system "(d) Export", "Staying in sync with later edits").
 *
 * The rule is the one the kit and Build already use: each file has one
 * owner. Polio owns what it writes (`tokens/*`, `components/ui/*`, and any
 * file carrying "Made by Polio. Edits here are replaced on the next
 * export."). A person or a code chat owns everything else, and any Polio
 * file once it was edited in the repository.
 *
 * Every export carries `polio/export.json`: each file Polio wrote, by the
 * git blob sha of what it wrote, and its owner. The next export reads the
 * one on the branch and, for each file it would write:
 *
 *   · not on the branch, or the branch holds exactly what Polio last wrote
 *     there: written again;
 *   · the branch holds something else (someone edited it): KEPT, not sent,
 *     and from then on the person's ("code");
 *   · a token file (`tokens/*`): always written, because tokens are only
 *     values, and that is how a colour changed in the Builder reaches the
 *     code without touching a page;
 *   · a file the record already gives to code: kept, even if Polio would
 *     write it again;
 *   · no record (the first export into a repository that already has a
 *     file there): a file there that differs is somebody's, kept.
 *
 * A file Polio wrote before and no longer writes is left where it is and
 * said (`left`): nothing is taken off a repository by an export.
 *
 * Pure: the browser reads the branch and pushes (`exportRun.ts`).
 */
import { POLIO_HEADER, TOKENS_DIR } from "./tokensOut.ts";

export const EXPORT_RECORD = "polio/export.json";

export type ExportMode = "exact" | "clean";
export type Owner = "polio" | "code";
export interface RecordFile { sha: string; owner: Owner }
export interface ExportRecord {
  mode: ExportMode;
  target: "next-tailwind";
  /** When it was written (ISO). */
  at: string;
  /** What it counted: tokens, components and pages changed since the last export (for the dialog's "since then" line). */
  system?: { id: string; rev: number } | null;
  files: Record<string, RecordFile>;
}

const ABOUT = `Written by Polio on every export. Each file Polio wrote, by the git blob sha of what it wrote there, and its owner. A Polio file edited here since is kept on the next export and becomes "code"; tokens/* are always written again. Delete a line to give a file back to Polio. ${POLIO_HEADER}`;
const SHA = /^[0-9a-f]{40}$/;

export function recordFile(r: ExportRecord): { path: string; content: string } {
  const files = Object.fromEntries(Object.keys(r.files).sort().map((p) => [p, r.files[p]!]));
  return { path: EXPORT_RECORD, content: `${JSON.stringify({ about: ABOUT, mode: r.mode, target: r.target, at: r.at, system: r.system ?? null, files }, null, 2)}\n` };
}

/** A record read from the branch; null for anything that is not one. */
export function readRecord(text: string | null): ExportRecord | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Record<string, unknown>;
    if (!v || typeof v !== "object" || !v.files || typeof v.files !== "object") return null;
    const files: Record<string, RecordFile> = {};
    for (const [path, f] of Object.entries(v.files as Record<string, unknown>)) {
      const e = f as { sha?: unknown; owner?: unknown } | null;
      if (!e || typeof e.sha !== "string" || !SHA.test(e.sha) || !path || path.startsWith("/") || path.split("/").includes("..")) continue;
      files[path] = { sha: e.sha, owner: e.owner === "code" ? "code" : "polio" };
    }
    const sys = v.system as { id?: unknown; rev?: unknown } | null | undefined;
    return {
      mode: v.mode === "clean" ? "clean" : "exact", target: "next-tailwind", at: typeof v.at === "string" ? v.at : "",
      system: sys && typeof sys.id === "string" && typeof sys.rev === "number" ? { id: sys.id, rev: sys.rev } : null, files,
    };
  } catch {
    return null;
  }
}

/** A file Polio always writes again, whatever the branch holds: the tokens. */
export const alwaysWritten = (path: string) => path.startsWith(`${TOKENS_DIR}/`);

export interface SyncPlan {
  /** Paths to send. */
  write: string[];
  /** Paths edited in the repository since Polio wrote them (or never Polio's): kept as they are, not sent. */
  keep: string[];
  /** Paths Polio wrote before and writes no more: left in the repository, said. */
  left: string[];
  /** The record this export carries. */
  record: ExportRecord;
}

/**
 * What an export writes and keeps. `now` is every file it would write, by
 * path, with the blob sha of its content;
 * `onBranch` is the branch's files by blob sha; `was` its record, if any.
 */
export function syncPlan(was: ExportRecord | null, now: { path: string; sha: string }[], onBranch: ReadonlyMap<string, string>, meta: Omit<ExportRecord, "files">): SyncPlan {
  const write: string[] = [];
  const keep: string[] = [];
  const files: Record<string, RecordFile> = {};
  for (const f of now) {
    const there = onBranch.get(f.path);
    const last = was?.files[f.path];
    const mine = (): boolean => {
      if (alwaysWritten(f.path)) return true;
      if (there === undefined || there === f.sha) return last?.owner !== "code" || there === f.sha;
      if (last) return last.owner === "polio" && there === last.sha;
      /* No record says Polio wrote what is there: it is somebody's. */
      return false;
    };
    if (mine()) { write.push(f.path); files[f.path] = { sha: f.sha, owner: "polio" }; }
    else { keep.push(f.path); if (there !== undefined) files[f.path] = { sha: there, owner: "code" }; }
  }
  const left = Object.keys(was?.files ?? {}).filter((p) => !now.some((f) => f.path === p) && onBranch.has(p));
  for (const p of left) files[p] = { sha: onBranch.get(p)!, owner: was!.files[p]!.owner };
  return { write: write.sort(), keep: keep.sort(), left: left.sort(), record: { ...meta, files } };
}

/** The dialog's line about the last export: when, and what was kept. */
export function lastExportSays(was: ExportRecord | null, plan: SyncPlan | null, now = Date.now()): string {
  if (!was) return "No export yet.";
  const days = was.at ? Math.floor((now - Date.parse(was.at)) / 86_400_000) : NaN;
  const when = Number.isNaN(days) ? "" : days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  const kept = plan?.keep.length ?? 0;
  return `Last export: ${when || "earlier"}.${kept ? ` ${kept} file${kept === 1 ? " was" : "s were"} edited in the repo: kept.` : ""}`;
}

/* ------------------------------------------------------------------ */
/* What both ways of exporting share                                   */
/* ------------------------------------------------------------------ */

/** Tailwind v4 and its PostCSS plugin, at the Builder's own versions, beside Build's packages (`scaffolding/app.ts`). */
export const TAILWIND_PACKAGES = { tailwindcss: "^4.3.3", "@tailwindcss/postcss": "^4.3.3" } as const;

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/**
 * The files that make an export a Next.js + Tailwind app Vercel builds:
 * Build's app files (`appFiles`: package.json, tsconfig, next.config, the
 * vercel.json that tells Vercel it is Next.js, .gitignore) with Tailwind
 * added, and the PostCSS config Tailwind runs through.
 */
export function appSetup(build: { path: string; content: string }[]): { path: string; content: string }[] {
  return [
    ...build.map((f) => {
      if (f.path !== "package.json") return f;
      const pkg = JSON.parse(f.content) as { devDependencies?: Record<string, string> };
      return { path: f.path, content: json({ ...pkg, devDependencies: { ...pkg.devDependencies, ...TAILWIND_PACKAGES } }) };
    }),
    { path: "postcss.config.mjs", content: `/* ${POLIO_HEADER} */\nexport default { plugins: { "@tailwindcss/postcss": {} } };\n` },
  ];
}

/** POLIO.md's System section: the token files and how to use them, and the components. */
export function systemMd(o: { mode: ExportMode; tokens: number; components: { name: string; variants: number }[]; tokenFiles: readonly string[] }): string {
  const lines = [
    "## System",
    "",
    `This export is **${o.mode === "exact" ? "Exact look" : "Clean code"}** (Next.js + Tailwind). ${o.mode === "exact" ? "Each page is the published page exactly as the board draws it (`app/<route>/markup.ts`): edit the board and export again. For code to keep working on, export Clean code." : "Pages are laid out with flex and grid from the board's layout, each section a component in `components/sections/`, every style a Tailwind class."}`,
    "",
    `${o.tokens} design tokens, in ${o.tokenFiles.map((f) => `\`${f}\``).join(", ")}: the same values as W3C design tokens, CSS variables, a Tailwind \`@theme\` (\`bg-accent\`, \`text-heading-1\`, \`p-space-4\`, \`rounded-small\`, \`shadow-low\`) and a typed object. The token files are Polio's: every export writes them again, so change a token in the Builder's System tab, or change \`tokens/tokens.json\` and Refresh in the Builder to take it back in.`,
    "",
  ];
  if (o.mode === "clean" && o.components.length) {
    lines.push(`Components, in \`components/ui/\` (import from \`@/components/ui\`), each with a \`variant\` prop and real hover, pressed, focus and disabled states:`, "");
    for (const c of o.components) lines.push(`- \`${c.name}\`: ${c.variants} variant${c.variants === 1 ? "" : "s"}`);
    lines.push("", "`app/gallery/page.tsx`, when exported, shows every variant.", "");
  }
  lines.push("Files Polio wrote carry the line \"" + POLIO_HEADER + "\" and are listed in `polio/export.json`. Edit one here and the next export keeps your edit; the file is yours from then on.", "");
  return lines.join("\n");
}

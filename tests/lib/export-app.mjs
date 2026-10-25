/**
 * An exported Next.js + Tailwind app, written to disk and built with `next build`.
 *
 * The export tests (tokens-out, pages-out, library-out, exact-out) hand this
 * the files an export writes; it lays them in `.scratch/export-app/<tag>/`
 * (git-ignored) beside a package.json, a PostCSS config for Tailwind v4 and a
 * tsconfig only where the export has none of its own, and runs this
 * repository's own `next build` on it. The app sits inside the repository, so
 * it finds next, react and @tailwindcss/postcss in its node_modules without an
 * install.
 *
 *   const app = await buildApp("tokens-mochi3", files);
 *   app.ok, app.log, app.dir, app.css()   // the built stylesheets, joined
 */
import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DEFAULTS = {
  "package.json": JSON.stringify({ name: "polio-export-check", private: true, scripts: { build: "next build" } }, null, 2),
  "postcss.config.mjs": 'export default { plugins: { "@tailwindcss/postcss": {} } };\n',
  "next.config.mjs": `export default { turbopack: { root: ${JSON.stringify(ROOT.replace(/\\/g, "/"))} }, typescript: { ignoreBuildErrors: false } };\n`,
  "tsconfig.json": JSON.stringify({
    compilerOptions: { target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], allowJs: false, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "react-jsx", incremental: false, paths: { "@/*": ["./*"] } },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"], exclude: ["node_modules"],
  }, null, 2),
};

/** Writes the files (each `{ path, content }`, content a string or bytes) and builds them. */
export async function buildApp(tag, files, { keepDefaults = [] } = {}) {
  const dir = join(ROOT, ".scratch", "export-app", tag);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const given = new Set(files.map((f) => f.path));
  for (const [path, content] of Object.entries(DEFAULTS)) {
    /* The export's own package.json and next config name its Vercel setup; the check builds with ours so it needs no install. */
    if (!given.has(path) || keepDefaults.includes(path) || path === "package.json" || path === "next.config.mjs" || path === "postcss.config.mjs") writeFileSync(join(dir, path), content);
  }
  for (const f of files) {
    if (["package.json", "next.config.mjs", "postcss.config.mjs"].includes(f.path)) continue;
    const at = join(dir, f.path);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, f.content);
  }
  const next = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const log = await new Promise((done) => {
    let out = "";
    const p = spawn(process.execPath, [next, "build"], { cwd: dir, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--max-old-space-size=4096" } });
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => done({ code, out }));
  });
  return {
    ok: log.code === 0,
    log: log.out,
    dir,
    css() {
      const at = join(dir, ".next", "static");
      if (!existsSync(at)) return "";
      const all = [];
      const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".css")) all.push(readFileSync(p, "utf8")); } };
      walk(at);
      return all.join("\n");
    },
  };
}

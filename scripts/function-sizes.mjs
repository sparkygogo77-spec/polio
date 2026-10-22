#!/usr/bin/env node
/**
 * How big each serverless function is, from the last `next build`.
 *
 * Vercel's Functions Storage is every deployment's functions, each carrying
 * what its trace found (`.next/server/**\/*.nft.json`) beside its own code.
 * This adds them up the way it is billed: per function, the traced files and
 * the function's own file, with node_modules shared by none. It prints the
 * largest functions, what makes them large, and the total.
 *
 *   npm run build && node scripts/function-sizes.mjs [--json] [--top 12]
 */
import { readFileSync, statSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";

const root = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith("--") && process.argv[i - 1] !== "--top") ?? ".");
const server = join(root, ".next", "server");
if (!existsSync(server)) { console.error("No .next/server: run next build first."); process.exit(2); }
const top = Number(process.argv[process.argv.indexOf("--top") + 1]) || 12;
const nfts = [];
(function walk(d) { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith(".nft.json") && /[/\\](route|page)\.js\.nft\.json$/.test(p) && p.includes(`${join("server", "app")}`)) nfts.push(p); } })(server);
const size = (p) => { try { const s = statSync(p); return s.isFile() ? s.size : 0; } catch { return 0; } };
const out = [];
for (const nft of nfts) {
  const { files } = JSON.parse(readFileSync(nft, "utf8"));
  const own = nft.replace(/\.nft\.json$/, "");
  let bytes = size(own);
  const by = new Map();
  /* A file the trace lists twice (a package reached by two paths) is one file in the function. */
  const seen = new Set();
  for (const f of files) {
    const abs = resolve(dirname(nft), f);
    let real = abs; try { real = realpathSync(abs); } catch { /* gone */ }
    if (seen.has(real)) continue;
    seen.add(real);
    const b = size(abs);
    bytes += b;
    const rel = relative(root, abs);
    const key = rel.startsWith("node_modules") ? rel.split(/[/\\]/).slice(0, rel.split(/[/\\]/)[1]?.startsWith("@") ? 3 : 2).join("/") : rel.split(/[/\\]/).slice(0, 2).join("/");
    by.set(key, (by.get(key) ?? 0) + b);
  }
  out.push({ fn: relative(join(server, "app"), own).replaceAll("\\", "/").replace(/[/\\](route|page)\.js$/, "") || "/", bytes, files: files.length, heaviest: [...by].sort((a, b) => b[1] - a[1]).slice(0, 4) });
}
out.sort((a, b) => b.bytes - a.bytes);
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const total = out.reduce((s, f) => s + f.bytes, 0);
if (process.argv.includes("--json")) { console.log(JSON.stringify({ total, functions: out }, null, 1)); process.exit(0); }
for (const f of out.slice(0, top)) console.log(`${mb(f.bytes).padStart(9)}  ${f.fn}  (${f.files} files; ${f.heaviest.map(([k, b]) => `${k} ${mb(b)}`).join(", ")})`);
console.log(`\n${out.length} functions, ${mb(total)} in all; largest ${mb(out[0]?.bytes ?? 0)}`);

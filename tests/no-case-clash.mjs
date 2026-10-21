/**
 * No two tracked files may clash on a case-insensitive disk (Windows, macOS).
 *
 * Two kinds of clash, both of which make `npm run build` and `tsc` fail there:
 *   - the same path in two cases (`a/Foo.ts`, `a/foo.ts`): the checkout can
 *     hold only one;
 *   - the same name in two cases with different extensions (`Lanes.tsx`,
 *     `lanes.ts`): both check out, but `import "./lanes"` finds either one.
 *
 *   node tests/no-case-clash.mjs
 */
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);

const CODE = /\.(tsx?|jsx?|mjs|cjs|mts|cts)$/;
const seen = new Map();
const add = (key, file) => seen.set(key, [...(seen.get(key) ?? []), file]);
for (const f of files) {
  add(`path ${f.toLowerCase()}`, f);
  if (CODE.test(f)) add(`name ${f.toLowerCase().replace(/\.[^./]+$/, "")}`, f);
}

let bad = 0;
for (const [key, group] of seen) {
  // Same name, one case, two extensions (`a.ts`, `a.tsx`) resolves the same everywhere.
  if (key.startsWith("name ") && new Set(group.map((f) => f.replace(/\.[^./]+$/, ""))).size < 2) continue;
  if (group.length < 2) continue;
  bad++;
  console.log(`FAIL  differ only by case: ${group.join("  |  ")}`);
}
console.log(bad ? `\n${bad} clash(es). Rename one of each pair to a distinct name.` : `ok  no case clashes among ${files.length} tracked files`);
process.exit(bad ? 1 : 0);

/**
 * Go live finds the project past the first hundred.
 *
 * The deploy route asked Vercel for projects with `limit=100` and looked in
 * that one page. An account or team with more than a hundred projects was
 * told there was no project and to import one at vercel.com/new, which was
 * the wrong advice for a project that was there on page two. The lookup
 * walks `pagination.next` now, and stops as soon as it has what it wants.
 *
 *   node tests/vercel-pages.mjs
 */
import { readFileSync } from "node:fs";
import { findVercelProject } from "../src/features/studio/vercelProjects.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* Two hundred and fifty projects in pages of a hundred, the way Vercel pages: `next` is the cursor for `until`. */
const all = Array.from({ length: 250 }, (_, i) => ({ id: `prj_${i}`, name: `site-${i}`, link: i === 231 ? { type: "github", org: "Acme", repo: "Polio" } : undefined }));
const pager = () => {
  const fetched = [];
  const page = async (until) => {
    fetched.push(until);
    const start = until === null ? 0 : Number(until);
    const projects = all.slice(start, start + 100);
    return { projects, next: start + 100 < all.length ? String(start + 100) : null };
  };
  return { page, fetched };
};

{
  const p = pager();
  const hit = await findVercelProject(p.page, (x) => x.link?.type === "github" && x.link.org?.toLowerCase() === "acme" && x.link.repo?.toLowerCase() === "polio");
  check("a project on the third page is found", hit?.id === "prj_231", hit?.id ?? "none");
  check("after three pages, not one", p.fetched.length === 3, `${p.fetched.length} pages: ${p.fetched.join(", ")}`);
}
{
  const p = pager();
  const hit = await findVercelProject(p.page, (x) => x.name === "site-3");
  check("a project on the first page costs one page", hit?.id === "prj_3" && p.fetched.length === 1, `${p.fetched.length} pages`);
}
{
  const p = pager();
  const hit = await findVercelProject(p.page, () => false);
  check("no such project reads every page and answers none", hit === null && p.fetched.length === 3, `${p.fetched.length} pages`);
}
{
  const loop = async () => ({ projects: [], next: "again" });
  const hit = await findVercelProject(loop, () => false);
  check("a cursor that never ends is given up on", hit === null);
}
const route = readFileSync("src/app/api/studio/deploy/route.ts", "utf8");
check("the deploy route looks up projects this way", /findVercelProject\(/.test(route) && /until/.test(route));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

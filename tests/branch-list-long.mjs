/**
 * A LONG BRANCH LIST STILL SHOWS THE SITE'S OWN BRANCH, AND COUNTS THE REST.
 *
 * The branch list shows at most forty rows, and Merge into main is drawn
 * only on the row of the branch Update live site writes to. It used to keep
 * the first forty names in GitHub's order (alphabetical) and read one page
 * of a hundred, so in a repo with many claude/* branches the site's own
 * branch could get no row, and with it no Merge anywhere, while "And N more
 * on GitHub" stopped counting at a hundred.
 *
 *   · GitHub is a stand-in fetch with 121 branches besides main, served a
 *     hundred a page in name order; the site's branch sorts last;
 *   · the route (`api/studio/branches`) is the real handler, called
 *     in-process with the site's branch named, as the repo control does;
 *   · it reads the second page, gives the site's branch a row, and "more"
 *     is every other branch not shown;
 *   · without a branch named it still lists the first forty;
 *   · the repo control names its branch when it asks.
 *
 * No server, no browser, no token: the token is a placeholder the stand-in
 * never reads.
 *
 *   node tests/branch-list-long.mjs
 *
 * Covers: src/app/api/studio/branches/route.ts, src/features/studio/RepoPicker.tsx
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 300)}`}`);
};

/* ------------------------------------------------- GitHub, in one fetch */
const others = Array.from({ length: 120 }, (_, i) => `claude/b-${String(i).padStart(3, "0")}`);
const SITE = "claude/zz-site";
const all = ["main", ...others, SITE].sort();
const pages = [];
const compared = [];
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  if (u.pathname === "/repos/him/site") return json({ default_branch: "main" });
  if (u.pathname === "/repos/him/site/branches") {
    const page = Number(u.searchParams.get("page") ?? 1), per = Number(u.searchParams.get("per_page") ?? 30);
    pages.push(page);
    return json(all.slice((page - 1) * per, page * per).map((name) => ({ name })));
  }
  const cmp = u.pathname.match(/^\/repos\/him\/site\/compare\/main\.\.\.(.+)$/);
  if (cmp) { const name = decodeURIComponent(cmp[1]); compared.push(name); return json({ ahead_by: name === SITE ? 3 : 0, behind_by: 0, files: [] }); }
  return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
};
process.env.GITHUB_API = "https://github.test";
process.env.GITHUB_TOKEN = "STANDIN_GITHUB_TOKEN";

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const { GET } = await jiti.import(join(ROOT, "src/app/api/studio/branches/route.ts"));

/* ------------------------------------------------- the site's branch named */
const named = await (await GET(new Request(`http://polio.test/api/studio/branches?repo=him/site&branch=${encodeURIComponent(SITE)}`))).json();
const rows = named.branches ?? [];
check("the route answers", named.ok === true && named.base === "main", JSON.stringify(named).slice(0, 200));
check("every page of GitHub's list is read", pages.includes(2) && Math.max(...pages) === 2, JSON.stringify(pages));
check("the site's branch gets a row though it sorts last", rows.some((r) => r.name === SITE), rows.map((r) => r.name).join(", "));
check("its row carries its updates, so it sorts to the top", rows[0]?.name === SITE && rows[0]?.updates === 3, JSON.stringify(rows[0]));
check("no more than forty rows", rows.length === 40, String(rows.length));
check("no branch twice", new Set(rows.map((r) => r.name)).size === rows.length);
check("main is never a row", !rows.some((r) => r.name === "main"));
check(`"more" counts every other branch not shown (${all.length - 1} - 40)`, named.more === all.length - 1 - rows.length, String(named.more));
check("only the rows shown are compared", compared.length === rows.length, String(compared.length));

/* ------------------------------------------------- no branch named, or one that is main */
pages.length = 0;
const plain = await (await GET(new Request("http://polio.test/api/studio/branches?repo=him/site"))).json();
check("without a branch it lists the first forty", plain.ok === true && plain.branches?.length === 40 && !plain.branches.some((r) => r.name === SITE) && plain.more === all.length - 1 - 40, JSON.stringify({ n: plain.branches?.length, more: plain.more }));
const onMain = await (await GET(new Request("http://polio.test/api/studio/branches?repo=him/site&branch=main"))).json();
check("a site on main gets no main row", onMain.ok === true && !onMain.branches.some((r) => r.name === "main") && onMain.branches.length === 40);

/* ------------------------------------------------- the repo control names its branch */
const picker = readFileSync(join(ROOT, "src/features/studio/RepoPicker.tsx"), "utf8");
check("the repo control asks with the branch it publishes to", /\/api\/studio\/branches\?repo=\$\{encodeURIComponent\(own\)\}&branch=\$\{encodeURIComponent\(ownBranch\)\}/.test(picker));
check("and asks again when that branch changes", /\}, \[own, ownBranch\]\);/.test(picker));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

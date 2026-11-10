import type { NextConfig } from "next";

/** The routes that open the headless browser (each through `api/studio/headless.ts`); `tests/function-sizes.mjs` holds the same list. */
const BROWSER_ROUTES = ["/api/studio/element", "/api/studio/preview-video", "/api/studio/render", "/api/studio/screenshot", "/api/studio/zip"];

/**
 * `playwright-core`, folder by folder, less the two no launch ever loads:
 * `lib/vite/` is the trace viewer, recorder, HTML report and dashboard (web
 * pages, served only by `npx playwright show-trace` and codegen) and `types/`
 * is declarations. Six megabytes no `require` reaches, in each of five
 * functions. Named one folder at a time, with no negation and no bare `*`:
 * Turbopack's own glob reads `!(vite)` as nothing special and a `*` that
 * lands on a folder takes the folder whole, which is how a first try put the
 * pages straight back. `*.*` is the files beside the folders (browsers.json,
 * package.json, index.js); LICENSE, NOTICE and lib/xdg-open have no dot and
 * nothing loads them. `tests/trace-safe-paths.mjs` holds this list against
 * the installed package, so a playwright that grows a folder fails there
 * instead of losing it quietly. Said again in the excludes below, for the
 * copies Turbopack traces itself from playwright's code.
 */
const PLAYWRIGHT_CORE_FILES = ["*.*", "bin/**", "lib/*.*", "lib/entry/**", "lib/server/**", "lib/tools/**"].map((p) => `./node_modules/playwright-core/${p}`);

/** The build's one stamp: set once, in the first process that loads this file, and inherited by the rest. */
function buildStamp(): string {
  process.env.BUILD_TIME ||= new Date().toISOString();
  return process.env.BUILD_TIME;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * Source maps for the browser's scripts, only when asked for: they are how
   * `scripts/route-script.mjs --modules` says which source files make up the
   * script a route loads. Off for every real build (they would be served).
   */
  productionBrowserSourceMaps: process.env.POLIO_SOURCEMAPS === "1",
  /*
   * When this build was made, so a deployment can say how old it is.
   *
   * `/api/version` answers which commit is being served; this is the other
   * half of the same question. Read at build, frozen into the bundle, and
   * public — it is a timestamp.
   *
   * One build, one stamp. `next build` reads this file in more than one
   * process (the server's compiler and the pages' each load it), and a
   * `new Date()` per load stamped a local webpack build's pages and server
   * seconds apart: BuildGuard then called every page "an older build than
   * the server" and refused every press. So the first load writes the stamp
   * into its own environment, which every process it starts inherits, and
   * every later load reads it back. A stamp set from outside wins.
   */
  env: { BUILD_TIME: buildStamp() },
  /*
   * The headless browser, kept out of the bundle.
   *
   * `playwright-core` and `@sparticuz/chromium` are required at run time by
   * the routes that open the site — the second is a hundred-odd megabytes of
   * packed Chromium — and neither survives being traced and bundled: the
   * bundler rewrites the paths the binary is unpacked from and the launch then
   * looks for a browser that is not there. Named here they are left alone and
   * required from `node_modules` at run time, which is what they expect.
   *
   * A full Playwright install is not listed because it is never imported by
   * path the bundler can see: it is required from outside the project.
   */
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  /*
   * ...and pulled into the function whole.
   *
   * External is not the same as present. A serverless host builds each route
   * into its own bundle and copies in only what the trace found, and neither
   * of these packages is only its code: `@sparticuz/chromium` reads a packed
   * browser off disk beside itself, and `playwright-core` reads
   * `browsers.json` the moment it loads. Naming the browser's `bin/` alone
   * got the deployment as far as "Cannot find module
   * '/var/task/node_modules/playwright-core/browsers.json'", which is the
   * same lesson twice: a file no import mentions is a file the tracer cannot
   * know about, and the only safe list of those is all of them. So both
   * packages go in entire — a few megabytes of code beside a browser that is
   * already fifty.
   */
  /*
   * ...into the routes that open a browser, and no other.
   *
   * Vercel bills Functions Storage as every deployment's functions, each
   * carrying what its trace holds, and this was `/api/studio/**` and
   * `/api/tweets/**` whole: 80 to 92 MB in each of 18 functions, 1449 MB a
   * deployment, polio alone past the free plan's 10 GB (220 GB on Sep 22,
   * with many deployments kept). Five routes open the browser, each through
   * `api/studio/headless.ts`; the list is theirs (`scripts/function-sizes.mjs`
   * measures it, `tests/function-sizes.mjs` holds it).
   */
  outputFileTracingIncludes: Object.fromEntries(
    BROWSER_ROUTES.map((r) => [r, [...PLAYWRIGHT_CORE_FILES, "./node_modules/@sparticuz/chromium/**", "./src/app/api/studio/fonts/files/**"]]),
  ),
  /*
   * And nothing of the repository's own that no route reads: its checks,
   * their fixtures and screenshots, the docs and their pictures, the scripts.
   * Folders of the repository only, never `node_modules`: an exclude of
   * `@swc/**`, meant for the compiler, took `@swc/helpers` with it, which
   * Next's own launcher requires (next/setup-node-env.js ← console.js), and
   * every route on fd301ea answered 500. What the runtime needs is the
   * tracer's to find; `tests/function-sizes.mjs` resolves the launcher's
   * require chain against each function's trace.
   */
  outputFileTracingExcludes: {
    "*": ["./tests/**", "./docs/**", "./scripts/**", "./.screenshots/**", "./screenshots/**", "./.git/**", "./.claude/**"],
    /*
     * ...and, of the browser taken whole, the two parts no launch ever loads:
     * `playwright-core/lib/vite/` is the trace viewer, recorder, HTML report
     * and dashboard (web pages, served only by `npx playwright show-trace`
     * and codegen) and `playwright-core/types/` is type declarations. Six
     * megabytes that no `require` reaches, in each of five functions; the
     * one exception to "never node_modules" above, because these are leaf
     * folders of a package named by hand, not a glob over the compiler.
     */
    ...Object.fromEntries(BROWSER_ROUTES.map((r) => [r, ["./node_modules/playwright-core/lib/vite/**", "./node_modules/playwright-core/types/**"]])),
  },
  // Every page in this template is client-rendered from the feature registry,
  // so there is nothing to statically optimise per-route beyond the shell.
  typedRoutes: false,
  /*
   * The root is the Builder. Always.
   *
   * It used to redirect to /site the moment anything had been published into
   * the repository — which meant that pressing Publish once turned the
   * *tool's own deployment* into the site it had just built. Everything was
   * still there: /builder served the whole editor, and the published page
   * renders with the shell hidden and its own bar `hidden`, so what a person
   * found at the front door was a site with no toolbar, no shelf, no panel
   * and nothing on the page that said where the Builder had gone. A redirect
   * that can strand the tool is worse than a vanity URL is good.
   *
   * The published site is at /site, which is what Publish writes and what the
   * book has always called it.
   */
  async redirects() {
    return [];
  },
};

export default nextConfig;

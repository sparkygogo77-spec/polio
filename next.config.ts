import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * When this build was made, so a deployment can say how old it is.
   *
   * `/api/version` answers which commit is being served; this is the other
   * half of the same question. Read at build, frozen into the bundle, and
   * public — it is a timestamp.
   */
  env: { BUILD_TIME: new Date().toISOString() },
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
    ["/api/studio/element", "/api/studio/preview-video", "/api/studio/render", "/api/studio/screenshot", "/api/studio/zip"].map((r) => [r, ["./node_modules/playwright-core/**", "./node_modules/@sparticuz/chromium/**"]]),
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

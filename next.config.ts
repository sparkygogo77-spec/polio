import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

/** Has the Builder published a site into this repository? Then the root is the site. */
function published(): boolean {
  try {
    const doc = JSON.parse(readFileSync(new URL("./site/document.json", import.meta.url), "utf8")) as { nodes?: unknown[] };
    return Array.isArray(doc.nodes) && doc.nodes.length > 0;
  } catch {
    return false;
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  // Every page in this template is client-rendered from the feature registry,
  // so there is nothing to statically optimise per-route beyond the shell.
  typedRoutes: false,
  async redirects() {
    return published() ? [{ source: "/", destination: "/site", permanent: false }] : [];
  },
};

export default nextConfig;

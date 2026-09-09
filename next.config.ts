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
  // Every page in this template is client-rendered from the feature registry,
  // so there is nothing to statically optimise per-route beyond the shell.
  typedRoutes: false,
  async redirects() {
    return published() ? [{ source: "/", destination: "/site", permanent: false }] : [];
  },
};

export default nextConfig;

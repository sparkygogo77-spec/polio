/**
 * WHAT MAKES BUILD'S FILES A SITE VERCEL RUNS (J, 2026-10-12: "Run it").
 *
 * Build wrote a Next.js codebase and nothing to run it with: no
 * package.json, no tsconfig, nothing telling Vercel what the repository
 * is. The files went up beside the site's published HTML pages, which were
 * what Vercel served, so the code was only ever read. These are the five
 * files that make it run: the packages the parts use, at the versions the
 * Builder itself renders them with (`tests/build-runs.mjs` holds the two
 * together), TypeScript set up the way the pages import ("@/" is the
 * repository root), a Next config that lets a type slip through rather than
 * stop the site going live, a vercel.json that says the repository is a
 * Next.js app (it wins over the project's own setting, which Go live made
 * as a static site), and the usual .gitignore.
 *
 * Pure, and the same document gives the same five files every time.
 */
import type { ScaffoldFile, ScaffoldInput } from "./types.ts";
import { onlyBranchDeploys } from "../send-out/deployBranch.ts";

/** The packages a built site needs, at the Builder's own versions: what renders a part on the board renders it on the site. */
export const APP_PACKAGES = {
  dependencies: { next: "^16.3.4", react: "^19.2.8", "react-dom": "^19.2.8" },
  devDependencies: { typescript: "^5.9.3", "@types/node": "^26.4.1", "@types/react": "^19.2.18", "@types/react-dom": "^19.2.7" },
  /* Only with a solid on the board: the one part that loads a library. */
  solid: { dependencies: { three: "^0.186.0" }, devDependencies: { "@types/three": "^0.185.4" } },
} as const;

/** A package name npm takes, from the site's name: lowercase, letters, digits and dashes. */
export function packageName(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return s || "site";
}

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** The files that make the codebase a Next.js app Vercel builds and serves. */
export function appFiles(input: ScaffoldInput): ScaffoldFile[] {
  const solid = input.parts.some((p) => !!p.mesh?.glb);
  const pkg = {
    name: packageName(input.name),
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start", typecheck: "tsc --noEmit" },
    dependencies: { ...APP_PACKAGES.dependencies, ...(solid ? APP_PACKAGES.solid.dependencies : {}) },
    devDependencies: { ...APP_PACKAGES.devDependencies, ...(solid ? APP_PACKAGES.solid.devDependencies : {}) },
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "react-jsx",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
    /* public/ is the site's published pages and pictures, served as they are, never compiled. */
    exclude: ["node_modules", "public"],
  };
  return [
    { path: "package.json", content: json(pkg) },
    { path: "tsconfig.json", content: json(tsconfig) },
    {
      path: "next.config.mjs",
      content: `/**
 * Written by Build. The parts are the markup the Builder rendered, copied
 * into components, and React runs every attribute a browser knows while
 * TypeScript's list of them is shorter: so the build goes on past a type
 * error rather than keep the site from going live. \`npm run typecheck\`
 * still lists them.
 *
 * @type {import("next").NextConfig}
 */
const config = {
  typescript: { ignoreBuildErrors: true },
};

export default config;
`,
    },
    /* The repository is a Next.js app: this wins over the Vercel project's own setting, which Go live made for static pages. */
    /* Only the published branch deploys on a push (`deployBranch.ts`); the publish route names the branch. */
    { path: "vercel.json", content: json({ $schema: "https://openapi.vercel.sh/vercel.json", framework: "nextjs", git: onlyBranchDeploys() }) },
    { path: ".gitignore", content: ["# What installing and building make, never committed.", "/node_modules", "/.next/", "/out/", "next-env.d.ts", "*.tsbuildinfo", ".vercel", ".env*", ".DS_Store", ""].join("\n") },
  ];
}

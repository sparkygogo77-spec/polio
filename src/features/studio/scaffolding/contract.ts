/**
 * What the build ask says the codebase is: the scaffold's own layout, file
 * by file, and the rules for what Claude adds to it. Since J chose "Run it"
 * (2026-10-12) the layout is an app Vercel builds and runs as the live
 * site, its setup written by Build (`app.ts`), and the site's own pages and
 * pictures sit in its public/ folder.
 *
 * The ask used to describe this template instead (feature modules under
 * src/features/ registered with defineFeature, primitives from "@/core/ui",
 * Tailwind classes) and gave src/features/site/Home.tsx as its example
 * file. None of that is in what Build writes, so whatever Claude added came
 * back as a second app beside the scaffold that no page imported. The
 * layout below is what `scaffold()` writes, and `tests/build-contract.mjs`
 * holds the two together: every file it can write is named here, nothing is
 * named here that it never writes, and every import in it resolves the way
 * this says.
 *
 * Pure, with no imports: the route sends it as written.
 */

/** Every file the scaffold can write and what it holds; `<Name>` and `<route>` stand for the parts that vary. */
export const SCAFFOLD_LAYOUT: readonly { path: string; holds: string }[] = [
  { path: "package.json", holds: "the packages the site runs on (next, react and react-dom, and three as well for a site with a solid) and the scripts dev, build, start and typecheck" },
  { path: "tsconfig.json", holds: "TypeScript for the app, with \"@/\" pointing at the repository root" },
  { path: "next.config.mjs", holds: "the Next config: the build goes on past a type error, which npm run typecheck still lists" },
  { path: "vercel.json", holds: "tells Vercel the repository is a Next.js app" },
  { path: ".gitignore", holds: "what installing and building make, never committed" },
  { path: "app/globals.css", holds: "the design tokens as CSS custom properties, one per palette role and format value (var(--accent), var(--text), var(--radius) and the rest), the page's own ground, and the keyframes the parts play" },
  { path: "app/layout.tsx", holds: "the root layout: the site's title and description, and the stylesheet" },
  { path: "app/page.tsx", holds: "the home page, at /" },
  { path: "app/<route>/page.tsx", holds: "every other page, at its own route, nested folders kept" },
  { path: "components/Frame.tsx", holds: "Frame, the page at the board's width and re-placed for a tablet and a phone, and Place, one part's box at each of them" },
  { path: "components/Shell.tsx", holds: "the page's behaviours (reading progress, back to top, reveal, parallax, smooth scrolling, snapping, the opening wipe, a cursor, tilt, a burst on a \"site:success\" event), only when a page has any" },
  { path: "components/parts/<Name>.tsx", holds: "one per part, exporting function <Name>() with the markup that part renders on the board, its styles inline. A written body sits in a sandboxed frame, and a cube or a solid is a small component that turns" },
  { path: "public/stand-in.js", holds: "the stand-in server, recorded reads answered with samples, only when the Build option Stand-in server is on" },
  { path: "BUILD.md", holds: "what was written from the document and what is left" },
];

/**
 * The codebase in words, for the build ask. With a scaffold it is what was
 * written; without one (it could not be written) it is the layout the
 * whole site is to be written in, which is what the Brief dialog says
 * Claude was asked for.
 */
export function buildContract(scaffolded: boolean): string {
  const lead = scaffolded
    ? "The codebase the files are for is the one Build wrote from the document, laid out like this:"
    : "THE SCAFFOLD COULD NOT BE WRITTEN THIS TIME, so no file is listed below and the looks are yours as well: write every file of the site, from the brief and the pictures, in the layout Build uses:";
  return [
    lead,
    `- A Next.js App Router site at the root of the repository, in TypeScript and React, with no src/ folder. "@/" means the repository root, as the pages use it: "@/components/Frame", "@/components/parts/<Name>".`,
    ...SCAFFOLD_LAYOUT.map((f) => `- ${f.path}: ${f.holds}.`),
    `- A page places each of its parts in a <Place> inside its <Frame>, and imports only the parts it places, so a component nothing imports is never seen. A component that needs state or handlers starts with "use client".`,
    `- To give a part a body or a behaviour, replace its components/parts/<Name>.tsx and keep the function's name, since its page imports it by that name; anything bigger goes in a new file under components/ that the part imports. Data a part reads goes in a plain TypeScript file beside it.`,
    `- Styling is inline style objects reading the custom properties in app/globals.css. No Tailwind, CSS framework or UI kit is installed, so use none of their classes.`,
    `- Imports come from "react" and "next" only, and "three" only in a solid, which package.json names when the site has one. Add no dependency and change no build setup: package.json, tsconfig.json, next.config.mjs and vercel.json are Build's, and Vercel builds and runs this app as the live site.`,
    `- The site's published HTML pages, their stylesheets and its pictures go up in public/, served at their own addresses (a picture at /assets/pictures/<file>, as the parts already point at it). Write nothing in public/ but what a part needs served as a plain file.`,
  ].join("\n");
}

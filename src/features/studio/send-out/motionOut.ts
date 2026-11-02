/**
 * THE SITE'S MOTION, IN A CLEAN EXPORT (export-motion lane, 2026-11-01).
 *
 * A clean page is written from the published page's markup, which moves by
 * two things this file carries over:
 *
 *   · its motion stylesheet (`assets/motion/<page>.css`: each part's
 *     animation, transitions, hover and press). The published page draws a
 *     part as a placing box (`#id`) round a look box (`.mo-id`); a clean page
 *     draws one element, so the sheet is said of that element;
 *   · its scripts (`assets/features/*.js`: entrances, marquees, moving
 *     pictures, a press that copies or shows a tab), run by one small
 *     component once the page has hydrated: a script that changes the page
 *     before React has read it would make React throw the page away and draw
 *     it again.
 *
 * Pure: no store, no DOM of its own.
 */
import { POLIO_HEADER } from "./tokensOut.ts";

/** A motion rule's shared class, as a clean page wears it. */
export const motionClass = (c: string): string => c.replace(/^ms(\w+)-(\w+)$/, "motion-$1-$2");
export const isMotionClass = (c: string): boolean => /^ms\w+-\w+$/.test(c);

const PSEUDOS = String.raw`((?::[\w-]+(?:\([^()]*\))?)*)`;

/** A published motion sheet said of the clean page's one element per part. */
export function cleanMotionCss(css: string): string {
  return css
    /* A part's own box, under its own placing box: now the same element. */
    .replace(new RegExp(String.raw`#([\w-]+)${PSEUDOS} \.mo-\1(?![\w-])`, "g"), "#$1$2")
    .replace(/\.mo-(?!l(?![\w-]))([\w-]+)/g, "#$1")
    /* The same, for parts moving as others move, which share one rule: `.a:hover .b`, each part wearing both. */
    .replace(new RegExp(String.raw`\.(ms\w+-\w+)${PSEUDOS} \.(ms\w+-\w+)`, "g"), ".$1$2.$3, .$1$2 .$3")
    .replace(/\.ms(\w+)-(\w+)/g, ".motion-$1-$2")
    /* The sheet moves out of assets/motion/: a picture is named from the root. */
    .replace(/url\((["']?)(?:\.\.\/)+/g, "url($1/assets/")
    .replace(/url\((["']?)(?:\.\/)?(?=(?:pictures|crates|icons)\/)/g, "url($1/assets/");
}

/** The published page's scripts, as a clean page runs them. */
export interface PageScripts {
  /** Script addresses, in the page's order. */
  scripts: string[];
  /** Which part takes which behaviour (`#site-features`). */
  parts: { part: string; feature: string; inputs?: Record<string, string> }[];
  /** The other lists the scripts read off the page (`#site-motion`), by element id. */
  data: Record<string, string>;
}

/** What a published page runs: its deferred scripts and the lists they read. Switching pages in place is the published site's own (a clean page has routes). */
export function pageScripts(doc: Document): PageScripts {
  const out: PageScripts = { scripts: [], parts: [], data: {} };
  for (const s of Array.from(doc.querySelectorAll("body script"))) {
    const src = s.getAttribute("src");
    if (src) { out.scripts.push(`/${src.replace(/^(\.\.\/|\.\/)*/, "")}`); continue; }
    if (s.getAttribute("type") !== "application/json" || !s.id || s.id === "in-place") continue;
    if (s.id === "site-features") { try { out.parts = JSON.parse(s.textContent ?? "[]"); } catch { /* none */ } }
    else out.data[s.id] = s.textContent ?? "";
  }
  return out;
}

export const BEHAVIOURS_FILE = "components/Behaviours.tsx";

/** The component that runs a page's scripts. */
export function behavioursTsx(): string {
  return `/* ${POLIO_HEADER} */
"use client";
import { useEffect } from "react";

type Behaviour = { part: string; feature: string; inputs?: Record<string, string> };
export type PageBehaviours = { scripts: string[]; parts: Behaviour[]; data: Record<string, string> };
type Define = (el: Element, inputs: Record<string, string>, api: unknown) => void;
type Features = { define: (id: string, fn: Define) => void; api: unknown };

function load(src: string) {
  return new Promise<void>((done) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = s.onerror = () => done();
    document.body.appendChild(s);
  });
}

/**
 * Runs the site's behaviours (entrances, marquees, a press that copies or
 * shows a tab) on the parts named in \`parts\`, by id. It runs after React has
 * hydrated, so what the scripts change stays changed. To replace one, take
 * its line out of the page's behaviours.ts and write it in React.
 */
export function Behaviours({ scripts, parts, data }: PageBehaviours) {
  useEffect(() => {
    const w = window as unknown as { siteFeatures?: Features; __behaviours?: boolean };
    if (w.__behaviours) return;
    w.__behaviours = true;
    for (const [id, text] of Object.entries(data)) {
      const s = document.createElement("script");
      s.type = "application/json";
      s.id = id;
      s.textContent = text;
      document.body.appendChild(s);
    }
    const defined: Record<string, Define> = {};
    (async () => {
      for (const src of scripts) {
        await load(src);
        const F = w.siteFeatures;
        if (F && src.endsWith("/runtime.js")) {
          const define = F.define;
          F.define = (id, fn) => { defined[id] = fn; define(id, fn); };
        }
      }
      for (const b of parts) {
        const el = document.getElementById(b.part);
        const fn = defined[b.feature];
        if (el && fn) { try { fn(el, b.inputs ?? {}, w.siteFeatures?.api); } catch { /* the part keeps its look */ } }
      }
    })();
  }, [scripts, parts, data]);
  return null;
}
`;
}

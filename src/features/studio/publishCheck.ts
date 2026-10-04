/**
 * CHECK BEFORE PUBLISH: one short list of what is wrong with the board.
 *
 * Pressed Update live site, the person sees this list first, and can fix a
 * line, see where it is, or publish anyway. Each kind of problem is read by
 * the check that already owns it, so the list never disagrees with the rest
 * of the Builder:
 *
 *   links      a part's link that leaves the site, against the site's own
 *              link rules (`parts/offsite.ts`, Format > Links off the site:
 *              pump.fun allowed, DEX Screener allowed unless it is one
 *              token's page, X not allowed). A share link is neither: it may
 *              share this site or send people to another, so it is flagged
 *              for the person to choose.
 *   pictures   a picture the page shows whose file this browser no longer
 *              holds (`siteHead.namedPictures` against the picture store).
 *   words      words hard to read on what is behind them (`siteColours`
 *              `wordsContrast`, the Look panel's Readable words).
 *   fit        a part that runs off the page at phone or tablet width, read
 *              off the same layout the preview draws (`live/layout.ts`, passed
 *              in). Lane D is building the phone and tablet layouts; when its
 *              own check lands this reads it instead.
 *   nowhere    a button or link that does nothing yet (`library/badge.ts`
 *              `decisions`, the orange ! on the board).
 *
 * Pure: the store, the picture store and the layout are handed in, so
 * `tests/publish-check.mjs` reads it directly.
 */
import { DEFAULT_OFFSITE, isOffsite, linkAllowed, offsiteRules } from "./parts/offsite";
import { HARD_TO_READ, wordsContrast } from "./siteColours";
import { decisions } from "./library/badge";
import { partName, type Named } from "./partNames";
import type { Palette } from "./look";

export type ProblemKind = "link" | "share" | "picture" | "words" | "fit" | "nowhere";

export interface Problem {
  /** Stable across runs, so a line the person dealt with is not shown again until it changes. */
  key: string;
  kind: ProblemKind;
  /** The part it is about, and its page. */
  id: string;
  pageId: string;
  /** The line itself, in plain words, naming the part. */
  says: string;
  /** What the Fix button does, in a few words; absent when the only thing to do is look (Show). */
  fix?: string;
  /** For a share link: the second choice beside Fix. */
  keep?: string;
}

/** What the check reads. Every part is the document's own record; nothing here is drawn. */
export interface CheckInput {
  nodes: readonly (Named & { pageId: string; featureId?: string; link?: { kind: string; target: string } | null; picture?: { id: string } | null; media?: { file?: { id: string } } | null; [k: string]: unknown })[];
  pages: readonly { id: string; name?: string }[];
  format?: Record<string, unknown>;
  palette?: Partial<Palette>;
  /** Picture ids this browser holds, or null when they could not be read (the check is then skipped, not guessed). */
  held: Set<string> | null;
  /** Where each part lands at a width, as the preview lays it out; absent skips the fit check. */
  layout?: (pageId: string, device: "phone" | "tablet") => { width: number; placed: { id: string; x: number; w: number }[] };
  featureName?: (id: string) => string | undefined;
}

/*
 * A SHARE LINK: an address whose whole job is to post something somewhere.
 * Whether it shares this site (fine) or is a door to another one (a link
 * like any other) is the person's to say.
 */
const SHARE = /^(https?:)?\/\/(www\.)?((x|twitter)\.com\/(intent\/(tweet|post)|share)|facebook\.com\/sharer|linkedin\.com\/(sharing|shareArticle)|t\.me\/share|telegram\.me\/share|reddit\.com\/submit|wa\.me\/\?|api\.whatsapp\.com\/send|pinterest\.com\/pin\/create)/i;
export const isShareLink = (href: string) => SHARE.test(href.trim());

/** A short name for where a link goes: its host, and the rest of the address cut short. */
function where(href: string): string {
  try {
    const u = new URL(href.startsWith("//") ? `https:${href}` : href);
    const rest = `${u.pathname}${u.search}`.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${rest.length > 28 ? `${rest.slice(0, 27)}…` : rest}`;
  } catch {
    return href.slice(0, 40);
  }
}

/** Why the rules turn this address down, said the way a person would. */
function whyNot(href: string): string {
  const w = where(href);
  if (/^(https?:)?\/\/(www\.)?(x|twitter)\.com\//i.test(href)) return `links to X (${w}); links to X profiles are not allowed`;
  if (/dexscreener\.com\/[^/]+\/[^/]+/i.test(href)) return `links to one contract address on DEX Screener (${w}); DEX Screener is allowed, but not a link to one contract address`;
  return `leaves the site for ${w}, which the link rules do not allow`;
}

export function checkBoard(input: CheckInput): Problem[] {
  const all = input.nodes as readonly Named[];
  /* Quoted, so a part named "X" or "Buy" reads as a name, not as a word of the sentence. */
  const name = (n: Named) => { const t = partName(n, all, input.featureName).trim(); return t ? `“${t.replace(/[“”]/g, "")}”` : "A part"; };
  const pageName = (id: string) => input.pages.find((p) => p.id === id)?.name ?? "a page";
  const onPage = (pageId: string) => (input.pages.length > 1 ? ` on ${pageName(pageId)}` : "");
  const rules = offsiteRules(String(input.format?.["links.offsite"] ?? DEFAULT_OFFSITE));
  const out: Problem[] = [];

  /* Links. */
  for (const n of input.nodes) {
    const l = n.link;
    if (!l || l.kind !== "url" || !l.target || !isOffsite(l.target)) continue;
    if (isShareLink(l.target)) {
      if (n.shareChecked === l.target) continue;
      out.push({ key: `share:${n.id}:${l.target}`, kind: "share", id: n.id, pageId: n.pageId, says: `${name(n)}${onPage(n.pageId)} is a share link (${where(l.target)}): keep it if it shares this site, or take the link off.`, fix: "Take the link off", keep: "Keep it" });
      continue;
    }
    if (!linkAllowed(l.target, rules)) {
      out.push({ key: `link:${n.id}:${l.target}`, kind: "link", id: n.id, pageId: n.pageId, says: `${name(n)}${onPage(n.pageId)} ${whyNot(l.target)}. Published, it does nothing.`, fix: "Take the link off" });
    }
  }

  /* Pictures this browser no longer holds. */
  if (input.held) {
    for (const n of input.nodes) {
      for (const p of [n.picture, n.media?.file]) {
        if (p?.id && !input.held.has(p.id)) out.push({ key: `picture:${n.id}:${p.id}`, kind: "picture", id: n.id, pageId: n.pageId, says: `${name(n)}${onPage(n.pageId)} shows a picture this browser no longer has, so it would go up missing.`, fix: "Choose a picture" });
      }
    }
  }

  /* Words hard to read, page by page (a part is read against what is under it on its own page). */
  for (const page of input.pages) {
    const here = input.nodes.filter((n) => n.pageId === page.id);
    let rows: { id: string; ratio: number }[] = [];
    try { rows = wordsContrast(here as never, input.palette ?? {}); } catch { rows = []; }
    for (const r of rows.filter((x) => x.ratio < HARD_TO_READ)) {
      const n = here.find((x) => x.id === r.id);
      if (n) out.push({ key: `words:${n.id}`, kind: "words", id: n.id, pageId: n.pageId, says: `${name(n)}${onPage(n.pageId)} is hard to read: ${r.ratio} to 1 against what is behind it (4.5 to 1 reads at any size).`, fix: "Make it readable" });
    }
  }

  /* Parts that run off the page at phone or tablet width. */
  if (input.layout) {
    for (const page of input.pages) {
      for (const device of ["phone", "tablet"] as const) {
        let laid: ReturnType<NonNullable<CheckInput["layout"]>>;
        try { laid = input.layout(page.id, device); } catch { continue; }
        for (const p of laid.placed) {
          const over = Math.round(Math.max(p.x + p.w - laid.width, -p.x));
          if (over <= 2) continue;
          const n = input.nodes.find((x) => x.id === p.id);
          if (n) out.push({ key: `fit:${device}:${n.id}`, kind: "fit", id: n.id, pageId: n.pageId, says: `${name(n)}${onPage(n.pageId)} runs ${over} pixels off the page at ${device} width (${laid.width} wide).` });
        }
      }
    }
  }

  /* Buttons and links that do nothing yet. */
  for (const d of decisions(input.nodes as never).filter((x) => x.why === "nowhere")) {
    const n = input.nodes.find((x) => x.id === d.id);
    /* A part its own code wires up (a site brought in from a code repository: the scripts that find it by its hook) does something; only the board cannot see what. */
    if (n && ((n as { source?: { code?: { refs?: unknown[] } } }).source?.code?.refs?.length ?? 0) > 0) continue;
    if (n) out.push({ key: `nowhere:${n.id}`, kind: "nowhere", id: n.id, pageId: n.pageId, says: `${name(n)}${onPage(n.pageId)} is a button or link that does nothing yet.`, fix: "Leave it doing nothing" });
  }
  return out;
}

/** The kinds, in the order the list shows them, with a heading each. */
export const KIND_ORDER: { kind: ProblemKind; heading: string }[] = [
  { kind: "link", heading: "Links that leave the site" },
  { kind: "share", heading: "Share links to choose about" },
  { kind: "picture", heading: "Missing pictures" },
  { kind: "words", heading: "Words that are hard to read" },
  { kind: "fit", heading: "Parts that run off the page on a phone or tablet" },
  { kind: "nowhere", heading: "Buttons that do nothing" },
];

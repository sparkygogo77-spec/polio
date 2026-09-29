/**
 * WHERE A LINK MAY GO OFF THE SITE: the owner's allow-list, one per site.
 *
 * A link to a page of the site itself is always kept. A link anywhere else
 * is kept only when this list allows it; otherwise the control stays, with
 * its words and look, does nothing, and says where it went in
 * `data-world-offsite` for a backend. The list is a site setting
 * (`links.offsite`, Format › Pages & Navigation, advanced), written as rules
 * separated by commas, the first that matches deciding:
 *
 *   pump.fun               allow the host (and its subdomains), any path
 *   !dexscreener.com/*\/*  deny: `*` is one path segment, so this is a
 *                          chain and an address (a token's own page)
 *   dexscreener.com        allow the rest of the host
 *   !x.com                 deny the host
 *   share:own              a Share that shares the site's own page runs
 *                          (the machine's share sheet, else the link copied);
 *                          one that only goes to another site's intent is a
 *                          link like any other, and this list decides it
 *
 * Anything no rule names is not allowed. Pure: no store, no DOM, so the
 * parts, the export and the tests read the same answer.
 */
export const DEFAULT_OFFSITE = "pump.fun, !dexscreener.com/*/*, dexscreener.com, !x.com, !twitter.com, share:own";

export interface OffsiteRule { allow: boolean; host: string; path: string[] }
export interface OffsiteRules { rules: OffsiteRule[]; shareOwn: boolean }

export function offsiteRules(text: string | null | undefined): OffsiteRules {
  const out: OffsiteRules = { rules: [], shareOwn: false };
  for (const raw of String(text ?? DEFAULT_OFFSITE).split(/[,\n;]+/)) {
    const r = raw.trim().toLowerCase();
    if (!r) continue;
    if (r === "share:own") { out.shareOwn = true; continue; }
    const allow = !r.startsWith("!");
    const body = r.replace(/^!/, "").replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
    const [host, ...path] = body.split("/");
    if (host) out.rules.push({ allow, host, path: path.filter(Boolean) });
  }
  return out;
}

/** An address off the site (a scheme, or `//`), as against a path of the site itself. */
export function isOffsite(href: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href.trim());
}

/** May a link to `href` stay a link? A path of the site always may; an address elsewhere as the rules say. */
export function linkAllowed(href: string | null | undefined, rules: OffsiteRules): boolean {
  const h = String(href ?? "").trim();
  if (!h) return false;
  if (!isOffsite(h)) return !/^\s*javascript:/i.test(h);
  let u: URL;
  try { u = new URL(h.startsWith("//") ? `https:${h}` : h); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segs = u.pathname.split("/").filter(Boolean);
  for (const r of rules.rules) {
    if (host !== r.host && !host.endsWith(`.${r.host}`)) continue;
    if (r.path.length > segs.length) continue;
    if (!r.path.every((p, i) => p === "*" || p === segs[i]!.toLowerCase())) continue;
    return r.allow;
  }
  return false;
}

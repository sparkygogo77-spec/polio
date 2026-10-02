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

/**
 * The answer `linkAllowed` gives, in plain words, with the rule that gave
 * it: so a person who typed an address is told why it can or cannot be a
 * link, not only that it cannot.
 */
export function explainLink(href: string | null | undefined, rules: OffsiteRules): { allowed: boolean; why: string } {
  const h = String(href ?? "").trim();
  const where = "The list is under Format, Pages and navigation.";
  if (!h) return { allowed: false, why: "No address yet." };
  if (!isOffsite(h)) return linkAllowed(h, rules) ? { allowed: true, why: "A page of this site: always allowed." } : { allowed: false, why: "That is not an address a link can go to." };
  let u: URL;
  try { u = new URL(h.startsWith("//") ? `https:${h}` : h); } catch { return { allowed: false, why: "That is not a web address. A web address starts with https://." }; }
  if (!/^https?:$/.test(u.protocol)) return { allowed: false, why: "Only web addresses (starting with https://) can be links off the site." };
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segs = u.pathname.split("/").filter(Boolean);
  for (const r of rules.rules) {
    if (host !== r.host && !host.endsWith(`.${r.host}`)) continue;
    if (r.path.length > segs.length) continue;
    if (!r.path.every((p, i) => p === "*" || p === segs[i]!.toLowerCase())) continue;
    if (r.allow) return { allowed: true, why: `Allowed: ${r.host} is on the site's list of places links may go.` };
    if (r.path.length === 2 && r.path.every((p) => p === "*")) {
      return { allowed: false, why: `Not allowed: this is the page of one specific contract address on ${r.host} (a chain, then an address). A link to ${r.host} itself is allowed. ${where}` };
    }
    if (r.path.length) return { allowed: false, why: `Not allowed: the site's list refuses addresses on ${r.host} under /${r.path.join("/")}. ${where}` };
    return { allowed: false, why: `Not allowed: the site's list refuses links to ${r.host}${segs.length ? `, including profiles and posts there` : ""}. ${where}` };
  }
  return { allowed: false, why: `Not allowed: ${host} is not on the site's list of places links may go, so the button would stay but go nowhere. ${where}` };
}

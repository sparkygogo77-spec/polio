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
 *   !re:<pattern>          deny any address the pattern matches, wherever it
 *                          sits in the list; the rest of its line is the
 *                          pattern. A site brought in from a builder-ready
 *                          repository gets its `builder.json` `links.block`
 *                          this way, one per line (`kitLinksToOffsite`).
 *
 * Anything no rule names is not allowed. Pure: no store, no DOM, so the
 * parts, the export and the tests read the same answer.
 */
export const DEFAULT_OFFSITE = "pump.fun, !dexscreener.com/*/*, dexscreener.com, !x.com, !twitter.com, share:own";

export interface OffsiteRule { allow: boolean; host: string; path: string[] }
export interface OffsiteBlock { pattern: string; re: RegExp; why?: string }
export interface OffsiteRules { rules: OffsiteRule[]; shareOwn: boolean; block?: OffsiteBlock[] }

export function offsiteRules(text: string | null | undefined): OffsiteRules {
  const out: OffsiteRules = { rules: [], shareOwn: false, block: [] };
  /* A pattern may hold commas: `!re:` takes the rest of its line, before the list is split. */
  const rest = String(text ?? DEFAULT_OFFSITE).replace(/!re:([^\n]*)/gi, (_all, pattern: string) => {
    const [pat, why] = pattern.split(/\s+#\s+/);
    try { out.block!.push({ pattern: pat!.trim(), re: new RegExp(pat!.trim(), "i"), ...(why ? { why: why.trim() } : {}) }); } catch { /* not a pattern: nothing to deny by */ }
    return "\n";
  });
  for (const raw of rest.split(/[,\n;]+/)) {
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
  if (rules.block?.some((b) => b.re.test(u.href) || b.re.test(h))) return false;
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
  const blocked = rules.block?.find((b) => b.re.test(u.href) || b.re.test(h));
  if (blocked) return { allowed: false, why: `Not allowed: ${blocked.why ? `${blocked.why} (the site's rule ${blocked.pattern})` : `the site's rule ${blocked.pattern} refuses it`}. ${where}` };
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

/** A builder-ready repository's link rules (`builder.json` `links`, see kit/BUILDER-CONTRACT.md section 6). */
export interface KitLinks { allowHosts?: string[]; block?: { pattern: string; why?: string }[] }

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The repository's rules as this list: every `block` pattern a `!re:` line
 * (they deny wherever they sit, as `kit-check` reads them), then each
 * allowed host. `share:own` is kept, since it is about the site's own page.
 */
export function kitLinksToOffsite(links: KitLinks | null | undefined): string {
  const lines = [
    ...(links?.block ?? []).map((b) => `!re:${b.pattern}${b.why ? ` # ${b.why}` : ""}`),
    ...(links?.allowHosts ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean),
    "share:own",
  ];
  return lines.join("\n");
}

/**
 * This list as a repository's `builder.json` `links`, for Export for code:
 * allowed hosts, and every refusal as a pattern `kit-check` holds the
 * pages to. A refusal written by host and path becomes the pattern that
 * says the same (`*` one path segment).
 */
export function offsiteToKitLinks(text: string | null | undefined): Required<KitLinks> {
  const r = offsiteRules(text);
  const allowHosts = [...new Set(r.rules.filter((x) => x.allow).map((x) => x.host))];
  const block = [
    ...(r.block ?? []).map((b) => ({ pattern: b.pattern, ...(b.why ? { why: b.why } : {}) })),
    ...r.rules.filter((x) => !x.allow).map((x) => ({
      pattern: `^https?://([^/?#]*\\.)?${escRe(x.host)}${x.path.length ? x.path.map((p) => `/${p === "*" ? "[^/?#]+" : escRe(p)}`).join("") : ""}(?=[/?#:]|$)`,
      why: x.path.length === 2 && x.path.every((p) => p === "*") ? `no links to one specific address on ${x.host}` : x.path.length ? `no links under ${x.host}/${x.path.join("/")}` : `no links to ${x.host}`,
    })),
  ];
  return { allowHosts, block };
}

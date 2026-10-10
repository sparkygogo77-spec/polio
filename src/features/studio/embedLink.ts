/**
 * WHAT CAN BE SHOWN INSIDE A PART, AND THE WORDS FOR WHEN IT CANNOT.
 *
 * J (2026-10-10): "are there limitations to what can be considered an
 * embed? a default one would be a dexscreener chart but can i embed
 * anything". Any web page can be put in a frame, but the page decides
 * whether it agrees to be shown inside another site: many say no (X, Google,
 * GitHub, pump.fun) with a header, and the frame stays blank. Players and
 * charts made for it (DexScreener with embed=1, YouTube's /embed/ player,
 * maps, Spotify, Vimeo) say yes. And a site from code can have rules of its
 * own: PonsStars allows only the DexScreener chart (`builder.json`
 * `rules.embeds`, kit rule 8).
 *
 * This file reads what J pasted (a link, or a whole `<iframe>` snippet),
 * turns the usual page links into the player link that can be framed, and
 * says up front what is known to refuse. The live check of a page's own
 * answer is `/api/studio/embed-check`, which reads its headers with
 * `frameRefusal` below. Pure: `tests/embed-box.mjs` holds it.
 */

/** A DexScreener chart, the default embed: SOL against USDC (Raydium), dark, chart only. */
export const DEFAULT_EMBED = "https://dexscreener.com/solana/58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2?embed=1&theme=dark&trades=0&info=0";

export type EmbedRead = { ok: true; src: string; host: string; note?: string } | { ok: false; says: string };

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
const on = (host: string, site: string) => host === site || host.endsWith(`.${site}`);

/** The `src` of a pasted `<iframe …>` snippet, or the text itself. */
function srcOf(text: string): string {
  const m = /<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(text);
  return (m ? m[1] ?? m[2] ?? m[3] ?? "" : text).replace(/&amp;/g, "&").trim();
}

/** A page link turned into the link of its player, which agrees to be framed; null when it already is one. */
function playerOf(u: URL): { src: string; note: string } | null {
  const host = hostOf(u);
  if (on(host, "youtube.com") || host === "youtu.be") {
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v") ?? /^\/(?:shorts|live)\/([^/?]+)/.exec(u.pathname)?.[1];
    if (id && !u.pathname.startsWith("/embed/")) return { src: `https://www.youtube.com/embed/${id}`, note: "Changed to YouTube's player link, the one that can be shown inside a page." };
    return null;
  }
  if (host === "vimeo.com") {
    const id = /^\/(\d+)/.exec(u.pathname)?.[1];
    return id ? { src: `https://player.vimeo.com/video/${id}`, note: "Changed to Vimeo's player link, the one that can be shown inside a page." } : null;
  }
  if (host === "open.spotify.com" && !u.pathname.startsWith("/embed/")) {
    return { src: `https://open.spotify.com/embed${u.pathname}`, note: "Changed to Spotify's player link, the one that can be shown inside a page." };
  }
  if (on(host, "dexscreener.com") && u.searchParams.get("embed") !== "1") {
    const q = new URLSearchParams(u.search);
    q.set("embed", "1");
    if (!q.has("theme")) q.set("theme", "dark");
    return { src: `https://dexscreener.com${u.pathname}?${q}`, note: "Changed to DexScreener's chart link (embed=1), the one that can be shown inside a page." };
  }
  return null;
}

/** Read what was pasted in the embed box: a link or an `<iframe>` snippet. */
export function readEmbed(raw: string): EmbedRead {
  const text = srcOf(raw ?? "");
  if (!text) return { ok: false, says: "Paste a link, or the embed code a site gives you." };
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`); } catch { return { ok: false, says: "That is not a web address. It wants to start with https://" }; }
  if (u.protocol === "http:") return { ok: false, says: "That page is not https, and an https site cannot show it inside. Use its https link." };
  if (u.protocol !== "https:") return { ok: false, says: "Only web pages (https://) can be shown inside a part." };
  if (!u.hostname.includes(".")) return { ok: false, says: "That is not a web address. It wants to start with https://" };
  const p = playerOf(u);
  const src = p?.src ?? u.href;
  return { ok: true, src, host: hostOf(new URL(src)), ...(p ? { note: p.note } : {}) };
}

/** Sites known to refuse being shown inside another page, except on the paths they make for it. */
const REFUSERS: { site: string; name: string; except?: RegExp }[] = [
  { site: "x.com", name: "X" },
  { site: "twitter.com", name: "X" },
  { site: "facebook.com", name: "Facebook", except: /^\/plugins\// },
  { site: "instagram.com", name: "Instagram", except: /\/embed\/?$/ },
  { site: "linkedin.com", name: "LinkedIn", except: /^\/embed\// },
  { site: "tiktok.com", name: "TikTok", except: /^\/embed\// },
  { site: "reddit.com", name: "Reddit" },
  { site: "discord.com", name: "Discord", except: /^\/widget/ },
  { site: "github.com", name: "GitHub" },
  { site: "google.com", name: "Google", except: /^\/maps\/embed/ },
  { site: "amazon.com", name: "Amazon" },
  { site: "pump.fun", name: "pump.fun" },
  { site: "axiom.trade", name: "Axiom" },
  { site: "photon-sol.tinyastro.io", name: "Photon" },
  { site: "bullx.io", name: "BullX" },
  { site: "padre.gg", name: "Padre" },
  { site: "t.me", name: "Telegram" },
];

/** What to say when the site is known to refuse being framed, before asking it. */
export function knownRefusal(src: string): string | null {
  let u: URL;
  try { u = new URL(src); } catch { return null; }
  const host = hostOf(u);
  const r = REFUSERS.find((x) => on(host, x.site) && !(x.except && x.except.test(u.pathname)));
  return r ? refusalSays(r.name) : null;
}

export const refusalSays = (name: string) => `${name} does not let other sites show its pages inside them, so this box would stay blank. Use a link to it instead, or its own embed code if it offers one.`;

/** A page's own answer, from its headers: does it refuse to be shown inside another site? */
export function frameRefusal(h: { xfo?: string | null; csp?: string | null }): boolean {
  const xfo = (h.xfo ?? "").trim().toLowerCase();
  if (xfo === "deny" || xfo === "sameorigin") return true;
  const fa = /(?:^|;)\s*frame-ancestors\s+([^;]*)/i.exec(h.csp ?? "")?.[1]?.trim().toLowerCase();
  if (fa === undefined) return false;
  const list = fa.split(/\s+/).filter(Boolean);
  if (list.includes("*")) return false;
  if (list.some((s) => s === "https:" || s === "https://*")) return false;
  return true;
}

/** An embed the site's code allows (`builder.json` `rules.embeds`, kit rule 8). */
export interface EmbedRule { name?: string; hosts: string[]; hooks?: string[] }

/** What to say when the site's own rules do not allow this embed; null when they do, or have none. */
export function siteRefusal(src: string, rules: readonly EmbedRule[] | null | undefined, site = "This site"): string | null {
  if (!rules?.length) return null;
  let host: string;
  try { host = hostOf(new URL(src)); } catch { return null; }
  if (rules.some((r) => r.hosts.some((h) => on(host, h.toLowerCase().replace(/^www\./, ""))))) return null;
  const names = [...new Set(rules.map((r) => r.name ?? r.hosts[0]))].join(", ");
  return `${site}'s rules allow only ${names} embeds, so a code chat will not put this one on the published page.`;
}

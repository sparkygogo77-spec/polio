#!/usr/bin/env node
/**
 * A LINK TO THE SITE IS PREVIEWED AS THE ORIGINAL IS.
 *
 * The owner pasted two links in Discord. gotchi.gg drew a large card: its
 * title, its line, its banner, its own icon. The export of it drew
 * "gotchi" and a thumbnail of a park: no description, the logo cut from a
 * picture on the page as the share picture and the favicon, and
 * `twitter:card` "summary" always. The capture now records the head
 * (`doc.head`, and on each page only what differs, `page.head`), and this
 * holds the importer and the export to it:
 *
 *   · the importer fetches every picture the heads name (the share picture
 *     and the icons), not only the parts' own;
 *   · taking the document in keeps the site's head on the brief and each
 *     page's on the page, and a description nobody typed is the captured one;
 *   · each page's head: its own title and description, og:image, og:url and
 *     twitter:image as full addresses on the address the site is published
 *     at (a stand-in here, never the original's), summary_large_image for a
 *     1200x630 banner, the captured favicon and apple-touch-icon, the theme
 *     colour, and the captured meta that is not derived and does not point
 *     back at the original (twitter:site passes, og:see_also does not);
 *   · the files the export writes include the icons and the share pictures;
 *   · a document with no head exports exactly as before.
 *
 * Pure: the importer's own `takeDoc` and the export's own `pageHead`, on a
 * fixture document (tests/fixtures/link-preview/site/document.json).
 *
 *   node --experimental-strip-types tests/link-preview.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
};

const { pageHead, namedPictures, publishedHead } = await import("../src/features/studio/siteHead.ts");
const { takeDoc } = await import("../src/features/studio/docTake.ts");
const { homeFor } = await import("../src/features/studio/homePage.ts");

const doc = JSON.parse(readFileSync(new URL("./fixtures/link-preview/site/document.json", import.meta.url), "utf8"));
const LIVE = "https://standin-published.example";
const pathOf = (id) => `assets/pictures/${id}.png`;

/* The importer: every picture the document names, the heads' included. */
const named = new Set(namedPictures(doc).map((p) => p.path));
for (const id of ["pic_banner01", "pic_hatch001", "pic_favicon1", "pic_touch001", "pic_park0001"]) {
  check(`the importer fetches ${id}`, named.has(pathOf(id)), [...named].join(", "));
}

/* Taken in. */
const prev = { pages: [{ id: "p0" }], nodes: [], groups: [], shapes: [], spaces: [], brief: { name: "", gimmick: "", master: "" }, look: {}, motion: [], frameWidth: 1440 };
const defaults = { format: () => ({}), look: () => ({}) };
const s = takeDoc(prev, doc, defaults);
check("the site's head is kept on the brief", s.brief.head?.image?.picture?.id === "pic_banner01" && s.brief.head?.icons?.length === 2, JSON.stringify(s.brief.head)?.slice(0, 120));
check("each page keeps its own head", s.pages[1].head?.title === "hatch · gotchi" && !s.pages[0].head);
check("the description nobody typed is the captured one", s.brief.description === doc.head.description, s.brief.description);
const typed = takeDoc(prev, { ...doc, brief: { ...doc.brief, description: "his own words" } }, defaults);
check("a typed description is never clobbered", typed.brief.description === "his own words", typed.brief.description);
const exported = new Set(namedPictures(s).map((p) => p.path));
check("the export writes the icons and the share pictures", ["pic_banner01", "pic_hatch001", "pic_favicon1", "pic_touch001"].every((id) => exported.has(pathOf(id))), [...exported].join(", "));

/* Each page's head, as the export writes it. */
const home = homeFor(s.pages);
const logo = s.nodes[0].picture;
const headFor = (page, live = LIVE) => pageHead({
  title: page.id === home.id ? "gotchi" : `${page.name} · gotchi`,
  name: "gotchi",
  description: s.brief.description,
  icon: logo,
  icons: null,
  up: page.id === home.id ? "" : "../",
  address: page.id === home.id ? "/" : "/hatch",
  live,
  site: s.brief.head,
  page: page.head,
});
const meta = (html, key) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${key.replace(/[:.]/g, "\\$&")}" content="([^"]*)">`));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"') : null;
};
const links = (html) => [...html.matchAll(/<link ([^>]*)>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));

const h0 = headFor(s.pages[0]);
const h1 = headFor(s.pages[1]);
console.log("\n--- home page head ---\n" + h0 + "\n----------------------\n");
check("home: <title> is the captured title", /<title>gotchi<\/title>/.test(h0));
check("home: the description", meta(h0, "description") === doc.head.description && meta(h0, "og:description") === doc.head.description && meta(h0, "twitter:description") === doc.head.description);
check("home: og:image is the banner, on the published address", meta(h0, "og:image") === `${LIVE}/${pathOf("pic_banner01")}`, meta(h0, "og:image"));
check("home: og:image:width/height 1200x630, with its alt", meta(h0, "og:image:width") === "1200" && meta(h0, "og:image:height") === "630" && meta(h0, "og:image:alt") === "gotchi banner");
check("home: twitter:image the same", meta(h0, "twitter:image") === `${LIVE}/${pathOf("pic_banner01")}`);
check("home: og:url is the published address, never the original", meta(h0, "og:url") === `${LIVE}/`, meta(h0, "og:url"));
check("home: twitter:card summary_large_image", meta(h0, "twitter:card") === "summary_large_image", meta(h0, "twitter:card"));
check("home: og:site_name and og:title", meta(h0, "og:site_name") === "gotchi" && meta(h0, "og:title") === "gotchi" && meta(h0, "twitter:title") === "gotchi");
check("home: theme-color", meta(h0, "theme-color") === "#101820");
const ic = links(h0);
check("home: the captured favicon", ic.some((l) => l.rel === "icon" && l.href === pathOf("pic_favicon1") && l.sizes === "32x32" && l.type === "image/png"), JSON.stringify(ic));
check("home: the apple-touch-icon", ic.some((l) => l.rel === "apple-touch-icon" && l.href === pathOf("pic_touch001") && l.sizes === "180x180"));
check("home: the park is not the icon or the share picture any more", !h0.includes("pic_park0001"));
check("home: captured meta not derived passes (twitter:site, og:locale)", meta(h0, "twitter:site") === "@gotchi_pets" && meta(h0, "og:locale") === "en_US");
check("home: nothing points back at the original", !/gotchi\.gg/.test(h0), h0.match(/.*gotchi\.gg.*/)?.[0]);
check("home: each derived line once", (h0.match(/og:image"/g) ?? []).length === 1 && (h0.match(/twitter:card/g) ?? []).length === 1 && (h0.match(/og:url/g) ?? []).length === 1);

check("hatch: its own title", /<title>hatch · gotchi<\/title>/.test(h1) && meta(h1, "og:title") === "hatch · gotchi");
check("hatch: its own description", meta(h1, "description") === doc.pages[1].head.description);
check("hatch: its own share picture, on the published address", meta(h1, "og:image") === `${LIVE}/${pathOf("pic_hatch001")}`, meta(h1, "og:image"));
check("hatch: og:url is its published address", meta(h1, "og:url") === `${LIVE}/hatch`, meta(h1, "og:url"));
check("hatch: the site's favicon, from one folder down", links(h1).some((l) => l.rel === "icon" && l.href === `../${pathOf("pic_favicon1")}`));
check("hatch: large card too", meta(h1, "twitter:card") === "summary_large_image");

/* Not live yet: the addresses stay relative, and og:url is left out. */
const h2 = headFor(s.pages[0], null);
check("not live yet: og:image relative, no og:url", meta(h2, "og:image") === pathOf("pic_banner01") && meta(h2, "og:url") === null);

/* No captured card: a wide picture is a large card, a square one is not. */
const auto = (w, h) => meta(pageHead({ title: "x", name: "x", description: "", icon: null, icons: null, up: "", address: "/", live: LIVE, site: { image: { picture: { ...logo, w, h } } }, page: undefined }), "twitter:card");
check("no captured card: 1200x630 is large, 400x400 is small", auto(1200, 630) === "summary_large_image" && auto(400, 400) === "summary", `${auto(1200, 630)} / ${auto(400, 400)}`);

/* The document published beside the pages keeps the head, without where it was captured from. */
const kept = JSON.stringify([publishedHead(s.brief.head), publishedHead(s.pages[1].head, [s.brief.head.url])]);
check("the published document's heads name no original address", !/gotchi\.gg/.test(kept) && kept.includes("pic_banner01") && kept.includes("@gotchi_pets"), kept.match(/.{40}gotchi\.gg.{20}/)?.[0]);

/* A document with no head: exactly as before. */
const old = { ...doc, head: undefined, pages: doc.pages.map(({ head, ...p }) => p) };
const t = takeDoc(prev, old, defaults);
check("no head: nothing added to the brief", !("head" in t.brief) && t.brief.description === undefined);
check("no head: the importer fetches the parts' pictures only", namedPictures(old).map((p) => p.id).join() === "pic_park0001");
const before = pageHead({ title: "Hatch · gotchi", name: "gotchi", description: "a line", icon: logo, icons: null, up: "../", address: "/hatch", live: LIVE, site: t.brief.head, page: t.pages[1].head });
const AS_BEFORE = `<title>Hatch · gotchi</title>
<meta name="description" content="a line">
<link rel="icon" href="../assets/pictures/pic_park0001.png" type="image/png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="gotchi">
<meta property="og:title" content="Hatch · gotchi">
<meta property="og:description" content="a line">
<meta property="og:url" content="https://standin-published.example/hatch">
<meta property="og:image" content="https://standin-published.example/assets/pictures/pic_park0001.png">
<meta property="og:image:width" content="400">
<meta property="og:image:height" content="300">
<meta name="twitter:card" content="summary">`;
check("no head: the head is written exactly as before", before === AS_BEFORE, `\n${before}`);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

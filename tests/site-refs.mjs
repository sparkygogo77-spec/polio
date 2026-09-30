/**
 * EVERY FILE A PUBLISHED PAGE POINTS AT IS IN THE PUBLISHED SITE.
 *
 * The live check of 30 September: TrendTrader's page pointed at
 * /placeholder/scene.svg and BLACKORB's at nine /construct/*.png, files the
 * Builder serves itself and publish never carried, so they were holes on the
 * live sites. Held here without a browser (`siteRefs.ts`):
 *   · what a page or a sheet points at is read: src, srcset, poster, a
 *     stylesheet's or icon's href, a share picture, every url(…) (inline
 *     styles written with &quot; included), relative or from the root;
 *   · links between pages, canonical addresses, other sites, data: and
 *     anchors are not files and are not held to it;
 *   · what the Builder serves itself is copied in at the same path;
 *   · anything else is named, with the pages that use it, in a plain
 *     warning (the publish still goes; the owner is never kept from going
 *     live by it).
 *
 *   node tests/site-refs.mjs
 */
const { referencesIn, resolveRef, completeSite, missingSays } = await import("../src/features/studio/siteRefs.ts");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = JSON.stringify;

const page = {
  path: "tokens/index.html",
  content: `<!doctype html><html><head>
<link rel="stylesheet" href="../assets/site.css">
<link rel="canonical" href="https://site.vercel.app/tokens">
<link rel="icon" href="../assets/icons/icon-32.png">
<meta property="og:image" content="https://site.vercel.app/assets/pictures/share.png">
</head><body>
<a href="/">Home</a><a href="../about">About</a><a href="https://elsewhere.test/x.png">off</a><a href="#top">top</a>
<img src="../assets/pictures/pic_a.webp" srcset="../assets/pictures/pic_a.webp 1x, ../assets/pictures/pic_a2.webp 2x">
<div style="background-image: url(&quot;/placeholder/scene.svg&quot;); background-size: cover"></div>
<div style="--mo-face: url('/construct/face-green.png')"></div>
<img src="data:image/png;base64,AAAA"><video poster="../assets/pictures/poster.jpg"></video>
<img src="../assets/pictures/pic_gone.png">
<img src="/api/studio/secret.png">
</body></html>`,
};
const sheet = { path: "assets/site.css", content: `.x{background:url(../construct/rim-green.png)} .y{background:url("data:image/svg+xml,<svg/>")}` };
const refs = referencesIn(page);
check("a page's files are read: styles, icons, share picture, src, srcset, poster, and url() in inline styles", ["../assets/site.css", "../assets/icons/icon-32.png", "https://site.vercel.app/assets/pictures/share.png", "../assets/pictures/pic_a.webp", "../assets/pictures/pic_a2.webp", "/placeholder/scene.svg", "/construct/face-green.png", "../assets/pictures/poster.jpg", "../assets/pictures/pic_gone.png"].every((r) => refs.includes(r)), J(refs));
check("links between pages, a canonical address, another site and an anchor are not files", !refs.some((r) => /about|^\/$|elsewhere|#top|canonical|\/tokens$/.test(r)), J(refs));
check("a reference is resolved against the file it is in", resolveRef("../assets/a.png", "tokens/index.html") === "assets/a.png" && resolveRef("/construct/x.png", "tokens/index.html") === "construct/x.png" && resolveRef("../construct/rim-green.png", "assets/site.css") === "construct/rim-green.png");
check("the live address is this site; data: and another site are not", resolveRef("https://site.vercel.app/assets/p.png", "index.html", "https://site.vercel.app") === "assets/p.png" && resolveRef("data:image/png;base64,AA", "index.html") === null && resolveRef("https://other.test/p.png", "index.html", "https://site.vercel.app") === null);

const builder = { "placeholder/scene.svg": 900, "construct/face-green.png": 1200, "construct/rim-green.png": 800, "api/studio/secret.png": 10 };
const asked = [];
const fetchOwn = async (p) => { asked.push(p); return builder[p] ? { base64: "QUJD", bytes: builder[p] } : null; };
const files = [page, sheet, { path: "assets/icons/icon-32.png", content: "x", encoding: "base64" }, { path: "assets/pictures/pic_a.webp", content: "x", encoding: "base64" }, { path: "assets/pictures/pic_a2.webp", content: "x", encoding: "base64" }, { path: "assets/pictures/poster.jpg", content: "x", encoding: "base64" }, { path: "assets/pictures/share.png", content: "x", encoding: "base64" }];
const { added, missing } = await completeSite(files, { fetchOwn, liveAddress: "https://site.vercel.app" });
check("the Builder's own files a page uses are copied in at the same path", J(added.map((f) => f.path).sort()) === J(["construct/face-green.png", "construct/rim-green.png", "placeholder/scene.svg"]) && added.every((f) => f.encoding === "base64"), J(added.map((f) => f.path)));
check("files already going up are not asked for", !asked.some((p) => /pic_a|site\.css|icon-32|share|poster/.test(p)), J(asked));
check("the Builder's own machinery is never copied in, even if it answers", !asked.includes("api/studio/secret.png") && missing.some((m) => m.path === "api/studio/secret.png"));
check("what nothing provides is named, with the file that uses it", J(missing) === J([{ path: "api/studio/secret.png", from: ["tokens/index.html"] }, { path: "assets/pictures/pic_gone.png", from: ["tokens/index.html"] }]), J(missing));
const says = missingSays(missing, (f) => (f === "tokens/index.html" ? "Tokens" : f));
check("the warning is plain: how many, which, on which page, and what to do", /^Published without 2 files the pages point at, so they are missing on the live site/.test(says) && /assets\/pictures\/pic_gone\.png \(used on Tokens\)/.test(says) && /Add the missing pictures again on the board, or remove the parts that show them, then press Update live site again\./.test(says), says);
check("no em dash in it", !says.includes("—"));
const clean = await completeSite([{ path: "index.html", content: '<img src="assets/pictures/a.png">' }, { path: "assets/pictures/a.png", content: "x", encoding: "base64" }], { fetchOwn });
check("a site with nothing missing adds nothing and warns of nothing", clean.added.length === 0 && clean.missing.length === 0);

/* The Builder's own sources that publish these paths: each one the copy has to cover. */
const { readFileSync, existsSync } = await import("node:fs");
for (const [file, re] of [["src/features/studio/parts/theme.ts", /"\/placeholder\/scene\.svg"/], ["src/features/studio/nebulaTile.ts", /"\/construct\/face-green\.png"/], ["src/core/ui/molten.css", /url\("\/construct\/rim-green\.png"\)/]]) {
  const m = readFileSync(file, "utf8").match(re);
  const path = m ? m[0].replace(/^url\(|\)$|"/g, "").replace(/^\//, "") : null;
  check(`${file}'s ${path} is a file the Builder serves, so it can be copied in`, !!path && existsSync(`public/${path}`), path ?? "not found");
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);

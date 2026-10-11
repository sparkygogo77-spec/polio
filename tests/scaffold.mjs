/**
 * Build, written from the document rather than described to a model.
 *
 * The brief is words and words are lossy about looks: a palette becomes "a
 * warm accent", a shadow becomes "a soft shadow", and every re-generation
 * drifts. So the looks are not generated at all — they are copied out of
 * the document, which already holds them exactly. This holds that to its
 * rules: the markup a part rendered survives into its component unchanged,
 * the tokens are the palette's own values, a part cut to a drawn line is
 * still cut to it, a written body is carried through in its sandbox, and
 * the file that says what is left for Claude says the true thing.
 *
 *   node tests/scaffold.mjs
 *
 * Covers: src/features/studio/scaffold.ts, src/features/studio/scaffolding/pages.ts
 */
import { componentName, htmlToJsx, scaffold, styleToObject } from "../src/features/studio/scaffold.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. The markup a part actually rendered, as JSX. */
{
  const html = '<div class="row" style="color:oklch(0.86 0.19 158);font-size:28px;letter-spacing:-0.02em;box-shadow:0 8px 24px oklch(0 0 0 / 0.4)"><h2 style="margin:0">Power in the dark</h2><img src="data:image/png;base64,AA==" alt=""><br><a href="/x" tabindex="-1">go</a></div>';
  const jsx = htmlToJsx(html);
  check("class becomes className", jsx.includes('className="row"'));
  check("the exact colour survives", jsx.includes("oklch(0.86 0.19 158)"), jsx.match(/color: "[^"]+"/)?.[0]);
  check("so does the exact shadow", jsx.includes("0 8px 24px oklch(0 0 0 / 0.4)"));
  check("styles are an object, camel-cased", /fontSize: "28px"/.test(jsx) && /letterSpacing: "-0.02em"/.test(jsx) && /boxShadow:/.test(jsx));
  check("void tags close themselves", /<br \/>/.test(jsx) && /<img [^>]*\/>/.test(jsx), jsx.match(/<img[^>]*>/)?.[0]);
  check("tabindex is React's, a number", jsx.includes("tabIndex={-1}"));
  check("the words are still the words", jsx.includes("Power in the dark"));
}
{
  // Braces in text would be code in JSX.
  check("braces in text are escaped", htmlToJsx("<p>{not a prop}</p>").includes('{"{"}'));
  // An SVG's hyphenated attributes are React's, and data- ones are not.
  const svg = htmlToJsx('<svg viewBox="0 0 10 10"><path d="M0 0" stroke-width="2" data-part="x" aria-hidden="true"/></svg>');
  check("SVG attributes are camel-cased", svg.includes('strokeWidth="2"') && svg.includes('viewBox="0 0 10 10"'));
  check("data- and aria- are left alone", svg.includes('data-part="x"') && svg.includes('aria-hidden="true"'));
}
{
  const o = styleToObject("--own: 4px; background-image: url(data:image/png;base64,AA==); color: red");
  check("a custom property keeps its name", o.includes('"--own": "4px"'));
  check("a data: url survives a style", o.includes("data:image/png;base64,AA=="));
}

/* 2. The files, from a document. */
const input = {
  name: "BLACKORB",
  gimmick: "A black sphere lit from inside the dark.",
  master: "One dark page about one thing.",
  frameWidth: 1440,
  pages: [{ id: "p1", name: "Home", path: "/", prompt: "One long scroll." }, { id: "p2", name: "Orb lab", path: "/orb-lab" }],
  parts: [
    { id: "n_head", pageId: "p1", featureId: "big-headline", label: "Hero headline", prompt: "Two tone.", x: 0, y: 0, w: 1440, h: 200,
      html: '<h1 style="color:#f5f7f2;font-size:88px">Power in the <em style="color:#b8ff24">dark</em></h1>' },
    { id: "n_helix", pageId: "p1", featureId: "custom-idea", label: "The helix", prompt: "a helix of sentences", x: 80, y: 260, w: 360, h: 360,
      html: "", outline: { cut: "M 0.5 0 C 0.6 0.3, 0.7 0.4, 0.5 1 Z", closed: true },
      code: { html: '<svg viewBox="0 0 10 10"><text x="1" y="5">a helix</text></svg>', note: "sentences on a coil" } },
    { id: "n_idea", pageId: "p2", featureId: "custom-idea", label: "The lab", prompt: "Three orbs, side by side, each one relit.", x: 0, y: 0, w: 1440, h: 600,
      html: '<div style="color:#8c9690">The lab</div>', empty: true, data: "the orb presets" },
  ],
  palette: { bg: "#050505", surface: "#0c0e0d", text: "#f5f7f2", muted: "#8c9690", accent: "#b8ff24", highlight: "#075dff" },
  tokens: { radius: 8, fontPx: 16, bodyFamily: "ui-monospace, monospace", headingFamily: "ui-monospace, monospace", line: "#1b1f1d", surface: "#0c0e0d", muted: "#8c9690" },
  pageCss: { backgroundImage: "radial-gradient(#111, #000)" },
};
const files = scaffold(input);
const at = (p) => files.find((f) => f.path === p)?.content ?? "";

// Three for the shell, one per part, one per page, and the note.
check("a file per part, plus the shell", files.length === 3 + input.parts.length + input.pages.length + 1, files.map((f) => f.path).join(" "));
check("the tokens are the palette's own values", at("app/globals.css").includes("--accent: #b8ff24;") && at("app/globals.css").includes("--bg: #050505;"));
check("and the page's own ground", at("app/globals.css").includes("background-image: radial-gradient(#111, #000);"));
check("the layout carries the site's name", at("app/layout.tsx").includes('title: "BLACKORB"'));

const head = at(`components/parts/${componentName(input.parts[0])}.tsx`);
check("a part's component holds the markup it rendered", head.includes("Power in the") && head.includes('fontSize: "88px"'), componentName(input.parts[0]));
check("and its exact accent, not a description of it", head.includes("#b8ff24"));
check("and says where it came from", head.includes("big-headline") && head.includes("Written from the document"));

const helix = at(`components/parts/${componentName(input.parts[1])}.tsx`);
check("a written body is carried through", helix.includes("a helix") && helix.includes("srcDoc"));
check("in a frame with no permissions", helix.includes('sandbox=""') && helix.includes("default-src 'none'"));
check("and the line it is cut to comes with it", helix.includes("M 0.5 0 C 0.6 0.3"));
// The cut is in the part's own 0..1 box. CSS path() reads numbers as
// pixels, so a clip built that way shrinks the part to a dot; it has to be
// read in objectBoundingBox units, the same way a part without a body is.
check("and is read in the part's own box, not as pixels",
  helix.includes('clipPathUnits="objectBoundingBox"') && helix.includes("url(#clip-n_helix)") && helix.includes('id="clip-n_helix"'));
check("never as a CSS path() of the raw cut", !/path\(['"]/.test(helix) && !helix.includes("PATH"));

const idea = at(`components/parts/${componentName(input.parts[2])}.tsx`);
check("an empty Idea part still gets a component", !!idea && idea.includes("The lab"));

const home = at("app/page.tsx");
check("the home page places its parts where the board does", home.includes('data-part="n_head"') && home.includes("left: 0") && home.includes("width: 1440"));
check("a second page gets its own route", at("app/orb-lab/page.tsx").includes("n_idea"));
check("pages import only their own parts", !home.includes(componentName(input.parts[2])));

const build = at("BUILD.md");
check("BUILD.md counts what was written from the document", build.includes("3 of them") || build.includes("one component per part, 3"), build.match(/one component per part, \d+/)?.[0]);
check("and names the Idea part left for Claude", build.includes("The lab") && build.includes("no body written yet"));
check("and the data question it cannot answer", build.includes("the orb presets"));
check("and does not claim the looks are Claude's job", !/Claude.*colou?r/i.test(build));

/* 2b. Every file the export imports is a file the export wrote.
   A codebase that fails its first `tsc` is a description of a codebase.
   The generated layout imported `./bodyPaint.ts`, which nothing emitted,
   so every export ever made failed to compile; the check on the layout
   read only its title. This walks every relative import in every file. */
{
  const paths = new Set(files.map((f) => f.path));
  const dirOf = (p) => p.split("/").slice(0, -1).join("/");
  const resolve = (from, spec) => {
    const parts = [...dirOf(from).split("/").filter(Boolean)];
    for (const seg of spec.split("/")) {
      if (seg === ".") continue;
      if (seg === "..") parts.pop(); else parts.push(seg);
    }
    return parts.join("/");
  };
  const missing = [];
  let imports = 0;
  for (const f of files) {
    if (!/\.(tsx?|css)$/.test(f.path)) continue;
    for (const m of f.content.matchAll(/^import\s[^;]*?from\s+"(\.[^"]+)"|^import\s+"(\.[^"]+)"/gm)) {
      imports++;
      const spec = m[1] ?? m[2];
      const target = resolve(f.path, spec);
      const found = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`].some((t) => paths.has(t));
      if (!found) missing.push(`${f.path} → ${spec}`);
    }
  }
  check("every relative import in the export names a file the export wrote", imports > 0 && missing.length === 0,
    `${imports} imports, ${missing.length} unresolved${missing.length ? `: ${missing.join(", ")}` : ""}`);
}

/* 3. Determinism: the same document, the same bytes. */
const again = scaffold(input);
check("the same document gives the same files, byte for byte", JSON.stringify(files) === JSON.stringify(again));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

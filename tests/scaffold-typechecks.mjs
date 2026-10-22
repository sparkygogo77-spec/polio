/**
 * The parts Build writes compile.
 *
 * Build copies the markup each part rendered into components/parts/*.tsx,
 * and the DOM writes every attribute as a string: `tabindex="0"`,
 * `disabled=""`, `rows="3"`. Copied as they were, a tab strip or any form
 * control failed the site's first `tsc` and `next build` (a number or a
 * boolean wanted, a string given), `playsinline` and `allowfullscreen`
 * were props React does not know, and a `>` in a <style> was read as a tag.
 * An input copied with `value` and no onChange was stuck on its sample.
 * This renders the real Tabs, Field and Checkbox parts the way the board
 * does, adds the media, frame, style and script markup the other parts
 * make, runs it all through htmlToJsx and then through tsc in a scratch
 * folder, with the same tsconfig the export test uses.
 *
 *   node tests/scaffold-typechecks.mjs
 *
 * Covers: src/features/studio/scaffolding/jsx.ts, src/features/studio/scaffold.ts
 */
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToJsx } from "../src/features/studio/scaffold.ts";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
await jiti.import("@/features/studio/board/store"); // the store door first (see tests-jiti-store-first)
const S = join(here, "..", "src", "features", "studio");
const { Block } = await jiti.import(join(S, "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(S, "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. The markup the DOM writes, as JSX React's types accept. */
{
  const j = htmlToJsx('<div role="tab" tabindex="0">a</div><a href="/x" tabindex="-1">b</a>');
  check("tabindex is a number", j.includes("tabIndex={0}") && j.includes("tabIndex={-1}"), j);
  const ta = htmlToJsx('<textarea rows="3" readonly="" disabled="" tabindex="-1">v</textarea>');
  check("rows is a number, readonly and disabled are bare", ta.includes("rows={3}") && /\sreadOnly[\s>]/.test(ta) && /\sdisabled[\s>]/.test(ta) && !ta.includes('disabled=""'), ta);
  const inp = htmlToJsx('<input readonly="" value="5" maxlength="4" minlength="1" spellcheck="false" inputmode="numeric"><input type="checkbox" checked="">');
  check("an input's value only seeds it", inp.includes('defaultValue="5"') && !/\svalue=/.test(inp) && inp.includes("defaultChecked"), inp);
  check("maxlength and minlength are numbers, inputmode and spellcheck React's", inp.includes("maxLength={4}") && inp.includes("minLength={1}") && inp.includes('inputMode="numeric"') && inp.includes('spellCheck="false"'), inp);
  const opt = htmlToJsx('<select multiple=""><option value="a" selected="">a</option></select>');
  check("an option keeps its value", opt.includes('value="a"') && /\smultiple[\s>]/.test(opt), opt);
  const vid = htmlToJsx('<video autoplay="" playsinline="" loop="" controls="" muted=""></video>');
  check("video flags are React's names, bare", ["autoPlay", "playsInline", "loop", "controls", "muted"].every((a) => new RegExp(`\\s${a}[\\s>]`).test(vid)), vid);
  const fr = htmlToJsx('<iframe allowfullscreen="" referrerpolicy="no-referrer" frameborder="0" srcdoc="&lt;p&gt;hi&lt;/p&gt;"></iframe>');
  check("frame attributes are React's names", /\sallowFullScreen[\s>]/.test(fr) && fr.includes('referrerPolicy="no-referrer"') && fr.includes('frameBorder="0"') && fr.includes('srcDoc="<p>hi</p>"'), fr);
  const st = htmlToJsx("<div><style>a > b{color:red}</style></div>");
  check("a style's text goes in as one string", st.includes('<style>{"a > b{color:red}"}</style>'), st);
  const sc = htmlToJsx('<script type="application/json">{"a":"b>c"}</script><p>after</p>');
  check("so does a script's, and the markup after it carries on", sc.includes('{"{\\"a\\":\\"b>c\\"}"}</script>') && sc.includes("<p>after</p>"), sc);
  check("an ordinary attribute is untouched", htmlToJsx('<a href="/x" title="3">x</a>').includes('title="3"'));
}

/* 2. The real parts, drawn the way Build draws them (board mode). */
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (id, featureId, content, options = {}) => ({
  id, pageId: "p", featureId, label: id, prompt: "", content, data: "", x: 0, y: 0, w: 400, h: 120, groupId: null, options,
  priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "board", size: { w: n.w, h: n.h } }));
const real = {
  TabsPart: draw(node("tabs", "tabs-panel", "One\nTwo\nThree")),
  TextareaPart: draw(node("ta", "field", "Notes", { kind: "textarea", rows: "3", value: "hi", disabled: "yes" })),
  InputPart: draw(node("in", "field", "Amount", { kind: "number", value: "5", placeholder: "0" })),
  SelectPart: draw(node("sel", "field", "Pick", { kind: "select", choices: "a\nb" })),
  CheckboxPart: draw(node("cb", "checkbox", "Approve", { checked: "yes" })),
};
check("the tab strip draws a tabindex the scaffold has to turn into a number", /tabindex="-?\d"/.test(real.TabsPart), (real.TabsPart.match(/<button[^>]*>/) ?? [""])[0].slice(0, 160));
check("the textarea draws rows, readonly and disabled", /rows="3"/.test(real.TextareaPart) && /readonly=""/i.test(real.TextareaPart) && /disabled=""/.test(real.TextareaPart), (real.TextareaPart.match(/<textarea[^>]*>/) ?? [""])[0].slice(0, 200));

/* 3. All of it through tsc. */
const fixtures = {
  ...real,
  Media: '<video autoplay="" playsinline="" loop="" controls="" muted="" src="/v.mp4"></video><iframe allowfullscreen="" referrerpolicy="no-referrer" frameborder="0" src="https://example.com/"></iframe>',
  Form: '<form novalidate=""><input readonly="" value="5" maxlength="4" spellcheck="false" inputmode="numeric"><select multiple=""><option selected="">a</option></select><button disabled="" formnovalidate="">go</button></form>',
  Styled: '<div><style>a > b{color:red}</style><script type="application/json">{"a":"b>c"}</script><details open=""><summary>s</summary></details></div>',
};
const site = join(tmpdir(), `scaffold-typechecks-${process.pid}`);
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
for (const [name, html] of Object.entries(fixtures)) {
  writeFileSync(join(site, `${name}.tsx`), `export function ${name}() {\n  return (\n    <>\n    ${htmlToJsx(html)}\n    </>\n  );\n}\n`);
}
writeFileSync(join(site, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["dom", "dom.iterable", "esnext"], jsx: "preserve", module: "esnext", moduleResolution: "bundler", strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true, types: ["react", "react-dom"], typeRoots: [resolve("node_modules/@types")] }, include: ["**/*.tsx"] }));
mkdirSync(join(site, "node_modules"), { recursive: true });
for (const m of ["react", "@types"]) symlinkSync(resolve("node_modules", m), join(site, "node_modules", m), "junction");
const tsc = spawnSync(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], { cwd: site, encoding: "utf8" });
check(`the parts typecheck: ${Object.keys(fixtures).join(", ")}`, tsc.status === 0, tsc.status === 0 ? "tsc clean" : (tsc.stdout + tsc.stderr).trim().split("\n").slice(0, 6).join(" | "));
rmSync(site, { recursive: true, force: true });

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

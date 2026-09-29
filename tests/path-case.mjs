/**
 * A PAGE'S PATH KEEPS ITS CASE.
 *
 * parasiteonsol.fun's coin pages are `/h/<mint>`, a case-sensitive address
 * (`/h/Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump`). The export wrote it
 * as `h/ai66lhzg…/index.html`, so the page was at an address no live link
 * reaches (a host serves paths as written). A page's own path is its file as
 * written, only characters no address holds replaced; a page with no path of
 * its own is still named from its name, lowered.
 *
 *   node --experimental-strip-types tests/path-case.mjs
 */
import { homeFor } from "../src/features/studio/homePage.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const mint = "Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump";
const pages = [
  { id: "home", name: "Home", path: "/" },
  { id: "h", name: "H", path: `/h/${mint}` },
  { id: "devs", name: "Devs", path: "/devs/EzJVSn8B9RPb3CdhLYqKbZEBEwkz4DNdo5tLwfNSLJhG" },
  { id: "tok", name: "Tokenomics", path: "/ttp-tokenomics/" },
  { id: "about", name: "About Us", path: "" },
];
const home = homeFor(pages);
const f = (id) => home.file(pages.find((p) => p.id === id));
check("the coin page is written at its own path, case and all", f("h") === `h/${mint}/index.html`, f("h"));
check("…and a developer's page too", f("devs") === "devs/EzJVSn8B9RPb3CdhLYqKbZEBEwkz4DNdo5tLwfNSLJhG/index.html", f("devs"));
check("control: a lower-case path is as it was", f("tok") === "ttp-tokenomics/index.html", f("tok"));
check("control: a page with no path is named from its name, lowered", f("about") === "about-us/index.html", f("about"));
check("control: home is index.html", f("home") === "index.html");
const twins = homeFor([{ id: "a", path: "/" }, { id: "b", path: "/Docs" }, { id: "c", path: "/docs" }]);
check("control: two paths that differ only in case are still two files", twins.file({ id: "b" }) !== twins.file({ id: "c" }), `${twins.file({ id: "b" })} ${twins.file({ id: "c" })}`);

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);

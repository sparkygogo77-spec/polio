/**
 * TWO ADDRESSES RUN TOGETHER ARE ONE ADDRESS AGAIN.
 *
 * J, 2 October 2026: bringing a repository in, typing went onto the end of
 * the address already in the field, and a capture ran on
 * "https://pst-server-beige.vercel.apphttps://…". The capture fields, the
 * recapture field and the web-address field now keep the last whole address
 * (`oneAddress`), the capture refuses nothing it can mend, and a capture or
 * site name made from such an address loses the glued-on second one
 * (`withoutJoinedAddress`, inside `captureName`).
 *
 *   node tests/joined-address.mjs
 *
 * Covers: src/features/studio/bring-in/captureSite.ts, src/features/studio/CaptureSiteDialog.tsx, src/features/studio/Recapture.tsx, src/features/studio/bring-in/recapture.ts, src/features/studio/bring-in/FromASite.tsx
 */
import { captureName, nameFrom, oneAddress, startCapture, withoutJoinedAddress } from "../src/features/studio/bring-in/captureSite.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const JOINED = "https://pst-server-beige.vercel.apphttps://pst-server-beige.vercel.app/play";
const one = oneAddress(JOINED);
check("two addresses run together keep the last whole one, and say so", one.url === "https://pst-server-beige.vercel.app/play" && one.joined === true, JSON.stringify(one));
check("one address is left as it is", JSON.stringify(oneAddress("  https://pump.fun/coin/x ")) === JSON.stringify({ url: "https://pump.fun/coin/x", joined: false }));
check("an address carrying another in its query is one address", oneAddress("https://a.com/?next=https://b.com").url === "https://a.com/?next=https://b.com" && oneAddress("https://a.com/ https://b.com").url === "https://b.com");
check("a name made from the joined address loses the glued-on second one", captureName("pst-server-beige-vercel-apphttps") === "pst-server-beige-vercel-app" && captureName("pst-server-beige.vercel.apphttps://pst-server-beige.vercel.app") === "pst-server-beige-vercel-app", `${captureName("pst-server-beige-vercel-apphttps")} ${captureName("pst-server-beige.vercel.apphttps://pst-server-beige.vercel.app")}`);
check("a site name is cleaned the same way, and plain names are untouched", withoutJoinedAddress("PonsStars apphttps://x.y") === "PonsStars app" && withoutJoinedAddress("Https Studio") === "Https Studio" && captureName("my-site") === "my-site");
check("the name the capture dialog offers from a cleaned address is plain", nameFrom(one.url) === "pst-server-beige-vercel", nameFrom(one.url));

/* The capture itself runs on the one address, whatever reached it. */
let sent = null;
const stand = async (url, init = {}) => {
  const u = new URL(url);
  const j = (o, status = 200) => new Response(status === 204 ? null : JSON.stringify(o), { status });
  if (u.pathname.endsWith("/dispatches")) { sent = JSON.parse(init.body); return j(null, 204); }
  if (u.pathname.endsWith("/runs")) return j({ workflow_runs: [{ id: 7, html_url: "https://github.com/j/polio/actions/runs/7", created_at: new Date(Date.now() + 1000).toISOString() }] });
  return j({ default_branch: "main" });
};
const started = await startCapture({ repo: { owner: "j", name: "polio" }, token: "tok", url: JOINED, name: "", pages: "/", ref: "captures/x", fetch: stand, sleep: async () => {} });
check("a capture handed the joined address runs on the last one, under a plain name", started.ok && sent?.inputs?.url === "https://pst-server-beige.vercel.app/play" && sent.inputs.name === "pst-server-beige-vercel", JSON.stringify(sent?.inputs ?? started));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);

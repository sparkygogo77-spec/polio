/**
 * Public addresses only, where the server actually opens things.
 *
 * The routes that open a typed address (read-a-page, the embed check, and
 * the font files a read page names) checked the address only as it was
 * typed. A public-looking name that points here (localtest.me,
 * 127.0.0.1.nip.io), "localhost." with its trailing dot, a carrier-grade
 * NAT address (100.64/10), a redirect, or a picture a page asks for got the
 * server's own browser or fetch onto this machine, and the read came back as
 * a screenshot. This holds the bounds as resolved: every name looked up,
 * every redirect checked before it is asked for, every request a page makes
 * checked the same way. DNS and fetch are stood in, so the pure half needs
 * no network.
 *
 * The route half needs a built server and runs only when given its address:
 *
 *   npm run build && npx next start -p 3013
 *   node --experimental-strip-types tests/site-bounds-resolved.mjs [builder url]
 *
 * Covers: src/features/studio/siteFetch.ts, src/features/studio/siteResolve.ts, src/app/api/studio/element/route.ts, src/app/api/studio/embed-check/route.ts
 */
import { allowed, privateAddress, REFUSAL_SAYS } from "../src/features/studio/siteFetch.ts";
import { allowedResolved, requestCheck, safeFetch } from "../src/features/studio/siteResolve.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

/* ---------------------------------------------------- as typed */
for (const [what, address] of [
  ["localhost with a trailing dot", "https://localhost./"],
  ["a carrier-grade NAT address (a cloud's metadata service)", "https://100.100.100.200/"],
  ["the bottom of that range", "https://100.64.0.1/"],
]) check(`${what} is refused as private`, allowed(address).ok === false && allowed(address).why === "private", JSON.stringify(allowed(address)));
check("an address just outside that range still opens", allowed("https://100.128.0.1/").ok);
check("a plain public address still opens", allowed("https://example.com/").ok);

/* ---------------------------------------------------- an address, as DNS answers it */
for (const ip of ["127.0.0.1", "10.1.2.3", "100.64.0.1", "169.254.169.254", "::1", "::", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe"]) {
  check(`${ip} is private`, privateAddress(ip) === true);
}
for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700::1111", "::ffff:5db8:d822"]) {
  check(`${ip} is public`, privateAddress(ip) === false);
}

/* ---------------------------------------------------- a name, as DNS answers it */
const DNS = {
  "localtest.me": ["127.0.0.1"],
  "127.0.0.1.nip.io": ["127.0.0.1"],
  "split.example": ["93.184.216.34", "10.0.0.7"],
  "v6.example": ["::ffff:127.0.0.1"],
  "example.com": ["93.184.216.34"],
  "public.example": ["93.184.216.34"],
};
const asked = [];
const resolve = async (host) => {
  asked.push(host);
  if (DNS[host]) return DNS[host];
  throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND" });
};
for (const [what, address] of [
  ["localtest.me, which points here", "https://localtest.me/"],
  ["127.0.0.1.nip.io", "https://127.0.0.1.nip.io/"],
  ["a name with one private address among public ones", "https://split.example/"],
  ["a name that answers an IPv4 address inside IPv6", "https://v6.example/"],
]) {
  const got = await allowedResolved(address, resolve);
  check(`${what} is refused as private`, got.ok === false && got.why === "private" && got.says === REFUSAL_SAYS.private, JSON.stringify(got));
}
const pub = await allowedResolved("https://example.com/a", resolve);
check("a public name still opens, as typed", pub.ok === true && pub.url === "https://example.com/a", JSON.stringify(pub));
const unknown = await allowedResolved("https://nowhere.example/", resolve);
check("a name that does not resolve here is left to fail on its own (a proxy may resolve it)", unknown.ok === true, JSON.stringify(unknown));
const typed = await allowedResolved("http://example.com/", resolve);
check("the typed bounds still come first (https only)", typed.ok === false && typed.why === "not-https", JSON.stringify(typed));

/* ---------------------------------------------------- redirects, followed by hand */
function stubFetch(answers) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, redirect: init?.redirect });
    const a = answers[url];
    if (!a) throw new Error(`asked for ${url}, which nothing serves`);
    return new Response(a.body ?? null, { status: a.status, headers: a.location ? { location: a.location } : {} });
  };
  return { fetcher, calls };
}
{
  const { fetcher, calls } = stubFetch({ "https://public.example/r": { status: 302, location: "https://10.0.0.1/secret" } });
  const got = await safeFetch("https://public.example/r", {}, { resolve, fetcher });
  check("a redirect to a private address is refused", !(got instanceof Response) && got.why === "private", got instanceof Response ? `answered ${got.status}` : JSON.stringify(got));
  check("…before it is asked for: the private address is never fetched", calls.length === 1 && calls[0].url === "https://public.example/r", JSON.stringify(calls));
  check("…and the fetch never follows on its own", calls.every((c) => c.redirect === "manual"), JSON.stringify(calls));
}
{
  const { fetcher, calls } = stubFetch({ "https://public.example/r": { status: 301, location: "https://localtest.me:3013/" } });
  const got = await safeFetch("https://public.example/r", {}, { resolve, fetcher });
  check("a redirect to a name that points here is refused, and not asked for", !(got instanceof Response) && got.why === "private" && calls.length === 1, JSON.stringify(calls));
}
{
  const { fetcher, calls } = stubFetch({
    "https://public.example/r": { status: 302, location: "/next" },
    "https://public.example/next": { status: 307, location: "https://example.com/page" },
    "https://example.com/page": { status: 200, body: "<p>hi</p>" },
  });
  const got = await safeFetch("https://public.example/r", {}, { resolve, fetcher });
  check("a chain of public redirects is followed to the page", got instanceof Response && got.status === 200 && calls.length === 3, JSON.stringify(calls));
}
{
  const answers = {};
  for (let i = 0; i < 10; i++) answers[`https://public.example/${i}`] = { status: 302, location: `https://public.example/${i + 1}` };
  const { fetcher, calls } = stubFetch(answers);
  const got = await safeFetch("https://public.example/0", {}, { resolve, fetcher });
  check("a loop of redirects stops after five hops", !(got instanceof Response) && calls.length === 6, `${calls.length} fetches`);
}
{
  const { fetcher, calls } = stubFetch({});
  const got = await safeFetch("https://127.0.0.1.nip.io/", {}, { resolve, fetcher });
  check("a first address that points here is never fetched", !(got instanceof Response) && got.why === "private" && calls.length === 0, JSON.stringify(calls));
}

/* ---------------------------------------------------- what a page asks for */
{
  const ok = requestCheck(resolve);
  const go = [
    ["the page itself", "https://example.com/"],
    ["a plain-http picture on a public host", "http://example.com/a.png"],
    ["a data: picture", "data:image/png;base64,AAAA"],
    ["a blob: the page made", "blob:https://example.com/1234"],
    ["a public socket", "wss://example.com/live"],
  ];
  const stop = [
    ["a frame on this machine", "http://127.0.0.1:3013/"],
    ["a picture from a name that points here", "https://localtest.me/a.png"],
    ["the metadata address", "http://169.254.169.254/latest/meta-data/"],
    ["a private network host by name", "http://router.local/"],
    ["a bare machine name", "http://intranet/"],
    ["a file", "file:///etc/passwd"],
    ["a socket to this machine", "ws://127.0.0.1:9222/devtools"],
  ];
  for (const [what, url] of go) check(`a page may ask for ${what}`, (await ok(url)) === true);
  for (const [what, url] of stop) check(`a page may not ask for ${what}`, (await ok(url)) === false);
  asked.length = 0;
  await ok("https://public.example/1");
  await ok("https://public.example/2");
  check("each host is looked up once per page", asked.filter((h) => h === "public.example").length === 1, JSON.stringify(asked));
}

/* ---------------------------------------------------- the routes */
const BUILDER = process.argv[2];
if (BUILDER) {
  const port = new URL(BUILDER).port || "80";
  const self = `https://localhost.:${port}/`;
  const began = Date.now();
  const read = await fetch(`${BUILDER}/api/studio/element`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: self }) }).then((r) => r.json());
  check("read-a-page refuses this server by a trailing-dot name, before opening anything", read.ok === false && read.reason === "private" && read.message === REFUSAL_SAYS.private, JSON.stringify(read));
  check("…and quickly, without a browser (under five seconds)", Date.now() - began < 5000, `${Date.now() - began}ms`);
  const embed = await fetch(`${BUILDER}/api/studio/embed-check?url=${encodeURIComponent(self)}`).then((r) => r.json());
  check("the embed check refuses it too", embed.refuses === null && embed.says === REFUSAL_SAYS.private, JSON.stringify(embed));
} else {
  console.log("  --   the route half wants a built server: node --experimental-strip-types tests/site-bounds-resolved.mjs http://127.0.0.1:3013");
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

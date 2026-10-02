/**
 * A CAPTURE COMES BACK AS THE RUN'S ARTIFACT AND IS BROUGHT IN FROM IT.
 *
 * polio's capture workflow commits nothing: it hands `capture/sites/<name>/`
 * back as the run's artifact, `capture-<name>`. Here trumpmorty.fun's
 * capture (the fixture, `capture/sites/trumpmorty-fun`) is zipped the way
 * upload-artifact zips a folder (its files at the root, deflated, sizes in a
 * data descriptor after each), and brought in through the real importer,
 * `readRepoSite`, at `STANDIN-owner/polio/sites/trumpmorty-fun@run:42`:
 *
 *   · GitHub, our route's storage redirect and the storage's byte ranges are
 *     stand-ins in one fetch; the route (`api/studio/capture-artifact`) is
 *     the real handler, called in-process;
 *   · the copy is the same as one read out of a repository's folder: the
 *     document, the pictures it names, the stand-in reads (`api/map.json`);
 *   · only what is wanted is fetched, no answer is over the route's limit,
 *     and the token goes to GitHub and nowhere else.
 *
 *   node tests/capture-artifact.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`); };

const { ensureFixtures } = await import("../capture/fixtures/unpack.mjs");
const CAP = process.env.SINK_ROOT ?? ensureFixtures({ quiet: true });
const SITE = join(CAP ?? "", "sites", "trumpmorty-fun");
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`no capture at ${SITE}`); process.exit(2); }

/* ------------------------------------------------- the artifact, zipped as upload-artifact does */
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
function zipOf(dir) {
  const locals = [], central = [];
  let at = 0;
  for (const file of walk(dir).sort()) {
    const name = Buffer.from(relative(dir, file).split("\\").join("/"));
    const raw = readFileSync(file);
    const packed = deflateRawSync(raw);
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0008, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const dd = Buffer.alloc(16);
    dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4); dd.writeUInt32LE(packed.length, 8); dd.writeUInt32LE(raw.length, 12);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0008, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(at, 42);
    locals.push(lh, name, packed, dd);
    central.push(ch, name);
    at += lh.length + name.length + packed.length + dd.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...locals, cd, end]);
}
const ZIP = zipOf(SITE);
const doc = JSON.parse(readFileSync(join(SITE, "site", "document.json"), "utf8"));

/* ------------------------------------------------- GitHub, storage and our route, in one fetch */
const TOKEN = "STANDIN_GITHUB_TOKEN";
process.env.GITHUB_API = "https://github.test";
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const { GET } = await jiti.import(join(ROOT, "src/app/api/studio/capture-artifact/route.ts"));
const calls = [];
let served = 0, biggest = 0;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const h = new Headers(init.headers ?? {});
  calls.push({ u, auth: h.get("authorization"), token: h.get("x-github-token"), range: h.get("range") });
  if (u.startsWith("/api/studio/capture-artifact")) {
    const res = await GET(new Request(`http://polio.test${u}`, { headers: init.headers }));
    if (res.ok) { const n = Number(res.headers.get("content-range")?.match(/bytes (\d+)-(\d+)/)?.slice(1).reduce((a, b) => b - a + 1)); biggest = Math.max(biggest, n); }
    return res;
  }
  if (u === "https://api.github.com/repos/STANDIN-owner/polio") return json(200, { default_branch: "trunk" });
  if (u.startsWith("https://api.github.com/repos/STANDIN-owner/polio/actions/runs/42/artifacts")) return json(200, { artifacts: [{ id: 7, name: "capture-trumpmorty-fun", size_in_bytes: ZIP.length, expired: false }, { id: 8, name: "logs", size_in_bytes: 10 }] });
  if (u.startsWith("https://api.github.com/repos/STANDIN-owner/polio/actions/runs/43/artifacts")) return json(200, { artifacts: [{ id: 9, name: "capture-trumpmorty-fun", size_in_bytes: 1, expired: true }] });
  if (u === "https://github.test/repos/STANDIN-owner/polio/actions/artifacts/7/zip") return new Response(null, { status: 302, headers: { location: "https://storage.test/artifact-7.zip?sig=STANDIN" } });
  if (u === "https://github.test/repos/STANDIN-owner/polio/actions/artifacts/9/zip") return json(410, { message: "Artifact has expired" });
  if (u.startsWith("https://storage.test/artifact-7.zip")) {
    const r = /bytes=(\d*)-(\d*)/.exec(h.get("range") ?? "");
    let a = 0, b = ZIP.length - 1;
    if (r && r[1] === "") a = Math.max(0, ZIP.length - Number(r[2]));
    else if (r) { a = Number(r[1]); b = Math.min(ZIP.length - 1, Number(r[2])); }
    served += b - a + 1;
    return new Response(ZIP.subarray(a, b + 1), { status: 206, headers: { "content-range": `bytes ${a}-${b}/${ZIP.length}` } });
  }
  return json(404, { message: "Not Found" });
};

/* ------------------------------------------------- the pieces */
const art = await import("../src/features/studio/captureArtifact.ts");
check("a run is named as a ref, and read back", art.runRef(42) === "run:42" && art.runOf("run:42") === 42 && art.runOf("main") === null && art.runOf("run:x") === null);
const found = await art.findArtifact({ repo: { owner: "STANDIN-owner", name: "polio" }, token: TOKEN, runId: 42, name: "trumpmorty-fun" });
check("the run's capture is found by its name, not its other artifacts", found?.id === 7 && found.name === "capture-trumpmorty-fun", JSON.stringify(found));

/* ------------------------------------------------- the importer, whole */
globalThis.atob ??= (s) => Buffer.from(s, "base64").toString("binary");
const { readRepoSite, isCopy } = await jiti.import(join(ROOT, "src/features/studio/repoRun.ts"));
const { readRepo } = await jiti.import(join(ROOT, "src/features/studio/repoImport.ts"));
const { namedPictures } = await jiti.import(join(ROOT, "src/features/studio/siteHead.ts"));
const repo = readRepo("STANDIN-owner/polio/sites/trumpmorty-fun@run:42");
check("Bring reads owner/polio/sites/<name>@run:<id> as the run, in the site's folder", repo?.ref === "run:42" && repo?.dir === "sites/trumpmorty-fun", JSON.stringify(repo));
const lines = [];
calls.length = 0;
const got = await readRepoSite(repo, TOKEN, (l) => lines.push(l));
check("the site is read out of the artifact, as a copy", isCopy(got), JSON.stringify(got).slice(0, 300));
if (isCopy(got)) {
  check("the document is the capture's, part for part", got.parts === doc.nodes.length && got.pages === doc.pages.length && JSON.stringify(got.document.nodes) === JSON.stringify(doc.nodes));
  check("its source is the run, in the site's folder, with no commit", got.ref === "run:42" && got.document.source?.repo === "STANDIN-owner/polio" && got.document.source?.dir === "sites/trumpmorty-fun" && got.document.source?.branch === "run:42" && got.document.source?.commit === null, JSON.stringify(got.document.source));
  const names = namedPictures(doc);
  const held = names.filter((p) => existsSync(join(SITE, p.path)));
  check("every picture it names that the capture holds comes, with its bytes", got.pictures.length === held.length && got.pictures.every((p) => Buffer.compare(Buffer.from(p.bytes), readFileSync(join(SITE, p.path))) === 0), `${got.pictures.length} of ${held.length}`);
  check("…and the ones it does not hold are named", got.lost.length === names.length - held.length, `${got.lost.length}`);
  const mapped = doc.api?.map ? JSON.parse(readFileSync(join(SITE, doc.api.map), "utf8")) : null;
  check("the reads the capture recorded come too, for the stand-in server", !mapped || (Array.isArray(got.document.standIn?.endpoints) && got.document.standIn.endpoints.length > 0), JSON.stringify(got.document.standIn ?? null).slice(0, 200));
}
check("only what is wanted is fetched: less than the whole artifact", served < ZIP.length, `${served} of ${ZIP.length} bytes`);
check("no answer from our route is over its limit", biggest > 0 && biggest <= art.MOST_PER_CALL, String(biggest));
check("the token goes to GitHub and our route, never to the storage", calls.filter((c) => c.u.startsWith("https://storage.test")).every((c) => !c.auth && !c.token) && calls.filter((c) => c.u.startsWith("https://api.github.com") || c.u.startsWith("https://github.test")).every((c) => c.auth === `Bearer ${TOKEN}`));
check("no address carries the token", calls.every((c) => !c.u.includes(TOKEN)));
check("what it is doing is said as it goes", lines.some((l) => /capture from run 42/.test(l)) && lines.some((l) => /pictures/.test(l)), lines.slice(0, 4).join(" | "));

/* ------------------------------------------------- what can go wrong, said */
const expired = await readRepoSite(readRepo("STANDIN-owner/polio/sites/trumpmorty-fun@run:43"), TOKEN, () => {});
check("an expired capture is said as one, with what to do", !isCopy(expired) && /expired/.test(expired.says) && /again/.test(expired.says), JSON.stringify(expired));
const none = await readRepoSite(readRepo("STANDIN-owner/polio/sites/trumpmorty-fun@run:44"), TOKEN, () => {});
check("a run that handed back no capture is said as one", !isCopy(none) && /no capture/.test(none.says), JSON.stringify(none));
const noKey = await GET(new Request("http://polio.test/api/studio/capture-artifact?repo=STANDIN-owner/polio&id=7&from=0&to=9"));
check("the route wants a key", noKey.status === 401);
const tooMuch = await GET(new Request(`http://polio.test/api/studio/capture-artifact?repo=STANDIN-owner/polio&id=7&from=0&to=${art.MOST_PER_CALL}`, { headers: { "x-github-token": TOKEN } }));
check("the route answers no more than its limit", tooMuch.status === 400);
const badRepo = await GET(new Request("http://polio.test/api/studio/capture-artifact?repo=../x&id=7&from=0&to=9", { headers: { "x-github-token": TOKEN } }));
check("the route takes owner/name and nothing else", badRepo.status === 400);
const gone = await GET(new Request("http://polio.test/api/studio/capture-artifact?repo=STANDIN-owner/polio&id=9&last=100", { headers: { "x-github-token": TOKEN } }));
check("an expired artifact is a 410 from the route", gone.status === 410);

/* ------------------------------------------------- what a capture recorded, for Recapture */
const rec = await art.recordOf({ repo: { owner: "STANDIN-owner", name: "polio" }, token: TOKEN, runId: 42, name: "trumpmorty-fun" });
const run = JSON.parse(readFileSync(join(SITE, "capture", "run.json"), "utf8"));
check("Recapture reads the address and pages the capture recorded, out of the run", rec?.url === run.url && JSON.stringify(rec?.pages) === JSON.stringify(run.pages), JSON.stringify(rec));
const { recapturePlan } = await jiti.import(join(ROOT, "src/features/studio/recapture.ts"));
const plan = recapturePlan({ owner: "STANDIN-owner", name: "polio", branch: "run:42", dir: "sites/trumpmorty-fun" }, rec);
check("…and runs polio's workflow again on its default branch, to come back as a new run", plan?.ref === "" && plan?.handsBack === true && plan?.branchNote === null && plan?.name === "trumpmorty-fun", JSON.stringify(plan));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);

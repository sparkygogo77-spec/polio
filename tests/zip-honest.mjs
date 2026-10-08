/**
 * The zip reader says what it cannot read, and reads names as they were written (inventory C17, C18).
 *
 * The reader is forty lines on purpose. Three things it did quietly:
 *
 *   · every name was decoded as UTF-8, whatever the entry's flag said, so a
 *     zip written by a tool that writes CP437 (most Windows zips of the
 *     last thirty years) had "café.css" arrive as "caf�.css", the page's
 *     own request for it never matched, and the page came up unstyled with
 *     nothing said;
 *   · a method other than stored or deflated (bzip2, LZMA, an encrypted
 *     entry) unpacked to zero bytes with nothing said, and for the page
 *     entry threw outside the route's own try, an HTTP 500;
 *   · a Zip64 archive was called "not a zip file", which it is not;
 *   · and `inflateRawSync` inflated an entry whole, so the 80 MB cap that
 *     trusted the directory's declared sizes held nothing against an entry
 *     that declared a kilobyte and unpacked to gigabytes.
 *
 * Now the name is decoded by the entry's flag (UTF-8 when bit 11 says so,
 * CP437 otherwise), the method is on the entry and a page packed another
 * way is refused with a sentence, Zip64 is refused by name, and an entry
 * inflates no further than it declared. Zips written here, by hand.
 *
 *   node tests/zip-honest.mjs
 */
import { crc32, deflateRawSync } from "node:zlib";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A zip writer of a few lines, with the knobs these cases need. */
function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const dir = [];
  let at = 0;
  for (const f of files) {
    const name = f.nameBytes ?? enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const method = f.method ?? (f.deflate ? 8 : 0);
    const packed = f.packed ?? (method === 8 ? deflateRawSync(data) : data);
    const declared = f.declaredSize ?? data.length;
    const flags = f.flags ?? 0;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(declared, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(declared, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); central.writeUInt32LE(at, 42);
    parts.push(local, Buffer.from(name), Buffer.from(packed));
    dir.push(central, Buffer.from(name));
    at += 30 + name.length + packed.length;
  }
  const dirBytes = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dirBytes.length, 12); end.writeUInt32LE(at, 16); end.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...parts, dirBytes, end]));
}

const { readZip } = await import("../src/features/studio/zipFile.ts");
let readZipInfo = null;
try { ({ readZipInfo } = await import("../src/features/studio/zipFile.ts")); } catch { /* not there */ }
const { checkZip, ZIP_REFUSAL_SAYS } = await import("../src/features/studio/bring-in/zipImport.ts");
const PAGE = { name: "index.html", data: "<!doctype html><title>x</title><link rel=stylesheet href=caf%C3%A9.css>" };

/* 1. Names, by the flag. */
const cp437 = readZip(zip([PAGE, { name: "café.css", nameBytes: Uint8Array.from([0x63, 0x61, 0x66, 0x82, 0x2e, 0x63, 0x73, 0x73]), data: "b{}" }]));
check("a CP437 name (no UTF-8 flag) is read as it was written", cp437?.[1]?.name === "café.css", JSON.stringify(cp437?.[1]?.name));
const utf8 = readZip(zip([PAGE, { name: "café.css", flags: 0x0800, data: "b{}" }]));
check("a UTF-8 name with the flag set still is", utf8?.[1]?.name === "café.css", JSON.stringify(utf8?.[1]?.name));
const utf8NoFlag = readZip(zip([PAGE, { name: "café.css", data: "b{}" }]));
check("a UTF-8 name a careless writer left unflagged is still read as UTF-8 when it decodes as such", utf8NoFlag?.[1]?.name === "café.css", JSON.stringify(utf8NoFlag?.[1]?.name));

/* 2. Methods. */
const bz = readZip(zip([{ ...PAGE, method: 12, packed: new TextEncoder().encode("BZh9...") }, { name: "a.css", data: "b{}" }]));
check("the method is on the entry", bz?.[0]?.method === 12 && bz?.[1]?.method === 0, `${bz?.[0]?.method}, ${bz?.[1]?.method}`);
const gate = bz ? checkZip(bz, 100) : null;
check("a page packed a way the reader cannot unpack is refused with a sentence, not opened to a 500", gate && gate.ok === false && /unpack|packed|bzip|stored and deflated/i.test(gate.says ?? ""), gate ? (gate.ok ? `opened at ${gate.entry}` : `${gate.why}: ${gate.says}`) : "no read");
let threw = null;
try { bz?.[0]?.bytes(); } catch (e) { threw = e; }
check("and asking for its bytes anyway throws a named error rather than handing back nothing", threw instanceof Error && /unpack|method|bzip|packed/i.test(threw.message), threw ? threw.message : `${bz?.[0]?.bytes().length} bytes, no throw`);

/* 3. Zip64. */
const big = zip([{ ...PAGE, declaredSize: 0xffffffff }]);
const info = readZipInfo ? readZipInfo(big) : null;
check("a Zip64 archive is named as one, not called not-a-zip", info && info.why === "zip64" && /zip64/i.test(ZIP_REFUSAL_SAYS.zip64 ?? ""), info ? `${info.why}: ${ZIP_REFUSAL_SAYS[info.why] ?? "no sentence"}` : "no readZipInfo");
check("and bytes that are not a zip still are not one", readZipInfo ? readZipInfo(new Uint8Array(100)).why === "not-a-zip" : false);

/* 4. The bomb: declares a kilobyte, unpacks to five megabytes. */
const loud = Buffer.alloc(5 * 1024 * 1024, 0x41);
const bomb = readZip(zip([PAGE, { name: "a.css", data: loud, method: 8, declaredSize: 1000 }]));
check("the gate reads the declared size and lets it through, as it always did", bomb && checkZip(bomb, 5000).ok === true);
let got = null; let bombThrew = null;
try { got = bomb?.[1]?.bytes(); } catch (e) { bombThrew = e; }
check("but the entry inflates no further than it declared", (bombThrew instanceof Error) || (got && got.length <= 1000), bombThrew ? bombThrew.message : `${got?.length ?? 0} bytes came out of an entry that declared 1000`);

/* 5. An honest zip still reads whole. */
const fine = readZip(zip([PAGE, { name: "a.css", data: "b{color:red}", deflate: true }]));
check("an honest deflated entry reads whole", fine && new TextDecoder().decode(fine[1].bytes()) === "b{color:red}");

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * ACCOUNT KEYS: WHO MAY DO WHAT, CHECKED WITHOUT A SERVER.
 *
 * J (2026-10-10): one owner key kept only as a Vercel setting, keys made
 * from it, kept hashed, cancellable; nothing erased. This drives
 * `src/app/api/account/core.ts` against an in-memory store:
 *
 *   1. the owner key opens the account only when it is long enough, and a
 *      wrong or near-miss key does not;
 *   2. a made key opens it as itself, is stored only as its hash (the key's
 *      characters appear nowhere in the store), and cannot pass as the owner;
 *   3. cancelling a key stops it at once; a listed key never shows its hash;
 *   4. saved work may go only under data/ (never keys/, never ..), and is
 *      served only as JSON, a picture or a video (never HTML or SVG);
 *   5. too many wrong keys from one address are made to wait.
 *
 *   node tests/account-keys.mjs
 */
import { cancelKey, cleanName, dataPath, hashKey, identify, KEY_RE, listKeys, makeKey, memoryBackend, offered, ownerKey, Throttle, typeFor } from "../src/app/api/account/core.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const bearer = (k) => `Bearer ${k}`;

const OWNER = "STANDIN_owner_key_for_tests_only_0123456789";
const env = { POLIO_OWNER_KEY: OWNER };
const store = memoryBackend();

// 1. owner
check("the owner key opens the account as the owner", (await identify(store, env, bearer(OWNER)))?.role === "owner");
check("the owner key with spaces around the setting still opens it", (await identify(store, { POLIO_OWNER_KEY: `  ${OWNER}\n` }, bearer(OWNER)))?.role === "owner");
check("a key one character off does not", (await identify(store, env, bearer(OWNER.slice(0, -1) + "X"))) === null);
check("a prefix of the owner key does not", (await identify(store, env, bearer(OWNER.slice(0, 20)))) === null);
check("no header, or not a Bearer header, opens nothing", (await identify(store, env, null)) === null && (await identify(store, env, OWNER)) === null && offered(`Basic ${OWNER}`) === null);
check("a short owner setting counts as unset", ownerKey({ POLIO_OWNER_KEY: "short" }) === null && (await identify(store, { POLIO_OWNER_KEY: "short" }, bearer("short"))) === null);
check("with no owner setting, an empty key opens nothing", (await identify(store, {}, "Bearer ")) === null);

// 2. made keys
const { key, record } = await makeKey(store, "Laptop");
check("a made key has the polio_ shape and 256 bits", KEY_RE.test(key), key.slice(0, 6));
check("the record shown carries no hash", !("hash" in record) && record.name === "Laptop");
const who = await identify(store, env, bearer(key));
check("a made key opens the account as itself", who?.role === "key" && who.name === "Laptop" && who.id === record.id);
const dump = [...store.items].map(([p, g]) => p + new TextDecoder().decode(g.bytes)).join("\n");
check("the store never holds the key, only its hash", !dump.includes(key) && !dump.includes(key.slice(6)) && dump.includes(hashKey(key)));
check("a made key is never the owner", who?.role !== "owner");
check("a made key does not open an account on another store", (await identify(memoryBackend(), env, bearer(key))) === null);
const listed = await listKeys(store);
check("the list names the key and shows no hash", listed.length === 1 && listed[0].name === "Laptop" && !JSON.stringify(listed).includes(hashKey(key)));

// 3. cancel
const second = await makeKey(store, "Phone");
check("cancelling an unknown id does nothing", (await cancelKey(store, "0000000000000000")) === false && (await listKeys(store)).length === 2);
check("cancelling a key removes it", (await cancelKey(store, record.id)) === true);
check("a cancelled key stops working at once", (await identify(store, env, bearer(key))) === null);
check("the other key still works", (await identify(store, env, bearer(second.key)))?.name === "Phone");

// 4. where work may go, and what it is served as
for (const ok of ["data/prefs.json", "data/sites/abc_DEF-1.json", "data/pictures/pic_1.png", "data/pictures/pic-2"]) check(`may save at ${ok}`, dataPath(ok) === ok);
for (const bad of ["keys/x.json", `keys/${hashKey(second.key)}.json`, "data/../keys/x.json", "data/sites/../../keys.json", "data/pictures/.hidden", "data/sites/a/b.json", "/data/prefs.json", "data/other.json", "", null, 5]) check(`refuses to save at ${JSON.stringify(bad)}`, dataPath(bad) === null);
check("JSON places are served as JSON whatever was claimed", typeFor("data/sites/a.json", "text/html") === "application/json");
check("pictures may be PNG, JPEG, WebP, video", ["image/png", "image/jpeg", "image/webp", "video/mp4"].every((t) => typeFor("data/pictures/p", t) === t));
check("HTML, SVG and unknown types are refused for pictures", ["text/html", "image/svg+xml", "application/javascript", "", null].every((t) => typeFor("data/pictures/p", t) === null));
check("names are cleaned and kept short", cleanName("  <b>Lap\u0000top</b>  ") === "bLaptop/b" && cleanName("x".repeat(99)).length === 60 && cleanName("   ") === null && cleanName(4) === null);

// 5. throttle
const t = new Throttle(3, 1000);
for (let i = 0; i < 3; i++) t.failed("1.2.3.4", 0);
check("three wrong keys from one address: that address waits", t.blocked("1.2.3.4", 10) && !t.blocked("5.6.7.8", 10));
check("and may try again once the window has passed", !t.blocked("1.2.3.4", 2000));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

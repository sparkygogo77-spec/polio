/**
 * The reshape answer's schema stays inside what structured output accepts.
 *
 * The drawing board's request once carried `additionalProperties: { type:
 * "string" }` on its options, and the API refused the whole request with a
 * 400 — read on the board as the drawing doing nothing. Structured output
 * allows `additionalProperties: false` and nothing else, and no numeric or
 * string constraints. This reads the route's source and holds it to that, so
 * the mistake cannot come back unnoticed without a key to try it against.
 *
 *   node tests/reshape-schema.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "app", "api", "studio", "reshape", "route.ts"), "utf8");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const start = src.indexOf("const ANSWER_SCHEMA = {");
const end = src.indexOf("} as const;", start);
check("the answer schema is where it was", start > 0 && end > start);
const schema = src.slice(start, end);

const additional = [...schema.matchAll(/additionalProperties:\s*([^,\n]+)/g)].map((m) => m[1].trim());
check("every additionalProperties is false", additional.length > 0 && additional.every((v) => v === "false"), additional.join(", "));

const objects = (schema.match(/type:\s*"object"/g) ?? []).length;
check("every object says additionalProperties: false", objects === additional.length, `${objects} objects, ${additional.length} closed`);

const banned = ["minimum", "maximum", "multipleOf", "minLength", "maxLength", "minItems", "maxItems", "pattern"];
const found = banned.filter((k) => new RegExp(`\\b${k}:`).test(schema));
check("no numeric or string constraints", found.length === 0, found.join(", "));

check("the options are a list of pairs, not an open map", /options:\s*\{\s*type:\s*"array"/.test(schema));

const ok = results.every(Boolean);
console.log(ok ? "\nall good" : "\nsomething failed");
process.exit(ok ? 0 : 1);

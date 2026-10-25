/**
 * Agents panel, the live check after a merge (helper/livecheck/*).
 *
 * - "Nothing moved": a part off by more than 1px, gone, or new is reported,
 *   worst first; within 1px is the same.
 * - Each reading waits for the board to hold still (late pictures).
 * - It waits for /api/version to show the merged commit.
 * - A failure is repeated once before it is reported; a flake that clears
 *   on the second look passes.
 * - The line is `checked` with shots and Undo, or `check-failed` naming the
 *   parts, and it is a valid contract message.
 *
 * The browser and the network are stand-ins: measure.ts is not opened here.
 *
 *   node tests/agents-livecheck.mjs
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};

let K = null, X = null, problems = null;
try {
  K = await import("../helper/livecheck/compare.ts");
  X = await import("../helper/livecheck/check.ts");
  ({ problems } = await import("../helper/contract.ts"));
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the live-check modules load", !!(K && X && problems));
if (!K || !X) done();

const box = (x, y, w = 100, h = 40) => ({ x, y, w, h });
const before = { a: box(0, 0), b: box(0, 100), c: box(200, 100) };

check("the same board: nothing moved", K.movedParts(before, structuredClone(before)).length === 0);
check("within 1px is the same", K.movedParts(before, { ...before, a: box(0.8, 0.6) }).length === 0);
const m = K.movedParts(before, { a: box(0, 0), b: box(0, 133), d: box(5, 5) });
check("a moved, a gone and a new part are all reported", m.length === 3 && ["b", "c", "d"].every((id) => m.some((x) => x.id === id)), m.map((x) => x.id).join(","));
check("worst first", m[0].by === Infinity && m[m.length - 1].id === "b" && Math.round(m[m.length - 1].by) === 33);

const job = { lane: "hover-calm", p: 2, generality: 4, pr: 501, sha: "abc1234def", fixes: "The hero's hover is calmer" };
function deps({ readings, versions = ["old0000", "abc1234"], own = [] }) {
  let r = 0, v = 0, o = 0;
  const log = { reads: 0, versions: 0, shots: [] };
  return {
    log,
    d: {
      version: async () => { log.versions++; return versions[Math.min(v++, versions.length - 1)]; },
      read: async () => { log.reads++; return structuredClone(readings[Math.min(r++, readings.length - 1)]); },
      shoot: async (name) => { log.shots.push(name); return `shots/${name}.png`; },
      ownCheck: own.length ? async () => own[Math.min(o++, own.length - 1)] : undefined,
      sleep: async () => {},
    },
  };
}

let t = deps({ readings: [before] });
let line = await X.liveCheck(job, t.d, before, "shots/before.png");
check("it waits for the merged commit to be live", t.log.versions >= 2);
check("nothing moved: checked, with shots and Undo", line.status === "checked" && line.shots?.after === "shots/hover-calm-after.png" && line.undo === true, JSON.stringify(line));
check("the checked line is a valid contract message", problems(line).length === 0, problems(line).join("; "));

const settling = { ...before, c: box(200, 160) };
t = deps({ readings: [settling, before, before] });
line = await X.liveCheck(job, t.d, before, null);
check("a board still settling is read again until it holds still", line.status === "checked" && t.log.reads >= 3, `reads ${t.log.reads}`);

const movedB = { ...before, b: box(0, 140) };
t = deps({ readings: [movedB] });
line = await X.liveCheck(job, t.d, before, "shots/before.png");
check("a moved part fails the check, named, with Undo", line.status === "check-failed" && /b by 40px/.test(line.line) && line.undo === true, line.line);
check("a failure is looked at twice before it is reported", t.log.reads >= 4, `reads ${t.log.reads}`);
check("the failed line is a valid contract message", problems(line).length === 0);

let first = true;
const flaky = deps({ readings: [before] });
flaky.d.read = async () => { flaky.log.reads++; if (first && flaky.log.reads <= 2) return structuredClone(movedB); first = false; return structuredClone(before); };
line = await X.liveCheck(job, flaky.d, before, null);
check("a flake that clears on the second look passes", line.status === "checked", line.line);

t = deps({ readings: [before], own: ["the hover lift is 0px"] });
line = await X.liveCheck(job, t.d, before, null);
check("the lane's own check failing fails the live check", line.status === "check-failed" && /hover lift/.test(line.line));

t = deps({ readings: [before], versions: ["old0000"] });
line = await X.liveCheck(job, t.d, before, null);
check("not live yet: merged, checked later, no false pass", line.status === "merged" && /isn't live yet/.test(line.line));

done();

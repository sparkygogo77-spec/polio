// A small process tree for the Stop test: this process, a child, and a
// grandchild the child leaves behind (its parent exits, so the grandchild is
// an orphan that a tree kill by parent id would miss). Writes every pid it
// owns to the file named in argv[2], then waits until it is killed.
//
//   node helper/jobs/testing/tree.mjs <pids.json>
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
const role = process.argv[3] ?? "root";
const sleep = () => setInterval(() => {}, 1 << 30);

if (role === "orphan") sleep();
else if (role === "middle") {
  // Starts the orphan, says its pid on stdout, then exits.
  const o = spawn(process.execPath, [import.meta.filename, out, "orphan"], { detached: true, stdio: "ignore" });
  o.unref();
  process.stdout.write(String(o.pid));
} else {
  const kid = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" });
  const mid = spawn(process.execPath, [import.meta.filename, out, "middle"], { stdio: ["ignore", "pipe", "ignore"] });
  let orphan = "";
  mid.stdout.on("data", (d) => { orphan += d; });
  mid.on("exit", () => {
    writeFileSync(out, JSON.stringify({ root: process.pid, kid: kid.pid, middle: mid.pid, orphan: Number(orphan) }));
  });
  sleep();
}

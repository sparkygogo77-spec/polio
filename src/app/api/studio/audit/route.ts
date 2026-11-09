import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/**
 * THE AUDIT SCREEN'S DOOR TO THE RUNNER (queue 75).
 *
 *   GET                       the latest receipt: AUDIT_RECEIPT, else
 *                             <cwd>/.next/audit/receipt.json. 404 in words
 *                             when there is none yet.
 *   POST { action: "run" }    runs scripts/audit-runner.mjs on AUDIT_ROOT
 *                             (default: this checkout) with AUDIT_GIT for
 *                             history, hidden, and answers the receipt.
 *   POST { action: "piece", name, text }
 *                             writes the brief the screen made into
 *                             AUDIT_BRIEFS (default ../handovers/open beside
 *                             the checkout, Pleo's layout) and answers the
 *                             path. It writes one markdown file with the
 *                             name the screen gave, nothing else, never code.
 *
 * On Vercel there is no build to read and no handovers folder: run and piece
 * answer 501 saying the audit runs on the PC, and GET serves the receipt the
 * deployment carries if one was checked in as AUDIT_RECEIPT.
 */
export const runtime = "nodejs";

const cwd = process.cwd();
const receiptAt = () => process.env.AUDIT_RECEIPT ? resolve(cwd, process.env.AUDIT_RECEIPT) : join(cwd, ".next", "audit", "receipt.json");
const onVercel = () => Boolean(process.env.VERCEL);

export async function GET() {
  const at = receiptAt();
  if (!existsSync(at)) return NextResponse.json({ ok: false, why: "No audit yet. Press Audit and optimize on the PC that builds Polio." }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, receipt: JSON.parse(readFileSync(at, "utf8")) });
  } catch (e) {
    return NextResponse.json({ ok: false, why: `The receipt could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { action?: string; name?: string; text?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  if (body.action === "run") {
    if (onVercel()) return NextResponse.json({ ok: false, why: "The audit reads a build's files, so it runs on the PC that builds Polio, not here." }, { status: 501 });
    const root = resolve(cwd, process.env.AUDIT_ROOT ?? ".");
    const out = join(cwd, ".next", "audit");
    const args = [join(cwd, "scripts", "audit-runner.mjs"), "--root", root, "--out", out];
    if (process.env.AUDIT_GIT) args.push("--git", resolve(cwd, process.env.AUDIT_GIT));
    const run = await new Promise<{ code: number | null; err: string }>((done) => {
      const p = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      p.stderr.on("data", (d) => { err += String(d); });
      const t = setTimeout(() => { p.kill(); done({ code: null, err: "took longer than two minutes" }); }, 120_000);
      p.on("close", (code) => { clearTimeout(t); done({ code, err }); });
    });
    if (run.code !== 0) return NextResponse.json({ ok: false, why: run.err.trim().split("\n").at(-1) || `the runner stopped (${run.code})` }, { status: 500 });
    return NextResponse.json({ ok: true, receipt: JSON.parse(readFileSync(join(out, "receipt.json"), "utf8")) });
  }

  if (body.action === "piece") {
    if (onVercel()) return NextResponse.json({ ok: false, why: "Briefs are written on the PC, into Pleo's handovers folder." }, { status: 501 });
    const dir = resolve(cwd, process.env.AUDIT_BRIEFS ?? join("..", "handovers", "open"));
    if (!process.env.AUDIT_BRIEFS && !existsSync(resolve(cwd, "..", "handovers"))) return NextResponse.json({ ok: false, why: `No handovers folder beside this checkout; set AUDIT_BRIEFS to where briefs go.` }, { status: 501 });
    /* Only a markdown file name, no path: the screen names it audit-piece-<date>.md. */
    const name = basename(String(body.name ?? ""));
    if (!/^audit-piece-[\w.-]+\.md$/.test(name) || typeof body.text !== "string" || !body.text.trim()) return NextResponse.json({ ok: false, why: "A brief needs a name like audit-piece-<date>.md and its text." }, { status: 400 });
    mkdirSync(dir, { recursive: true });
    const at = join(dir, name);
    writeFileSync(at, body.text);
    return NextResponse.json({ ok: true, path: at });
  }

  return NextResponse.json({ ok: false, why: "action must be run or piece" }, { status: 400 });
}

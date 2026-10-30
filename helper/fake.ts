/**
 * A fake runner for the dock and the tests to build against before the real
 * one exists. It plays one scripted request: a plan of one lane, then that
 * lane through all 8 steps, stopping on a question, a pause by J and an
 * only-you approval, with merge lines and the spend at the end.
 *
 * The script holds J's controls in their place. `fakeRunner()` waits for
 * the dock to send each one (or, with `auto`, plays them itself), so a dock
 * can be clicked through it the way it will drive the real runner.
 */
import { CONTRACT_VERSION as v, STEPS, type Control, type Lane, type Message, type State } from "./contract.ts";

const requestId = "req-fake-1";
const lane = "export-gallery";

const row = (stepsDone: number, state: State, note: string, etaSeconds: number | null): Lane => ({
  v, kind: "lane", requestId, lane, where: "cloud",
  stepsDone, stepNow: STEPS[stepsDone] ?? null, etaSeconds, state, note,
});
const j = (d: Control["do"], text?: string): Control => ({ v, kind: "control", lane, do: d, by: "j", ...(text ? { text } : {}) });

/** The whole conversation, both ways, in order. */
export function fakeScript(): Message[] {
  return [
    { v, kind: "request", id: requestId, text: "Add a gallery page to the export", target: "builder-ui",
      chips: [{ kind: "part", id: "h1#hero-title", name: "Hero heading" }, { kind: "page", id: "home" }, { kind: "shot", ref: "shot-1440-1" }],
      action: null, how: "plan-first" },
    { v, kind: "plan", requestId, newControl: true,
      lanes: [{ lane, where: "cloud", files: ["src/features/export/gallery.ts"], test: "tests/export-gallery.mjs", size: "medium", stackedOn: null }] },
    row(0, "working", "reading the export steps", 1500),
    row(0, "question", "Gallery page: one per component, or one long page?", 1500),
    j("answer", "One long page"),
    row(1, "working", "writing the red test", 1300),
    row(2, "working", "building the gallery page", 1100),
    j("pause"),
    row(2, "paused", "paused by you", null),
    j("resume"),
    row(2, "working", "building the gallery page", 1000),
    row(3, "working", "running the closest tests", 700),
    row(4, "working", "pushing claude/export-gallery", 500),
    row(5, "working", "waiting for CI", 400),
    { v, kind: "merge", lane, p: 2, generality: 5, status: "waiting-ci", pr: 412, line: "Export gets a gallery page", shots: null, undo: false },
    row(6, "only-you", "adds a new control: Gallery in the Export dialog", 300),
    j("approve"),
    row(6, "working", "merging on green", 250),
    { v, kind: "merge", lane, p: 2, generality: 5, status: "merged", pr: 412, line: "Export gets a gallery page", shots: null, undo: true },
    row(7, "working", "live check on new sites", 120),
    { v, kind: "merge", lane, p: 2, generality: 5, status: "checked", pr: 412, line: "Export gets a gallery page",
      shots: { before: "shots/export-gallery-before.png", after: "shots/export-gallery-after.png" }, undo: true },
    row(8, "done", "live and checked", 0),
    // A cloud lane's tokens can't be read (v2): null, "on your plan, not measured".
    { v, kind: "spend", requestId, tokens: { in: 0, out: 0 },
      lanes: [{ lane, pays: "cloud", tokens: null, seconds: 1480 }],
      plan: { used: 0.41, resetsAt: 1793030400, status: "allowed", window: "five_hour" } },
  ];
}

export type FakeRunner = {
  /** What the runner says, in order; ends after the spend line. */
  messages: AsyncIterable<Message>;
  /** What the dock says. A control the script is waiting on lets it go on. */
  send(c: Control): void;
};

/**
 * `delayMs` spaces the runner's messages out for a dock to watch; `auto`
 * plays J's controls itself, for a test that only wants the stream.
 */
export function fakeRunner({ delayMs = 0, auto = false }: { delayMs?: number; auto?: boolean } = {}): FakeRunner {
  const sent: Control[] = [];
  let wake: (() => void) | null = null;
  const send = (c: Control) => { sent.push(c); wake?.(); };
  const arrived = async (want: Control) => {
    for (;;) {
      const i = sent.findIndex((c) => c.do === want.do && c.lane === want.lane);
      if (i >= 0) return void sent.splice(i, 1);
      await new Promise<void>((r) => { wake = r; });
      wake = null;
    }
  };
  async function* play(): AsyncGenerator<Message> {
    for (const m of fakeScript()) {
      if (m.kind === "request") continue; // the dock sent it
      if (m.kind === "control") { if (!auto) await arrived(m); continue; }
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      yield m;
    }
  }
  return { messages: play(), send };
}
